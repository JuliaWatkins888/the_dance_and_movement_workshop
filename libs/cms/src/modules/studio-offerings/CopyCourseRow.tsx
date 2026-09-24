import { Box, Button, Checkbox, Icon, Pill, RadioGroup, RadioGroupItem, Text } from '@inithium/ui';
import type { CopyClassPreviewDto, CopyCoursePreviewDto } from '@inithium/api-client';
import { getClassAvailability, getTargetMode } from './copySelection';
import type { CopySelectionState, CopyTargetMode } from './copySelection';
import { formatAgeRange, formatCurrency, formatSchedule, formatSemesterScope } from './formatOffering';

export interface CopyCourseRowProps {
  readonly course: CopyCoursePreviewDto;
  readonly selection: CopySelectionState;
  readonly expanded: boolean;
  readonly destinationTitle: string;
  readonly onToggleExpanded: () => void;
  readonly onToggleCourse: (checked: boolean) => void;
  readonly onToggleClass: (classItem: CopyClassPreviewDto, checked: boolean) => void;
  readonly onSetClasses: (which: 'all' | 'none') => void;
  readonly onSetTargetMode: (mode: CopyTargetMode) => void;
}

const describeInstructors = (classItem: CopyClassPreviewDto): string =>
  classItem.instructors.length > 0 ? classItem.instructors.map((instructor) => instructor.name).join(', ') : 'No instructor';

const describeClassDetails = (classItem: CopyClassPreviewDto): string =>
  [
    formatSchedule(classItem.daysOfWeek, classItem.startTime, classItem.endTime),
    formatAgeRange(classItem.minAgeYears, classItem.maxAgeYears),
    describeInstructors(classItem),
    `${formatCurrency(classItem.priceAmount)}/mo`,
    formatSemesterScope(classItem),
  ].join(' · ');

// One source course: a checkbox to include it, an expandable list of its classes each with their own
// checkbox, and - when the destination year already has a matching course - the choice between
// adding to that one or creating a separate copy.
export const CopyCourseRow = ({
  course,
  selection,
  expanded,
  destinationTitle,
  onToggleExpanded,
  onToggleCourse,
  onToggleClass,
  onSetClasses,
  onSetTargetMode,
}: CopyCourseRowProps) => {
  const isSelected = selection.courseIds.has(course.id);
  const mode = getTargetMode(course, selection);
  const match = course.destinationMatch;
  const selectedClassCount = course.classes.filter((classItem) => selection.classIds.has(classItem.id)).length;
  const mergeWithNothingTicked = isSelected && mode === 'existing' && match !== null && selectedClassCount === 0;

  return (
    <Box
      borderColor={{ color: isSelected ? 'primary' : 'surface', intensity: isSelected ? 400 : 200 }}
      bgColor={{ color: 'surface', intensity: 100 }}
      flex={{ direction: 'col', gap: 12 }}
      padding={{ base: 12 }}
      className="rounded border"
    >
      <Box flex={{ direction: 'row', align: 'center', gap: 12 }} className="flex-wrap">
        <Checkbox checked={isSelected} disabled={!course.canCopy} onCheckedChange={(checked) => onToggleCourse(checked === true)} />
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} classes in ${course.name}`}
          className="flex items-center rounded p-1 text-surface-600 hover:bg-surface-200"
        >
          <Icon as="span" name={expanded ? 'CaretDown' : 'CaretRight'} size={16} />
        </button>

        <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 flex-1">
          <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="flex-wrap">
            <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="font-medium">
              {course.name}
            </Text>
            <Pill color={{ color: 'surface', intensity: 200 }}>{formatSemesterScope(course)}</Pill>
            {!course.isPublished ? <Pill color={{ color: 'surface', intensity: 300 }}>Draft</Pill> : null}
            {match ? (
              <Pill color={{ color: match.reason === 'copied' ? 'primary' : 'amber', intensity: 200 }}>
                {match.reason === 'copied' ? `Already copied to ${destinationTitle}` : `Same name exists in ${destinationTitle}`}
              </Pill>
            ) : null}
          </Box>
          <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-sm">
            {course.classes.length === 0
              ? 'No classes'
              : isSelected
                ? `${selectedClassCount} of ${course.classes.length} class${course.classes.length === 1 ? '' : 'es'} selected`
                : `${course.classes.length} class${course.classes.length === 1 ? '' : 'es'}`}
          </Text>
        </Box>

        {course.classes.length > 0 && course.canCopy ? (
          <Box flex={{ direction: 'row', gap: 4 }}>
            <Button variant={{ kind: 'ghost', color: 'primary' }} onClick={() => onSetClasses('all')} className="px-2 py-1 text-xs">
              All classes
            </Button>
            <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={() => onSetClasses('none')} className="px-2 py-1 text-xs">
              No classes
            </Button>
          </Box>
        ) : null}
      </Box>

      {!course.canCopy && course.cannotCopyReason ? (
        <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
          {course.cannotCopyReason}
        </Text>
      ) : null}

      {isSelected && match ? (
        <Box bgColor={{ color: 'surface', intensity: 200 }} padding={{ base: 12 }} flex={{ direction: 'col', gap: 8 }} className="rounded">
          <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
            {destinationTitle} already has &ldquo;{match.name}&rdquo; ({formatSemesterScope(match)}). What should happen?
          </Text>
          <RadioGroup value={mode} onValueChange={(value) => onSetTargetMode(value as CopyTargetMode)}>
            <RadioGroupItem value="existing" label={`Add the selected classes to the existing “${match.name}”`} />
            <RadioGroupItem value="create" label="Create a separate course" />
          </RadioGroup>
          {mergeWithNothingTicked ? (
            <Text as="p" textColor={{ color: 'amber', intensity: 700 }} className="text-sm">
              Nothing to add yet - tick at least one class, or create a separate course instead.
            </Text>
          ) : null}
        </Box>
      ) : null}

      {expanded ? (
        <Box flex={{ direction: 'col', gap: 4 }} className="pl-9">
          {course.classes.length === 0 ? (
            <Text as="p" textColor={{ color: 'surface', intensity: 500 }} className="text-sm italic">
              This course has no classes to copy.
            </Text>
          ) : (
            course.classes.map((classItem) => {
              const availability = getClassAvailability(course, classItem, mode);
              return (
                <Box key={classItem.id} flex={{ direction: 'row', align: 'start', gap: 12 }} className={availability.selectable ? '' : 'opacity-60'}>
                  <Checkbox
                    checked={selection.classIds.has(classItem.id)}
                    disabled={!availability.selectable}
                    onCheckedChange={(checked) => onToggleClass(classItem, checked === true)}
                    className="mt-1"
                  />
                  <Box flex={{ direction: 'col', gap: 2 }} className="min-w-0 flex-1">
                    <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="flex-wrap">
                      <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
                        {classItem.variantLabel || formatSchedule(classItem.daysOfWeek, classItem.startTime, classItem.endTime)}
                      </Text>
                      {!classItem.isPublished ? <Pill color={{ color: 'surface', intensity: 300 }}>Draft</Pill> : null}
                      {classItem.alreadyCopied ? <Pill color={{ color: 'primary', intensity: 200 }}>Already copied</Pill> : null}
                    </Box>
                    <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                      {describeClassDetails(classItem)}
                    </Text>
                    {!availability.selectable && availability.reason && !classItem.alreadyCopied ? (
                      <Text as="span" textColor={{ color: 'amber', intensity: 700 }} className="text-xs">
                        {availability.reason}
                      </Text>
                    ) : null}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      ) : null}
    </Box>
  );
};
