import { z } from 'zod';
import { CHILD_GENDERS } from '@inithium/db';

// Students have no age cap (adult students can stay on a parent's account). The 1900 floor
// only catches typos like "0201".
const EARLIEST_BIRTH_DATE = new Date('1900-01-01T00:00:00.000Z');

const isRealCalendarDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const toUtcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

// parentUserId is only ever honored by the route when the caller has the children:manage
// capability (see children.route.ts) - a plain parent's own child is always forced to their own
// id regardless of what's sent here, so validating it more strictly at this layer would be
// misleading about who can actually set it.
const childShape = {
  parentUserId: z.string().min(1).optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .refine(isRealCalendarDate, 'Enter a valid date')
    .refine((value) => !isRealCalendarDate(value) || toUtcDate(value) <= new Date(), 'Date of birth can’t be in the future')
    .refine((value) => !isRealCalendarDate(value) || toUtcDate(value) >= EARLIEST_BIRTH_DATE, 'Date of birth can’t be before 1900'),
  gender: z.enum(CHILD_GENDERS),
};

export const createChildSchema = z.object(childShape);
export type CreateChildRequestBody = z.infer<typeof createChildSchema>;

export const updateChildSchema = z.object(childShape).partial();
export type UpdateChildRequestBody = z.infer<typeof updateChildSchema>;
