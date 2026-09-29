import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@inithium/ui';
import { useUploadProductImageLocalMutation } from '@inithium/api-client';
import type { ProductImageFieldHandle, ProductImageFieldProps, ProductImageValue } from './productImage.contract';

// Plain (storage-less) product image field: an external URL, or a file uploaded to the API's own
// uploads folder. ProductImageField.storage.tsx replaces this file (with cloud uploads + cropping
// via MediaField) once the storage plugin is installed - MediaField only exists in a workspace
// that has storage, so this version can't use it.
export const ProductImageField = forwardRef<ProductImageFieldHandle, ProductImageFieldProps>(({ initial }, ref) => {
  const [image, setImage] = useState<ProductImageValue>(initial);
  const [activeTab, setActiveTab] = useState(initial.imageSourceType === 'local' ? 'upload' : 'url');
  const [uploadLocal, { isLoading: isUploading }] = useUploadProductImageLocalMutation();
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ finalize: async () => image }), [image]);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadError(undefined);
    try {
      const result = await uploadLocal({ file }).unwrap();
      setImage({ imageUrl: result.url, imageSourceType: 'local', imageStorageKey: result.storageKey });
    } catch {
      setUploadError('Upload failed. Please try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Image
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
                placeholder="https://example.com/product.jpg"
                value={image.imageSourceType === 'local' ? '' : image.imageUrl ?? ''}
                onChange={(event) => {
                  const url = event.target.value.trim();
                  setImage(url ? { imageUrl: url, imageSourceType: 'external' } : {});
                }}
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
        {image.imageUrl ? (
          <Box flex={{ direction: 'col', align: 'center', gap: 4 }} className="shrink-0">
            <img src={image.imageUrl} alt="" className="h-20 w-20 rounded object-cover" />
            <Button variant={{ kind: 'link', color: 'accent' }} textColor={{ color: 'surface', intensity: 700 }} className="text-xs" onClick={() => setImage({})}>
              Remove
            </Button>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
});
ProductImageField.displayName = 'ProductImageField';
