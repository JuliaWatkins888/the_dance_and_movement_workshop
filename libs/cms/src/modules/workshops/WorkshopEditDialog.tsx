import { useMemo, useRef, useState } from 'react';
import {
  Banner,
  BannerEditDialog,
  Box,
  Button,
  IconButton,
  Input,
  Select,
  SelectItem,
  Switch,
  Text,
  Textarea,
  generateSeededBannerConfig,
  useElementSize,
} from '@inithium/ui';
import type { BannerTrianglifyConfig } from '@inithium/ui';
import {
  formatMinorUnitsForInput,
  parseMinorUnitsInput,
  readApiError,
  useCreateWorkshopMutation,
  useListWorkshopStaffOptionsQuery,
  useUpdateWorkshopMutation,
} from '@inithium/api-client';
import type { ProgramBannerDto, WorkshopDto, WorkshopInstructorRecord, WorkshopWriteInput } from '@inithium/api-client';
import type { CourseLevel } from '@inithium/db';
import { useSessionUploads } from '../../media/useSessionUploads';
import { FormError, MoneyInput, TagInput, useStoreCurrency } from '../ecommerce/shared';
import { parseOptionalNumber, slugify, toDateInputValue } from '../classes/classAdmin.shared';
import { ProgramImageField } from '../classes/ProgramImageField';
import type { ProgramImageFieldHandle, ProgramImageValue } from '../classes/ProgramImageField';

const PREVIEW_HEIGHT = 140;
const DEFAULT_CAPACITY = 10;
const DAY_MS = 86_400_000;
// Matches the portrait crop staff photos use.
const GUEST_PHOTO_ASPECT_RATIO = 3 / 4;
const NO_LEVEL = 'none';
const LEVEL_OPTIONS: { value: CourseLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner (0–3 years experience)' },
  { value: 'intermediate', label: 'Intermediate (4+ years experience)' },
];

// Local keys keep rows' identity (and input focus) while they're added and removed.
interface DayDraft {
  key: string;
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  agenda: string;
  capacity: string;
  enrolled: number;
}

type InstructorDraft =
  | { key: string; type: 'staff'; staffId: string }
  | {
      key: string;
      type: 'guest';
      name: string;
      bio: string;
      photo: ProgramImageValue;
    };

const nextKey = (): string => crypto.randomUUID();

const toBannerDto = ({ cellSize, variance, xColors, yColors }: BannerTrianglifyConfig): ProgramBannerDto => ({
  cellSize,
  variance,
  xColors: [...xColors],
  yColors: [...yColors],
});

const randomBanner = (): ProgramBannerDto => toBannerDto(generateSeededBannerConfig(crypto.randomUUID()));

const emptyDay = (): DayDraft => ({
  key: nextKey(),
  date: '',
  startTime: '',
  endTime: '',
  agenda: '',
  capacity: String(DEFAULT_CAPACITY),
  enrolled: 0,
});

// A new day follows on from the last one - the next date, same times and capacity.
const followingDay = (previous: DayDraft | undefined): DayDraft => {
  if (!previous) return emptyDay();
  const nextDate = previous.date ? new Date(new Date(`${previous.date}T00:00:00.000Z`).getTime() + DAY_MS).toISOString().slice(0, 10) : '';
  return {
    ...emptyDay(),
    date: nextDate,
    startTime: previous.startTime,
    endTime: previous.endTime,
    capacity: previous.capacity,
  };
};

const toDayDrafts = (workshop: WorkshopDto | undefined): DayDraft[] =>
  workshop
    ? workshop.days.map((day) => ({
        key: nextKey(),
        id: day.id,
        date: toDateInputValue(day.date),
        startTime: day.startTime,
        endTime: day.endTime,
        agenda: day.agenda ?? '',
        capacity: String(day.capacity),
        enrolled: day.enrolled,
      }))
    : [emptyDay()];

const toInstructorDrafts = (workshop: WorkshopDto | undefined): InstructorDraft[] =>
  (workshop?.instructors ?? []).map((instructor) =>
    instructor.type === 'staff'
      ? { key: nextKey(), type: 'staff', staffId: instructor.staffId }
      : {
          key: nextKey(),
          type: 'guest',
          name: instructor.name,
          bio: instructor.bio ?? '',
          photo: {
            ...(instructor.photoUrl ? { imageUrl: instructor.photoUrl } : {}),
            ...(instructor.photoSourceType ? { imageSourceType: instructor.photoSourceType } : {}),
            ...(instructor.photoAssetId ? { imageAssetId: instructor.photoAssetId } : {}),
          },
        },
  );

