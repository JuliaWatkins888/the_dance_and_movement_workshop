import type { ClearableUpdate } from './commerce.contract';

// An admin-authored calendar item that isn't sold through another module - a studio closure
// ("Carpet cleaning", a winter break) or an informational happening ("Meet the Staff Night").
export interface CalendarEntryEntity {
  id: string;
  title: string;
  description?: string;
  // UTC midnight of the calendar dates, both inclusive.
  startDate: Date;
  endDate: Date;
  // 24-hour "HH:mm" studio wall-clock times, always set together. Without them the entry is
  // all-day; with them it's one continuous span from startDate@startTime to endDate@endTime.
  // A closure is always all-day.
  startTime?: string;
  endTime?: string;
  // Hides every class session on the entry's dates. Workshops and events still run.
  isStudioClosed: boolean;
  // At the studio unless a venue is given.
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  linkUrl?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateCalendarEntryInput = Omit<CalendarEntryEntity, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCalendarEntryInput = ClearableUpdate<CreateCalendarEntryInput>;

export interface CalendarEntryRepository {
  // Unpaged - a studio adds a handful of these a year.
  findAll: () => Promise<CalendarEntryEntity[]>;
  // Entries touching [from, to] - both UTC midnights, inclusive.
  findOverlapping: (from: Date, to: Date) => Promise<CalendarEntryEntity[]>;
  findById: (id: string) => Promise<CalendarEntryEntity | null>;
  create: (input: CreateCalendarEntryInput) => Promise<CalendarEntryEntity>;
  update: (id: string, input: UpdateCalendarEntryInput) => Promise<CalendarEntryEntity | null>;
  delete: (id: string) => Promise<boolean>;
}

// The studio is closed on every US federal holiday by default. A record here marks one specific
// holiday date as open instead - it's per occurrence, so the next year's holiday is closed again.
export interface HolidayOpeningEntity {
  id: string;
  // UTC midnight of the holiday's actual date.
  date: Date;
  holidayKey: string;
  createdAt: Date;
}

export interface HolidayOpeningRepository {
  // Openings within [from, to] - both UTC midnights, inclusive.
  findInRange: (from: Date, to: Date) => Promise<HolidayOpeningEntity[]>;
  // Idempotent - opening an already-open date keeps the existing record.
  open: (date: Date, holidayKey: string) => Promise<HolidayOpeningEntity>;
  close: (date: Date) => Promise<void>;
}
