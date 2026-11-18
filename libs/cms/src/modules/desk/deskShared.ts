import { useEffect, useState } from 'react';
import type { ClassAttendeeDto, DeskAccountDetailDto, ManualOrderLineInput } from '@inithium/api-client';

// One item on the desk order, with the labels staff see before it's priced.
export interface DeskLine {
  key: string;
  title: string;
  detail: string;
  input: ManualOrderLineInput;
}

export const personName = (person: { firstName: string; lastName?: string }): string =>
  [person.firstName, person.lastName].filter(Boolean).join(' ');

// Who can attend: each student on the account, then the account holder (adult courses only - the
// API checks eligibility for each line).
export const attendeeOptions = (account: DeskAccountDetailDto): ClassAttendeeDto[] => [
  ...account.students.map((student): ClassAttendeeDto => ({ type: 'child', childId: student.id, name: personName(student) })),
  { type: 'self', name: `${personName(account)} (account holder)` },
];

export const attendeeKey = (attendee: ClassAttendeeDto): string => (attendee.type === 'self' ? 'self' : `child:${attendee.childId}`);

export const useDebounced = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

const time = (value: string): string => {
  const [hoursRaw, minutes] = value.split(':');
  const hours = Number(hoursRaw);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`;
};

export const sectionLabel = (section: { daysOfWeek: string[]; startTime: string; endTime: string }): string =>
  `${section.daysOfWeek.map((day) => day.slice(0, 3)).join(' & ')} ${time(section.startTime)}–${time(section.endTime)}`;

// Calendar dates are stored as UTC midnight, so they're formatted in UTC to never shift a day.
const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
export const formatCalendarDay = (iso: string): string => dayFormatter.format(new Date(iso));

export const SECTION_TITLE_CLASS = 'text-lg font-semibold';
