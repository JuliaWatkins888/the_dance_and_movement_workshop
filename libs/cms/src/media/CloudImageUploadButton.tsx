import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Button, Text } from '@inithium/ui';
import { useUploadAssetMutation } from '@inithium/api-client';
import type { UploadAssetResult, UploadPurpose } from '@inithium/api-client';

export interface CloudImageUploadButtonProps {
  readonly purpose: UploadPurpose;
  readonly onUploaded: (result: UploadAssetResult) => void;
  readonly disabled?: boolean;
}

// Uploads straight to R2 on file pick, uncropped - for images shown at their natural proportions
// (gallery masonry, logo, home hero). Fixed-shape images (staff, program, product) use
// @inithium/ui's MediaField instead, which crops before uploading.
export const CloudImageUploadButton = ({ purpose, onUploaded, disabled }: CloudImageUploadButtonProps) => {
  const [uploadAsset, { isLoading }] = useUploadAssetMutation();
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError(undefined);
    try {
      onUploaded(await uploadAsset({ file, purpose }).unwrap());
    } catch {
      setUploadError('Upload failed. Please try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 4 }}>
      <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileSelected} />
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={() => fileInputRef.current?.click()} disabled={disabled || isLoading}>
          Choose File
        </Button>
        {isLoading ? (
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
            Uploading…
          </Text>
        ) : null}
      </Box>
      {uploadError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-xs">
          {uploadError}
        </Text>
      ) : null}
    </Box>
  );
};
