import { z } from 'zod';
import { DAYS_OF_WEEK } from '@inithium/db';
import { calendarDateString, timeString, withAgeRangeCheck } from './shared/scheduling';

const classShape = {
  courseId: z.string().min(1, 'Course is required'),
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
  priceAmount: z.number().min(0, 'Price must be zero or greater'),
  billingCycle: z.string().min(1).default('Monthly'),
  capacity: z.number().int().min(0, 'Capacity must be zero or greater'),
  enrolled: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
};

export const createClassSchema = z.object(classShape).superRefine(withAgeRangeCheck);
export type CreateClassRequestBody = z.infer<typeof createClassSchema>;

export const updateClassSchema = z.object(classShape).partial().superRefine(withAgeRangeCheck);
export type UpdateClassRequestBody = z.infer<typeof updateClassSchema>;
