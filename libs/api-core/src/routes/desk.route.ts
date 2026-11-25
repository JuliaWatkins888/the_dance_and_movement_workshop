import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, ConflictError, createSuccessResponse, NotFoundError } from '@inithium/api-utils';
import { hashPassword, requireAuth } from '@inithium/auth';
import { createChild, createUser, getUserRepository, listChildrenByParentUserId, listUsers } from '@inithium/db';
import type { ChildEntity, OrderEntity, UserEntity, UserSearchField } from '@inithium/db';
import { confirmStaffOrderPayment, createDeskOrder, quoteDeskOrder } from '@inithium/ecommerce';
import type { PlaceOrderResult } from '@inithium/ecommerce';
import { requirePermission } from '@inithium/permissions';
import { deskAccountSchema, deskOrderSchema, deskQuoteSchema, deskStudentSchema } from '../schemas/desk.schema';
import { currentUserId, normalizeParam, parseBody, queryString } from './ecommerce/ecommerceHttp';

const router: RouterType = Router();
export const DESK_CAPABILITY = 'registrations:desk';
const SEARCH_LIMIT = 10;
const SEARCH_FIELDS: UserSearchField[] = ['firstName', 'lastName', 'email', 'phone'];

const toUtcDate = (calendarDate: string): Date => new Date(`${calendarDate}T00:00:00.000Z`);

const toStudentDto = (child: ChildEntity) => ({
  id: child.id,
  firstName: child.firstName,
  lastName: child.lastName,
  birthDate: child.birthDate,
  gender: child.gender,
});

const toAccountDto = (user: UserEntity) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
});

const toAccountDetailDto = async (user: UserEntity) => ({
  ...toAccountDto(user),
  students: (await listChildrenByParentUserId(user.id)).map(toStudentDto),
});

const requireAccount = async (id: string): Promise<UserEntity> => {
  const user = await getUserRepository().findById(id);
  if (!user) throw NotFoundError('Account not found');
  return user;
};

const toOrderSummary = (order: OrderEntity) => ({
  id: order.id,
  status: order.status,
  currency: order.currency,
  totals: order.totals,
  paymentProvider: order.payment.provider,
  fulfillmentErrors: order.fulfillmentErrors,
});

const toDeskOrderResult = (result: PlaceOrderResult) => ({
  status: result.status,
  order: toOrderSummary(result.order),
  ...(result.status === 'requires_action' ? { clientSecret: result.clientSecret } : {}),
});

// Account lookups are shared with the Private Lessons screen, which picks the family to bill.
const VIEW_ACCOUNTS = requirePermission([DESK_CAPABILITY, 'privates:manage']);

router.get(
  '/api/desk/accounts',
  requireAuth,
  VIEW_ACCOUNTS,
  asyncHandler(async (req: Request, res: Response) => {
    const search = queryString(req, 'search');
    if (!search) {
      res.status(200).json(createSuccessResponse([]));
      return;
    }
    const results = await Promise.all(SEARCH_FIELDS.map((searchField) => listUsers({ page: 1, pageSize: SEARCH_LIMIT, search, searchField })));
    const unique = new Map(results.flatMap((result) => result.items).map((user) => [user.id, user]));
    res.status(200).json(createSuccessResponse([...unique.values()].slice(0, SEARCH_LIMIT).map(toAccountDto)));
  }),
);

router.post(
  '/api/desk/accounts',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(deskAccountSchema, req.body);
    if (await getUserRepository().findByEmail(body.email)) {
      throw ConflictError('An account with this email already exists. Search for it instead.');
    }
    const user = await createUser({
      email: body.email,
      firstName: body.firstName,
      ...(body.lastName ? { lastName: body.lastName } : {}),
      ...(body.phone ? { phone: body.phone } : {}),
      passwordHash: await hashPassword(body.password ?? randomBytes(24).toString('base64url')),
      role: 'user',
    });
    res.status(201).json(createSuccessResponse(await toAccountDetailDto(user)));
  }),
);

router.get(
  '/api/desk/accounts/:id',
  requireAuth,
  VIEW_ACCOUNTS,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await requireAccount(normalizeParam(req.params['id']));
    res.status(200).json(createSuccessResponse(await toAccountDetailDto(user)));
  }),
);

router.post(
  '/api/desk/accounts/:id/students',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await requireAccount(normalizeParam(req.params['id']));
    const body = parseBody(deskStudentSchema, req.body);
    const child = await createChild({
      parentUserId: user.id,
      firstName: body.firstName,
      ...(body.lastName ? { lastName: body.lastName } : {}),
      birthDate: toUtcDate(body.birthDate),
      gender: body.gender,
    });
    res.status(201).json(createSuccessResponse(toStudentDto(child)));
  }),
);

// Totals (taxed when a billing address is given, for a card payment) plus the policies the family
// still has to sign for these items.
router.post(
  '/api/desk/quote',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await quoteDeskOrder(parseBody(deskQuoteSchema, req.body))));
  }),
);

router.post(
  '/api/desk/orders',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await createDeskOrder(parseBody(deskOrderSchema, req.body), currentUserId(req));
    res.status(201).json(createSuccessResponse(toDeskOrderResult(result)));
  }),
);

// After the card's bank asked for an extra step (3-D Secure) and the family completed it.
router.post(
  '/api/desk/orders/:id/confirm-payment',
  requireAuth,
  requirePermission(DESK_CAPABILITY),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await confirmStaffOrderPayment(normalizeParam(req.params['id']));
    res.status(200).json(createSuccessResponse(toDeskOrderResult(result)));
  }),
);

export default router;
