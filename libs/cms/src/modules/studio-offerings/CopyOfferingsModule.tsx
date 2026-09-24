import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Loader, Select, SelectItem, Text } from '@inithium/ui';
import { pickCurrentAcademicYear, useCopyOfferingsMutation, useGetOfferingCopyPreviewQuery, useListAcademicYearsAdminQuery } from '@inithium/api-client';
import type { AcademicYearDto, CopyCourseEntryInput, OfferingCopyResultDto } from '@inithium/api-client';
import { CopyCourseRow } from './CopyCourseRow';
import { CopyResultPanel } from './CopyResultPanel';
import {
  EMPTY_SELECTION,
  buildCopyEntries,
  selectCoursesOnly,
  selectEverything,
  setCourseClasses,
  setTargetMode,
  summarizeSelection,
  toggleClass,
  toggleCourse,
} from './copySelection';
import type { CopySelectionState } from './copySelection';
import { extractErrorMessage } from './extractErrorMessage';

const ACADEMIC_YEAR_PAGE_SIZE = 100;

const startTime = (academicYear: AcademicYearDto): number => (academicYear.startDate ? new Date(academicYear.startDate).getTime() : 0);

const plural = (count: number, singular: string, pluralForm = `${singular}s`): string => `${count} ${count === 1 ? singular : pluralForm}`;

interface YearSelectProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly AcademicYearDto[];
  readonly onValueChange: (academicYearId: string) => void;
}

const YearSelect = ({ label, value, options, onValueChange }: YearSelectProps) => (
  <Box flex={{ direction: 'col', gap: 8 }} className="min-w-0 flex-1">
    <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
      {label}
    </Text>
    <Select value={value} onValueChange={onValueChange} placeholder="Select an academic year">
      {options.map((academicYear) => (
        <SelectItem key={academicYear.id} value={academicYear.id}>
          {academicYear.title}
        </SelectItem>
      ))}
    </Select>
  </Box>
);

interface ActionBarProps {
  readonly entries: readonly CopyCourseEntryInput[];
  readonly destinationTitle: string;
  readonly isCopying: boolean;
  readonly onSelectEverything: () => void;
  readonly onSelectCoursesOnly: () => void;
  readonly onClear: () => void;
  readonly onCopy: () => void;
  readonly showBulkActions: boolean;
}

// Rendered above and below the list, so the button is in reach however long the list gets.
const ActionBar = ({ entries, destinationTitle, isCopying, onSelectEverything, onSelectCoursesOnly, onClear, onCopy, showBulkActions }: ActionBarProps) => {
  const summary = summarizeSelection(entries);
  const courseCount = summary.newCourses + summary.mergedCourses;

  return (
    <Box flex={{ direction: 'row', align: 'center', justify: 'between', gap: 12 }} className="flex-wrap">
      <Box flex={{ direction: 'row', align: 'center', gap: 4 }} className="flex-wrap">
        {showBulkActions ? (
          <>
            <Button variant={{ kind: 'outlined', color: 'primary' }} onClick={onSelectEverything} className="px-3 py-1 text-sm">
              Select everything
            </Button>
            <Button variant={{ kind: 'outlined', color: 'surface' }} onClick={onSelectCoursesOnly} className="px-3 py-1 text-sm">
              Courses only
            </Button>
            <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onClear} className="px-3 py-1 text-sm">
              Clear
            </Button>
          </>
        ) : null}
      </Box>
      <Button variant={{ kind: 'filled', color: 'primary' }} onClick={onCopy} disabled={courseCount === 0 || isCopying}>
        {isCopying
          ? 'Copying…'
          : courseCount === 0
            ? `Copy to ${destinationTitle}`
            : `Copy ${plural(courseCount, 'course')} and ${plural(summary.classes, 'class', 'classes')} to ${destinationTitle}`}
      </Button>
    </Box>
  );
};

