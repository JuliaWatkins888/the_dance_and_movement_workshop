import { RealtimeProvider } from '../contracts/realtime-provider.contract';
import { memoryProvider } from './memory/memory.provider';

export const activeProvider: RealtimeProvider = memoryProvider;
