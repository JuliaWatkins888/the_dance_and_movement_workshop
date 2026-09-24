import { Box, Select, SelectItem, Text } from '@inithium/ui';
import { useListSemestersAdminQuery } from '@inithium/api-client';

export interface SemesterPickerProps {
  readonly value: string;
  readonly onValueChange: (semesterId: string) => void;
  readonly label?: string;
}

// A year only ever has two semesters, so even a few years' worth fits a plain Select backed by the
// existing admin-list query at a large page size - no dedicated candidates endpoint needed. Used for
// Workshops, which belong to a single semester rather than a year-or-term scope like Courses/Classes.
const PAGE_SIZE = 100;

export const SemesterPicker = ({ value, onValueChange, label = 'Semester' }: SemesterPickerProps) => {
  const { data } = useListSemestersAdminQuery({ page: 1, pageSize: PAGE_SIZE });

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        {label} <span className="text-red-500">*</span>
      </Text>
      <Select value={value} onValueChange={onValueChange} placeholder="Select a semester">
        {(data?.items ?? []).map((semester) => (
          <SelectItem key={semester.id} value={semester.id}>
            {semester.academicYearTitle ? `${semester.name} (${semester.academicYearTitle})` : semester.name}
          </SelectItem>
        ))}
      </Select>
    </Box>
  );
};
