import { Router } from 'express';
import type { Request, Response, Router as RouterType } from 'express';
import { asyncHandler, createSuccessResponse } from '@inithium/api-utils';
import { requireAuth } from '@inithium/auth';
import {
  addLedgerCharge,
  buildLedgerPaymentsCsv,
  getAccountLedger,
  listOutstandingBalances,
  recordLedgerPayment,
  searchLedgerAccounts,
  voidLedgerEntry,
} from '@inithium/ecommerce';
import type { AccountLedgerView, LedgerEntryView } from '@inithium/ecommerce';
import { requirePermission } from '@inithium/permissions';
import { addLedgerChargeSchema, ledgerPaymentsExportQuerySchema, recordLedgerPaymentSchema, voidLedgerEntrySchema } from '../schemas/ledger.schema';
import { currentUserId, normalizeParam, parseBody, parsePaging, queryString } from './ecommerce/ecommerceHttp';

const router: RouterType = Router();
const MANAGE = 'ledger:manage';
const DEFAULT_OUTSTANDING_LIMIT = 10;
const MAX_OUTSTANDING_LIMIT = 50;
const DAY_MS = 86_400_000;

// Families see their own history, but not who at the studio keyed it or any staff-only notes.
const toFamilyEntry = (entry: LedgerEntryView) => {
  const { createdByUserId: _createdBy, voidedByUserId: _voidedBy, note: _note, subscriptionId: _subscription, ...visible } = entry;
  return visible;
};

const toFamilyLedger = (ledger: AccountLedgerView) => ({ ...ledger, entries: ledger.entries.map(toFamilyEntry) });

router.get(
  '/api/ledger/mine',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const ledger = await getAccountLedger(currentUserId(req), parsePaging(req));
    res.status(200).json(createSuccessResponse(toFamilyLedger(ledger)));
  }),
);

router.get(
  '/api/ledger/outstanding',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const requested = Number(req.query['limit']) || DEFAULT_OUTSTANDING_LIMIT;
    const limit = Math.min(MAX_OUTSTANDING_LIMIT, Math.max(1, requested));
    res.status(200).json(createSuccessResponse(await listOutstandingBalances(limit)));
  }),
);

router.get(
  '/api/ledger/accounts',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const search = queryString(req, 'search');
    res.status(200).json(createSuccessResponse(search ? await searchLedgerAccounts(search) : []));
  }),
);

// Both dates are inclusive calendar days, matching how the client reads a deposit's date range.
router.get(
  '/api/ledger/payments/export.csv',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to, method } = parseBody(ledgerPaymentsExportQuerySchema, req.query);
    const csv = await buildLedgerPaymentsCsv({ from, to: new Date(to.getTime() + DAY_MS), ...(method ? { method } : {}) });
    res
      .status(200)
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', 'attachment; filename="ledger-payments.csv"')
      .send(csv);
  }),
);

router.post(
  '/api/ledger/:entryId/void',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { reason } = parseBody(voidLedgerEntrySchema, req.body);
    const entry = await voidLedgerEntry(normalizeParam(req.params['entryId']), reason, currentUserId(req));
    res.status(200).json(createSuccessResponse(entry));
  }),
);

router.get(
  '/api/users/:id/ledger',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(createSuccessResponse(await getAccountLedger(normalizeParam(req.params['id']), parsePaging(req))));
  }),
);

router.post(
  '/api/users/:id/ledger/charges',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { amountCents, description, category, studentId, dueDate, note } = parseBody(addLedgerChargeSchema, req.body);
    const entry = await addLedgerCharge(
      normalizeParam(req.params['id']),
      {
        amountCents,
        description,
        category,
        ...(studentId ? { studentId } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(note ? { note } : {}),
      },
      currentUserId(req),
    );
    res.status(201).json(createSuccessResponse(entry));
  }),
);

router.post(
  '/api/users/:id/ledger/payments',
  requireAuth,
  requirePermission(MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    const { amountCents, method, checkNumber, receivedAt, note, chargeIds } = parseBody(recordLedgerPaymentSchema, req.body);
    const entry = await recordLedgerPayment(
      normalizeParam(req.params['id']),
      {
        amountCents,
        method,
        receivedAt,
        ...(method === 'check' && checkNumber ? { checkNumber } : {}),
        ...(note ? { note } : {}),
        ...(chargeIds ? { chargeIds } : {}),
      },
      currentUserId(req),
    );
    res.status(201).json(createSuccessResponse(entry));
  }),
);

export default router;
