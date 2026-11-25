import { ConflictError, NotFoundError, ValidationError, toCsvRow } from '@inithium/api-utils';
import { autoApply, computeBalance, getChildRepository, getLedgerEntryRepository, getUserRepository, ledgerPosition, listUsers } from '@inithium/db';
import type {
  ChildEntity,
  CreateLedgerEntryInput,
  LedgerChargeCategory,
  LedgerEntryEntity,
  LedgerPaymentMethod,
  OrderEntity,
  OrderLine,
  UserEntity,
  UserSearchField,
} from '@inithium/db';
import { toMajorUnits } from '../orders/orders-csv';
import { LEDGER_PAYMENT_PROVIDER, MANUAL_PAYMENT_PROVIDER } from '../orders/payment-collection';
import { getStoreCurrency } from '../settings';
import { accruePrivateLessonCharges } from './private-lesson-accrual';
import { accrueLedgerTuition } from './tuition-accrual';

export const LEDGER_BALANCE_SOURCE_TYPE = 'ledger_balance';
const ACCOUNT_SEARCH_LIMIT = 10;
const ACCOUNT_SEARCH_FIELDS: UserSearchField[] = ['firstName', 'lastName', 'email'];

const PAYMENT_METHOD_LABELS: Record<LedgerPaymentMethod, string> = {
  cash: 'Cash',
  check: 'Check',
  card_in_person: 'Card in person',
  other: 'Other',
  card_online: 'Card online',
};

const fullName = (person: { firstName: string; lastName?: string }): string => [person.firstName, person.lastName].filter(Boolean).join(' ');

export interface LedgerPerson {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
}

const toLedgerPerson = (user: UserEntity): LedgerPerson => ({
  id: user.id,
  firstName: user.firstName,
  ...(user.lastName ? { lastName: user.lastName } : {}),
  email: user.email,
});

const requireAccount = async (userId: string): Promise<UserEntity> => {
  const user = await getUserRepository().findById(userId);
  if (!user) throw NotFoundError('Account not found');
  return user;
};

export interface LedgerOpenChargeView {
  chargeId: string;
  description: string;
  amountCents: number;
  remainingCents: number;
  studentName?: string;
  dueDate?: Date;
  createdAt: Date;
}

export type LedgerEntryView = LedgerEntryEntity & { studentName?: string };

export interface AccountLedgerView {
  customer: LedgerPerson;
  currency: string;
  balanceCents: number;
  creditCents: number;
  openCharges: LedgerOpenChargeView[];
  students: { id: string; name: string }[];
  entries: LedgerEntryView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const getAccountLedger = async (userId: string, paging: { page: number; pageSize: number }): Promise<AccountLedgerView> => {
  await accrueLedgerTuition(userId);
  await accruePrivateLessonCharges(userId);
  const repository = getLedgerEntryRepository();
  const [customer, currency, all, history, children] = await Promise.all([
    requireAccount(userId),
    getStoreCurrency(),
    repository.findAllByUserId(userId),
    repository.findByUserId(userId, paging),
    getChildRepository().findByParentUserId(userId),
  ]);

  const nameByChildId = new Map(children.map((child: ChildEntity) => [child.id, fullName(child)]));
  const withStudent = (entry: LedgerEntryEntity): { studentName?: string } => {
    const name = entry.studentId ? nameByChildId.get(entry.studentId) : undefined;
    return name ? { studentName: name } : {};
  };

  const chargesById = new Map(all.map((entry) => [entry.id, entry]));
  const position = ledgerPosition(all);

  return {
    customer: toLedgerPerson(customer),
    currency,
    balanceCents: computeBalance(all),
    creditCents: position.creditCents,
    openCharges: position.openCharges.flatMap((open) => {
      const charge = chargesById.get(open.chargeId);
      if (!charge) return [];
      return [
        {
          chargeId: charge.id,
          description: charge.description,
          amountCents: charge.amountCents,
          remainingCents: open.remainingCents,
          ...withStudent(charge),
          ...(charge.dueDate ? { dueDate: charge.dueDate } : {}),
          createdAt: charge.createdAt,
        },
      ];
    }),
    students: children.map((child: ChildEntity) => ({ id: child.id, name: fullName(child) })),
    entries: history.items.map((entry) => ({ ...entry, ...withStudent(entry) })),
    page: history.page,
    pageSize: history.pageSize,
    total: history.total,
    totalPages: Math.max(1, Math.ceil(history.total / history.pageSize)),
  };
};

export interface AddLedgerChargeInput {
  amountCents: number;
  description: string;
  category: LedgerChargeCategory;
  studentId?: string;
  dueDate?: Date;
  note?: string;
}

export const addLedgerCharge = async (userId: string, input: AddLedgerChargeInput, actorUserId: string): Promise<LedgerEntryEntity> => {
  await requireAccount(userId);
  if (input.studentId) {
    const child = await getChildRepository().findById(input.studentId);
    if (child?.parentUserId !== userId) throw ValidationError('That student isn’t on this account');
  }
  return getLedgerEntryRepository().create({
    userId,
    kind: 'charge',
    amountCents: input.amountCents,
    description: input.description,
    category: input.category,
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.note ? { note: input.note } : {}),
    source: 'staff',
    createdByUserId: actorUserId,
  });
};

