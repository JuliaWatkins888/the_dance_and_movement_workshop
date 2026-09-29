import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse, NotFoundError, ValidationError } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import { requirePermission } from '@inithium/permissions';
import { getOrderRepository, getUserRepository, listUsers, ORDER_KINDS, ORDER_STATUSES } from '@inithium/db';
import type { OrderEntity, OrderKind, OrderStatus, UserEntity, UserSearchField } from '@inithium/db';
import {
  buildOrdersCsv,
  createManualOrder,
  getSalesReport,
  quoteManualOrder,
  SALES_PERIODS,
  setOrderStatusByAdmin,
} from '@inithium/ecommerce';
import type { SalesPeriod } from '@inithium/ecommerce';
import { manualOrderSchema, setOrderStatusSchema, updateOrderAdminSchema } from '../../schemas/ecommerce.schema';
import { currentUserId, normalizeParam, paginatedResponse, parseBody, parsePaging, queryString } from './ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ecommerce:manage-orders';
const RECORD_SALES = 'ecommerce:record-sales';
const CUSTOMER_SEARCH_LIMIT = 10;
const CUSTOMER_SEARCH_FIELDS: UserSearchField[] = ['firstName', 'lastName', 'email'];

const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
const isOrderKind = (value: unknown): value is OrderKind => typeof value === 'string' && (ORDER_KINDS as readonly string[]).includes(value);
const isSalesPeriod = (value: unknown): value is SalesPeriod =>
  typeof value === 'string' && (SALES_PERIODS as readonly string[]).includes(value);

const parseDateQuery = (req: Request, key: string): Date | undefined => {
  const raw = queryString(req, key);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw ValidationError(`Invalid "${key}" date`);
  return date;
};

const toPersonDto = (user: UserEntity | null, fallbackId: string) => ({
  id: fallbackId,
  firstName: user?.firstName ?? '',
  lastName: user?.lastName,
  email: user?.email ?? '',
});

// Admin views resolve the purchaser (and, for a staff-recorded order, who recorded it) at
// response time - orders never copy a name/email - falling back to empty values if that account
// has since been deleted.
const toAdminOrderDto = async (order: OrderEntity) => {
  const users = getUserRepository();
  const [customer, createdBy] = await Promise.all([
    users.findById(order.userId),
    order.createdByUserId ? users.findById(order.createdByUserId) : Promise.resolve(null),
  ]);
  return {
    ...order,
    customer: toPersonDto(customer, order.userId),
    ...(order.createdByUserId ? { createdBy: toPersonDto(createdBy, order.createdByUserId) } : {}),
  };
};

router.get(
  '/api/orders/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize } = parsePaging(req);
    const result = await getOrderRepository().findMany({ page, pageSize, userId: currentUserId(req) });
    res.status(200).json(paginatedResponse(result, result.items));
  }),
);

router.get(
  '/api/orders/mine/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const order = await getOrderRepository().findById(normalizeParam(req.params['id']));
    if (!order || order.userId !== currentUserId(req)) throw NotFoundError('Order not found');
    res.status(200).json(createSuccessResponse(order));
  }),
);

router.get(
  '/api/orders/admin',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, pageSize } = parsePaging(req);
    const status = req.query['status'];
    const kind = req.query['kind'];
    const userId = queryString(req, 'userId');
    const from = parseDateQuery(req, 'from');
    const to = parseDateQuery(req, 'to');
    const result = await getOrderRepository().findMany({
      page,
      pageSize,
      ...(isOrderStatus(status) ? { status } : {}),
      ...(isOrderKind(kind) ? { kind } : {}),
      ...(userId ? { userId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    res.status(200).json(paginatedResponse(result, await Promise.all(result.items.map(toAdminOrderDto))));
  }),
);

// Literal /admin/* segments are registered ahead of "/api/orders/admin/:id" - Express matches in
// registration order.

// The CMS sales widget. `tz` is the viewer's IANA timezone so day/month buckets match their
// calendar; an unknown zone falls back to UTC.
router.get(
  '/api/orders/admin/stats',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const period = req.query['period'];
    const report = await getSalesReport(isSalesPeriod(period) ? period : 'month', queryString(req, 'tz'));
    res.status(200).json(createSuccessResponse(report));
  }),
);

