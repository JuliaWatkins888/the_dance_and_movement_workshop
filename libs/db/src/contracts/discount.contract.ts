import type { PaginatedResult } from './pagination.contract';
import type { ClearableUpdate } from './commerce.contract';

// percent - `value` is 1-100
// fixed   - `value` is cents: per eligible unit for 'items' scope, split across eligible lines for 'order' scope
export const DISCOUNT_KINDS = ['percent', 'fixed'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export const DISCOUNT_SCOPES = ['order', 'items'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];

export const DISCOUNT_BILLING_TARGETS = ['all', 'one_time', 'recurring'] as const;
export type DiscountBillingTarget = (typeof DISCOUNT_BILLING_TARGETS)[number];

// How long the code keeps discounting a subscription line: 'once' covers only the charge at
// checkout, 'repeating' covers durationInMonths months from checkout, 'forever' every renewal.
export const DISCOUNT_DURATIONS = ['once', 'repeating', 'forever'] as const;
export type DiscountDuration = (typeof DISCOUNT_DURATIONS)[number];

// Only consulted for 'items' scope. Each non-empty list narrows eligibility (AND across lists, OR
// within one) - all empty means every line is eligible.
export interface DiscountTarget {
  sourceTypes: string[];
  sourceIds: string[];
  categories: string[];
}

export type DiscountSearchField = 'code';

export interface DiscountEntity {
  id: string;
  // Stored uppercased; matched case-insensitively by normalizing input the same way.
  code: string;
  description?: string;
  kind: DiscountKind;
  value: number;
  scope: DiscountScope;
  target: DiscountTarget;
  appliesToBilling: DiscountBillingTarget;
  duration: DiscountDuration;
  durationInMonths?: number;
  minSubtotalCents?: number;
  minQuantity?: number;
  startsAt?: Date;
  endsAt?: Date;
  maxRedemptions?: number;
  maxRedemptionsPerUser?: number;
  timesRedeemed: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateDiscountInput = Omit<DiscountEntity, 'id' | 'timesRedeemed' | 'createdAt' | 'updatedAt'>;
export type UpdateDiscountInput = ClearableUpdate<CreateDiscountInput>;

export interface FindManyDiscountsOptions {
  page: number;
  pageSize: number;
  search?: string;
  searchField?: DiscountSearchField;
}

export interface DiscountRepository {
  findMany: (options: FindManyDiscountsOptions) => Promise<PaginatedResult<DiscountEntity>>;
  findById: (id: string) => Promise<DiscountEntity | null>;
  findByCode: (code: string) => Promise<DiscountEntity | null>;
  create: (input: CreateDiscountInput) => Promise<DiscountEntity>;
  update: (id: string, input: UpdateDiscountInput) => Promise<DiscountEntity | null>;
  delete: (id: string) => Promise<boolean>;
  // Conditional on maxRedemptions - false when the code has just been used up by someone else.
  incrementRedemptions: (id: string) => Promise<boolean>;
}
