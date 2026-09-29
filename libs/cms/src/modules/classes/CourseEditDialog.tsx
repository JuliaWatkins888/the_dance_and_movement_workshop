import { useState } from 'react';
import { Box, Button, Input, Select, SelectItem, Switch, Textarea } from '@inithium/ui';
import {
  formatMinorUnitsForInput,
  parseMinorUnitsInput,
  readApiError,
  useCreateCourseMutation,
  useUpdateCourseMutation,
} from '@inithium/api-client';
import type { CourseDto, ProgramDto } from '@inithium/api-client';
import type { CourseLevel } from '@inithium/db';
import { FormError, MoneyInput, TagInput, useStoreCurrency } from '../ecommerce/shared';
import { parseOptionalNumber, slugify } from './classAdmin.shared';

const NO_LEVEL = 'none';
const LEVEL_OPTIONS: { value: CourseLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner (0–3 years experience)' },
  { value: 'intermediate', label: 'Intermediate (4+ years experience)' },
];

export interface CourseEditDialogProps {
  readonly programs: ProgramDto[];
  readonly course?: CourseDto;
  readonly defaultProgramId?: string;
  // Offered as one-click suggestions in the styles field.
  readonly knownStyles: string[];
  readonly onDone: () => void;
}

export const CourseEditDialog = ({ programs, course, defaultProgramId, knownStyles, onDone }: CourseEditDialogProps) => {
  const currency = useStoreCurrency();
  const [createCourse, { isLoading: isCreating }] = useCreateCourseMutation();
  const [updateCourse, { isLoading: isUpdating }] = useUpdateCourseMutation();
  const isSaving = isCreating || isUpdating;
  const [error, setError] = useState<string | undefined>(undefined);

  const [programId, setProgramId] = useState(course?.programId ?? defaultProgramId ?? programs[0]?.id ?? '');
  const [name, setName] = useState(course?.name ?? '');
  const [slug, setSlug] = useState(course?.slug ?? '');
  // A new course's slug follows its name until the admin edits the slug themselves.
  const [slugTouched, setSlugTouched] = useState(Boolean(course));
  const [description, setDescription] = useState(course?.description ?? '');
  const [dressCode, setDressCode] = useState(course?.dressCode ?? '');
  const [styles, setStyles] = useState<string[]>(course?.styles ?? []);
  const [level, setLevel] = useState<string>(course?.level ?? NO_LEVEL);
  const [minAge, setMinAge] = useState(course?.minAgeYears !== undefined ? String(course.minAgeYears) : '');
  const [maxAge, setMaxAge] = useState(course?.maxAgeYears !== undefined ? String(course.maxAgeYears) : '');
  const [price, setPrice] = useState(formatMinorUnitsForInput(course?.monthlyPriceCents, currency));
  const [isPublished, setIsPublished] = useState(course?.isPublished ?? true);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSubmit = async () => {
    setError(undefined);
    const minAgeYears = parseOptionalNumber(minAge);
    const maxAgeYears = parseOptionalNumber(maxAge);
    const monthlyPriceCents = parseMinorUnitsInput(price, currency);
    if (!programId) return setError('Choose a program.');
    if (!name.trim()) return setError('Name is required.');
    if (!slug.trim()) return setError('URL slug is required.');
    if (monthlyPriceCents === null) return setError('Enter a valid monthly price.');
    if (minAgeYears === 'invalid' || maxAgeYears === 'invalid') return setError('Ages must be zero or greater.');
    if (minAgeYears !== undefined && maxAgeYears !== undefined && maxAgeYears < minAgeYears) {
      return setError('Max age must be greater than or equal to min age.');
    }
    const courseLevel = level === NO_LEVEL ? undefined : (level as CourseLevel);

    try {
      if (course) {
        await updateCourse({
          id: course.id,
          programId,
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          dressCode: dressCode.trim() || null,
          styles,
          level: courseLevel ?? null,
          minAgeYears: minAgeYears ?? null,
          maxAgeYears: maxAgeYears ?? null,
          monthlyPriceCents,
          isPublished,
        }).unwrap();
      } else {
        await createCourse({
          programId,
          name: name.trim(),
          slug: slug.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(dressCode.trim() ? { dressCode: dressCode.trim() } : {}),
          styles,
          ...(courseLevel ? { level: courseLevel } : {}),
          ...(minAgeYears !== undefined ? { minAgeYears } : {}),
          ...(maxAgeYears !== undefined ? { maxAgeYears } : {}),
          monthlyPriceCents,
          isPublished,
        }).unwrap();
      }
      onDone();
    } catch (saveError) {
      setError(readApiError(saveError, 'Could not save this course.').message);
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'row', gap: 12 }}>
        <Input label="Course Name" required value={name} onChange={(event) => handleNameChange(event.target.value)} className="flex-1" />
        <Box className="flex-1">
          <Select label="Program" value={programId} onValueChange={setProgramId} placeholder="Choose a program">
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {program.name}
              </SelectItem>
            ))}
          </Select>
        </Box>
      </Box>

      <Input
        label="URL Slug"
        required
        helperText={`Public page: /classes/${slug || '…'}`}
        value={slug}
        onChange={(event) => {
          setSlugTouched(true);
          setSlug(slugify(event.target.value));
        }}
      />

      <Textarea label="Description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} />
      <Textarea label="Dress Code" rows={3} value={dressCode} onChange={(event) => setDressCode(event.target.value)} />

      <TagInput label="Styles" values={styles} onChange={setStyles} suggestions={knownStyles} placeholder="e.g. Ballet" />

      <Box flex={{ direction: 'row', gap: 12 }}>
        <Box className="flex-1">
          <Select label="Level" value={level} onValueChange={setLevel}>
            <SelectItem value={NO_LEVEL}>All levels</SelectItem>
            {LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </Box>
        <Input label="Min Age" type="number" min={0} step="0.5" value={minAge} onChange={(event) => setMinAge(event.target.value)} className="flex-1" />
        <Input label="Max Age" type="number" min={0} step="0.5" value={maxAge} onChange={(event) => setMaxAge(event.target.value)} className="flex-1" />
      </Box>

      <MoneyInput
        label="Monthly Price"
        required
        currency={currency}
        value={price}
        onChange={setPrice}
        helperText="Semester (5% off) and full-year (10% off) prices are calculated from this."
      />

      <Switch label="Published (visible on the public Classes page)" checked={isPublished} onCheckedChange={setIsPublished} />
      <FormError message={error} />
      <Box flex={{ direction: 'row', gap: 8, justify: 'end' }}>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDone} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant={{ kind: 'filled', color: 'primary' }} onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};