// One row per order created in [from, to) - defaults to everything up to now.
router.get(
  '/api/orders/admin/export.csv',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const from = parseDateQuery(req, 'from') ?? new Date(0);
    const to = parseDateQuery(req, 'to') ?? new Date();
    const status = req.query['status'];

    const orders = await getOrderRepository().findForExport({ from, to, ...(isOrderStatus(status) ? { status } : {}) });
    const userIds = [...new Set(orders.map((order) => order.userId))];
    const users = await Promise.all(userIds.map((id) => getUserRepository().findById(id)));
    const usersById = new Map(users.filter((user): user is UserEntity => user !== null).map((user) => [user.id, user]));

    res
      .status(200)
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="orders-export.csv"')
      .send(buildOrdersCsv(orders, usersById));
  }),
);

// Customer lookup for recording an order on someone's behalf - a minimal, record-sales-scoped
// view of user accounts (users.route.ts's own listing needs users:manage). Matches name or email.
router.get(
  '/api/orders/admin/customers',
  requireAuth,
  requirePermission(RECORD_SALES),
  asyncHandler(async (req: Request, res: Response) => {
    const search = queryString(req, 'search');
    const results = search
      ? await Promise.all(
          CUSTOMER_SEARCH_FIELDS.map((searchField) => listUsers({ page: 1, pageSize: CUSTOMER_SEARCH_LIMIT, search, searchField })),
        )
      : [await listUsers({ page: 1, pageSize: CUSTOMER_SEARCH_LIMIT })];

    const unique = new Map(results.flatMap((result) => result.items).map((user) => [user.id, user]));
    const customers = [...unique.values()].slice(0, CUSTOMER_SEARCH_LIMIT).map((user) => toPersonDto(user, user.id));
    res.status(200).json(createSuccessResponse(customers));
  }),
);

router.post(
  '/api/orders/admin/quote',
  requireAuth,
  requirePermission(RECORD_SALES),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await quoteManualOrder(parseBody(manualOrderSchema, req.body))));
  }),
);

// Records an order on a customer's behalf. Payment happened outside the system, so the order is
// created already paid, with no charge and no tax; stock, promo codes, and fulfillment hooks run
// exactly as they do for a checkout.
router.post(
  '/api/orders/admin',
  requireAuth,
  requirePermission(RECORD_SALES),
  asyncHandler(async (req: Request, res: Response) => {
    const order = await createManualOrder(parseBody(manualOrderSchema, req.body), currentUserId(req));
    res.status(201).json(createSuccessResponse(await toAdminOrderDto(order)));
  }),
);

router.get(
  '/api/orders/admin/:id',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const order = await getOrderRepository().findById(normalizeParam(req.params['id']));
    if (!order) throw NotFoundError('Order not found');
    res.status(200).json(createSuccessResponse(await toAdminOrderDto(order)));
  }),
);

// Staff bookkeeping only - internal notes and a tracking number. Line items and totals are a
// financial record and are never edited.
router.patch(
  '/api/orders/admin/:id',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const body = parseBody(updateOrderAdminSchema, req.body);
    const order = await getOrderRepository().update(normalizeParam(req.params['id']), {
      ...(body.internalNotes !== undefined ? { internalNotes: body.internalNotes.trim() } : {}),
      ...(body.trackingNumber !== undefined ? { trackingNumber: body.trackingNumber.trim() } : {}),
    });
    if (!order) throw NotFoundError('Order not found');
    res.status(200).json(createSuccessResponse(await toAdminOrderDto(order)));
  }),
);

// Records an outcome only (fulfilled / cancelled / refunded) - no money moves. Issuing the actual
// refund is a per-workspace process.
router.patch(
  '/api/orders/admin/:id/status',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, note } = parseBody(setOrderStatusSchema, req.body);
    const order = await setOrderStatusByAdmin(normalizeParam(req.params['id']), status, currentUserId(req), note);
    res.status(200).json(createSuccessResponse(await toAdminOrderDto(order)));
  }),
);

export default router;
