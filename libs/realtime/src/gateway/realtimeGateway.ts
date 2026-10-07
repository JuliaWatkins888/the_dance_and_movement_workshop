import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { authenticateAccessToken } from '@inithium/auth';
import { PRESENCE_STATUSES } from '../contracts/presence.contract';
import { presenceChannel, setPresence, clearPresence } from '../presence/presence.service';
import { getActiveRealtimeProvider } from '../providers/provider-registry';
import { getConnectionCount, registerConnection, removeConnection } from './connectionRegistry';
import type { RealtimeClientMessage, RealtimeServerMessage, SettablePresenceStatus } from './protocol';

const REALTIME_PATH = '/realtime';
const HEARTBEAT_INTERVAL_MS = 30000;
// Client messages are tiny JSON commands - ws's own default (100 MiB) would let one socket pin
// that much server memory.
const MAX_MESSAGE_BYTES = 16 * 1024;

// The browser offers [AUTH_SUBPROTOCOL, <access token>] as WebSocket subprotocols - the one
// header a browser can set on an upgrade request - so the token never lands in a URL, where
// proxies and access logs would record it.
export const AUTH_SUBPROTOCOL = 'inithium.bearer';

type TrackedSocket = WebSocket & { isAlive?: boolean };

const send = (socket: WebSocket, message: RealtimeServerMessage): void => {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
};

const isSettableStatus = (value: unknown): value is SettablePresenceStatus =>
  typeof value === 'string' && (PRESENCE_STATUSES as readonly string[]).includes(value) && value !== 'offline';

const readSubprotocolToken = (request: IncomingMessage): string | null => {
  const offered = (request.headers['sec-websocket-protocol'] ?? '').split(',').map((value) => value.trim());
  const index = offered.indexOf(AUTH_SUBPROTOCOL);
  return index >= 0 && offered[index + 1] ? offered[index + 1] : null;
};

// Every authenticated user has a private `user:<id>` push channel (notifications, which can carry
// other families' contact messages) - nobody may subscribe to anyone else's. Presence
// (online/away) is the only cross-user channel core exposes.
const defaultAuthorizeChannel = (channel: string, userId: string): boolean =>
  channel === `user:${userId}` || channel.startsWith('presence:');

const rejectUpgrade = (socket: Duplex, status: string): void => {
  socket.write(`HTTP/1.1 ${status}\r\n\r\n`);
  socket.destroy();
};

// One per authenticated socket: auto-subscribes it to its own private `user:<id>` push channel
// and its own `presence:<id>` channel, dispatches client-requested subscribe/unsubscribe for
// any other channel authorizeChannel allows, and tears every subscription down together when
// the socket closes.
const bindConnection = (
  socket: WebSocket,
  userId: string,
  authorizeChannel: (channel: string, userId: string) => boolean,
): void => {
  const provider = getActiveRealtimeProvider();
  const unsubscribers = new Map<string, () => void>();

  const subscribeChannel = (channel: string) => {
    if (unsubscribers.has(channel)) return;
    const unsubscribe = provider.subscribe(channel, (message) => {
      send(socket, { type: 'event', channel: message.channel, event: message.event, payload: message.payload });
    });
    unsubscribers.set(channel, unsubscribe);
  };

  const unsubscribeChannel = (channel: string) => {
    unsubscribers.get(channel)?.();
    unsubscribers.delete(channel);
  };

  // These two are never reachable via an incoming 'subscribe' message - they're populated here,
  // unconditionally, the moment the connection authenticates.
  subscribeChannel(`user:${userId}`);
  subscribeChannel(presenceChannel(userId));

  registerConnection(userId, socket);
  if (getConnectionCount(userId) === 1) {
    void setPresence(userId, 'online');
  }

  send(socket, { type: 'connected', userId });

  socket.on('message', (raw) => {
    let message: RealtimeClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(socket, { type: 'error', message: 'Malformed message: expected JSON' });
      return;
    }

    switch (message?.type) {
      case 'subscribe':
        if (typeof message.channel !== 'string' || !authorizeChannel(message.channel, userId)) {
          send(socket, { type: 'error', message: 'Not authorized to subscribe to that channel' });
          break;
        }
        subscribeChannel(message.channel);
        break;
      case 'unsubscribe':
        if (typeof message.channel === 'string') unsubscribeChannel(message.channel);
        break;
      case 'presence:set':
        if (isSettableStatus(message.status)) {
          void setPresence(userId, message.status);
        } else {
          send(socket, { type: 'error', message: 'Invalid presence status' });
        }
        break;
      default:
        send(socket, { type: 'error', message: 'Unknown message type' });
    }
  });

  socket.on('close', () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers.clear();
    const wasLastConnection = removeConnection(userId, socket);
    if (wasLastConnection) {
      // Known limitation, accepted for v1: a page refresh briefly drops to zero connections and
      // this fires immediately, so a fast reconnect can produce a visible online -> offline ->
      // online flicker. A debounce here (delay clearPresence, cancel it if a new connection for
      // the same userId registers within a short window) is a natural follow-up, deliberately
      // left out to keep this first pass's bookkeeping simple.
      void clearPresence(userId);
    }
  });
};

