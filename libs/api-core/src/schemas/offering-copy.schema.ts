import { z } from 'zod';

// Where one source course's copy goes: a brand-new course in the destination year, or an existing
// destination course that the selected classes are added to (the "same name already exists" choice).
const copyTargetSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('create') }),
  z.object({ mode: z.literal('existing'), courseId: z.string().min(1, 'Choose the course to add to') }),
]);

const copyCourseEntrySchema = z.object({
  sourceCourseId: z.string().min(1),
  target: copyTargetSchema,
  // Which of the course's classes come along. Empty means "course only" - and for an existing target,
  // it's a no-op that simply reports the course as merged with nothing added.
  classIds: z.array(z.string().min(1)).max(500).refine((ids) => new Set(ids).size === ids.length, 'Classes must be distinct'),
});

export const copyOfferingsSchema = z.object({
  sourceAcademicYearId: z.string().min(1, 'Source academic year is required'),
  destinationAcademicYearId: z.string().min(1, 'Destination academic year is required'),
  courses: z
    .array(copyCourseEntrySchema)
    .min(1, 'Select at least one course to copy')
    .max(200)
    .refine((entries) => new Set(entries.map((entry) => entry.sourceCourseId)).size === entries.length, 'Each course can only be copied once per request'),
});
export type CopyOfferingsRequestBody = z.infer<typeof copyOfferingsSchema>;
