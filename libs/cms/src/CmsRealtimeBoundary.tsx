import { useEffect } from 'react';
import { connectRealtimeClient, disconnectRealtimeClient } from '@inithium/api-client';

export interface CmsRealtimeBoundaryProps {
  readonly token: string | null;
}

// Mirrors apps/web's RealtimeConnectionBoundary - RootRouter never mounts App while on /cms, so
// the CMS navbar's notification center needs its own live socket. Token arrives as a prop (not a
// hook) to match CmsRoot's existing currentUser layering: libs/cms has no knowledge of apps/web's
// authStore.
export const CmsRealtimeBoundary = ({ token }: CmsRealtimeBoundaryProps) => {
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
