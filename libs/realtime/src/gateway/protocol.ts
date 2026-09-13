import type { PresenceStatus } from '../contracts/presence.contract';

// Wire shapes for the `/realtime` WebSocket endpoint - kept framework-agnostic (no `ws` or DOM
// `WebSocket` types) so both the Node-side gateway here and the browser-side client in
// `@inithium/api-client` can `import type` these without pulling in the other side's runtime.
export type SettablePresenceStatus = Exclude<PresenceStatus, 'offline'>;

export interface RealtimeSubscribeMessage {
  readonly type: 'subscribe';
  readonly channel: string;
}

export interface RealtimeUnsubscribeMessage {
  readonly type: 'unsubscribe';
  readonly channel: string;
}

// 'offline' is deliberately excluded - a client can never declare itself offline, only the
// gateway can (inferred from its last connection closing, see connectionRegistry.ts).
export interface RealtimePresenceSetMessage {
  readonly type: 'presence:set';
  readonly status: SettablePresenceStatus;
}

export type RealtimeClientMessage =
  | RealtimeSubscribeMessage
  | RealtimeUnsubscribeMessage
  | RealtimePresenceSetMessage;

export interface RealtimeConnectedMessage {
  readonly type: 'connected';
  readonly userId: string;
}

export interface RealtimeEventMessage<TPayload = unknown> {
  readonly type: 'event';
  readonly channel: string;
  readonly event: string;
  readonly payload: TPayload;
}

export interface RealtimeErrorMessage {
  readonly type: 'error';
  readonly message: string;
}

export type RealtimeServerMessage = RealtimeConnectedMessage | RealtimeEventMessage | RealtimeErrorMessage;
