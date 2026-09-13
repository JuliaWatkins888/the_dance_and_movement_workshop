import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getSetting, listSettings, upsertSetting } from '@inithium/db';
import type { UpsertSettingInput } from '@inithium/db';
import { upsertSettingSchema } from '../schemas/settings.schema';

const router: RouterType = Router();

const normalizeKey = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

// Unauthenticated on purpose: settings like app.name need to be readable by anonymous public
// visitors (the Navbar, the CMS's own pre-login screen) - none of the settings this system
// currently supports are sensitive. If a genuinely private setting is ever needed, this route
// would need real per-setting visibility control before being trusted with it; flagging that
// now rather than pretending this is more locked-down than it is.
router.get(
  '/api/settings/public/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const key = normalizeKey(req.params.key);
    const setting = await getSetting(key);
    if (!setting) {
      throw NotFoundError('Setting not found');
    }
    res.status(200).json(createSuccessResponse(setting));
  }),
);

router.get(
  '/api/settings',
  requireAuth,
  requirePermission('settings:manage'),
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await listSettings();
    res.status(200).json(createSuccessResponse(settings));
  }),
);

router.patch(
  '/api/settings/:key',
  requireAuth,
  requirePermission('settings:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = upsertSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ValidationError('Invalid request body', parsed.error.flatten());
    }

    const key = normalizeKey(req.params.key);
    // Cross-field validity (value's shape matches type) was already enforced by
    // upsertSettingSchema's superRefine - Zod doesn't narrow `value` past `unknown` from that
    // alone, so this cast reflects a check that already happened, not one being skipped.
    const input = { key, type: parsed.data.type, value: parsed.data.value } as UpsertSettingInput;

    const setting = await upsertSetting(input);
    res.status(200).json(createSuccessResponse(setting));
  }),
);

export default router;
