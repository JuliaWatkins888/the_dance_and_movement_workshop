import type { ClassAttendee } from './class-registration.contract';

// A prepaid class card the studio sells to adults, e.g. "5-Class Card" for $80. Cards never expire.
export interface ClassCardTypeEntity {
  id: string;
  name: string;
  classCount: number;
  priceCents: number;
  // Inactive types stay on cards already sold but can't be bought.
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassCardTypeInput = Pick<ClassCardTypeEntity, 'name' | 'classCount' | 'priceCents' | 'isActive'>;
export type UpdateClassCardTypeInput = Partial<CreateClassCardTypeInput>;

export interface ClassCardTypeRepository {
  findAll: () => Promise<ClassCardTypeEntity[]>;
  findById: (id: string) => Promise<ClassCardTypeEntity | null>;
  create: (input: CreateClassCardTypeInput) => Promise<ClassCardTypeEntity>;
  update: (id: string, input: UpdateClassCardTypeInput) => Promise<ClassCardTypeEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

// active    - classes can be used until classesUsed reaches classesTotal
// cancelled - the order that bought it was refunded; unused classes are gone
export const CLASS_CARD_STATUSES = ['active', 'cancelled'] as const;
export type ClassCardStatus = (typeof CLASS_CARD_STATUSES)[number];

// One adult's card, created when the order that bought it is paid (online, or at the desk on the
// ledger - active straight away even if that charge is unpaid). Tied to one person, never shared.
export interface ClassCardEntity {
  id: string;
  userId: string; // FK -> UserEntity.id, the account that paid
  attendee: ClassAttendee;
  cardTypeId: string;
  // Snapshot of the type's name at purchase.
  name: string;
  classesTotal: number;
  classesUsed: number;
  orderId: string;
  orderLineId: string;
  status: ClassCardStatus;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassCardInput = Omit<ClassCardEntity, 'id' | 'classesUsed' | 'status' | 'cancelledAt' | 'createdAt' | 'updatedAt'>;

export interface ClassCardRepository {
  findById: (id: string) => Promise<ClassCardEntity | null>;
  findByUserId: (userId: string) => Promise<ClassCardEntity[]>;
  findByOrderLineId: (orderLineId: string) => Promise<ClassCardEntity | null>;
  hasCardsOfType: (cardTypeId: string) => Promise<boolean>;
  // Active cards with at least one class left.
  findUsable: () => Promise<ClassCardEntity[]>;
  create: (input: CreateClassCardInput) => Promise<ClassCardEntity>;
  // Atomically uses one class - null when the card isn't active or has none left.
  useClass: (id: string) => Promise<ClassCardEntity | null>;
  // Gives one class back; never below zero.
  restoreClass: (id: string) => Promise<ClassCardEntity | null>;
  // Compare-and-set from active; null when it wasn't active.
  cancel: (id: string, at: Date) => Promise<ClassCardEntity | null>;
}

// active - the class was taken from the card
// voided - staff undid the check-in and the class went back on the card
export const CLASS_CARD_REDEMPTION_STATUSES = ['active', 'voided'] as const;
export type ClassCardRedemptionStatus = (typeof CLASS_CARD_REDEMPTION_STATUSES)[number];

// One class taken from a card at check-in. It also holds a seat in the section on that date.
export interface ClassCardRedemptionEntity {
  id: string;
  cardId: string;
  userId: string;
  attendee: ClassAttendee;
  sectionId: string;
  courseId: string;
  // UTC midnight of the class date.
  classDate: Date;
  redeemedByUserId: string;
  status: ClassCardRedemptionStatus;
  voidedAt?: Date;
  voidedByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassCardRedemptionInput = Pick<
  ClassCardRedemptionEntity,
  'cardId' | 'userId' | 'attendee' | 'sectionId' | 'courseId' | 'classDate' | 'redeemedByUserId'
>;

export interface ClassCardRedemptionRepository {
  findById: (id: string) => Promise<ClassCardRedemptionEntity | null>;
  findByCardIds: (cardIds: string[]) => Promise<ClassCardRedemptionEntity[]>;
  findActiveBySectionDate: (sectionId: string, classDate: Date) => Promise<ClassCardRedemptionEntity[]>;
  // Throws a duplicate-key error (code 11000) when the attendee is already checked in to that
  // section on that date.
  create: (input: CreateClassCardRedemptionInput) => Promise<ClassCardRedemptionEntity>;
  // Compare-and-set from active, so two concurrent undos can't both restore the class.
  void: (id: string, voidedByUserId: string, at: Date) => Promise<ClassCardRedemptionEntity | null>;
}
