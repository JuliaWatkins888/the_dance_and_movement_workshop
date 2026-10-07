import { z } from 'zod';

// Shared by every schema that takes an account email or a new password, so normalization and
// limits can't drift between registration, admin user edits, and self-service profile edits.
// bcrypt only reads the first 72 bytes of a password; 128 characters bounds hashing cost without
// rejecting any realistic passphrase.
export const accountEmailSchema = z.string().trim().toLowerCase().pipe(z.email());
export const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerSchema = z.object({
  email: accountEmailSchema,
  password: newPasswordSchema,
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1).max(100).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: accountEmailSchema,
  password: z.string().min(1, 'Password is required').max(1024),
});
export type LoginInput = z.infer<typeof loginSchema>;