export interface RecordLedgerPaymentInput {
  amountCents: number;
  method: LedgerPaymentMethod;
  checkNumber?: string;
  receivedAt: Date;
  note?: string;
  // Omitted leaves the payment unapplied, and the ledger spreads it over the oldest open charges.
  chargeIds?: string[];
}

export const recordLedgerPayment = async (userId: string, input: RecordLedgerPaymentInput, actorUserId: string): Promise<LedgerEntryEntity> => {
  await requireAccount(userId);
  const repository = getLedgerEntryRepository();

  let appliesTo: CreateLedgerEntryInput['appliesTo'];
  if (input.chargeIds && input.chargeIds.length > 0) {
    const selected = new Set(input.chargeIds);
    const open = ledgerPosition(await repository.findAllByUserId(userId)).openCharges.filter((charge) => selected.has(charge.chargeId));
    if (open.length !== selected.size) throw ConflictError('One of those charges is no longer open. Please refresh and try again.');
    appliesTo = autoApply(input.amountCents, open);
  }

  return repository.create({
    userId,
    kind: 'payment',
    amountCents: input.amountCents,
    description: `${PAYMENT_METHOD_LABELS[input.method]} payment`,
    method: input.method,
    ...(input.checkNumber ? { checkNumber: input.checkNumber } : {}),
    receivedAt: input.receivedAt,
    ...(appliesTo ? { appliesTo } : {}),
    ...(input.note ? { note: input.note } : {}),
    source: 'staff',
    createdByUserId: actorUserId,
  });
};

// Entries written by an order mirror money that really moved through it, so they only change
// through that order (mark it refunded). Voiding one half would make a paid order look unpaid.
// Monthly tuition the system posted for a pay-in-person class can be voided to waive that month;
// it stays on the ledger, so accrual never posts the month again.
export const voidLedgerEntry = async (entryId: string, reason: string, actorUserId: string): Promise<LedgerEntryEntity> => {
  const repository = getLedgerEntryRepository();
  const entry = await repository.findById(entryId);
  if (!entry) throw NotFoundError('Ledger entry not found');
  if (entry.source !== 'staff' && entry.source !== 'system') {
    throw ConflictError('This entry came from an order. To reverse it, mark that order refunded.');
  }

  const voided = await repository.void(entryId, { voidedAt: new Date(), voidedByUserId: actorUserId, voidReason: reason });
  if (!voided) throw ConflictError('This entry has already been voided');
  return voided;
};

const orderPaymentMethod = (order: OrderEntity): LedgerPaymentMethod =>
  order.payment.provider === MANUAL_PAYMENT_PROVIDER ? 'other' : 'card_online';

const describeLines = (lines: OrderLine[]): string =>
  lines.map((line) => (line.quantity > 1 ? `${line.quantity} × ${line.name}` : line.name)).join(', ');

