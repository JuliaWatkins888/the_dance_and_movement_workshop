import { z } from 'zod';
import { AVATAR_SHAPES, AVATAR_VARIANTS } from '@inithium/db';

// Mirrors page.schema.ts's pageColorSchema - libs/api-core validates against the same loose
// {color, intensity?, opacity?} shape @inithium/db's AvatarColor/UserProfileBannerConfig color
// fields use, not @inithium/ui's narrower ColorIntensity/ColorOpacity literal unions (this layer
// stays ignorant of that package too).
const avatarColorSchema = z.object({
  color: z.string().min(1),
  intensity: z.number().int().optional(),
  opacity: z.number().int().optional(),
});

const avatarStyleSchema = z.object({
  bgColor: avatarColorSchema,
  fontColor: avatarColorSchema.optional(),
  shape: z.enum(AVATAR_SHAPES),
});

const avatarDicebearSchema = z.object({
  style: z.string().min(1),
  seed: z.string().min(1),
  options: z.record(z.string(), z.string()).optional(),
});

const avatarConfigSchema = z.object({
  variant: z.enum(AVATAR_VARIANTS),
  style: avatarStyleSchema,
  dicebear: avatarDicebearSchema.optional(),
  imageUrl: z.url().optional(),
});

const profileBannerConfigSchema = z.object({
  cellSize: z.number().positive(),
  variance: z.number().min(0).max(1),
  xColors: z.array(z.string().min(1)).min(1),
  yColors: z.array(z.string().min(1)).min(1),
  imageUrl: z.url().optional(),
});

// Mirrors users.schema.ts's userShape minus `role`/`password` - self-service editing never
// touches role (admin-only, see users.route.ts's self-lockout guard) or the password (handled
// by its own two dedicated endpoints below, not this general-purpose update). avatar/profileBanner
// are whole-object replacements (the editor dialogs always send a complete config), not
// per-field patches.
export const updateMyProfileSchema = z
  .object({
    email: z.email(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1).optional(),
    avatar: avatarConfigSchema,
    profileBanner: profileBannerConfigSchema,
  })
  .partial();
export type UpdateMyProfileRequestBody = z.infer<typeof updateMyProfileSchema>;

export const verifyPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});
export type VerifyPasswordRequestBody = z.infer<typeof verifyPasswordSchema>;

// Same min-length rule as registration's password field (auth.schema.ts) - a changed password
// is held to the same bar as a newly-registered one.
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ChangePasswordRequestBody = z.infer<typeof changePasswordSchema>;