const savedAssetIdsOf = (workshop: WorkshopDto | undefined): string[] => [
  ...(workshop?.imageAssetId ? [workshop.imageAssetId] : []),
  ...(workshop?.instructors ?? []).flatMap((instructor) =>
    instructor.type === 'guest' && instructor.photoAssetId ? [instructor.photoAssetId] : [],
  ),
];

const SectionHeading = ({ title, hint }: { title: string; hint?: string }) => (
  <Box flex={{ direction: 'col', gap: 2 }} className="pt-2">
    <Text as="h3" textColor={{ color: 'surface', intensity: 950 }} className="text-base font-semibold">
      {title}
    </Text>
    {hint ? (
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        {hint}
      </Text>
    ) : null}
  </Box>
);

export interface WorkshopEditDialogProps {
  readonly workshop?: WorkshopDto;
  // Offered as one-click suggestions in the styles field.
  readonly knownStyles: string[];
  readonly onDone: () => void;
}

export const WorkshopEditDialog = ({ workshop, knownStyles, onDone }: WorkshopEditDialogProps) => {
  const currency = useStoreCurrency();
  const [createWorkshop, { isLoading: isCreating }] = useCreateWorkshopMutation();
  const [updateWorkshop, { isLoading: isUpdating }] = useUpdateWorkshopMutation();
  const { data: staffOptions = [], isLoading: isLoadingStaff } = useListWorkshopStaffOptionsQuery();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  const [title, setTitle] = useState(workshop?.title ?? '');
  const [slug, setSlug] = useState(workshop?.slug ?? '');
  // A new workshop's slug follows its title until the admin edits the slug themselves.
  const [slugTouched, setSlugTouched] = useState(Boolean(workshop));
  const [description, setDescription] = useState(workshop?.description ?? '');
  const [dressCode, setDressCode] = useState(workshop?.dressCode ?? '');
  const [styles, setStyles] = useState<string[]>(workshop?.styles ?? []);
  const [level, setLevel] = useState<string>(workshop?.level ?? NO_LEVEL);
  const [minAge, setMinAge] = useState(workshop?.minAgeYears !== undefined ? String(workshop.minAgeYears) : '');
  const [maxAge, setMaxAge] = useState(workshop?.maxAgeYears !== undefined ? String(workshop.maxAgeYears) : '');
  const [days, setDays] = useState<DayDraft[]>(() => toDayDrafts(workshop));
  const [instructors, setInstructors] = useState<InstructorDraft[]>(() => toInstructorDrafts(workshop));
  const [price, setPrice] = useState(formatMinorUnitsForInput(workshop?.pricePerDayCents, currency));
  const [discount, setDiscount] = useState(String(workshop?.fullWorkshopDiscountPercent ?? 0));
  const [isPublished, setIsPublished] = useState(workshop?.isPublished ?? true);

  const [image, setImage] = useState<ProgramImageValue>({
    ...(workshop?.imageUrl ? { imageUrl: workshop.imageUrl } : {}),
    ...(workshop?.imageSourceType ? { imageSourceType: workshop.imageSourceType } : {}),
    ...(workshop?.imageAssetId ? { imageAssetId: workshop.imageAssetId } : {}),
  });
  const imageFieldRef = useRef<ProgramImageFieldHandle>(null);
  const guestPhotoRefs = useRef(new Map<string, ProgramImageFieldHandle>());
  const sessionUploads = useSessionUploads();
  // An existing workshop without a saved mesh keeps its id-derived default (matching the public
  // site); a new one has no id yet, so it gets a concrete mesh up front that's saved with it.
  const [banner, setBanner] = useState<ProgramBannerDto | undefined>(workshop ? workshop.banner : randomBanner);
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const { ref: previewRef, size: previewSize } = useElementSize();

  const previewBanner = useMemo(
    () => (banner as BannerTrianglifyConfig | undefined) ?? generateSeededBannerConfig(workshop?.id ?? ''),
    [banner, workshop?.id],
  );

  const staffById = useMemo(() => new Map(staffOptions.map((staff) => [staff.id, staff])), [staffOptions]);
  const chosenStaffIds = new Set(instructors.flatMap((instructor) => (instructor.type === 'staff' ? [instructor.staffId] : [])));
  const availableStaff = staffOptions.filter((staff) => !chosenStaffIds.has(staff.id));

  const instructorHeading = (instructor: InstructorDraft): string => {
    if (instructor.type === 'guest') return 'Guest instructor';
    const staff = staffById.get(instructor.staffId);
    return staff ? [staff.name || 'Unnamed staff member', staff.title].filter(Boolean).join(' · ') : 'Staff member';
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const updateDay = (key: string, patch: Partial<DayDraft>) =>
    setDays((previous) => previous.map((day) => (day.key === key ? { ...day, ...patch } : day)));

  const updateGuest = (key: string, patch: Partial<Extract<InstructorDraft, { type: 'guest' }>>) =>
    setInstructors((previous) =>
      previous.map((instructor) => (instructor.key === key && instructor.type === 'guest' ? { ...instructor, ...patch } : instructor)),
    );

  const moveInstructor = (index: number, offset: number) =>
    setInstructors((previous) => {
      const next = [...previous];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(index + offset, 0, moved);
      return next;
    });

  const validate = (): string | undefined => {
    const minAgeYears = parseOptionalNumber(minAge);
    const maxAgeYears = parseOptionalNumber(maxAge);
    const discountPercent = Number(discount);
    if (!title.trim()) return 'Title is required.';
    if (!slug.trim()) return 'URL slug is required.';
    if (parseMinorUnitsInput(price, currency) === null) return 'Enter a valid price per day.';
    if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return 'The whole-workshop discount must be a whole number from 0 to 100.';
    }
    if (minAgeYears === 'invalid' || maxAgeYears === 'invalid') return 'Ages must be zero or greater.';
    if (minAgeYears !== undefined && maxAgeYears !== undefined && maxAgeYears < minAgeYears) {
      return 'Max age must be greater than or equal to min age.';
    }
    if (days.length === 0) return 'Add at least one day.';
    if (days.some((day) => !day.date || !day.startTime || !day.endTime)) return 'Every day needs a date, start time, and end time.';
    if (days.some((day) => day.endTime <= day.startTime)) return 'A day ends before it starts.';
    if (days.some((day) => !Number.isInteger(Number(day.capacity)) || Number(day.capacity) < 0)) {
      return 'Each day’s capacity must be a whole number.';
    }
    if (new Set(days.map((day) => day.date)).size !== days.length) return 'Each day must be on a different date.';
    if (instructors.some((instructor) => instructor.type === 'guest' && !instructor.name.trim())) {
      return 'Every guest instructor needs a name.';
    }
    return undefined;
  };

  const handleSubmit = async () => {
    setError(undefined);
    const validationError = validate();
    if (validationError) return setError(validationError);

    const minAgeYears = parseOptionalNumber(minAge);
    const maxAgeYears = parseOptionalNumber(maxAge);
    const courseLevel = level === NO_LEVEL ? undefined : (level as CourseLevel);

    try {
      const finalImage = (await imageFieldRef.current?.finalize()) ?? image;
      const finalInstructors = await Promise.all(
        instructors.map(async (instructor): Promise<WorkshopInstructorRecord> => {
          if (instructor.type === 'staff') return { type: 'staff', staffId: instructor.staffId };
          const photo = (await guestPhotoRefs.current.get(instructor.key)?.finalize()) ?? instructor.photo;
          return {
            type: 'guest',
            name: instructor.name.trim(),
            ...(instructor.bio.trim() ? { bio: instructor.bio.trim() } : {}),
            ...(photo.imageUrl ? { photoUrl: photo.imageUrl } : {}),
            ...(photo.imageSourceType ? { photoSourceType: photo.imageSourceType } : {}),
            ...(photo.imageAssetId ? { photoAssetId: photo.imageAssetId } : {}),
          };
        }),
      );
      const savedAssetIds = [
        ...(finalImage.imageAssetId ? [finalImage.imageAssetId] : []),
        ...finalInstructors.flatMap((instructor) =>
          instructor.type === 'guest' && instructor.photoAssetId ? [instructor.photoAssetId] : [],
        ),
      ];
      const previouslySaved = new Set(savedAssetIdsOf(workshop));
      savedAssetIds.filter((assetId) => !previouslySaved.has(assetId)).forEach(sessionUploads.track);

      const input: WorkshopWriteInput = {
        title: title.trim(),
        slug: slug.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(dressCode.trim() ? { dressCode: dressCode.trim() } : {}),
        styles,
        ...(courseLevel ? { level: courseLevel } : {}),
        ...(minAgeYears !== undefined && minAgeYears !== 'invalid' ? { minAgeYears } : {}),
        ...(maxAgeYears !== undefined && maxAgeYears !== 'invalid' ? { maxAgeYears } : {}),
        instructors: finalInstructors,
        days: days.map((day) => ({
          ...(day.id ? { id: day.id } : {}),
          date: day.date,
          startTime: day.startTime,
          endTime: day.endTime,
          ...(day.agenda.trim() ? { agenda: day.agenda.trim() } : {}),
          capacity: Number(day.capacity),
        })),
        pricePerDayCents: parseMinorUnitsInput(price, currency) ?? 0,
        fullWorkshopDiscountPercent: Number(discount),
        ...finalImage,
        ...(banner ? { banner } : {}),
        isPublished,
      };

      if (workshop) await updateWorkshop({ id: workshop.id, ...input }).unwrap();
      else await createWorkshop(input).unwrap();
      sessionUploads.discardUnsaved(...savedAssetIds);
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this workshop.').message);
    }
  };

  // Swaps the form for the shared banner editor; its Save only stages the mesh here - it's
  // written along with the rest of the workshop when the workshop itself is saved.
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
      <SectionHeading title="Details" />
      <Input
        label="Title"
        required
        placeholder="e.g. Contemporary Intensive with Jada Reyes"
        value={title}
        onChange={(event) => handleTitleChange(event.target.value)}
      />
      <Input
        label="URL Slug"
        required
        helperText={`Public page: /workshops/${slug || '…'}`}
        value={slug}
        onChange={(event) => {
          setSlugTouched(true);
          setSlug(slugify(event.target.value));
        }}
      />
      <Textarea label="Description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
      <Textarea label="Dress Code" rows={3} value={dressCode} onChange={(event) => setDressCode(event.target.value)} />
      <TagInput label="Styles" values={styles} onChange={setStyles} suggestions={knownStyles} placeholder="e.g. Contemporary" />
      <Box flex={{ direction: 'row', gap: 12 }} className="flex-wrap sm:flex-nowrap">
        <Box className="min-w-[12rem] flex-1">
          <Select label="Level" value={level} onValueChange={setLevel}>
            <SelectItem value={NO_LEVEL}>All levels</SelectItem>
            {LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </Box>
        <Input
          label="Min Age"
          type="number"
          min={0}
          step="0.5"
          value={minAge}
          onChange={(event) => setMinAge(event.target.value)}
          className="flex-1"
        />
        <Input
          label="Max Age"
          type="number"
          min={0}
          step="0.5"
          helperText="Leave both blank for all ages. Adults can only enroll themselves at 18+."
          value={maxAge}
          onChange={(event) => setMaxAge(event.target.value)}
          className="flex-1"
        />
      </Box>

      <SectionHeading
        title="Schedule"
        hint="Families pick which days to attend. Registration closes for every day once the first day starts."
      />
      {days.map((day, index) => (
        <Box
          key={day.key}
          flex={{ direction: 'col', gap: 8 }}
          borderColor={{ color: 'surface', intensity: 300 }}
          className="rounded-lg border p-3"
        >
          <Box
            flex={{
              direction: 'row',
              justify: 'between',
              align: 'center',
              gap: 8,
            }}
          >
            <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-semibold">
              Day {index + 1}
            </Text>
            <IconButton
              icon="Trash"
              label={day.enrolled > 0 ? 'This day has registrations and can’t be removed' : `Remove day ${index + 1}`}
              textColor={{ color: 'red', intensity: 600 }}
              disabled={day.enrolled > 0 || days.length === 1}
              onClick={() => setDays((previous) => previous.filter((candidate) => candidate.key !== day.key))}
            />
          </Box>
          <Box className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Input
              label="Date"
              type="date"
              required
              value={day.date}
              onChange={(event) => updateDay(day.key, { date: event.target.value })}
            />
            <Input
              label="Start"
              type="time"
              required
              value={day.startTime}
              onChange={(event) => updateDay(day.key, { startTime: event.target.value })}
            />
            <Input
              label="End"
              type="time"
              required
              value={day.endTime}
              onChange={(event) => updateDay(day.key, { endTime: event.target.value })}
            />
            <Input
              label="Capacity"
              type="number"
              min={0}
              required
              value={day.capacity}
              helperText={day.id ? `${day.enrolled} registered` : undefined}
              onChange={(event) => updateDay(day.key, { capacity: event.target.value })}
            />
          </Box>
          <Textarea
            label="Agenda (optional)"
            rows={3}
            placeholder="What this day covers, e.g. 10:00 Warm-up · 10:30 Technique · 12:00 Combination"
            value={day.agenda}
            onChange={(event) => updateDay(day.key, { agenda: event.target.value })}
          />
        </Box>
      ))}
      <Box>
        <Button
          variant={{ kind: 'outlined', color: 'primary' }}
          onClick={() => setDays((previous) => [...previous, followingDay(previous[previous.length - 1])])}
        >
          Add Day
        </Button>
      </Box>

      <SectionHeading title="Instructors" hint="Pick from your staff, or add a visiting guest instructor with their own bio and photo." />
      {instructors.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          No instructors yet - the workshop will show “Instructor TBA”.
        </Text>
      ) : null}
      {instructors.map((instructor, index) => (
        <Box
          key={instructor.key}
          flex={{ direction: 'col', gap: 8 }}
          borderColor={{ color: 'surface', intensity: 300 }}
          className="rounded-lg border p-3"
        >
          <Box
            flex={{
              direction: 'row',
              justify: 'between',
              align: 'center',
              gap: 8,
            }}
          >
            <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-semibold">
              {instructorHeading(instructor)}
            </Text>
            <Box flex={{ direction: 'row', align: 'center', gap: 4 }}>
              <IconButton icon="ArrowUp" label="Move up" disabled={index === 0} onClick={() => moveInstructor(index, -1)} />
              <IconButton
                icon="ArrowDown"
                label="Move down"
                disabled={index === instructors.length - 1}
                onClick={() => moveInstructor(index, 1)}
              />
              <IconButton
                icon="Trash"
                label="Remove instructor"
                textColor={{ color: 'red', intensity: 600 }}
                onClick={() => setInstructors((previous) => previous.filter((candidate) => candidate.key !== instructor.key))}
              />
            </Box>
          </Box>
          {instructor.type === 'guest' ? (
            <>
              <Input
                label="Name"
                required
                value={instructor.name}
                onChange={(event) => updateGuest(instructor.key, { name: event.target.value })}
              />
              <Textarea
                label="Bio"
                rows={3}
                value={instructor.bio}
                onChange={(event) => updateGuest(instructor.key, { bio: event.target.value })}
              />
              <ProgramImageField
                ref={(handle) => {
                  if (handle) guestPhotoRefs.current.set(instructor.key, handle);
                  else guestPhotoRefs.current.delete(instructor.key);
                }}
                label="Photo"
                purpose="workshop"
                aspectRatio={GUEST_PHOTO_ASPECT_RATIO}
                value={instructor.photo}
                onChange={(photo) => updateGuest(instructor.key, { photo })}
              />
            </>
          ) : null}
        </Box>
      ))}
      <Box flex={{ direction: 'row', gap: 8, align: 'end' }} className="flex-wrap">
        <Box className="min-w-[14rem]">
          <Select
            label="Add staff instructor"
            value=""
            placeholder={isLoadingStaff ? 'Loading staff…' : availableStaff.length === 0 ? 'No more staff to add' : 'Choose a staff member'}
            onValueChange={(staffId) => setInstructors((previous) => [...previous, { key: nextKey(), type: 'staff', staffId }])}
          >
            {availableStaff.map((staff) => (
              <SelectItem key={staff.id} value={staff.id}>
                {staff.name || 'Unnamed staff member'}
              </SelectItem>
            ))}
          </Select>
        </Box>
        <Button
          variant={{ kind: 'outlined', color: 'primary' }}
          onClick={() => setInstructors((previous) => [...previous, { key: nextKey(), type: 'guest', name: '', bio: '', photo: {} }])}
        >
          Add Guest Instructor
        </Button>
      </Box>

      <SectionHeading title="Pricing" />
      <Box flex={{ direction: 'row', gap: 12 }} className="flex-wrap sm:flex-nowrap">
        <MoneyInput label="Price per Day" required currency={currency} value={price} onChange={setPrice} className="flex-1" />
        <Input
          label="Whole-Workshop Discount (%)"
          type="number"
          min={0}
          max={100}
          step="1"
          helperText="Applied when a dancer is signed up for every day. 0 for none."
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
          className="flex-1"
        />
      </Box>

      <SectionHeading title="Card & Banner" />
      <div ref={previewRef} className="w-full overflow-hidden rounded-md">
        <Banner
          imageUrl={image.imageUrl}
          imageAlt={title}
          trianglifyConfig={previewBanner}
          width={previewSize?.width ?? '100%'}
          height={PREVIEW_HEIGHT}
        />
      </div>
      <ProgramImageField ref={imageFieldRef} purpose="workshop" value={image} onChange={setImage} />
      <Box flex={{ direction: 'col', gap: 8 }}>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
          Without an image, the card and workshop page show this generated pattern.
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

      <Switch label="Published (visible on the public Workshops page)" checked={isPublished} onCheckedChange={setIsPublished} />
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