// A pay-in-person desk order moved no money, so it only charges the account. Monthly class lines
// are left to tuition accrual, which posts their first month and every month after it.
const recordLedgerOrderCharge = async (order: OrderEntity): Promise<void> => {
  const lines = order.lines.filter((line) => line.sourceType !== LEDGER_BALANCE_SOURCE_TYPE && line.billing.type !== 'recurring');
  const billedElsewhereCents = order.lines
    .filter((line) => line.sourceType === LEDGER_BALANCE_SOURCE_TYPE || line.billing.type === 'recurring')
    .reduce((sum, line) => sum + line.totalCents, 0);
  const amountCents = order.totals.totalCents - billedElsewhereCents;
  if (amountCents <= 0) return;
  await getLedgerEntryRepository().create({
    userId: order.userId,
    kind: 'charge',
    amountCents,
    description: describeLines(lines) || 'Order',
    source: 'order',
    orderId: order.id,
  });
};

const orderEntryOrigin = (order: OrderEntity): Pick<CreateLedgerEntryInput, 'source' | 'orderId' | 'subscriptionId'> => {
  const subscriptionId = order.kind === 'renewal' ? order.subscriptionIds[0] : undefined;
  return {
    source: order.kind === 'renewal' ? 'subscription' : 'order',
    orderId: order.id,
    ...(subscriptionId ? { subscriptionId } : {}),
  };
};

// A paid order or renewal becomes a charge and a matching card payment, so it shows in the history
// without moving the balance. Balance-payment lines are skipped: they pay existing charges rather
// than creating a new one, and recordLedgerBalancePayment writes their payment.
export const recordOrderLedgerEntries = async (order: OrderEntity): Promise<void> => {
  if (order.payment.provider === LEDGER_PAYMENT_PROVIDER) return recordLedgerOrderCharge(order);
  const balanceLines = order.lines.filter((line) => line.sourceType === LEDGER_BALANCE_SOURCE_TYPE);
  const amountCents = order.totals.totalCents - balanceLines.reduce((sum, line) => sum + line.totalCents, 0);
  if (amountCents <= 0) return;

  const repository = getLedgerEntryRepository();
  const origin = orderEntryOrigin(order);
  const description = describeLines(order.lines.filter((line) => line.sourceType !== LEDGER_BALANCE_SOURCE_TYPE));

  const charge = await repository.create({ userId: order.userId, kind: 'charge', amountCents, description: description || 'Order', ...origin });
  await repository.create({
    userId: order.userId,
    kind: 'payment',
    amountCents,
    description: `${PAYMENT_METHOD_LABELS[orderPaymentMethod(order)]} payment`,
    method: orderPaymentMethod(order),
    receivedAt: order.paidAt ?? new Date(),
    appliesTo: [{ chargeId: charge.id, amountCents }],
    ...origin,
  });
};

export const recordLedgerBalancePayment = async (line: OrderLine, order: OrderEntity): Promise<void> => {
  const repository = getLedgerEntryRepository();
  const selected = new Set((line.options['chargeIds'] ?? '').split(',').filter(Boolean));
  const open = ledgerPosition(await repository.findAllByUserId(order.userId)).openCharges.filter((charge) => selected.has(charge.chargeId));

  await repository.create({
    userId: order.userId,
    kind: 'payment',
    amountCents: line.totalCents,
    description: 'Account balance payment',
    method: orderPaymentMethod(order),
    receivedAt: order.paidAt ?? new Date(),
    appliesTo: autoApply(line.totalCents, open),
    ...orderEntryOrigin(order),
  });
};

