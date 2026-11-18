import type { PaginatedResult } from './pagination.contract';

export const LEDGER_ENTRY_KINDS = ['charge', 'payment'] as const;
export type LedgerEntryKind = (typeof LEDGER_ENTRY_KINDS)[number];

export const LEDGER_CHARGE_CATEGORIES = ['costume', 'fee', 'tuition', 'drop_in', 'private_lesson', 'other'] as const;
export type LedgerChargeCategory = (typeof LEDGER_CHARGE_CATEGORIES)[number];

// What staff can choose when recording money taken at the desk.
export const STAFF_LEDGER_PAYMENT_METHODS = ['cash', 'check', 'card_in_person', 'other'] as const;
// card_online is only ever written by checkout and subscription renewals.
export const LEDGER_PAYMENT_METHODS = [...STAFF_LEDGER_PAYMENT_METHODS, 'card_online'] as const;
export type LedgerPaymentMethod = (typeof LEDGER_PAYMENT_METHODS)[number];

export const LEDGER_ENTRY_SOURCES = ['staff', 'order', 'subscription', 'system'] as const;
export type LedgerEntrySource = (typeof LEDGER_ENTRY_SOURCES)[number];

export interface LedgerAllocation {
  chargeId: string;
  // Negative on a refund, which hands the allocation back so the charge reopens.
  amountCents: number;
}

export interface LedgerEntryEntity {
  id: string;
  userId: string; // FK -> UserEntity.id
  kind: LedgerEntryKind;
  // Positive for everything staff enter. Negative only on a refund's reversal: a negative payment
  // is money given back, and a negative charge cancels what the refunded order had charged.
  amountCents: number;
  description: string;
  // Charges only.
  category?: LedgerChargeCategory;
  studentId?: string;
  dueDate?: Date;
  // Payments only.
  method?: LedgerPaymentMethod;
  checkNumber?: string;
  receivedAt?: Date;
  appliesTo?: LedgerAllocation[];
  // Staff-only, never shown to the family.
  note?: string;
  source: LedgerEntrySource;
  orderId?: string;
  subscriptionId?: string;
  createdByUserId?: string;
  voidedAt?: Date;
  voidedByUserId?: string;
  voidReason?: string;
  createdAt: Date;
}

export type CreateLedgerEntryInput = Omit<LedgerEntryEntity, 'id' | 'createdAt' | 'voidedAt' | 'voidedByUserId' | 'voidReason'>;

export interface VoidLedgerEntryInput {
  voidedAt: Date;
  voidedByUserId: string;
  voidReason: string;
}

export interface FindLedgerPaymentsOptions {
  // receivedAt range, inclusive of from and exclusive of to.
  from: Date;
  to: Date;
  method?: LedgerPaymentMethod;
}

export interface LedgerUserBalance {
  userId: string;
  balanceCents: number;
}

// Deliberately has no update or delete: the ledger is an audit trail, so a mistake is voided.
export interface LedgerEntryRepository {
  create: (input: CreateLedgerEntryInput) => Promise<LedgerEntryEntity>;
  findById: (id: string) => Promise<LedgerEntryEntity | null>;
  // Newest first.
  findByUserId: (userId: string, paging: { page: number; pageSize: number }) => Promise<PaginatedResult<LedgerEntryEntity>>;
  // Every entry on the account, for working out its balance.
  findAllByUserId: (userId: string) => Promise<LedgerEntryEntity[]>;
  findByOrderId: (orderId: string) => Promise<LedgerEntryEntity[]>;
  // Live payments only, oldest first - what actually has to reconcile against a deposit.
  findPaymentsForExport: (options: FindLedgerPaymentsOptions) => Promise<LedgerEntryEntity[]>;
  // Accounts that owe money, largest balance first.
  findOutstandingBalances: (limit: number) => Promise<LedgerUserBalance[]>;
  findBalancesByUserIds: (userIds: string[]) => Promise<LedgerUserBalance[]>;
  // Null when the entry doesn't exist or was already voided, so two staff can't both void it.
  void: (id: string, input: VoidLedgerEntryInput) => Promise<LedgerEntryEntity | null>;
}
