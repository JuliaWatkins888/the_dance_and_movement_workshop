import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, ForbiddenError, NotFoundError, UnauthorizedError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { getUserRepository } from '@inithium/db';
import {
  getPolicyConsentStatus,
  listPolicyConsentsForUser,
  listPolicyConsentSummaries,
  recordPaperPolicyConsent,
  signPolicyConsent,
} from '@inithium/ecommerce';
import { canManageUser, requirePermission } from '@inithium/permissions';
import { recordPaperPolicyConsentSchema, signPolicyConsentSchema } from '../schemas/policy-consent.schema';
import { currentUserId, normalizeParam, parseBody } from './ecommerce/ecommerceHttp';

const router: RouterType = Router();

const MAX_USER_AGENT_LENGTH = 500;

router.get(
  '/api/policy-consent/status',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getPolicyConsentStatus(currentUserId(req))));
  }),
);

router.get(
  '/api/policy-consent/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listPolicyConsentSummaries(currentUserId(req))));
  }),
);

// IP and user agent come from the request rather than the body, so a client can't choose its own.
router.post(
  '/api/policy-consent',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { versionHash, signedName } = parseBody(signPolicyConsentSchema, req.body);
    const userAgent = req.get('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH);
    const created = await signPolicyConsent(currentUserId(req), {
      versionHash,
      signedName,
      ...(req.ip ? { ipAddress: req.ip } : {}),
      ...(userAgent ? { userAgent } : {}),
    });
    res.status(created.length > 0 ? 201 : 200).json(createSuccessResponse(created));
  }),
);

router.get(
  '/api/users/:id/policy-consents',
  requireAuth,
  requirePermission('users:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listPolicyConsentsForUser(normalizeParam(req.params['id']))));
  }),
);

router.post(
  '/api/users/:id/policy-consents/paper',
  requireAuth,
  requirePermission('users:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(recordPaperPolicyConsentSchema, req.body);
    const actor = req.permissionUser;
    if (!actor) throw UnauthorizedError();

    const target = await getUserRepository().findById(normalizeParam(req.params['id']));
    if (!target) throw NotFoundError('User not found');
    if (!canManageUser(actor, target)) {
      throw ForbiddenError('You cannot manage an account with more permissions than your own');
    }

    const consent = await recordPaperPolicyConsent(target.id, {
      ...body,
      recordedByUserId: actor.id,
      recordedByName: [actor.firstName, actor.lastName].filter(Boolean).join(' ') || actor.email,
    });
    res.status(201).json(createSuccessResponse(consent));
  }),
);

export default router;