// Mirrors everything the order wrote. Money handed back is a negative payment, and the order's own
// charge is reversed too, otherwise the family would "owe" for something they returned. A charge
// the order only paid off (a costume on the account) isn't the order's to reverse, so it reopens;
// staff void it if it's no longer owed.
export const recordOrderRefundLedgerEntries = async (order: OrderEntity): Promise<void> => {
  const repository = getLedgerEntryRepository();
  const entries = (await repository.findByOrderId(order.id)).filter((entry) => !entry.voidedAt && entry.amountCents > 0);
  const refundedAt = new Date();

  for (const entry of entries) {
    await repository.create({
      userId: entry.userId,
      kind: entry.kind,
      amountCents: -entry.amountCents,
      description: `${entry.kind === 'payment' ? 'Refund' : 'Reversed'}: ${entry.description}`,
      ...(entry.method ? { method: entry.method } : {}),
      ...(entry.kind === 'payment' ? { receivedAt: refundedAt } : {}),
      ...(entry.appliesTo
        ? { appliesTo: entry.appliesTo.map((allocation) => ({ chargeId: allocation.chargeId, amountCents: -allocation.amountCents })) }
        : {}),
      source: entry.source,
      orderId: order.id,
      ...(entry.subscriptionId ? { subscriptionId: entry.subscriptionId } : {}),
    });
  }
};

export interface LedgerAccountSummary {
  customer: LedgerPerson;
  balanceCents: number;
}

const summarize = (users: UserEntity[], balanceByUserId: Map<string, number>): LedgerAccountSummary[] =>
  users.map((user) => ({ customer: toLedgerPerson(user), balanceCents: balanceByUserId.get(user.id) ?? 0 }));

// Read by the CMS dashboard widget, which is where every account's tuition and private lessons get
// caught up.
export const listOutstandingBalances = async (limit: number): Promise<LedgerAccountSummary[]> => {
  await accrueLedgerTuition();
  await accruePrivateLessonCharges();
  const balances = await getLedgerEntryRepository().findOutstandingBalances(limit);
  const users = await Promise.all(balances.map((balance) => getUserRepository().findById(balance.userId)));
  return summarize(
    users.filter((user): user is UserEntity => user !== null),
    new Map(balances.map((balance) => [balance.userId, balance.balanceCents])),
  );
};

export const searchLedgerAccounts = async (search: string): Promise<LedgerAccountSummary[]> => {
  const results = await Promise.all(
    ACCOUNT_SEARCH_FIELDS.map((searchField) => listUsers({ page: 1, pageSize: ACCOUNT_SEARCH_LIMIT, search, searchField })),
  );
  const unique = new Map(results.flatMap((result) => result.items).map((user) => [user.id, user]));
  const users = [...unique.values()].slice(0, ACCOUNT_SEARCH_LIMIT);
  const balances = await getLedgerEntryRepository().findBalancesByUserIds(users.map((user) => user.id));
  return summarize(users, new Map(balances.map((balance) => [balance.userId, balance.balanceCents])));
};

const CSV_HEADER = [
  'Received',
  'Customer',
  'Email',
  'Method',
  'Check Number',
  'Amount',
  'Currency',
  'Description',
  'Note',
  'Source',
  'Order ID',
  'Entry ID',
];

// What a deposit is reconciled against, so voided payments are left out and refunds show as
// negative amounts on the day they were given back.
export const buildLedgerPaymentsCsv = async (options: { from: Date; to: Date; method?: LedgerPaymentMethod }): Promise<string> => {
  const [payments, currency] = await Promise.all([getLedgerEntryRepository().findPaymentsForExport(options), getStoreCurrency()]);
  const users = await Promise.all([...new Set(payments.map((payment) => payment.userId))].map((id) => getUserRepository().findById(id)));
  const usersById = new Map(users.filter((user): user is UserEntity => user !== null).map((user) => [user.id, user]));

  const rows = payments.map((payment) => {
    const user = usersById.get(payment.userId);
    return toCsvRow([
      payment.receivedAt ? payment.receivedAt.toISOString().slice(0, 10) : '',
      user ? fullName(user) : '',
      user?.email ?? '',
      payment.method ? PAYMENT_METHOD_LABELS[payment.method] : '',
      payment.checkNumber ?? '',
      toMajorUnits(payment.amountCents, currency),
      currency.toUpperCase(),
      payment.description,
      payment.note ?? '',
      payment.source,
      payment.orderId ?? '',
      payment.id,
    ]);
  });
  return [toCsvRow(CSV_HEADER), ...rows].join('\r\n');
};
