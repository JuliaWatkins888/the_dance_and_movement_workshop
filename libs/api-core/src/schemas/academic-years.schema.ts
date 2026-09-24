import { z } from 'zod';
import { calendarDateString } from './shared/scheduling';

// The two semesters every year is created with. Keyed by SEMESTER_TERMS' own slugs so the route can
// iterate the terms and look each one up directly.
const semesterDatesShape = z
  .object({
    startDate: calendarDateString,
    endDate: calendarDateString,
    registrationOpensAt: calendarDateString.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate must be on or after startDate' });
    }
  });

export const createAcademicYearSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().max(4000).optional(),
  isPublished: z.boolean().optional(),
  semesters: z.object({
    'summer-fall': semesterDatesShape,
    'winter-spring': semesterDatesShape,
  }),
});
export type CreateAcademicYearRequestBody = z.infer<typeof createAcademicYearSchema>;

// Semester dates are deliberately not editable here - the Semesters module owns them.
export const updateAcademicYearSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().max(4000),
    isPublished: z.boolean(),
  })
  .partial();
export type UpdateAcademicYearRequestBody = z.infer<typeof updateAcademicYearSchema>;
