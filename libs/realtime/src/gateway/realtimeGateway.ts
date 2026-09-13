import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyAccessToken } from '@inithium/auth';
import { PRESENCE_STATUSES } from '../contracts/presence.contract';
import { presenceChannel, setPresence, clearPresence } from '../presence/presence.service';
import { getActiveRealtimeProvider } from '../providers/provider-registry';
import { getConnectionCount, registerConnection, removeConnection } from './connectionRegistry';
import type { RealtimeClientMessage, RealtimeServerMessage, SettablePresenceStatus } from './protocol';

const REALTIME_PATH = '/realtime';
const HEARTBEAT_INTERVAL_MS = 30000;

type TrackedSocket = WebSocket & { isAlive?: boolean };

const send = (socket: WebSocket, message: RealtimeServerMessage): void => {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
};

const isSettableStatus = (value: unknown): value is SettablePresenceStatus =>
  typeof value === 'string' && (PRESENCE_STATUSES as readonly string[]).includes(value) && value !== 'offline';

// One per authenticated socket: auto-subscribes it to its own private `user:<id>` push channel
// and its own `presence:<id>` channel, dispatches client-requested subscribe/unsubscribe for
// any other channel (e.g. a future friend's `presence:<friendId>`), and tears every subscription
// down together when the socket closes.
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

    switch (message.type) {
      case 'subscribe':
        if (!authorizeChannel(message.channel, userId)) {
          send(socket, { type: 'error', message: `Not authorized to subscribe to "${message.channel}"` });
          break;
        }
        subscribeChannel(message.channel);
        break;
      case 'unsubscribe':
        unsubscribeChannel(message.channel);
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
  // Escape hatch for a future plugin/core feature needing to reject a subscribe request per
  // channel (e.g. a "friends only" presence channel) - permissive by default since core ships
  // no such restriction.
  readonly authorizeChannel?: (channel: string, userId: string) => boolean;
}

// Attaches a `/realtime` WS upgrade handler to the same underlying `http.Server` Express's own
// `app.listen(...)` already creates - see apps/api/src/main.ts for why that server has to be
// captured in a variable rather than left implicit. Authenticates via a `token` query param
// (browsers cannot set custom headers on a WebSocket upgrade request) using `@inithium/auth`'s
// `verifyAccessToken`, which has zero Express coupling and works identically here.
export const attachRealtimeGateway = (server: HttpServer, options: AttachRealtimeGatewayOptions = {}): void => {
  const authorizeChannel = options.authorizeChannel ?? (() => true);
  const wss = new WebSocketServer({ noServer: true });

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

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url ?? '', 'http://localhost');
    if (url.pathname !== REALTIME_PATH) return; // Not ours - leave it for any other upgrade handler.

    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let userId: string;
    try {
      userId = verifyAccessToken(token).sub;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const tracked = ws as TrackedSocket;
      tracked.isAlive = true;
      tracked.on('pong', () => {
        tracked.isAlive = true;
      });
      bindConnection(ws, userId, authorizeChannel);
    });
  });

  console.log(`🔌 Realtime gateway listening at ${REALTIME_PATH}`);
};
