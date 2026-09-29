import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@inithium/ui';
import { useUploadClassImageMutation } from '@inithium/api-client';
import type { ProgramImageSourceType } from '@inithium/api-client';

export interface ProgramImageValue {
  readonly imageUrl?: string;
  readonly imageSourceType?: ProgramImageSourceType;
  readonly imageStorageKey?: string;
}

export interface ProgramImageFieldProps {
  readonly value: ProgramImageValue;
  readonly onChange: (value: ProgramImageValue) => void;
}

// An external URL, or a file uploaded to the API's own uploads folder - the same two sources the
// plain ProductImageField offers.
export const ProgramImageField = ({ value, onChange }: ProgramImageFieldProps) => {
  const [activeTab, setActiveTab] = useState(value.imageSourceType === 'local' ? 'upload' : 'url');
  const [uploadLocal, { isLoading: isUploading }] = useUploadClassImageMutation();
  const [uploadError, setUploadError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadError(undefined);
    try {
      const result = await uploadLocal({ file }).unwrap();
      onChange({ imageUrl: result.url, imageSourceType: 'local', imageStorageKey: result.storageKey });
    } catch {
      setUploadError('Upload failed. Please try again.');
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Image
      </Text>
      <Box borderColor={{ color: 'surface', intensity: 300 }} className="rounded-md border" padding={{ base: 12 }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>
          <TabsContent value="url">
            <Input
              placeholder="https://example.com/program.jpg"
              value={value.imageSourceType === 'local' ? '' : value.imageUrl ?? ''}
              onChange={(event) => {
                const url = event.target.value.trim();
                onChange(url ? { imageUrl: url, imageSourceType: 'external' } : {});
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
    </Box>
  );
};
