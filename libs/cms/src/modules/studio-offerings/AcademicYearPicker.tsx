import { Box, Select, SelectItem, Text } from '@inithium/ui';
import { useListAcademicYearsAdminQuery } from '@inithium/api-client';

export interface AcademicYearPickerProps {
  readonly value: string;
  readonly onValueChange: (academicYearId: string) => void;
  readonly label?: string;
}

// Academic years are created ~once a year, so a plain Select backed by the existing admin-list
// query at a large page size is enough - no dedicated candidates endpoint needed the way Staff/
// Parent picking needs (those exclude already-linked accounts; nothing about picking a year does).
const PAGE_SIZE = 100;

export const AcademicYearPicker = ({ value, onValueChange, label = 'Academic Year' }: AcademicYearPickerProps) => {
  const { data } = useListAcademicYearsAdminQuery({ page: 1, pageSize: PAGE_SIZE });

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        {label} <span className="text-red-500">*</span>
      </Text>
      <Select value={value} onValueChange={onValueChange} placeholder="Select an academic year">
        {(data?.items ?? []).map((academicYear) => (
          <SelectItem key={academicYear.id} value={academicYear.id}>
            {academicYear.title}
          </SelectItem>
        ))}
      </Select>
    </Box>
  );
};
