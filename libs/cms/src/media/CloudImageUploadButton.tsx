import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Button, Text } from '@inithium/ui';
import type { UploadAssetResult, UploadPurpose } from '@inithium/api-client';
import { UPLOAD_IMAGE_ACCEPT, useCloudImageUpload, validateUploadImage } from './cloud-image-upload';

export interface CloudImageUploadButtonProps {
  readonly purpose: UploadPurpose;
  readonly onUploaded: (result: UploadAssetResult) => void;
  readonly disabled?: boolean;
}

// Uploads straight to R2 on file pick, uncropped - for images shown at their natural proportions
// (gallery masonry, logo, home hero). Fixed-shape images (staff, program, product) use
// @inithium/ui's MediaField instead, which crops before uploading.
export const CloudImageUploadButton = ({ purpose, onUploaded, disabled }: CloudImageUploadButtonProps) => {
  const [uploadImage, { isLoading }] = useCloudImageUpload(purpose);
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const invalid = validateUploadImage(file);
    setUploadError(invalid);
    if (invalid) return;

    try {
      onUploaded(await uploadImage(file));
    } catch (error) {
      setUploadError((error as Error).message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 4 }}>
      <Box flex={{ direction: 'row', align: 'center', gap: 8 }}>
        <input ref={fileInputRef} type="file" accept={UPLOAD_IMAGE_ACCEPT} className="hidden" onChange={handleFileSelected} />
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
