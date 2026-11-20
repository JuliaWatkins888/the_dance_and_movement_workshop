import type { ClassAttendee } from './class-registration.contract';

// active    - paid for; the dancer has a seat in the class on classDate
// cancelled - staff cancelled it and the seat went back. Any money is settled separately (refund
//             the order or void its ledger charge).
export const DROP_IN_STATUSES = ['active', 'cancelled'] as const;
export type DropInStatus = (typeof DROP_IN_STATUSES)[number];

// One dancer's paid seat in one class section on one date, created when the order that bought it
// is paid. `attendee.name` is a snapshot so a renamed or deleted student still reads correctly.
export interface DropInRegistrationEntity {
  id: string;
  userId: string; // FK -> UserEntity.id, the account that paid
  attendee: ClassAttendee;
  sectionId: string;
  courseId: string;
  schoolYearId: string;
  // UTC midnight of the class date.
  classDate: Date;
  orderId: string;
  orderLineId: string;
  status: DropInStatus;
  cancelledAt?: Date;
  cancelledByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateDropInRegistrationInput = Omit<
  DropInRegistrationEntity,
  'id' | 'status' | 'cancelledAt' | 'cancelledByUserId' | 'createdAt' | 'updatedAt'
>;

export interface DropInRegistrationRepository {
  findById: (id: string) => Promise<DropInRegistrationEntity | null>;
  findByUserId: (userId: string) => Promise<DropInRegistrationEntity[]>;
  findByOrderLineId: (orderLineId: string) => Promise<DropInRegistrationEntity | null>;
  findBySectionDate: (sectionId: string, classDate: Date) => Promise<DropInRegistrationEntity[]>;
  // The attendee's active drop-in on this account for the section and date, if any.
  findActiveForAttendee: (userId: string, sectionId: string, classDate: Date, attendeeKey: string) => Promise<DropInRegistrationEntity | null>;
  create: (input: CreateDropInRegistrationInput) => Promise<DropInRegistrationEntity>;
  // Compare-and-set from active, so two concurrent cancels can't both hand the seat back. null when
  // it wasn't active.
  cancel: (id: string, cancelledByUserId: string, at: Date) => Promise<DropInRegistrationEntity | null>;

  // Per-date seats are counted per section and date, apart from the section's term `enrolled`
  // counter: drop-ins and class-card check-ins share this count. A drop-in seat is held from the
  // moment an order reserves it, so unpaid checkouts count too.
  countForSectionDate: (sectionId: string, classDate: Date) => Promise<number>;
  // Held seats per date key ("YYYY-MM-DD") for dates in [from, to]; dates with none are absent.
  countForSectionDates: (sectionId: string, from: Date, to: Date) => Promise<Map<string, number>>;
  // Atomic claim that only succeeds while the date's held seats are below `limit` - false when full.
  reserveSeat: (sectionId: string, classDate: Date, limit: number) => Promise<boolean>;
  // Never takes the count below zero.
  releaseSeat: (sectionId: string, classDate: Date) => Promise<void>;
}
