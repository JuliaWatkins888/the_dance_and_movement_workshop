import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Button, Input, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Text, Textarea } from '@inithium/ui';
import { useCreateGalleryImageMutation, useUpdateGalleryImageMutation, useUploadGalleryImageLocalMutation } from '@inithium/api-client';
import type { GalleryImageDto } from '@inithium/api-client';
import type { GalleryImageSourceType } from '@inithium/db';

export interface GalleryImageEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialImage?: GalleryImageDto;
  readonly onDone: () => void;
}

// Deliberately NOT @inithium/ui's MediaField here - MediaField's Upload tab always forces a
// fixed-aspect-ratio crop step before it uploads (see ImageCropStep in MediaField.tsx), which is
// exactly wrong for a gallery: the masonry grid's whole visual point is showing each image at its
// own natural proportions, so force-cropping every upload to one shape here would silently turn
// the masonry grid into a uniform one. This reimplements just the URL/Upload tab shell MediaField
// uses (same Tabs/Input/Button primitives, same visual container) without the crop step.
//
// Every tab commits directly to the shared imageUrl/sourceType state as its own action - there is
// no separate "confirm"/"use this" button beyond the outer dialog's own Save. Typing/pasting a
// URL, or picking a file to upload, IS the selection; only "Save" persists the record.
const ImageSourceField = ({
  imageUrl,
  onUrlCommit,
  onLocalUploaded,
}: {
  readonly imageUrl: string;
  readonly onUrlCommit: (url: string) => void;
  readonly onLocalUploaded: (result: { url: string; storageKey: string }) => void;
}) => {
  const [activeTab, setActiveTab] = useState('url');
  const [uploadLocal, { isLoading: isUploading }] = useUploadGalleryImageLocalMutation();
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
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
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
        {imageUrl ? <img src={imageUrl} alt="" className="h-20 w-20 shrink-0 rounded object-cover" /> : null}
      </Box>
    </Box>
  );
};

export const GalleryImageEditDialog = ({ mode, initialImage, onDone }: GalleryImageEditDialogProps) => {
  const [createGalleryImage, { isLoading: isCreating }] = useCreateGalleryImageMutation();
  const [updateGalleryImage, { isLoading: isUpdating }] = useUpdateGalleryImageMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState(initialImage?.title ?? '');
  const [description, setDescription] = useState(initialImage?.description ?? '');
  const [altText, setAltText] = useState(initialImage?.altText ?? '');
  const [metadataText, setMetadataText] = useState(initialImage?.metadata ? JSON.stringify(initialImage.metadata, null, 2) : '');
  const [isPublished, setIsPublished] = useState(initialImage?.isPublished ?? false);

  const [imageUrl, setImageUrl] = useState(initialImage?.url ?? '');
  const [sourceType, setSourceType] = useState<GalleryImageSourceType | undefined>(initialImage?.sourceType);
  const [assetId, setAssetId] = useState(initialImage?.assetId);
  const [storageKey, setStorageKey] = useState(initialImage?.storageKey);

  const handleUrlCommit = (url: string) => {
    setImageUrl(url);
    setSourceType('external');
    setAssetId(undefined);
    setStorageKey(undefined);
  };

  const handleLocalUploaded = (result: { url: string; storageKey: string }) => {
    setImageUrl(result.url);
    setSourceType('local');
    setStorageKey(result.storageKey);
    setAssetId(undefined);
  };

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!imageUrl || !sourceType) {
      setSubmitError('Choose an image before saving.');
      return;
    }

    let metadata: Record<string, unknown> | undefined;
    if (metadataText.trim()) {
      try {
        metadata = JSON.parse(metadataText);
      } catch {
        setSubmitError('Metadata must be valid JSON.');
        return;
      }
    }

    const payload = {
      title,
      description: description || undefined,
      altText: altText || undefined,
      metadata,
      isPublished,
      sourceType,
      url: imageUrl,
      assetId,
      storageKey,
    };

    try {
      if (mode === 'create') {
        await createGalleryImage(payload).unwrap();
      } else if (initialImage) {
        await updateGalleryImage({ id: initialImage.id, ...payload }).unwrap();
      }
      onDone();
    } catch {
      setSubmitError('Could not save this image. Check the fields and try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      {/* Each field is wrapped in its own flex-1 Box rather than passing className="flex-1"
          straight to Input/Textarea - both of those apply their className prop to the inner
          <input>/<textarea> element (see Input.tsx/Textarea.tsx), not to the FieldShell wrapper
          that's the actual flex child here, so a bare className="flex-1" on the field itself
          silently does nothing for this row's width distribution. */}
      <Box flex={{ direction: 'row', gap: 12 }}>
        <Box className="flex-1">
          <Input label="Title" required value={title} onChange={(event) => setTitle(event.target.value)} />
        </Box>
        <Box className="flex-1">
          <Input label="Alt text" value={altText} onChange={(event) => setAltText(event.target.value)} />
        </Box>
      </Box>

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Box className="flex-1">
          <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </Box>
        <Box className="flex-1">
          <Textarea
            label="Metadata (JSON)"
            helperText="Optional - camera, location, tags, etc."
            value={metadataText}
            onChange={(event) => setMetadataText(event.target.value)}
            rows={3}
          />
        </Box>
      </Box>

      <ImageSourceField imageUrl={imageUrl} onUrlCommit={handleUrlCommit} onLocalUploaded={handleLocalUploaded} />
      {sourceType === 'local' ? (
        <Text as="p" textColor={{ color: 'amber', intensity: 700 }} className="text-xs">
          Stored locally on this server. Commit and push apps/api/uploads/gallery to make this permanent in production.
        </Text>
      ) : null}

      <Switch label="Published" checked={isPublished} onCheckedChange={setIsPublished} />

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
