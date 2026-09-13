import { useEffect } from 'react';
import { connectRealtimeClient, disconnectRealtimeClient } from '@inithium/api-client';
import { useAuthToken } from './useCurrentUser';

// Mounted once in app.tsx alongside AlertContainer/DialogContainer/DrawerContainer - opens the
// realtime WebSocket as soon as a token exists (on login, or one already in localStorage on
// page load) and closes it on logout, without any other component needing to know a connection
// is involved at all. Lives here (not in @inithium/api-client) because it needs the app's own
// reactive `useAuthToken()`, the same layering already used by useCurrentUser.ts.
export const RealtimeConnectionBoundary = () => {
  const token = useAuthToken();

  useEffect(() => {
    if (!token) {
      disconnectRealtimeClient();
      return undefined;
    }
    connectRealtimeClient(token);
    return () => disconnectRealtimeClient();
  }, [token]);

  return null;
};