export interface AttachRealtimeGatewayOptions {
  // Replaces defaultAuthorizeChannel - a plugin adding its own shared channel (a game match, a
  // chat room) must still keep other users' `user:<id>` channels off-limits.
  readonly authorizeChannel?: (channel: string, userId: string) => boolean;
  // Browser origins allowed to open a socket (the web app's own origin). Empty allows any origin.
  readonly allowedOrigins?: readonly string[];
}

// Attaches a `/realtime` WS upgrade handler to the same underlying `http.Server` Express's own
// `app.listen(...)` already creates - see apps/api/src/main.ts for why that server has to be
// captured in a variable rather than left implicit. Authenticates with the same
// `authenticateAccessToken` the HTTP routes use, so a revoked token is refused here too.
export const attachRealtimeGateway = (server: HttpServer, options: AttachRealtimeGatewayOptions = {}): void => {
  const authorizeChannel = options.authorizeChannel ?? defaultAuthorizeChannel;
  const allowedOrigins = options.allowedOrigins ?? [];
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
    handleProtocols: (protocols) => (protocols.has(AUTH_SUBPROTOCOL) ? AUTH_SUBPROTOCOL : false),
  });

  // Raw `ws` has no built-in heartbeat (unlike socket.io) - this is the accepted tradeoff of
  // that choice. A socket that stops responding to ping (dead network, crashed tab) gets
  // terminated so its connection-registry entry - and therefore presence - doesn't linger
  // forever.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((socket) => {
      const tracked = socket as TrackedSocket;
      if (tracked.isAlive === false) {
        tracked.terminate();
        return;
      }
      tracked.isAlive = false;
      tracked.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);
  wss.on('close', () => clearInterval(heartbeat));

  server.on('upgrade', async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? '', 'http://localhost');
    if (url.pathname !== REALTIME_PATH) return; // Not ours - leave it for any other upgrade handler.

    const origin = request.headers.origin;
    if (allowedOrigins.length > 0 && (!origin || !allowedOrigins.includes(origin))) {
      rejectUpgrade(socket, '403 Forbidden');
      return;
    }

    const token = readSubprotocolToken(request);
    const payload = token ? await authenticateAccessToken(token).catch(() => null) : null;
    if (!payload) {
      rejectUpgrade(socket, '401 Unauthorized');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const tracked = ws as TrackedSocket;
      tracked.isAlive = true;
      tracked.on('pong', () => {
        tracked.isAlive = true;
      });
      bindConnection(ws, payload.sub, authorizeChannel);
    });
  });

  console.log(`🔌 Realtime gateway listening at ${REALTIME_PATH}`);
};
