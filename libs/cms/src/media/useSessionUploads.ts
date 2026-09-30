import { useCallback, useRef } from 'react';
import { useDeleteAssetMutation } from '@inithium/api-client';

// Tracks assets uploaded during one editing session (a dialog, a settings row) so any that never
// end up saved - a file re-picked before Save, or the whole edit cancelled - are removed from R2
// instead of lingering as orphans. Assets that were saved are released server-side by the owning
// record's own route when later replaced, so they're never touched here.
export const useSessionUploads = () => {
  const [deleteAsset] = useDeleteAssetMutation();
  const uploadedIds = useRef<string[]>([]);

  const track = useCallback((assetId: string) => {
    uploadedIds.current = [...uploadedIds.current, assetId];
  }, []);

  // Best-effort: a failed discard only leaves an orphan behind, never breaks the edit itself.
  const discardUnsaved = useCallback(
    (...savedAssetIds: (string | undefined)[]) => {
      const unsaved = uploadedIds.current.filter((id) => !savedAssetIds.includes(id));
      uploadedIds.current = [];
      unsaved.forEach((id) => void deleteAsset(id).unwrap().catch(() => undefined));
    },
    [deleteAsset],
  );

  return { track, discardUnsaved };
};
