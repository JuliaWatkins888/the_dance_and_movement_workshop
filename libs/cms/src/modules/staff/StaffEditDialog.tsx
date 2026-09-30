import { useRef, useState } from 'react';
import { Box, Button, Input, MediaField, Text, Textarea } from '@inithium/ui';
import type { MediaFieldHandle, UploadedAsset } from '@inithium/ui';
import {
  useCreateStaffMemberMutation,
  useUpdateStaffMemberMutation,
  useUploadAssetMutation,
} from '@inithium/api-client';
import type { StaffMemberDto, StaffUserCandidate } from '@inithium/api-client';
import type { StaffPhotoSourceType } from '@inithium/db';
import { useSessionUploads } from '../../media/useSessionUploads';
import { LinkedUserField } from './UserPicker';

export interface StaffEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialStaff?: StaffMemberDto;
  readonly onDone: () => void;
}

// A staff photo is a fixed-shape portrait card image (see StaffPage.tsx's aspect-[3/4] cards),
// unlike gallery's masonry grid - a forced crop is exactly right here, which is why this uses
// @inithium/ui's MediaField rather than GalleryImageEditDialog's uncropped upload.
const STAFF_PHOTO_ASPECT_RATIO = 3 / 4;

export const StaffEditDialog = ({ mode, initialStaff, onDone }: StaffEditDialogProps) => {
  const [createStaffMember, { isLoading: isCreating }] = useCreateStaffMemberMutation();
  const [updateStaffMember, { isLoading: isUpdating }] = useUpdateStaffMemberMutation();
  const [uploadAsset] = useUploadAssetMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [selectedUser, setSelectedUser] = useState<StaffUserCandidate | null>(null);

  const [title, setTitle] = useState(initialStaff?.title ?? '');
  const [bio, setBio] = useState(initialStaff?.bio ?? '');
  const [order, setOrder] = useState(String(initialStaff?.order ?? 0));

  const [photoUrl, setPhotoUrl] = useState(initialStaff?.photoUrl ?? '');
  // Only reassigned by handlePhotoAssetChange below (itself only invoked when MediaField reports
  // a genuine URL-commit or a completed upload) - never recomputed from photoUrl at submit time,
  // so an untouched photo field on an edit keeps whatever sourceType/assetId it
  // already had instead of being silently reclassified as 'external'.
  const [photoSourceType, setPhotoSourceType] = useState<StaffPhotoSourceType | undefined>(initialStaff?.photoSourceType);
  const [photoAssetId, setPhotoAssetId] = useState(initialStaff?.photoAssetId);
  const mediaFieldRef = useRef<MediaFieldHandle>(null);
  const sessionUploads = useSessionUploads();

  const handlePhotoAssetChange = (asset: UploadedAsset | null) => {
    if (asset) {
      setPhotoSourceType('cloud');
      setPhotoAssetId(asset.assetId);
    } else {
      // A URL was committed via MediaField's own URL tab - a deliberate switch to an
      // externally-hosted image.
      setPhotoSourceType('external');
      setPhotoAssetId(undefined);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (mode === 'create' && !selectedUser) {
      setSubmitError('Choose a user to link before saving.');
      return;
    }

    try {
      // Resolves a still-pending crop (a file was selected/dragged into position but never
      // separately "confirmed") into a real R2 upload right here. Returns null when there's
      // nothing pending, in which case whatever photoUrl/photoSourceType is already in state is
      // final. Throws on upload failure, which the catch below reports.
      const uploaded = await mediaFieldRef.current?.resolvePendingUpload();
      if (uploaded) sessionUploads.track(uploaded.assetId);
      const finalPhotoUrl = uploaded?.url ?? photoUrl;
      const finalPhotoSourceType = uploaded ? 'cloud' : photoSourceType;
      const finalPhotoAssetId = uploaded ? uploaded.assetId : photoAssetId;

      const parsedOrder = Number(order);
      const commonFields = {
        title,
        bio: bio || undefined,
        order: Number.isFinite(parsedOrder) ? parsedOrder : 0,
        photoUrl: finalPhotoUrl || undefined,
        photoSourceType: finalPhotoUrl ? finalPhotoSourceType : undefined,
        photoAssetId: finalPhotoSourceType === 'cloud' ? finalPhotoAssetId : undefined,
      };

      if (mode === 'create' && selectedUser) {
        await createStaffMember({ userId: selectedUser.id, ...commonFields }).unwrap();
      } else if (initialStaff) {
        await updateStaffMember({ id: initialStaff.id, userId: selectedUser?.id, ...commonFields }).unwrap();
      }
      sessionUploads.discardUnsaved(commonFields.photoAssetId);
      onDone();
    } catch {
      setSubmitError('Could not save this staff member. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <LinkedUserField
        initialLabel={initialStaff ? `${initialStaff.firstName} ${initialStaff.lastName ?? ''}`.trim() : undefined}
        initialEmail={initialStaff?.email}
        onSelect={setSelectedUser}
      />

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Title" required value={title} onChange={(event) => setTitle(event.target.value)} className="flex-1" />
        <Input
          label="Display Order"
          type="number"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          className="flex-1"
        />
      </Box>

      <Textarea
        label="Bio"
        helperText="Shown when a visitor hovers this staff member's card."
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        rows={3}
      />

      <MediaField
        ref={mediaFieldRef}
        label="Photo"
        value={photoUrl}
        onValueChange={setPhotoUrl}
        onAssetChange={handlePhotoAssetChange}
        onUpload={async (file) => await uploadAsset({ file, purpose: 'staff' }).unwrap()}
        defaultMode={initialStaff?.photoSourceType === 'external' ? 'url' : 'upload'}
        aspectRatio={STAFF_PHOTO_ASPECT_RATIO}
      />

      {submitError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button
          variant={{ kind: 'ghost', color: 'surface' }}
          onClick={() => {
            sessionUploads.discardUnsaved();
            onDone();
          }}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
