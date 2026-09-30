import { useMemo, useRef, useState } from 'react';
import { Banner, BannerEditDialog, Box, Button, Input, Switch, Text, Textarea, generateSeededBannerConfig, useElementSize } from '@inithium/ui';
import type { BannerTrianglifyConfig } from '@inithium/ui';
import { readApiError, useCreateProgramMutation, useUpdateProgramMutation } from '@inithium/api-client';
import type { ProgramBannerDto, ProgramDto } from '@inithium/api-client';
import { useSessionUploads } from '../../media/useSessionUploads';
import { FormError } from '../ecommerce/shared';
import { parseOptionalNumber, slugify } from './classAdmin.shared';
import { ProgramImageField } from './ProgramImageField';
import type { ProgramImageFieldHandle, ProgramImageValue } from './ProgramImageField';

const PREVIEW_HEIGHT = 140;

export interface ProgramEditDialogProps {
  readonly program?: ProgramDto;
  readonly onDone: () => void;
}

const toBannerDto = ({ cellSize, variance, xColors, yColors }: BannerTrianglifyConfig): ProgramBannerDto => ({
  cellSize,
  variance,
  xColors: [...xColors],
  yColors: [...yColors],
});

const randomBanner = (): ProgramBannerDto => toBannerDto(generateSeededBannerConfig(crypto.randomUUID()));

export const ProgramEditDialog = ({ program, onDone }: ProgramEditDialogProps) => {
  const [createProgram, { isLoading: isCreating }] = useCreateProgramMutation();
  const [updateProgram, { isLoading: isUpdating }] = useUpdateProgramMutation();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  // Programs saved before slugs existed report their id as the slug - offer a readable one instead.
  const hasRealSlug = Boolean(program && program.slug !== program.id);
  const [name, setName] = useState(program?.name ?? '');
  const [slug, setSlug] = useState(hasRealSlug ? (program?.slug ?? '') : slugify(program?.name ?? ''));
  const [slugTouched, setSlugTouched] = useState(hasRealSlug);
  const [description, setDescription] = useState(program?.description ?? '');
  const [minAge, setMinAge] = useState(program?.minAgeYears !== undefined ? String(program.minAgeYears) : '');
  const [maxAge, setMaxAge] = useState(program?.maxAgeYears !== undefined ? String(program.maxAgeYears) : '');
  const [isPublished, setIsPublished] = useState(program?.isPublished ?? true);
  const [image, setImage] = useState<ProgramImageValue>({
    ...(program?.imageUrl ? { imageUrl: program.imageUrl } : {}),
    ...(program?.imageSourceType ? { imageSourceType: program.imageSourceType } : {}),
    ...(program?.imageAssetId ? { imageAssetId: program.imageAssetId } : {}),
  });
  const imageFieldRef = useRef<ProgramImageFieldHandle>(null);
  const sessionUploads = useSessionUploads();
  // An existing program without a saved mesh keeps its id-derived default (matching the public
  // site); a new one has no id yet, so it gets a concrete mesh up front that's saved with it.
  const [banner, setBanner] = useState<ProgramBannerDto | undefined>(program ? program.banner : randomBanner);
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const { ref: previewRef, size: previewSize } = useElementSize();

  const previewBanner = useMemo(
    () => (banner as BannerTrianglifyConfig | undefined) ?? generateSeededBannerConfig(program?.id ?? ''),
    [banner, program?.id],
  );

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async () => {
    setError(undefined);
    const minAgeYears = parseOptionalNumber(minAge);
    const maxAgeYears = parseOptionalNumber(maxAge);
    if (!name.trim()) return setError('Name is required.');
    if (!slug.trim()) return setError('URL slug is required.');
    if (minAgeYears === 'invalid' || maxAgeYears === 'invalid') return setError('Ages must be zero or greater.');
    if (minAgeYears !== undefined && maxAgeYears !== undefined && maxAgeYears < minAgeYears) {
      return setError('Max age must be greater than or equal to min age.');
    }

    try {
      const finalImage = (await imageFieldRef.current?.finalize()) ?? image;
      if (finalImage.imageAssetId && finalImage.imageAssetId !== program?.imageAssetId) sessionUploads.track(finalImage.imageAssetId);
      if (program) {
        await updateProgram({
          id: program.id,
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          minAgeYears: minAgeYears ?? null,
          maxAgeYears: maxAgeYears ?? null,
          imageUrl: finalImage.imageUrl ?? null,
          imageSourceType: finalImage.imageSourceType ?? null,
          imageAssetId: finalImage.imageAssetId ?? null,
          ...(banner ? { banner } : {}),
          isPublished,
        }).unwrap();
      } else {
        await createProgram({
          name: name.trim(),
          slug: slug.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(minAgeYears !== undefined ? { minAgeYears } : {}),
          ...(maxAgeYears !== undefined ? { maxAgeYears } : {}),
          ...finalImage,
          ...(banner ? { banner } : {}),
          isPublished,
        }).unwrap();
      }
      sessionUploads.discardUnsaved(finalImage.imageAssetId);
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this program.').message);
    }
  };

  // Swaps the form for the shared banner editor; its Save only stages the mesh here - it's
  // written along with the rest of the program when the program itself is saved.
  if (isEditingBanner) {
    return (
      <BannerEditDialog
        initialBanner={toBannerDto(previewBanner)}
        onSave={async ({ cellSize, variance, xColors, yColors }) => setBanner({ cellSize, variance, xColors, yColors })}
        onClose={() => setIsEditingBanner(false)}
      />
    );
  }

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Input label="Program Name" required placeholder="e.g. Early Childhood" value={name} onChange={(event) => handleNameChange(event.target.value)} />
      <Input
        label="URL Slug"
        required
        helperText={`Public page: /programs/${slug || '…'}`}
        value={slug}
        onChange={(event) => {
          setSlugTouched(true);
          setSlug(slugify(event.target.value));
        }}
      />
      <Textarea
        label="Description"
        helperText="Shown on the program's card on the Classes page and at the top of its own page."
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input
          label="Min Age"
          type="number"
          min={0}
          step="0.5"
          helperText="Display only - each course sets its own eligibility."
          value={minAge}
          onChange={(event) => setMinAge(event.target.value)}
          className="flex-1"
        />
        <Input label="Max Age" type="number" min={0} step="0.5" value={maxAge} onChange={(event) => setMaxAge(event.target.value)} className="flex-1" />
      </Box>

      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
          Card &amp; Banner Preview
        </Text>
        <div ref={previewRef} className="w-full overflow-hidden rounded-md">
          <Banner
            imageUrl={image.imageUrl}
            imageAlt={name}
            trianglifyConfig={previewBanner}
            width={previewSize?.width ?? '100%'}
            height={PREVIEW_HEIGHT}
          />
        </div>
      </Box>

      <ProgramImageField ref={imageFieldRef} value={image} onChange={setImage} />

      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
          Placeholder Banner
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          The generated pattern shown on the card and program page whenever there's no image.
        </Text>
        <Box flex={{ direction: 'row', gap: 8 }} className="flex-wrap">
          <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={() => setIsEditingBanner(true)}>
            Customize Placeholder
          </Button>
          <Button variant={{ kind: 'ghost', color: 'primary' }} onClick={() => setBanner(randomBanner())}>
            Randomize
          </Button>
        </Box>
      </Box>

      <Switch label="Published (visible on the public Classes page)" checked={isPublished} onCheckedChange={setIsPublished} />
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button
          variant={{ kind: 'ghost', color: 'surface' }}
          onClick={() => {
            sessionUploads.discardUnsaved();
            onDone();
          }}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
