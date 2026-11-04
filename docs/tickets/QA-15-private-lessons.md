# QA-15: Recurring private lessons (admin-scheduled)

- **Status:** `todo`
- **Priority:** P1
- **Depends on:** QA-06 (Sunday "By Appointment Only" copy), QA-11 (billing via ledger)
- **Branch:** `feature/qa-15-private-lessons`

## Client request

> …I would like to have Sunday say "By Appointment Only" so people can book private lessons on
> Sundays.
>
> …poke around JR's appointment booking system on my account if you get the chance.
> Specifically, Abrianna Elliott's account and booking. I have her as a "Jazz Private" on
> Thursdays and the way I was able to put her in the system as an ongoing private lesson is
> nice.

## Current state

- No appointment/private lesson concept exists. The calendar (`libs/api-core/src/services/calendar.service.ts`)
  shows classes, workshops, events, holidays and ad hoc entries.

## Decisions

- **Admin-scheduled only** for launch. There is **no public self-booking**. The public side is
  QA-06's Sunday "By Appointment Only" linking to a prefilled contact form.
- CMS "Private Lessons" module. A lesson has: student (account + student, or the account holder),
  instructor (staff), title (e.g. "Jazz Private"), schedule (recurring weekly weekday + start/end
  time with start date and optional end date, **or** a one-off date/time), rate, and billing
  cadence.
- Shows on the **calendar** for staff and on the **family's profile**. On the public calendar it
  appears only as an anonymous "Private lesson" block, or not at all (see steps). Never with
  names.
- Billing posts charges to the **ledger** (QA-11), so the family can pay online or the studio can
  record cash/check.
- Closures/holidays skip occurrences (same rule as classes).

## Pre-work

- [ ] **Developer:** look at Abrianna Elliott's "Jazz Private (Thursdays)" setup in Jackrabbit and
      note which fields JR captures (rate model, billing cadence, instructor, room, end date,
      attendance). Paste screenshots/notes into this ticket under "Findings" before building, and
      adjust the data model if JR has something the client relies on.

## Implementation steps

### Data
- [ ] `PrivateLesson` contract + schema: `{ id, userId, attendee, instructorStaffId, title,
      schedule: { kind: 'weekly', weekday, startTime, endTime, startDate, endDate? } | { kind:
      'once', date, startTime, endTime }, rateCents, billing: 'per_lesson' | 'monthly', notes?,
      status: 'active' | 'ended', createdAt, updatedAt }`.
- [ ] `PrivateLessonException`: per-date cancel/reschedule `{ lessonId, date, kind: 'cancelled' |
      'moved', newDate?, newStartTime? }`.
- [ ] Pure occurrence expansion `expandPrivateLesson(lesson, exceptions, closures, range)`,
      beside the class calendar expansion.

### Billing
- [ ] Lazy, idempotent ledger accrual (same approach as QA-12, since there's no job runner):
      `per_lesson` → one charge per occurrence once it has occurred; `monthly` → one charge per
      month on the 1st = rate × occurrences in that month (or flat rate, depending on the
      client's answer). Unique key `(lessonId, period)`.

### API
- [ ] CRUD `/api/private-lessons` (new capability `privates:manage`) and exceptions.
- [ ] `GET /api/private-lessons/mine` for families.
- [ ] Calendar service: include private lesson occurrences for staff (CMS calendar / Time
      users), plus an optional "Private lesson" busy block on the public calendar on Sundays
      (decide with the client; default **hidden** publicly).

### CMS
- [ ] `private-lessons-admin.module.tsx`: list by instructor/day, create/edit dialog, per-date
      cancel/move, end lesson.
- [ ] The instructor's schedule appears on the CMS calendar.

### Web
- [ ] Profile: "Private Lessons" list with upcoming dates and instructor.

### Docs
- [ ] Postman: Private Lessons folder.

## Findings

_(JR walkthrough notes go here.)_

## Acceptance criteria

- [ ] Staff can set up "Jazz Private, Thursdays 5:00–5:30 PM with <instructor>, starting
      <date>", and it recurs weekly, skipping studio closures.
- [ ] Staff can cancel or move a single occurrence.
- [ ] The family sees upcoming lessons on their profile, and charges appear in their ledger per
      the billing cadence.
- [ ] No student names are exposed publicly.
- [ ] Type-check passes for all touched projects. Postman updated.

## Open questions (for the client)

- What's the private lesson rate, and is it billed per lesson or monthly on the 1st (like
  tuition)?
- Should Sunday private lessons appear on the public calendar as anonymous "booked" blocks, or
  stay hidden?
