import { z } from 'zod';
import { CHILD_GENDERS } from '@inithium/db';

// parentUserId is only ever honored by the route when the caller has the children:manage
// capability (see children.route.ts) - a plain parent's own child is always forced to their own
// id regardless of what's sent here, so validating it more strictly at this layer would be
// misleading about who can actually set it.
const childShape = {
  parentUserId: z.string().min(1).optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1).optional(),
  age: z.number().int().min(0).max(17, 'Child accounts are for ages 0-17'),
  gender: z.enum(CHILD_GENDERS),
};

export const createChildSchema = z.object(childShape);
export type CreateChildRequestBody = z.infer<typeof createChildSchema>;

export const updateChildSchema = z.object(childShape).partial();
export type UpdateChildRequestBody = z.infer<typeof updateChildSchema>;
