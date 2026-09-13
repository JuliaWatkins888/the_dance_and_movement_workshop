import { EventEmitter } from 'node:events';
import type { RealtimeConfig, RealtimeMessageHandler, RealtimeProvider } from '../../contracts/realtime-provider.contract';

// Raised because this emitter fans out across every subscribed channel for every connected
// user - a genuine listener leak still surfaces via the process's own memory growth, this just
// avoids a false-positive warning under normal multi-connection load.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

// Core's zero-infra default. Limitation: cannot fan events out across more than one API
// process - presence and pub/sub both become process-local the moment `apps/api` is
// horizontally scaled. A future `realtime-redis` plugin swaps only providers/active-provider.ts
// to lift that limitation; nothing else in this package needs to change.
export const memoryProvider: RealtimeProvider = {
  name: 'In-Memory (single-process)',
  connect: async (_config: RealtimeConfig) => {
    // Nothing to connect to - the EventEmitter above is already live for this process's
    // lifetime. Present for contract symmetry with any future provider whose connect() does
    // real I/O (e.g. opening a Redis connection).
  },
  disconnect: async () => {
    emitter.removeAllListeners();
  },
  publish: async (channel, event, payload) => {
    emitter.emit(channel, { channel, event, payload });
  },
  subscribe: (channel, handler: RealtimeMessageHandler) => {
    emitter.on(channel, handler);
    return () => emitter.off(channel, handler);
  },
};
