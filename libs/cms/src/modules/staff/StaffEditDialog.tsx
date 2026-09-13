import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, Text, Textarea } from '@inithium/ui';
import {
  useCreateStaffMemberMutation,
  useUpdateStaffMemberMutation,
  useUploadStaffPhotoLocalMutation,
} from '@inithium/api-client';
import type { StaffMemberDto, StaffUserCandidate } from '@inithium/api-client';
import type { StaffPhotoSourceType } from '@inithium/db';
import { LinkedUserField } from './UserPicker';

export interface StaffEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialStaff?: StaffMemberDto;
  readonly onDone: () => void;
}

// Deliberately NOT @inithium/ui's MediaField here - MediaField only exists in this workspace once
// the storage plugin is installed (it's shipped BY that plugin, not a core libs/ui component -
// see MediaField.tsx's own comment), so a plain, storage-less workspace can't import it at all.
// This reimplements just the URL/Upload tab shell MediaField uses (same Tabs/Input/Button
// primitives) without a crop step - StaffEditDialog.storage.tsx is the version that swaps this
// for MediaField (with cropping, since a staff photo is a fixed-aspect portrait card unlike a
// gallery image) once storage is installed.
const PhotoSourceField = ({
  photoUrl,
  onUrlCommit,
  onLocalUploaded,
}: {
  readonly photoUrl: string;
  readonly onUrlCommit: (url: string) => void;
  readonly onLocalUploaded: (result: { url: string; storageKey: string }) => void;
}) => {
  const [activeTab, setActiveTab] = useState('url');
  const [uploadLocal, { isLoading: isUploading }] = useUploadStaffPhotoLocalMutation();
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError(undefined);
    try {
      const result = await uploadLocal({ file }).unwrap();
      onLocalUploaded(result);
    } catch {
      setUploadError('Upload failed. Please try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Photo
      </Text>
      <Box flex={{ direction: 'row', gap: 12, align: 'start' }}>
        <Box borderColor={{ color: 'surface', intensity: 300 }} className="flex-1 rounded-md border" padding={{ base: 12 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="url">URL</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="url">
              <Input
                placeholder="https://example.com/photo.jpg"
                value={photoUrl}
                onChange={(event) => onUrlCommit(event.target.value)}
              />
            </TabsContent>

            <TabsContent value="upload">
              <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
                <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  Choose File
                </Button>
                {isUploading ? (
                  <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                    Uploading…
                  </Text>
                ) : null}
              </Box>
              {uploadError ? (
                <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="mt-2 text-xs">
                  {uploadError}
                </Text>
              ) : null}
            </TabsContent>
          </Tabs>
        </Box>
        {photoUrl ? <img src={photoUrl} alt="" className="h-20 w-20 shrink-0 rounded object-cover" /> : null}
      </Box>
    </Box>
  );
};

export const StaffEditDialog = ({ mode, initialStaff, onDone }: StaffEditDialogProps) => {
  const [createStaffMember, { isLoading: isCreating }] = useCreateStaffMemberMutation();
  const [updateStaffMember, { isLoading: isUpdating }] = useUpdateStaffMemberMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [selectedUser, setSelectedUser] = useState<StaffUserCandidate | null>(null);

  const [title, setTitle] = useState(initialStaff?.title ?? '');
  const [bio, setBio] = useState(initialStaff?.bio ?? '');
  const [order, setOrder] = useState(String(initialStaff?.order ?? 0));

  const [photoUrl, setPhotoUrl] = useState(initialStaff?.photoUrl ?? '');
  const [photoSourceType, setPhotoSourceType] = useState<StaffPhotoSourceType | undefined>(initialStaff?.photoSourceType);
  const [photoStorageKey, setPhotoStorageKey] = useState(initialStaff?.photoStorageKey);

  const handlePhotoUrlCommit = (url: string) => {
    setPhotoUrl(url);
    setPhotoSourceType(url ? 'external' : undefined);
    setPhotoStorageKey(undefined);
  };

  const handlePhotoLocalUploaded = (result: { url: string; storageKey: string }) => {
    setPhotoUrl(result.url);
    setPhotoSourceType('local');
    setPhotoStorageKey(result.storageKey);
  };

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (mode === 'create' && !selectedUser) {
      setSubmitError('Choose a user to link before saving.');
      return;
    }

    const parsedOrder = Number(order);
    const commonFields = {
      title,
      bio: bio || undefined,
      order: Number.isFinite(parsedOrder) ? parsedOrder : 0,
      photoUrl: photoUrl || undefined,
      photoSourceType,
      photoStorageKey,
    };

    try {
      if (mode === 'create' && selectedUser) {
        await createStaffMember({ userId: selectedUser.id, ...commonFields }).unwrap();
      } else if (initialStaff) {
        await updateStaffMember({ id: initialStaff.id, userId: selectedUser?.id, ...commonFields }).unwrap();
      }
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

      <PhotoSourceField photoUrl={photoUrl} onUrlCommit={handlePhotoUrlCommit} onLocalUploaded={handlePhotoLocalUploaded} />
      {photoSourceType === 'local' ? (
        <Text as="p" textColor={{ color: 'amber', intensity: 700 }} className="text-xs">
          Stored locally on this server. Commit and push apps/api/uploads/staff to make this permanent in production.
        </Text>
      ) : null}

      {submitError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
