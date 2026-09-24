import { z } from 'zod';
import { DAYS_OF_WEEK } from '@inithium/db';
import { calendarDateString, timeString, withAgeRangeCheck } from './shared/scheduling';

const classShape = {
  courseId: z.string().min(1, 'Course is required'),
  // Must be a subset of the course's own semesterIds - checked in the route, which has the course.
  semesterIds: z
    .array(z.string().min(1))
    .min(1, 'Choose at least one semester')
    .max(2, 'A class can run in at most two semesters')
    .refine((ids) => new Set(ids).size === ids.length, 'Semesters must be distinct'),
  variantLabel: z.string().max(200).optional(),
  instructorIds: z.array(z.string().min(1)).default([]),
  daysOfWeek: z.array(z.enum(DAYS_OF_WEEK)).min(1, 'At least one day is required'),
  startTime: timeString,
  endTime: timeString,
  registrationStartDate: calendarDateString.optional(),
  startDate: calendarDateString,
  endDate: calendarDateString,
  minAgeYears: z.number().min(0).max(120).optional(),
  maxAgeYears: z.number().min(0).max(120).optional(),
  // The month-to-month rate; semester/year totals are derived (see classPricing.ts).
  priceAmount: z.number().min(0, 'Price must be zero or greater'),
  capacity: z.number().int().min(0, 'Capacity must be zero or greater'),
  enrolled: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
};

export const createClassSchema = z.object(classShape).superRefine(withAgeRangeCheck);
export type CreateClassRequestBody = z.infer<typeof createClassSchema>;

export const updateClassSchema = z.object(classShape).partial().superRefine(withAgeRangeCheck);
export type UpdateClassRequestBody = z.infer<typeof updateClassSchema>;
