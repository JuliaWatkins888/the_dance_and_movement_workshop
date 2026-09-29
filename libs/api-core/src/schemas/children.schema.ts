import { z } from 'zod';
import { CHILD_GENDERS, ageInYears } from '@inithium/db';

// A real calendar date, not in the future, for someone under 18 today.
const isChildBirthDate = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const now = new Date();
  return date <= now && ageInYears(date, now) < 18;
};

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
    .refine((value) => isChildBirthDate(value), 'Child accounts are for ages 0-17'),
  gender: z.enum(CHILD_GENDERS),
};

export const createChildSchema = z.object(childShape);
export type CreateChildRequestBody = z.infer<typeof createChildSchema>;

export const updateChildSchema = z.object(childShape).partial();
export type UpdateChildRequestBody = z.infer<typeof updateChildSchema>;
