import type { ClassPlanKind } from '../utils/class-pricing';

// active    - enrolled and attending
// withdrawn - a monthly plan the family cancelled; attends until accessEndsAt
// ended     - the paid-for term is over, or the billing stopped on its own
export const CLASS_REGISTRATION_STATUSES = ['active', 'withdrawn', 'ended'] as const;
export type ClassRegistrationStatus = (typeof CLASS_REGISTRATION_STATUSES)[number];

// Who attends: one of the account's child profiles, or the account holder themselves.
export type ClassAttendee = { type: 'child'; childId: string; name: string } | { type: 'self'; name: string };

// One dancer's enrollment in one class section, created when the checkout that bought it is paid.
// Course/section/child details are resolved at the API layer; `attendee.name` is a snapshot so a
// renamed or deleted child still reads correctly in history.
export interface ClassRegistrationEntity {
  id: string;
  userId: string; // FK -> UserEntity.id, the account that paid
  attendee: ClassAttendee;
  sectionId: string;
  courseId: string;
  schoolYearId: string;
  plan: ClassPlanKind;
  semesterId?: string;
  // The span of classes this registration pays for (endsAt exclusive).
  startsAt: Date;
  endsAt: Date;
  orderId: string;
  orderLineId: string;
  // Monthly plans only - the billing subscription line that renews it.
  subscriptionId?: string;
  subscriptionLineId?: string;
  status: ClassRegistrationStatus;
  withdrawnAt?: Date;
  // When a withdrawn monthly's last paid period ends; its seat frees once this passes.
  accessEndsAt?: Date;
  seatReleased: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassRegistrationInput = Omit<ClassRegistrationEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClassRegistrationInput = Partial<
  Pick<ClassRegistrationEntity, 'status' | 'withdrawnAt' | 'accessEndsAt' | 'seatReleased' | 'subscriptionId' | 'subscriptionLineId'>
>;

export interface ClassRegistrationRepository {
  findById: (id: string) => Promise<ClassRegistrationEntity | null>;
  findByUserId: (userId: string) => Promise<ClassRegistrationEntity[]>;
  findBySection: (sectionId: string) => Promise<ClassRegistrationEntity[]>;
  findByOrderLineId: (orderLineId: string) => Promise<ClassRegistrationEntity | null>;
  // Withdrawn registrations whose access has ended but still hold a seat.
  findSeatsToRelease: (now: Date) => Promise<ClassRegistrationEntity[]>;
  create: (input: CreateClassRegistrationInput) => Promise<ClassRegistrationEntity>;
  update: (id: string, input: UpdateClassRegistrationInput) => Promise<ClassRegistrationEntity | null>;
  // Compare-and-set so concurrent sweeps can't both release the same seat.
  markSeatReleased: (id: string) => Promise<boolean>;
}
