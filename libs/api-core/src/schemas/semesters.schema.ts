import { z } from 'zod';
import { calendarDateString } from './shared/scheduling';

// Edit-only: a semester's parent year and term slot are fixed when its academic year is created
// (see academic-years.route.ts), so neither appears here.
const semesterShape = {
  name: z.string().trim().min(1, 'Name is required'),
  startDate: calendarDateString,
  endDate: calendarDateString,
  registrationOpensAt: calendarDateString.optional(),
  isPublished: z.boolean().optional(),
};

export const updateSemesterSchema = z.object(semesterShape).partial();
export type UpdateSemesterRequestBody = z.infer<typeof updateSemesterSchema>;
