import { z } from 'zod';
import { calendarDateString, timeString, withAgeRangeCheck } from './shared/scheduling';

const occurrenceShape = z.object({
  date: calendarDateString,
  startTime: timeString,
  endTime: timeString,
});

const workshopShape = {
  semesterId: z.string().min(1, 'Semester is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().max(4000).optional(),
  instructorIds: z.array(z.string().min(1)).default([]),
  occurrences: z.array(occurrenceShape).min(1, 'At least one occurrence is required'),
  minAgeYears: z.number().min(0).max(120).optional(),
  maxAgeYears: z.number().min(0).max(120).optional(),
  priceAmount: z.number().min(0, 'Price must be zero or greater'),
  registrationStartDate: calendarDateString.optional(),
  capacity: z.number().int().min(0, 'Capacity must be zero or greater'),
  enrolled: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
};

export const createWorkshopSchema = z.object(workshopShape).superRefine(withAgeRangeCheck);
export type CreateWorkshopRequestBody = z.infer<typeof createWorkshopSchema>;

export const updateWorkshopSchema = z.object(workshopShape).partial().superRefine(withAgeRangeCheck);
export type UpdateWorkshopRequestBody = z.infer<typeof updateWorkshopSchema>;
