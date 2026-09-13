import type { RealtimeClientMessage, RealtimeServerMessage } from '@inithium/realtime';

export type RealtimeConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed';

type ChannelListener = (event: string, payload: unknown) => void;

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

// Module-level pub/sub - the same recipe as @inithium/ui's alert/dialog/drawer stores and
// apps/web's authStore. A WebSocket connection is exactly the singleton, non-React resource
// that recipe targets: any component (a presence dot, a future friends list, a future game
// board) can call subscribeToRealtimeChannel(...) without sitting inside a Provider, and there
// is exactly one physical socket regardless of how many components subscribe through it.
let socket: WebSocket | null = null;
let status: RealtimeConnectionStatus = 'idle';
let currentToken: string | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const statusListeners = new Set<() => void>();
const channelListeners = new Map<string, Set<ChannelListener>>();

const emitStatus = () => statusListeners.forEach((listener) => listener());

const resolveSocketUrl = (token: string): string => {
  const baseUrl = import.meta.env?.['VITE_API_URL'] ?? 'http://localhost:3000';
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/realtime';
  url.searchParams.set('token', token);
  return url.toString();
};

// A WebSocket's own .close() only *initiates* the closing handshake - it does not stop
// onmessage from firing for anything already in flight, and the handshake itself is
// asynchronous. Without clearing handlers first, a socket being replaced (a reconnect, a
// logout-then-login, or - in dev only - React StrictMode's mount->cleanup->mount briefly
// opening a second connection) can still deliver a message via its stale onmessage after the
// "current" socket has already moved on to a new one, double-invoking every channel listener for
// that one event. Nulling every handler before closing makes a discarded socket permanently
// inert, regardless of how long its actual network-level teardown takes.
const teardownSocket = (ws: WebSocket | null): void => {
  if (!ws) return;
  ws.onopen = null;
  ws.onmessage = null;
  ws.onclose = null;
  ws.onerror = null;
  ws.close();
};

const send = (message: RealtimeClientMessage): void => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const resubscribeAll = (): void => {
  channelListeners.forEach((_listeners, channel) => send({ type: 'subscribe', channel }));
};

const scheduleReconnect = (): void => {
  if (!currentToken || reconnectTimer) return;
  const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt, RECONNECT_MAX_DELAY_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempt += 1;
    open();
  }, delay);
};

const handleMessage = (raw: string): void => {
  let message: RealtimeServerMessage;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (message.type !== 'event') return;
  channelListeners.get(message.channel)?.forEach((listener) => listener(message.event, message.payload));
};

const open = (): void => {
  if (!currentToken) return;
  status = 'connecting';
  emitStatus();

  const ws = new WebSocket(resolveSocketUrl(currentToken));
  socket = ws;

  ws.onopen = () => {
    reconnectAttempt = 0;
    status = 'open';
    emitStatus();
    resubscribeAll();
  };
  ws.onmessage = (event) => handleMessage(event.data);
  ws.onclose = () => {
    status = 'closed';
    emitStatus();
    socket = null;
    scheduleReconnect();
  };
  ws.onerror = () => {
    // onclose always fires immediately after onerror for a socket that failed to connect -
    // reconnection is handled there; this just avoids an unhandled-error console entry.
    ws.close();
  };
};

// Called once, from RealtimeConnectionBoundary, whenever the current access token changes.
export const connectRealtimeClient = (token: string): void => {
  if (currentToken === token && (status === 'open' || status === 'connecting')) return;
  currentToken = token;
  reconnectAttempt = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  teardownSocket(socket);
  socket = null;
  open();
};

export const disconnectRealtimeClient = (): void => {
  currentToken = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  teardownSocket(socket);
  socket = null;
  status = 'idle';
  emitStatus();
};

export const getRealtimeConnectionStatus = (): RealtimeConnectionStatus => status;

export const subscribeToRealtimeStatus = (listener: () => void): (() => void) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

// Sends {type:'subscribe'} the moment a channel gets its first listener (and on every
// reconnect via resubscribeAll), and {type:'unsubscribe'} once its last listener unsubscribes -
// multiple callers watching the same channel (e.g. two components both showing the same user's
// presence) share one underlying wire subscription.
export const subscribeToRealtimeChannel = (channel: string, listener: ChannelListener): (() => void) => {
  const existing = channelListeners.get(channel);
  if (existing) {
    existing.add(listener);
  } else {
    channelListeners.set(channel, new Set([listener]));
    send({ type: 'subscribe', channel });
  }

  return () => {
    const listeners = channelListeners.get(channel);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) {
      channelListeners.delete(channel);
      send({ type: 'unsubscribe', channel });
    }
  };
};

export const setPresenceStatus = (nextStatus: 'online' | 'busy' | 'away'): void => {
  send({ type: 'presence:set', status: nextStatus });
};
