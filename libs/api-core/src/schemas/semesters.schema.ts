import { z } from 'zod';
import { calendarDateString } from './shared/scheduling';

const semesterShape = {
  name: z.string().min(1, 'Name is required'),
  startDate: calendarDateString,
  endDate: calendarDateString,
  registrationOpensAt: calendarDateString.optional(),
  isPublished: z.boolean().optional(),
};

export const createSemesterSchema = z.object(semesterShape);
export type CreateSemesterRequestBody = z.infer<typeof createSemesterSchema>;

export const updateSemesterSchema = z.object(semesterShape).partial();
export type UpdateSemesterRequestBody = z.infer<typeof updateSemesterSchema>;
