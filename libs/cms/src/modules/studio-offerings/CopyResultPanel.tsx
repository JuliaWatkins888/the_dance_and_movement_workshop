import { Box, Button, Pill, Text } from '@inithium/ui';
import type { CopyCourseResultDto, OfferingCopyResultDto } from '@inithium/api-client';

export interface CopyResultPanelProps {
  readonly result: OfferingCopyResultDto;
  readonly destinationTitle: string;
  readonly onDismiss: () => void;
}

const OUTCOME_LABEL: Record<CopyCourseResultDto['outcome'], string> = {
  created: 'Course created',
  merged: 'Added to existing course',
  failed: 'Not copied',
};

const plural = (count: number, singular: string, pluralForm = `${singular}s`): string => `${count} ${count === 1 ? singular : pluralForm}`;

// What the copy actually did, course by course - including what it skipped and why, since a "skipped"
// class or a dropped instructor is exactly the kind of thing the owner needs to go and check.
export const CopyResultPanel = ({ result, destinationTitle, onDismiss }: CopyResultPanelProps) => {
  const { totals } = result;
  const createdOrMerged = totals.coursesCreated + totals.coursesMerged;

  return (
    <Box
      borderColor={{ color: totals.coursesFailed > 0 ? 'amber' : 'primary', intensity: 400 }}
      bgColor={{ color: 'surface', intensity: 100 }}
      padding={{ base: 16 }}
      flex={{ direction: 'col', gap: 12 }}
      className="rounded border"
    >
      <Box flex={{ direction: 'row', justify: 'between', align: 'start', gap: 12 }}>
        <Box flex={{ direction: 'col', gap: 2 }}>
          <Text as="h2" textColor={{ color: 'surface', intensity: 950 }} className="text-lg font-semibold">
            Copied to {destinationTitle}
          </Text>
          <Text as="p" textColor={{ color: 'surface', intensity: 700 }} className="text-sm">
            {plural(createdOrMerged, 'course')} and {plural(totals.classesCreated, 'class', 'classes')} saved as drafts - nothing is public until you publish it under Courses and
            Classes.
            {totals.classesSkipped > 0 ? ` ${plural(totals.classesSkipped, 'class', 'classes')} skipped.` : ''}
            {totals.coursesFailed > 0 ? ` ${plural(totals.coursesFailed, 'course')} could not be copied.` : ''}
          </Text>
        </Box>
        <Button variant={{ kind: 'ghost', color: 'surface' }} onClick={onDismiss}>
          Dismiss
        </Button>
      </Box>

      <Box flex={{ direction: 'col', gap: 8 }}>
        {result.results.map((entry) => (
          <Box key={entry.sourceCourseId} flex={{ direction: 'col', gap: 2 }} borderColor={{ color: 'surface', intensity: 200 }} padding={{ base: 8 }} className="rounded border">
            <Box flex={{ direction: 'row', align: 'center', gap: 8 }} className="flex-wrap">
              <Text as="span" textColor={{ color: 'surface', intensity: 950 }} className="text-sm font-medium">
                {entry.courseName}
              </Text>
              <Pill color={{ color: entry.outcome === 'failed' ? 'red' : 'primary', intensity: 200 }}>{OUTCOME_LABEL[entry.outcome]}</Pill>
              {entry.outcome !== 'failed' ? (
                <Text as="span" textColor={{ color: 'surface', intensity: 600 }} className="text-xs">
                  {plural(entry.classesCreated, 'class', 'classes')} copied
                </Text>
              ) : null}
            </Box>
            {entry.error ? (
              <Text as="p" textColor={{ color: 'red', intensity: 600 }} className="text-sm">
                {entry.error}
              </Text>
            ) : null}
            {entry.classesSkipped.map((skipped) => (
              <Text key={skipped.classId} as="p" textColor={{ color: 'amber', intensity: 700 }} className="text-sm">
                Skipped {skipped.label}: {skipped.reason}
              </Text>
            ))}
            {entry.warnings.map((warning) => (
              <Text key={warning} as="p" textColor={{ color: 'amber', intensity: 700 }} className="text-sm">
                {warning}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
};
