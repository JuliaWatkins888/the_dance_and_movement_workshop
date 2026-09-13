export interface RealtimeConfig {
  [key: string]: unknown;
}

export interface RealtimeMessage<TPayload = unknown> {
  readonly channel: string;
  readonly event: string;
  readonly payload: TPayload;
}

export type RealtimeMessageHandler = (message: RealtimeMessage) => void;

// Mirrors DbProvider/AuthProvider's shape. Channels are plain strings, not a typed enum - core
// only ever names `user:<id>` and `presence:<id>` channels, but a future plugin (a game, a chat
// room) needs to mint its own channel names without this contract knowing about them in advance.
export interface RealtimeProvider {
  name: string;
  connect: (config: RealtimeConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  publish: (channel: string, event: string, payload: unknown) => Promise<void>;
  subscribe: (channel: string, handler: RealtimeMessageHandler) => () => void;
}
