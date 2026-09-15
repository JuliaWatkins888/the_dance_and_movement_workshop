import { Box, Select, SelectItem, Text } from '@inithium/ui';
import { useListSemestersAdminQuery } from '@inithium/api-client';

export interface SemesterPickerProps {
  readonly value: string;
  readonly onValueChange: (semesterId: string) => void;
  readonly label?: string;
}

// Semester CRUD is rare (~twice a year), so a plain Select backed by the existing admin-list query
// at a large page size is enough - no dedicated candidates endpoint needed the way Staff/Parent
// picking needs (those exclude already-linked accounts; nothing about picking a Semester does).
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
            {semester.name}
          </SelectItem>
        ))}
      </Select>
    </Box>
  );
};
