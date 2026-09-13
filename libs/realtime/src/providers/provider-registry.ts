import { RealtimeProvider } from '../contracts/realtime-provider.contract';
import { activeProvider as defaultProvider } from './active-provider';

// Deliberate small deviation from libs/db/libs/auth's exact recipe (a mutable `let
// activeProvider` living directly in index.ts): unlike DbProvider/AuthProvider, this package has
// its own internal consumers of the active provider - the presence service and the WS gateway
// both need to publish/subscribe through whichever provider is currently active, not just
// index.ts's own exported functions. Putting the mutable reference in index.ts would force
// presence.service.ts/realtimeGateway.ts to import index.ts, which imports them back - a cycle.
// This module is the shared point both sides import instead; index.ts's own
// setRealtimeProvider/getRealtimeProvider are thin pass-throughs to it, so the external contract
// is identical to the db/auth pattern.
let current: RealtimeProvider = defaultProvider;

export const setActiveRealtimeProvider = (provider: RealtimeProvider): void => {
  current = provider;
};

export const getActiveRealtimeProvider = (): RealtimeProvider => current;
