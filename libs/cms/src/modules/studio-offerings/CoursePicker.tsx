import { Box, Select, SelectItem, Text } from '@inithium/ui';
import { useListCoursesAdminQuery } from '@inithium/api-client';

export interface CoursePickerProps {
  readonly semesterId: string;
  readonly value: string;
  readonly onValueChange: (courseId: string) => void;
  readonly label?: string;
}

const PAGE_SIZE = 100;

// Scoped by semesterId - the one deviation from SemesterPicker's plain-Select shape, since a
// Class's Course choice only ever makes sense within whichever Semester was picked first.
export const CoursePicker = ({ semesterId, value, onValueChange, label = 'Course' }: CoursePickerProps) => {
  const { data } = useListCoursesAdminQuery({ page: 1, pageSize: PAGE_SIZE, semesterId }, { skip: !semesterId });

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        {label} <span className="text-red-500">*</span>
      </Text>
      {semesterId ? (
        <Select value={value} onValueChange={onValueChange} placeholder="Select a course">
          {(data?.items ?? []).map((course) => (
            <SelectItem key={course.id} value={course.id}>
              {course.name}
            </SelectItem>
          ))}
        </Select>
      ) : (
        <Text as="p" textColor={{ color: 'surface', intensity: 500 }} className="text-sm italic">
          Choose a semester first.
        </Text>
      )}
    </Box>
  );
};
