import { useState } from 'react';
import { Box, Button, Input, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Text, Textarea } from '@inithium/ui';
import { useCreateGalleryImageMutation, useUpdateGalleryImageMutation } from '@inithium/api-client';
import type { GalleryImageDto, UploadAssetResult } from '@inithium/api-client';
import type { GalleryImageSourceType } from '@inithium/db';
import { CloudImageUploadButton } from '../../media/CloudImageUploadButton';
import { useSessionUploads } from '../../media/useSessionUploads';

export interface GalleryImageEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialImage?: GalleryImageDto;
  readonly onDone: () => void;
}

// Deliberately NOT @inithium/ui's MediaField here - MediaField's Upload tab always forces a
// fixed-aspect-ratio crop step before it uploads, which is exactly wrong for a gallery: the masonry
// grid's whole visual point is showing each image at its own natural proportions.
//
// Every tab commits directly to the shared imageUrl/sourceType state as its own action - typing a
// URL, or picking a file (uploaded to R2 immediately), IS the selection; only "Save" persists the
// record.
const ImageSourceField = ({
  imageUrl,
  sourceType,
  onUrlCommit,
  onCloudUploaded,
}: {
  readonly imageUrl: string;
  readonly sourceType?: GalleryImageSourceType;
  readonly onUrlCommit: (url: string) => void;
  readonly onCloudUploaded: (result: UploadAssetResult) => void;
}) => {
  const [activeTab, setActiveTab] = useState(sourceType === 'external' ? 'url' : 'upload');

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Image
      </Text>
      <Box flex={{ direction: 'row', gap: 12, align: 'start' }}>
        <Box borderColor={{ color: 'surface', intensity: 300 }} className="flex-1 rounded-md border" padding={{ base: 12 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <CloudImageUploadButton purpose="gallery" onUploaded={onCloudUploaded} />
            </TabsContent>

            <TabsContent value="url">
              <Input
                placeholder="https://example.com/image.jpg"
                value={sourceType === 'external' ? imageUrl : ''}
                onChange={(event) => onUrlCommit(event.target.value)}
              />
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
  const sessionUploads = useSessionUploads();

  const handleUrlCommit = (url: string) => {
    setImageUrl(url);
    setSourceType('external');
    setAssetId(undefined);
  };

  const handleCloudUploaded = (result: UploadAssetResult) => {
    sessionUploads.track(result.assetId);
    setImageUrl(result.url);
    setSourceType('cloud');
    setAssetId(result.assetId);
  };

  const handleCancel = () => {
    sessionUploads.discardUnsaved();
    onDone();
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
      assetId: sourceType === 'cloud' ? assetId : undefined,
    };

    try {
      if (mode === 'create') {
        await createGalleryImage(payload).unwrap();
      } else if (initialImage) {
        await updateGalleryImage({ id: initialImage.id, ...payload }).unwrap();
      }
      sessionUploads.discardUnsaved(payload.assetId);
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

      <ImageSourceField
        imageUrl={imageUrl}
        sourceType={sourceType}
        onUrlCommit={handleUrlCommit}
        onCloudUploaded={handleCloudUploaded}
      />
      <Switch label="Published" checked={isPublished} onCheckedChange={setIsPublished} />

      {submitError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {submitError}
        </Text>
      ) : null}

      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={handleCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
