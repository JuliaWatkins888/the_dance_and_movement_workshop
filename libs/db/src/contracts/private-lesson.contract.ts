import type { ClassAttendee } from './class-registration.contract';
import type { DayOfWeek } from './class-section.contract';

// Dates are UTC midnight of a calendar date and times are studio wall-clock "HH:mm", the same as
// class sections.
export interface WeeklyPrivateLessonSchedule {
  kind: 'weekly';
  weekday: DayOfWeek;
  startTime: string;
  endTime: string;
  startDate: Date;
  endDate?: Date;
}

export interface OncePrivateLessonSchedule {
  kind: 'once';
  date: Date;
  startTime: string;
  endTime: string;
}

export type PrivateLessonSchedule = WeeklyPrivateLessonSchedule | OncePrivateLessonSchedule;

export const PRIVATE_LESSON_STATUSES = ['active', 'ended'] as const;
export type PrivateLessonStatus = (typeof PRIVATE_LESSON_STATUSES)[number];

// A lesson staff set up for one dancer with one instructor, e.g. "Jazz Private, Thursdays 5:00-5:30
// PM". There's no public booking. Each lesson that happens posts one charge of rateCents to the
// account's ledger.
export interface PrivateLessonEntity {
  id: string;
  userId: string; // FK -> UserEntity.id, the account that's billed
  attendee: ClassAttendee;
  instructorStaffId: string; // FK -> StaffEntity.id
  title: string;
  schedule: PrivateLessonSchedule;
  rateCents: number;
  // Staff-only.
  notes?: string;
  status: PrivateLessonStatus;
  // Set when staff end the lesson: nothing after this date happens or is charged.
  endedOn?: Date;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePrivateLessonInput = Omit<PrivateLessonEntity, 'id' | 'status' | 'endedOn' | 'createdAt' | 'updatedAt'>;
export type UpdatePrivateLessonInput = Partial<
  Pick<PrivateLessonEntity, 'attendee' | 'instructorStaffId' | 'title' | 'schedule' | 'rateCents'> & { notes: string | null }
>;

export interface PrivateLessonRepository {
  findAll: () => Promise<PrivateLessonEntity[]>;
  findById: (id: string) => Promise<PrivateLessonEntity | null>;
  findByUserId: (userId: string) => Promise<PrivateLessonEntity[]>;
  // What accrual walks: every lesson, or one account's. Ended lessons still owe for what happened.
  findBillable: (userId?: string) => Promise<PrivateLessonEntity[]>;
  create: (input: CreatePrivateLessonInput) => Promise<PrivateLessonEntity>;
  update: (id: string, input: UpdatePrivateLessonInput) => Promise<PrivateLessonEntity | null>;
  end: (id: string, endedOn: Date) => Promise<PrivateLessonEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

export const PRIVATE_LESSON_EXCEPTION_KINDS = ['cancelled', 'moved'] as const;
export type PrivateLessonExceptionKind = (typeof PRIVATE_LESSON_EXCEPTION_KINDS)[number];

// One occurrence changed: cancelled, or moved to another date/time. `date` is the date it was
// scheduled for, so there's at most one exception per occurrence.
export interface PrivateLessonExceptionEntity {
  id: string;
  lessonId: string;
  date: Date;
  kind: PrivateLessonExceptionKind;
  // Moved only.
  newDate?: Date;
  newStartTime?: string;
  newEndTime?: string;
  createdByUserId: string;
  createdAt: Date;
}

export type CreatePrivateLessonExceptionInput = Omit<PrivateLessonExceptionEntity, 'id' | 'createdAt'>;

export interface PrivateLessonExceptionRepository {
  findByLessonIds: (lessonIds: string[]) => Promise<PrivateLessonExceptionEntity[]>;
  // Replaces any exception already on that date.
  upsert: (input: CreatePrivateLessonExceptionInput) => Promise<PrivateLessonExceptionEntity>;
  deleteOne: (lessonId: string, date: Date) => Promise<boolean>;
  deleteByLessonId: (lessonId: string) => Promise<void>;
}
