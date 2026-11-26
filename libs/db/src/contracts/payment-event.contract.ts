import type { PaginatedResult } from './pagination.contract';

// processing - claimed, handler running (or the process died mid-handler)
// processed  - handled successfully; a re-delivery is a duplicate no-op
// failed     - the handler threw; the provider's retry may claim it again
// rejected   - a delivery whose signature didn't verify (one rolling record, see recordRejected)
export const PAYMENT_EVENT_STATUSES = ['processing', 'processed', 'failed', 'rejected'] as const;
export type PaymentEventStatus = (typeof PAYMENT_EVENT_STATUSES)[number];

// Ledger of received webhook events. Providers deliver at-least-once, so a claimed event id is
// what turns a duplicate delivery into a no-op. It doubles as the CMS payment-health log.
export interface PaymentEventEntity {
  id: string;
  provider: string;
  eventId: string;
  type: string;
  status: PaymentEventStatus;
  // The provider object the event was about (a payment or subscription id).
  reference?: string;
  orderId?: string;
  error?: string;
  // rejected only: how many bad-signature deliveries the rolling record has counted.
  attempts?: number;
  createdAt: Date;
  // Last time anything happened to the event (a retry, the outcome, another rejected delivery).
  updatedAt: Date;
}

export interface PaymentEventOutcome {
  reference?: string;
  orderId?: string;
}

export interface FindManyPaymentEventsOptions {
  page: number;
  pageSize: number;
  status?: PaymentEventStatus;
}

export interface PaymentEventRepository {
  // false when this event is already processing or processed (a duplicate delivery). A failed
  // event can be claimed again, so the provider's retry gets processed.
  claim: (provider: string, eventId: string, type: string) => Promise<boolean>;
  markProcessed: (provider: string, eventId: string, outcome: PaymentEventOutcome) => Promise<void>;
  markFailed: (provider: string, eventId: string, error: string) => Promise<void>;
  // Bad signatures carry no trustworthy event id, and anyone can post to the webhook URL, so they
  // bump a single per-provider record instead of growing the collection.
  recordRejected: (provider: string) => Promise<void>;
  findMany: (options: FindManyPaymentEventsOptions) => Promise<PaginatedResult<PaymentEventEntity>>;
  // The newest event with a verified signature (any status but rejected).
  findLatestVerified: (provider: string) => Promise<PaymentEventEntity | null>;
  findRejected: (provider: string) => Promise<PaymentEventEntity | null>;
  countByStatusSince: (provider: string, status: PaymentEventStatus, since: Date) => Promise<number>;
}
