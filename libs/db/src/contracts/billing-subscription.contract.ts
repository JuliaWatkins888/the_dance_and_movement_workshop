import type { PaginatedResult } from './pagination.contract';
import type { BillingInterval, LineOptions } from './commerce.contract';

// Named "billing" subscription to stay clear of any unrelated future "subscription" concept
// (newsletters, notifications).
//
// active   - billing normally (includes the provider's pre-first-renewal period)
// past_due - a renewal charge failed and the provider is retrying
// canceled - stopped early (every line dropped, or an admin cancel)
// ended    - ran to its scheduled endsAt
export const BILLING_SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled', 'ended'] as const;
export type BillingSubscriptionStatus = (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

export const BILLING_SUBSCRIPTION_LINE_STATUSES = ['active', 'removed'] as const;
export type BillingSubscriptionLineStatus = (typeof BILLING_SUBSCRIPTION_LINE_STATUSES)[number];

// One provider subscription item per purchased recurring line, so a single line (e.g. one dropped
// class) can stop billing without touching the rest of the subscription.
export interface BillingSubscriptionLine {
  id: string;
  orderLineId: string;
  sourceType: string;
  sourceId: string;
  variantId?: string;
  options: LineOptions;
  name: string;
  unitAmountCents: number;
  quantity: number;
  providerItemId: string;
  status: BillingSubscriptionLineStatus;
  removedAt?: Date;
}

export interface BillingSubscriptionEntity {
  id: string;
  userId: string;
  orderId: string; // the checkout order that started it
  currency: string;
  provider: string;
  providerSubscriptionId: string;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  intervalCount: number;
  currentPeriodEnd?: Date;
  endsAt?: Date;
  lines: BillingSubscriptionLine[];
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateBillingSubscriptionInput = Omit<BillingSubscriptionEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateBillingSubscriptionInput = Partial<
  Pick<BillingSubscriptionEntity, 'status' | 'currentPeriodEnd' | 'lines' | 'canceledAt'>
>;

export interface FindManyBillingSubscriptionsOptions {
  page: number;
  pageSize: number;
  status?: BillingSubscriptionStatus;
  userId?: string;
}

export interface BillingSubscriptionRepository {
  findMany: (options: FindManyBillingSubscriptionsOptions) => Promise<PaginatedResult<BillingSubscriptionEntity>>;
  findByUserId: (userId: string) => Promise<BillingSubscriptionEntity[]>;
  findById: (id: string) => Promise<BillingSubscriptionEntity | null>;
  findByProviderSubscriptionId: (providerSubscriptionId: string) => Promise<BillingSubscriptionEntity | null>;
  // Live subscriptions of one user holding an active line for this source - what a client-level
  // "drop this class" flow cancels.
  findLiveByUserAndSource: (userId: string, sourceType: string, sourceId: string) => Promise<BillingSubscriptionEntity[]>;
  create: (input: CreateBillingSubscriptionInput) => Promise<BillingSubscriptionEntity>;
  update: (id: string, input: UpdateBillingSubscriptionInput) => Promise<BillingSubscriptionEntity | null>;
}
