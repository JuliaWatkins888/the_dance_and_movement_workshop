import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Box, Button, Input, Pill, Switch, Tabs, TabsContent, TabsList, TabsTrigger, Text, Textarea } from '@inithium/ui';
import {
  useCreateCourseMutation,
  useListAcademicYearsAdminQuery,
  useUpdateCourseMutation,
  useUploadCourseImageLocalMutation,
} from '@inithium/api-client';
import type { CourseDto, CourseWriteInput } from '@inithium/api-client';
import type { CourseImageSourceType } from '@inithium/db';
import { AcademicYearPicker } from './AcademicYearPicker';
import { SemesterScopeField } from './SemesterScopeField';
import { extractConflictMessage } from './extractErrorMessage';

export interface CourseEditDialogProps {
  readonly mode: 'create' | 'edit';
  readonly initialCourse?: CourseDto;
  readonly onDone: () => void;
}

interface CategoriesFieldProps {
  readonly values: string[];
  readonly onChange: (values: string[]) => void;
}

// Local tag input (type + Enter/comma to add, click the x to remove) - categories are an
// open-ended list with no fixed vocabulary, the same rationale the old ClassEditDialog's own
// TagListField followed before Class's categories field moved up to Course.
const CategoriesField = ({ values, onChange }: CategoriesFieldProps) => {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const trimmed = draft.trim();
    setDraft('');
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    }
  };

  const removeTag = (tag: string) => onChange(values.filter((value) => value !== tag));

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        Categories <span className="text-red-500">*</span>
      </Text>
      <Box flex={{ direction: 'row', gap: 8, align: 'center' }}>
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} onBlur={commitDraft} placeholder="e.g. Ballet" className="flex-1" />
        <Button type="button" variant={{ kind: 'outlined', color: 'primary' }} onClick={commitDraft}>
          Add
        </Button>
      </Box>
      {values.length > 0 ? (
        <Box flex={{ direction: 'row', gap: 6 }} className="flex-wrap">
          {values.map((value) => (
            <Pill key={value} color={{ color: 'surface', intensity: 200 }}>
              <span className="inline-flex items-center gap-1.5">
                {value}
                <button type="button" onClick={() => removeTag(value)} aria-label={`Remove ${value}`} className="text-surface-500 hover:text-red-600">
                  ×
                </button>
              </span>
            </Pill>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

// Deliberately NOT @inithium/ui's MediaField here - MediaField only ships with the storage
// plugin, not installed in this workspace, so a plain workspace can't import it at all. This
// reimplements just the URL/Upload tab shell MediaField uses (same Tabs/Input/Button primitives),
// mirroring StaffEditDialog's own PhotoSourceField exactly - the same local-until-a-second-need
// precedent, adjusted for a wide banner-shaped preview instead of a square headshot one.
const CourseImageField = ({
  imageUrl,
  onUrlCommit,
  onLocalUploaded,
}: {
  readonly imageUrl: string;
  readonly onUrlCommit: (url: string) => void;
  readonly onLocalUploaded: (result: { url: string; storageKey: string }) => void;
}) => {
  const [activeTab, setActiveTab] = useState('url');
  const [uploadLocal, { isLoading: isUploading }] = useUploadCourseImageLocalMutation();
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
        Banner Image
      </Text>
      <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
        Shown as a banner on the course browse and detail pages. Leave empty to use a generated pattern instead.
      </Text>
      <Box flex={{ direction: 'row', gap: 12, align: 'start' }}>
        <Box borderColor={{ color: 'surface', intensity: 300 }} className="flex-1 rounded-md border" padding={{ base: 12 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="url">URL</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="url">
              <Input placeholder="https://example.com/ballet.jpg" value={imageUrl} onChange={(event) => onUrlCommit(event.target.value)} />
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
        {imageUrl ? <img src={imageUrl} alt="" className="h-20 w-36 shrink-0 rounded object-cover" /> : null}
      </Box>
    </Box>
  );
};

export const CourseEditDialog = ({ mode, initialCourse, onDone }: CourseEditDialogProps) => {
  const [createCourse, { isLoading: isCreating }] = useCreateCourseMutation();
  const [updateCourse, { isLoading: isUpdating }] = useUpdateCourseMutation();
  const isLoading = isCreating || isUpdating;
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const [academicYearId, setAcademicYearId] = useState(initialCourse?.academicYearId ?? '');
  const [semesterIds, setSemesterIds] = useState<string[]>(initialCourse?.semesterIds ?? []);
  const [name, setName] = useState(initialCourse?.name ?? '');
  const [description, setDescription] = useState(initialCourse?.description ?? '');
  const [categories, setCategories] = useState<string[]>(initialCourse?.categories ?? []);
  const [imageUrl, setImageUrl] = useState(initialCourse?.imageUrl ?? '');
  const [imageSourceType, setImageSourceType] = useState<CourseImageSourceType | undefined>(initialCourse?.imageSourceType);
  const [imageStorageKey, setImageStorageKey] = useState(initialCourse?.imageStorageKey);
  const [isPublished, setIsPublished] = useState(initialCourse?.isPublished ?? true);

  // The scope choices come from the selected year's own semesters (the same cached list the picker
  // reads). Picking a different year starts the course as full-year, the common case - the admin
  // narrows it to one semester only when it genuinely runs in just one.
  const { data: academicYears } = useListAcademicYearsAdminQuery({ page: 1, pageSize: 100 });
  const selectedAcademicYear = academicYears?.items.find((academicYear) => academicYear.id === academicYearId);

  const handleAcademicYearChange = (nextAcademicYearId: string) => {
    setAcademicYearId(nextAcademicYearId);
    const nextAcademicYear = academicYears?.items.find((academicYear) => academicYear.id === nextAcademicYearId);
    setSemesterIds(nextAcademicYear ? nextAcademicYear.semesters.map((semester) => semester.id) : []);
  };

  const handleImageUrlCommit = (url: string) => {
    setImageUrl(url);
    setImageSourceType(url ? 'external' : undefined);
    setImageStorageKey(undefined);
  };

  const handleImageLocalUploaded = (result: { url: string; storageKey: string }) => {
    setImageUrl(result.url);
    setImageSourceType('local');
    setImageStorageKey(result.storageKey);
  };

  const handleSubmit = async () => {
    setSubmitError(undefined);

    if (!academicYearId) {
      setSubmitError('Choose an academic year.');
      return;
    }
    if (semesterIds.length === 0) {
      setSubmitError('Choose which semester(s) this course runs in.');
      return;
    }
    if (!name.trim()) {
      setSubmitError('Name is required.');
      return;
    }
    if (categories.length === 0) {
      setSubmitError('Add at least one category.');
      return;
    }

    const commonFields: CourseWriteInput = {
      academicYearId,
      semesterIds,
      name: name.trim(),
      description: description.trim() || undefined,
      categories,
      imageUrl: imageUrl.trim() || undefined,
      imageSourceType,
      imageStorageKey,
      isPublished,
    };

    try {
      if (mode === 'create') {
        await createCourse(commonFields).unwrap();
      } else if (initialCourse) {
        await updateCourse({ id: initialCourse.id, ...commonFields }).unwrap();
      }
      onDone();
    } catch (error) {
      setSubmitError(extractConflictMessage(error, 'Could not save this course. Check the fields and try again.'));
    }
  };

  return (
    <Box flex={{ direction: 'col', gap: 16 }}>
      <AcademicYearPicker value={academicYearId} onValueChange={handleAcademicYearChange} />

      {selectedAcademicYear ? (
        <SemesterScopeField
          label="Runs In"
          available={selectedAcademicYear.semesters}
          value={semesterIds}
          onChange={setSemesterIds}
          helperText="A course doesn't have to span the whole year - choose one semester if it only runs then."
        />
      ) : null}

      <Input label="Course Name" required placeholder="e.g. Ballet" value={name} onChange={(event) => setName(event.target.value)} />

      <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />

      <CategoriesField values={categories} onChange={setCategories} />

      <CourseImageField imageUrl={imageUrl} onUrlCommit={handleImageUrlCommit} onLocalUploaded={handleImageLocalUploaded} />
      {imageSourceType === 'local' ? (
        <Text as="p" textColor={{ color: 'amber', intensity: 700 }} className="text-xs">
          Stored locally on this server. Commit and push apps/api/uploads/courses to make this permanent in production.
        </Text>
      ) : null}

      <Switch label="Published (visible on the public site)" checked={isPublished} onCheckedChange={setIsPublished} />

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
