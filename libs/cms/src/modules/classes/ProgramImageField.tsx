import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Box, Button, DEFAULT_BANNER_HEIGHT, DEFAULT_MESH_WIDTH, MediaField } from '@inithium/ui';
import type { MediaFieldHandle, UploadedAsset } from '@inithium/ui';
import { useUploadAssetMutation } from '@inithium/api-client';
import type { ProgramImageSourceType, UploadPurpose } from '@inithium/api-client';

export interface ProgramImageValue {
  readonly imageUrl?: string;
  readonly imageSourceType?: ProgramImageSourceType;
  readonly imageAssetId?: string;
}

export interface ProgramImageFieldHandle {
  // The image to save - uploading a file still sitting in the crop step first.
  readonly finalize: () => Promise<ProgramImageValue>;
}

export interface ProgramImageFieldProps {
  readonly value: ProgramImageValue;
  readonly onChange: (value: ProgramImageValue) => void;
  // Workshops reuse this field for their banner image and guest instructor photos.
  readonly purpose?: UploadPurpose;
  readonly aspectRatio?: number;
  readonly label?: string;
}

// Cropped to the same ratio as the live program banner (ProgramBanner / Banner's reference mesh
// size), so the saved image matches how it's displayed on the program page.
const BANNER_IMAGE_ASPECT_RATIO = DEFAULT_MESH_WIDTH / DEFAULT_BANNER_HEIGHT;

// An R2 upload (cropped) or an external URL. Removing the image falls back to the program's
// generated placeholder banner.
export const ProgramImageField = forwardRef<ProgramImageFieldHandle, ProgramImageFieldProps>(({ value, onChange, ...options }, ref) => {
  const { purpose = 'program', aspectRatio = BANNER_IMAGE_ASPECT_RATIO, label = 'Image' } = options;
  const [uploadAsset] = useUploadAssetMutation();
  const mediaFieldRef = useRef<MediaFieldHandle>(null);
  // Remounts MediaField on Remove so a half-finished crop doesn't survive the removal.
  const [fieldKey, setFieldKey] = useState(0);

  const handleAssetChange = (asset: UploadedAsset | null) => {
    if (asset) {
      onChange({ imageUrl: asset.url, imageSourceType: 'cloud', imageAssetId: asset.assetId });
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      finalize: async () => {
        const uploaded = await mediaFieldRef.current?.resolvePendingUpload();
        return uploaded ? { imageUrl: uploaded.url, imageSourceType: 'cloud', imageAssetId: uploaded.assetId } : value;
      },
    }),
    [value],
  );

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <MediaField
        key={fieldKey}
        ref={mediaFieldRef}
        label={label}
        value={value.imageUrl ?? ''}
        onValueChange={(url) => onChange({ imageUrl: url, imageSourceType: 'external' })}
        onAssetChange={handleAssetChange}
        onUpload={async (file) => await uploadAsset({ file, purpose }).unwrap()}
        aspectRatio={aspectRatio}
        defaultMode={value.imageSourceType === 'external' ? 'url' : 'upload'}
      />
      {value.imageUrl ? (
        <Box flex={{ direction: 'row', justify: 'end' }}>
          <Button
            variant={{ kind: 'link', color: 'accent' }}
            textColor={{ color: 'surface', intensity: 700 }}
            className="text-xs"
            onClick={() => {
              onChange({});
              setFieldKey((key) => key + 1);
            }}
          >
            Remove image
          </Button>
        </Box>
      ) : null}
    </Box>
  );
});
ProgramImageField.displayName = 'ProgramImageField';
