import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { MediaField } from '@inithium/ui';
import type { MediaFieldHandle, UploadedAsset } from '@inithium/ui';
import { useUploadAssetMutation } from '@inithium/api-client';
import type { ProductImageFieldHandle, ProductImageFieldProps, ProductImageValue } from './productImage.contract';

// Storefront cards and the product dialog both show product images square.
const PRODUCT_IMAGE_ASPECT_RATIO = 1;

export const ProductImageField = forwardRef<ProductImageFieldHandle, ProductImageFieldProps>(({ initial }, ref) => {
  const [uploadAsset] = useUploadAssetMutation();
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? '');
  // Only reassigned when MediaField reports a real URL commit or a finished upload - an untouched
  // image on an edit keeps its existing sourceType/assetId instead of being
  // reclassified as 'external'.
  const [source, setSource] = useState<Omit<ProductImageValue, 'imageUrl'>>({
    ...(initial.imageSourceType ? { imageSourceType: initial.imageSourceType } : {}),
    ...(initial.imageAssetId ? { imageAssetId: initial.imageAssetId } : {}),
  });
  const mediaFieldRef = useRef<MediaFieldHandle>(null);

  const handleAssetChange = (asset: UploadedAsset | null) => {
    setSource(asset ? { imageSourceType: 'cloud', imageAssetId: asset.assetId } : { imageSourceType: 'external' });
  };

  useImperativeHandle(
    ref,
    () => ({
      // A file still sitting in the crop step is uploaded here, so saving never loses it.
      finalize: async () => {
        const uploaded = await mediaFieldRef.current?.resolvePendingUpload();
        if (uploaded) return { imageUrl: uploaded.url, imageSourceType: 'cloud', imageAssetId: uploaded.assetId };
        return imageUrl ? { imageUrl, ...source } : {};
      },
    }),
    [imageUrl, source],
  );

  return (
    <MediaField
      ref={mediaFieldRef}
      label="Image"
      value={imageUrl}
      onValueChange={setImageUrl}
      onAssetChange={handleAssetChange}
      onUpload={async (file) => await uploadAsset({ file, purpose: 'product' }).unwrap()}
      aspectRatio={PRODUCT_IMAGE_ASPECT_RATIO}
      defaultMode={initial.imageSourceType === 'external' ? 'url' : 'upload'}
    />
  );
});
ProductImageField.displayName = 'ProductImageField';
