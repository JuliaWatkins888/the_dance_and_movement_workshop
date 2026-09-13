import { RealtimeConfig, RealtimeMessage, RealtimeMessageHandler, RealtimeProvider } from './contracts/realtime-provider.contract';
import { getActiveRealtimeProvider, setActiveRealtimeProvider } from './providers/provider-registry';

export const setRealtimeProvider = (provider: RealtimeProvider): void => setActiveRealtimeProvider(provider);

export const getRealtimeProvider = (): RealtimeProvider => getActiveRealtimeProvider();

export const connectRealtime = async (config: RealtimeConfig = {}): Promise<void> => {
  const provider = getActiveRealtimeProvider();
  await provider.connect(config);
  console.log(`Successfully connected using [${provider.name}] Realtime Provider`);
};

export const disconnectRealtime = async (): Promise<void> => {
  await getActiveRealtimeProvider().disconnect();
};

export const userChannel = (userId: string): string => `user:${userId}`;

// The contract's crux: any core route/service or future plugin - a friends system pushing
// "friend request received", a multiplayer game pushing a move - calls this to push one event
// to one specific user across every device/tab they currently have open. The caller never needs
// to know how many connections that is, which process holds them, or that a WebSocket is even
// involved; that's entirely the active RealtimeProvider's and the gateway's job.
export const publishToUser = (userId: string, event: string, payload: unknown): Promise<void> =>
  getActiveRealtimeProvider().publish(userChannel(userId), event, payload);

// The lower-level primitive publishToUser is built on - for a future plugin that needs a
// non-per-user channel (a game match, a chat room) rather than a specific user's own channel.
export const publishToChannel = (channel: string, event: string, payload: unknown): Promise<void> =>
  getActiveRealtimeProvider().publish(channel, event, payload);

// Server-side subscription primitive - for a future plugin's own backend service that needs to
// react to events published on a channel (e.g. a moderation service watching every game's
// channel), as opposed to a browser client subscribing over the WS gateway.
export const subscribeToChannel = (channel: string, handler: RealtimeMessageHandler): (() => void) =>
  getActiveRealtimeProvider().subscribe(channel, handler);

export type { RealtimeProvider, RealtimeConfig, RealtimeMessage, RealtimeMessageHandler } from './contracts/realtime-provider.contract';
export { memoryProvider } from './providers/memory/memory.provider';

export { PRESENCE_STATUSES } from './contracts/presence.contract';
export type { PresenceStatus, PresenceRecord } from './contracts/presence.contract';
export { getPresence, setPresence, presenceChannel } from './presence/presence.service';

export { getConnectionCount, getConnectedUserIds } from './gateway/connectionRegistry';
export { attachRealtimeGateway } from './gateway/realtimeGateway';
export type { AttachRealtimeGatewayOptions } from './gateway/realtimeGateway';
export type {
  RealtimeClientMessage,
  RealtimeServerMessage,
  RealtimeSubscribeMessage,
  RealtimeUnsubscribeMessage,
  RealtimePresenceSetMessage,
  RealtimeConnectedMessage,
  RealtimeEventMessage,
  RealtimeErrorMessage,
  SettablePresenceStatus,
} from './gateway/protocol';