// Year-to-year copy. Pick a source and a destination year, tick the courses to bring across (each
// expands to tick or untick its classes), and copy - everything lands in the destination year as a
// draft, on the destination's own semester dates, to be reviewed under Courses and Classes. What's
// already been copied is marked and unticked so a second pass doesn't duplicate anything.
export const CopyOfferingsModule = () => {
  const { data: academicYearList } = useListAcademicYearsAdminQuery({ page: 1, pageSize: ACADEMIC_YEAR_PAGE_SIZE });
  const academicYears = useMemo(() => academicYearList?.items ?? [], [academicYearList]);

  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [selection, setSelection] = useState<CopySelectionState>(EMPTY_SELECTION);
  const [expandedCourseIds, setExpandedCourseIds] = useState<ReadonlySet<string>>(new Set());
  const [result, setResult] = useState<OfferingCopyResultDto | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  // Starts on the current year as the source and the year after it as the destination - the common
  // "set up next year" case - until the owner picks otherwise.
  useEffect(() => {
    if (sourceId || academicYears.length === 0) return;
    const source = pickCurrentAcademicYear(academicYears) ?? academicYears[0];
    if (!source) return;
    setSourceId(source.id);
    const following = academicYears.filter((academicYear) => startTime(academicYear) > startTime(source)).sort((a, b) => startTime(a) - startTime(b))[0];
    if (following) setDestinationId(following.id);
  }, [academicYears, sourceId]);

  const resetWorkspace = () => {
    setSelection(EMPTY_SELECTION);
    setExpandedCourseIds(new Set());
    setResult(undefined);
    setSubmitError(undefined);
  };

  const handleSourceChange = (academicYearId: string) => {
    setSourceId(academicYearId);
    if (academicYearId === destinationId) setDestinationId('');
    resetWorkspace();
  };

  const handleDestinationChange = (academicYearId: string) => {
    setDestinationId(academicYearId);
    resetWorkspace();
  };

  const canPreview = Boolean(sourceId && destinationId && sourceId !== destinationId);
  const {
    data: preview,
    isFetching,
    error: previewError,
  } = useGetOfferingCopyPreviewQuery({ sourceAcademicYearId: sourceId, destinationAcademicYearId: destinationId }, { skip: !canPreview });
  const [copyOfferings, { isLoading: isCopying }] = useCopyOfferingsMutation();

  const destinationTitle = preview?.destinationAcademicYear.title ?? academicYears.find((academicYear) => academicYear.id === destinationId)?.title ?? 'the new year';
  const entries = useMemo(() => (preview ? buildCopyEntries(preview, selection) : []), [preview, selection]);

  const toggleExpanded = (courseId: string) =>
    setExpandedCourseIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });

  const handleCopy = async () => {
    setSubmitError(undefined);
    try {
      const outcome = await copyOfferings({ sourceAcademicYearId: sourceId, destinationAcademicYearId: destinationId, courses: entries }).unwrap();
      setResult(outcome);
      setSelection(EMPTY_SELECTION);
    } catch (error) {
      setSubmitError(extractErrorMessage(error, 'Could not copy these offerings. Try again.'));
    }
  };

  const actionBar = (
    <ActionBar
      entries={entries}
      destinationTitle={destinationTitle}
      isCopying={isCopying}
      showBulkActions={Boolean(preview && preview.courses.length > 0)}
      onSelectEverything={() => preview && setSelection((current) => selectEverything(preview, current))}
      onSelectCoursesOnly={() => preview && setSelection((current) => selectCoursesOnly(preview, current))}
      onClear={() => setSelection(EMPTY_SELECTION)}
      onCopy={handleCopy}
    />
  );

  return (
    <Box padding={{ base: 24 }} flex={{ direction: 'col', gap: 16 }}>
      <Box flex={{ direction: 'col', gap: 4 }}>
        <Text as="h1" textColor={{ color: 'surface', intensity: 950 }} className="text-2xl font-bold">
          Copy Offerings
        </Text>
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
          Bring courses and classes from one academic year into another. Copies are saved as drafts on the new year&apos;s semester dates, with the same instructors, price and
          capacity - review and publish them under Courses and Classes.
        </Text>
      </Box>

      {academicYears.length < 2 && academicYearList ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          You need at least two academic years to copy between - create the new year under Academic Years first.
        </Text>
      ) : (
        <Box flex={{ direction: 'row', gap: 16 }} className="flex-wrap">
          <YearSelect label="Copy from" value={sourceId} options={academicYears} onValueChange={handleSourceChange} />
          <YearSelect label="Copy to" value={destinationId} options={academicYears.filter((academicYear) => academicYear.id !== sourceId)} onValueChange={handleDestinationChange} />
        </Box>
      )}

      {result ? <CopyResultPanel result={result} destinationTitle={destinationTitle} onDismiss={() => setResult(undefined)} /> : null}

      {submitError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {submitError}
        </Text>
      ) : null}

      {!canPreview ? (
        academicYears.length >= 2 ? (
          <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
            Choose the year to copy from and the year to copy to.
          </Text>
        ) : null
      ) : previewError ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }}>
          Could not load the offerings to copy.
        </Text>
      ) : !preview ? (
        <Box flex={{ justify: 'center' }} padding={{ base: 32 }}>
          <Loader variant="spinner" color={{ color: 'primary', intensity: 500 }} />
        </Box>
      ) : preview.courses.length === 0 ? (
        <Text as="p" textColor={{ color: 'surface', intensity: 600 }}>
          {preview.sourceAcademicYear.title} has no courses to copy.
        </Text>
      ) : (
        <Box flex={{ direction: 'col', gap: 12 }} className={isFetching ? 'opacity-70' : ''}>
          {actionBar}

          {preview.courses.map((course) => (
            <CopyCourseRow
              key={course.id}
              course={course}
              selection={selection}
              expanded={expandedCourseIds.has(course.id)}
              destinationTitle={preview.destinationAcademicYear.title}
              onToggleExpanded={() => toggleExpanded(course.id)}
              onToggleCourse={(checked) => setSelection((current) => toggleCourse(current, course, checked))}
              onToggleClass={(classItem, checked) => setSelection((current) => toggleClass(current, course, classItem, checked))}
              onSetClasses={(which) => setSelection((current) => setCourseClasses(current, course, which))}
              onSetTargetMode={(mode) => setSelection((current) => setTargetMode(current, course, mode))}
            />
          ))}

          {actionBar}
        </Box>
      )}
    </Box>
  );
};
