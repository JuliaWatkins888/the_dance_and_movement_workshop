// Ledger of processed webhook events. Providers deliver at-least-once, so a claimed event id is
// what turns a duplicate delivery into a no-op.
export interface PaymentEventEntity {
  id: string;
  provider: string;
  eventId: string;
  type: string;
  createdAt: Date;
}

export interface PaymentEventRepository {
  // false when this event was already claimed (a duplicate delivery).
  claim: (provider: string, eventId: string, type: string) => Promise<boolean>;
  // Undoes a claim whose processing threw, so the provider's retry is processed instead of skipped.
  release: (provider: string, eventId: string) => Promise<void>;
}
