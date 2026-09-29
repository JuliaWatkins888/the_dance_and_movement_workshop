import { z } from 'zod';
import { COURSE_LEVELS, DAYS_OF_WEEK } from '@inithium/db';

// 24-hour "HH:mm" - matches a native <input type="time"> value directly, see class-section.contract.ts.
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeString = z.string().regex(TIME_REGEX, 'Expected 24-hour HH:mm');

// Plain calendar date "YYYY-MM-DD", converted to a UTC-midnight Date in the route handler.
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const calendarDateString = z.string().regex(DATE_REGEX, 'Expected YYYY-MM-DD');

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Expected an id');

const ageYears = z.number().min(0).max(120);
const styleList = z.array(z.string().trim().min(1).max(40)).max(10);
const staffIdList = z.array(objectIdString).max(10);

const withAgeRangeCheck = (
  data: { minAgeYears?: number | null; maxAgeYears?: number | null },
  ctx: z.RefinementCtx,
) => {
  if (data.minAgeYears != null && data.maxAgeYears != null && data.maxAgeYears < data.minAgeYears) {
    ctx.addIssue({ code: 'custom', path: ['maxAgeYears'], message: 'Max age must be greater than or equal to min age' });
  }
};

const withTimeRangeCheck = (data: { startTime?: string; endTime?: string }, ctx: z.RefinementCtx) => {
  if (data.startTime && data.endTime && data.endTime <= data.startTime) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' });
  }
};

// Update schemas accept null on optional fields so an admin can clear them (see toUpdateOperations).

const hexColor = z.string().regex(/^#[0-9a-f]{3,8}$/i, 'Expected a hex color');
const programBanner = z.object({
  cellSize: z.number().min(10).max(100),
  variance: z.number().min(0).max(1),
  xColors: z.array(hexColor).min(1).max(8),
  yColors: z.array(hexColor).min(1).max(8),
});
const imageUrl = z.string().trim().url().max(2000);
const imageSourceType = z.enum(['local', 'external']);
// Only ever a filename this API generated (see classes.route.ts's upload handler) - never a path.
const imageStorageKey = z.string().regex(/^[a-z0-9-]+\.[a-z]+$/i, 'Invalid storage key');
const programSlug = z.string().trim().regex(SLUG_REGEX, 'Use lowercase letters, numbers, and single dashes');

export const createProgramSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80),
    slug: programSlug,
    description: z.string().trim().max(2000).optional(),
    minAgeYears: ageYears.optional(),
    maxAgeYears: ageYears.optional(),
    imageUrl: imageUrl.optional(),
    imageSourceType: imageSourceType.optional(),
    imageStorageKey: imageStorageKey.optional(),
    banner: programBanner.optional(),
    order: z.number().int().optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine(withAgeRangeCheck);

export const updateProgramSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    slug: programSlug.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    minAgeYears: ageYears.nullable().optional(),
    maxAgeYears: ageYears.nullable().optional(),
    imageUrl: imageUrl.nullable().optional(),
    imageSourceType: imageSourceType.nullable().optional(),
    imageStorageKey: imageStorageKey.nullable().optional(),
    banner: programBanner.nullable().optional(),
    order: z.number().int().optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine(withAgeRangeCheck);

export const createCourseSchema = z
  .object({
    programId: objectIdString,
    name: z.string().trim().min(1, 'Name is required').max(120),
    slug: z.string().trim().regex(SLUG_REGEX, 'Use lowercase letters, numbers, and single dashes'),
    description: z.string().trim().max(4000).optional(),
    dressCode: z.string().trim().max(2000).optional(),
    styles: styleList.default([]),
    level: z.enum(COURSE_LEVELS).optional(),
    minAgeYears: ageYears.optional(),
    maxAgeYears: ageYears.optional(),
    monthlyPriceCents: z.number().int().min(0, 'Price must be zero or greater'),
    order: z.number().int().optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine(withAgeRangeCheck);

export const updateCourseSchema = z
  .object({
    programId: objectIdString.optional(),
    name: z.string().trim().min(1, 'Name is required').max(120).optional(),
    slug: z.string().trim().regex(SLUG_REGEX, 'Use lowercase letters, numbers, and single dashes').optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    dressCode: z.string().trim().max(2000).nullable().optional(),
    styles: styleList.optional(),
    level: z.enum(COURSE_LEVELS).nullable().optional(),
    minAgeYears: ageYears.nullable().optional(),
    maxAgeYears: ageYears.nullable().optional(),
    monthlyPriceCents: z.number().int().min(0, 'Price must be zero or greater').optional(),
    order: z.number().int().optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine(withAgeRangeCheck);

export const createClassSectionSchema = z
  .object({
    courseId: objectIdString,
    schoolYearId: objectIdString,
    semesterIds: z.array(objectIdString).min(1, 'Choose at least one semester'),
    instructorStaffIds: staffIdList.default([]),
    daysOfWeek: z.array(z.enum(DAYS_OF_WEEK)).min(1, 'Choose at least one day'),
    startTime: timeString,
    endTime: timeString,
    capacity: z.number().int().min(0, 'Capacity must be zero or greater'),
    enrolled: z.number().int().min(0).optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine(withTimeRangeCheck);

export const updateClassSectionSchema = z
  .object({
    courseId: objectIdString.optional(),
    schoolYearId: objectIdString.optional(),
    semesterIds: z.array(objectIdString).min(1, 'Choose at least one semester').optional(),
    instructorStaffIds: staffIdList.optional(),
    daysOfWeek: z.array(z.enum(DAYS_OF_WEEK)).min(1, 'Choose at least one day').optional(),
    startTime: timeString.optional(),
    endTime: timeString.optional(),
    capacity: z.number().int().min(0, 'Capacity must be zero or greater').optional(),
    enrolled: z.number().int().min(0).optional(),
    isPublished: z.boolean().optional(),
  })
  .superRefine(withTimeRangeCheck);

const semesterSchema = z
  .object({
    id: objectIdString.optional(),
    name: z.string().trim().min(1, 'Semester name is required').max(60),
    startDate: calendarDateString,
    endDate: calendarDateString,
  })
  .refine((semester) => semester.endDate >= semester.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date',
  });

const semesterList = z.array(semesterSchema).min(1, 'Add at least one semester').max(6);

export const createSchoolYearSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  registrationOpensAt: calendarDateString.optional(),
  semesters: semesterList,
  isPublished: z.boolean().optional(),
});

export const updateSchoolYearSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60).optional(),
  registrationOpensAt: calendarDateString.nullable().optional(),
  semesters: semesterList.optional(),
  isPublished: z.boolean().optional(),
});

export type CreateSchoolYearBody = z.infer<typeof createSchoolYearSchema>;
export type UpdateSchoolYearBody = z.infer<typeof updateSchoolYearSchema>;
