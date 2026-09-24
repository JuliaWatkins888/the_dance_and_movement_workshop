import { Box, Select, SelectItem, Text } from '@inithium/ui';
import { useListCoursesAdminQuery } from '@inithium/api-client';

export interface CoursePickerProps {
  readonly academicYearId: string;
  readonly value: string;
  readonly onValueChange: (courseId: string) => void;
  readonly label?: string;
}

const PAGE_SIZE = 100;

// Every course in one academic year. Exported as a hook (not just used inside CoursePicker) so a
// dialog that needs the *selected* course's own semesters can read the same cached query instead of
// making a second request for data the picker already fetched.
export const useAcademicYearCourses = (academicYearId: string) =>
  useListCoursesAdminQuery({ page: 1, pageSize: PAGE_SIZE, academicYearId }, { skip: !academicYearId });

// Scoped by academicYearId - the one deviation from AcademicYearPicker's plain-Select shape, since a
// Class's Course choice only ever makes sense within whichever year was picked first.
export const CoursePicker = ({ academicYearId, value, onValueChange, label = 'Course' }: CoursePickerProps) => {
  const { data } = useAcademicYearCourses(academicYearId);

  return (
    <Box flex={{ direction: 'col', gap: 8 }}>
      <Text as="span" textColor={{ color: 'surface', intensity: 900 }} className="text-sm font-medium">
        {label} <span className="text-red-500">*</span>
      </Text>
      {academicYearId ? (
        <Select value={value} onValueChange={onValueChange} placeholder="Select a course">
          {(data?.items ?? []).map((course) => (
            <SelectItem key={course.id} value={course.id}>
              {course.name}
            </SelectItem>
          ))}
        </Select>
      ) : (
        <Text as="p" textColor={{ color: 'surface', intensity: 500 }} className="text-sm italic">
          Choose an academic year first.
        </Text>
      )}
    </Box>
  );
};
