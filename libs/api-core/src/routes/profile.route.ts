import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import {
  asyncHandler,
  createSuccessResponse,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@inithium/api-utils';
import { requireAuth, optionalAuth, hashPassword, comparePassword } from '@inithium/auth';
import { getSetting, getUserRepository, updateUser } from '@inithium/db';
import type { UserEntity } from '@inithium/db';
import { changePasswordSchema, updateMyProfileSchema, verifyPasswordSchema } from '../schemas/profile.schema';

const router: RouterType = Router();

const normalizeId = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

// Unset (nothing ever saved for this key) defaults to enabled, mirroring blog.route.ts's own
// areCommentsEnabled fallback and the CMS Settings module's fallback-to-definition-default
// behavior for a boolean setting nothing has been saved for yet.
const isProfileEnabled = async (): Promise<boolean> => {
  const setting = await getSetting('profile.enabled');
  return setting && setting.type === 'boolean' ? setting.value : true;
};

// Defaults false (off unless an admin opts in) - mirrors the setting's own `default` in
// libs/cms/src/settings/definitions/dark-mode-enabled.setting.ts. Acts as a feature kill-switch
// for the /dark-mode/toggle route below: when off, no one can flip their own darkMode preference
// regardless of its current value.
const isDarkModeFeatureEnabled = async (): Promise<boolean> => {
  const setting = await getSetting('appearance.darkModeEnabled');
  return setting && setting.type === 'boolean' ? setting.value : false;
};

// One identical message for both "profiles are disabled" and "no such user" - an attacker
// probing ids can't distinguish a real-but-gated profile from a nonexistent one.
const PROFILE_NOT_FOUND_MESSAGE = 'Profile not found';

// email is included only for the profile's own owner - every other viewer (including anonymous
// ones) never sees it. passwordHash never leaves this module regardless of viewer.
const toProfileDto = (user: UserEntity, isOwner: boolean) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  avatar: user.avatar,
  profileBanner: user.profileBanner,
  darkMode: user.darkMode,
  createdAt: user.createdAt,
  ...(isOwner ? { email: user.email } : {}),
});

router.get(
  '/api/profile/:id',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await isProfileEnabled())) {
      throw NotFoundError(PROFILE_NOT_FOUND_MESSAGE);
    }

    const id = normalizeId(req.params.id);
    const user = await getUserRepository().findById(id);
    if (!user) {
      throw NotFoundError(PROFILE_NOT_FOUND_MESSAGE);
    }

    res.status(200).json(createSuccessResponse(toProfileDto(user, req.user?.sub === id)));
  }),
);

router.patch(
  '/api/profile/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await isProfileEnabled())) {
      throw NotFoundError(PROFILE_NOT_FOUND_MESSAGE);
    }

    const parsed = updateMyProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const id = req.user!.sub;

    if (parsed.data.email) {
      const existing = await getUserRepository().findByEmail(parsed.data.email);
      if (existing && existing.id !== id) {
        throw ConflictError('A user with this email already exists');
      }
    }

    const user = await updateUser(id, {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      avatar: parsed.data.avatar,
      profileBanner: parsed.data.profileBanner,
    });
    if (!user) {
      throw NotFoundError('User not found');
    }

    res.status(200).json(createSuccessResponse(toProfileDto(user, true)));
  }),
);

// Dedicated flip endpoint rather than folding darkMode into updateMyProfileSchema - keeps a
// single source of truth for the transition (no client-supplied target value to get out of sync
// with the stored one) and lets it be gated by its own feature flag independently of the general
// profile form. Not gated by isProfileEnabled() itself - dark mode is a display preference, not
// part of the profile-viewing feature that setting controls.
router.post(
  '/api/profile/me/dark-mode/toggle',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await isDarkModeFeatureEnabled())) {
      throw ForbiddenError('Dark mode is not enabled');
    }

    const current = await getUserRepository().findById(req.user!.sub);
    if (!current) {
      throw NotFoundError('User not found');
    }

    const user = await updateUser(current.id, { darkMode: !current.darkMode });
    if (!user) {
      throw NotFoundError('User not found');
    }

    res.status(200).json(createSuccessResponse(toProfileDto(user, true)));
  }),
);

// Not gated by isProfileEnabled() - password changing must keep working even with profiles
// disabled (see the Navbar's "Change Password" drawer fallback, @inithium/ui's Navbar.tsx).
router.post(
  '/api/profile/me/password/verify',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = verifyPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const user = await getUserRepository().findById(req.user!.sub);
    if (!user) {
      throw NotFoundError('User not found');
    }

    if (!(await comparePassword(parsed.data.currentPassword, user.passwordHash))) {
      throw UnauthorizedError('Incorrect password');
    }

    res.status(200).json(createSuccessResponse({ valid: true }));
  }),
);

router.post(
  '/api/profile/me/password',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const user = await getUserRepository().findById(req.user!.sub);
    if (!user) {
      throw NotFoundError('User not found');
    }

    // Re-verified here rather than trusting the earlier /password/verify call - that endpoint
    // only exists to drive the two-step UI, never to authorize this one.
    if (!(await comparePassword(parsed.data.currentPassword, user.passwordHash))) {
      throw UnauthorizedError('Incorrect password');
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await updateUser(user.id, { passwordHash });

    res.status(200).json(createSuccessResponse({ success: true }));
  }),
);

export default router;
