import type { ClassAttendee } from './class-registration.contract';

// One dancer's paid seat on one or more days of a workshop, created when the checkout that bought
// it is paid. `attendee.name` is a snapshot so a renamed or deleted child still reads correctly.
export interface WorkshopRegistrationEntity {
  id: string;
  userId: string; // FK -> UserEntity.id, the account that paid
  attendee: ClassAttendee;
  workshopId: string;
  dayIds: string[];
  isFullWorkshop: boolean;
  orderId: string;
  orderLineId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWorkshopRegistrationInput = Omit<WorkshopRegistrationEntity, 'id' | 'createdAt' | 'updatedAt'>;

export interface WorkshopRegistrationRepository {
  findByUserId: (userId: string) => Promise<WorkshopRegistrationEntity[]>;
  findByWorkshop: (workshopId: string) => Promise<WorkshopRegistrationEntity[]>;
  findByOrderLineId: (orderLineId: string) => Promise<WorkshopRegistrationEntity | null>;
  create: (input: CreateWorkshopRegistrationInput) => Promise<WorkshopRegistrationEntity>;
}
