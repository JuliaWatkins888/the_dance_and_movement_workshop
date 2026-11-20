import { z } from 'zod';
import { calendarDateString } from './calendar.schema';

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Expected an id');

export const createClassCardTypeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  classCount: z.number().int().min(1).max(100),
  priceCents: z.number().int().min(0).max(10_000_00),
  isActive: z.boolean().default(true),
});
export type CreateClassCardTypeBody = z.infer<typeof createClassCardTypeSchema>;

export const updateClassCardTypeSchema = createClassCardTypeSchema.partial();
export type UpdateClassCardTypeBody = z.infer<typeof updateClassCardTypeSchema>;

export const checkInSessionsQuerySchema = z.object({ date: calendarDateString.optional() });

export const redeemClassCardSchema = z.object({
  cardId: objectIdString,
  sectionId: objectIdString,
  classDate: calendarDateString,
});
