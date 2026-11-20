import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError, UnauthorizedError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import {
  getClassCardRedemptionRepository,
  getClassCardRepository,
  getClassCardTypeRepository,
  getClassSectionById,
  getCourseById,
  getTimeSettings,
  getUserRepository,
  toDateKey,
  zonedDateKey,
} from '@inithium/db';
import type { ClassCardEntity, ClassCardRedemptionEntity, ClassCardTypeEntity, UpdateClassCardTypeInput } from '@inithium/db';
import { redeemClassCard, voidClassCardRedemption } from '@inithium/ecommerce';
import type { ZodType } from 'zod';
import {
  checkInSessionsQuerySchema,
  createClassCardTypeSchema,
  redeemClassCardSchema,
  updateClassCardTypeSchema,
} from '../schemas/class-cards.schema';
import { buildCheckInDay } from '../services/check-in.service';

const router: RouterType = Router();

const MANAGE_TYPES = requirePermission('classes:manage');
export const CHECK_IN_CAPABILITY = 'checkin:manage';
const CHECK_IN = requirePermission(CHECK_IN_CAPABILITY);
// A family's cards show in the CMS wherever staff look at the account.
const VIEW_ACCOUNT_CARDS = requirePermission([CHECK_IN_CAPABILITY, 'registrations:desk']);

const normalizeParam = (raw: string | string[]): string => (Array.isArray(raw) ? raw[0] : raw);

const currentUserId = (req: Request): string => {
  if (!req.user) throw UnauthorizedError();
  return req.user.sub;
};

const parseBody = <T>(schema: ZodType<T>, body: unknown): T => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw ValidationError('Invalid request body', parsed.error.flatten());
  return parsed.data;
};

const toCardTypeDto = (type: ClassCardTypeEntity) => ({
  id: type.id,
  name: type.name,
  classCount: type.classCount,
  priceCents: type.priceCents,
  isActive: type.isActive,
});

const toRedemptionDto = async (redemption: ClassCardRedemptionEntity) => {
  const [section, course] = await Promise.all([getClassSectionById(redemption.sectionId), getCourseById(redemption.courseId)]);
  return {
    id: redemption.id,
    cardId: redemption.cardId,
    classDate: toDateKey(redemption.classDate),
    status: redemption.status,
    createdAt: redemption.createdAt,
    voidedAt: redemption.voidedAt,
    course: course ? { id: course.id, name: course.name, slug: course.slug } : undefined,
    section: section ? { id: section.id, daysOfWeek: section.daysOfWeek, startTime: section.startTime, endTime: section.endTime } : undefined,
  };
};

const toCardDto = (card: ClassCardEntity, redemptions: Awaited<ReturnType<typeof toRedemptionDto>>[]) => ({
  id: card.id,
  attendee: card.attendee,
  name: card.name,
  classesTotal: card.classesTotal,
  classesUsed: card.classesUsed,
  classesLeft: Math.max(0, card.classesTotal - card.classesUsed),
  status: card.status,
  cancelledAt: card.cancelledAt,
  orderId: card.orderId,
  createdAt: card.createdAt,
  redemptions: redemptions.filter((redemption) => redemption.cardId === card.id),
});

const listCardDtos = async (userId: string) => {
  const cards = await getClassCardRepository().findByUserId(userId);
  const redemptions = await getClassCardRedemptionRepository().findByCardIds(cards.map((card) => card.id));
  const redemptionDtos = await Promise.all(redemptions.map(toRedemptionDto));
  return cards.map((card) => toCardDto(card, redemptionDtos));
};

// ---- Card types --------------------------------------------------------------------------------

// What's for sale - the adult class pages list these.
router.get(
  '/api/class-card-types',
  asyncHandler(async (_req: Request, res: Response) => {
    const types = await getClassCardTypeRepository().findAll();
    res.status(200).json(createSuccessResponse(types.filter((type) => type.isActive).map(toCardTypeDto)));
  }),
);

router.get(
  '/api/class-card-types/admin',
  requireAuth,
  MANAGE_TYPES,
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse((await getClassCardTypeRepository().findAll()).map(toCardTypeDto)));
  }),
);

router.post(
  '/api/class-card-types',
  requireAuth,
  MANAGE_TYPES,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(createClassCardTypeSchema, req.body);
    res.status(201).json(createSuccessResponse(toCardTypeDto(await getClassCardTypeRepository().create(body))));
  }),
);

// A price or class-count change only affects cards bought afterwards; sold cards keep theirs.
router.put(
  '/api/class-card-types/:id',
  requireAuth,
  MANAGE_TYPES,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(updateClassCardTypeSchema, req.body);
    const input: UpdateClassCardTypeInput = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.classCount !== undefined ? { classCount: body.classCount } : {}),
      ...(body.priceCents !== undefined ? { priceCents: body.priceCents } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    };
    const updated = await getClassCardTypeRepository().update(normalizeParam(req.params['id']), input);
    if (!updated) throw NotFoundError('Class card type not found');
    res.status(200).json(createSuccessResponse(toCardTypeDto(updated)));
  }),
);

router.delete(
  '/api/class-card-types/:id',
  requireAuth,
  MANAGE_TYPES,
  asyncHandler(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params['id']);
    if (await getClassCardRepository().hasCardsOfType(id)) {
      throw ConflictError('Cards of this type have been sold. Turn it off instead so it can’t be bought.');
    }
    if (!(await getClassCardTypeRepository().delete(id))) throw NotFoundError('Class card type not found');
    res.status(200).json(createSuccessResponse({ id }));
  }),
);

// ---- Owned cards -------------------------------------------------------------------------------

router.get(
  '/api/class-cards/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await listCardDtos(currentUserId(req))));
  }),
);

router.get(
  '/api/users/:id/class-cards',
  requireAuth,
  VIEW_ACCOUNT_CARDS,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = normalizeParam(req.params['id']);
    if (!(await getUserRepository().findById(userId))) throw NotFoundError('Account not found');
    res.status(200).json(createSuccessResponse(await listCardDtos(userId)));
  }),
);

// ---- Check-in ----------------------------------------------------------------------------------

// The classes meeting on a date (default: today, studio time) with who is in each.
router.get(
  '/api/check-in/sessions',
  requireAuth,
  CHECK_IN,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = checkInSessionsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw ValidationError('Invalid date', parsed.error.flatten());
    const date = parsed.data.date ?? zonedDateKey(new Date(), (await getTimeSettings()).timezone);
    res.status(200).json(createSuccessResponse(await buildCheckInDay(date)));
  }),
);

router.post(
  '/api/check-in/redeem',
  requireAuth,
  CHECK_IN,
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(redeemClassCardSchema, req.body);
    const { card, redemption } = await redeemClassCard(body, currentUserId(req));
    res.status(201).json(createSuccessResponse({ card: toCardDto(card, []), redemption: await toRedemptionDto(redemption) }));
  }),
);

router.post(
  '/api/check-in/redemptions/:id/void',
  requireAuth,
  CHECK_IN,
  asyncHandler(async (req: Request, res: Response) => {
    const { card, redemption } = await voidClassCardRedemption(normalizeParam(req.params['id']), currentUserId(req));
    res.status(200).json(createSuccessResponse({ card: toCardDto(card, []), redemption: await toRedemptionDto(redemption) }));
  }),
);

export default router;
