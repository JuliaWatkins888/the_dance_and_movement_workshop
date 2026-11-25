# QA-15: Recurring private lessons (admin-scheduled)

- **Status:** `review`
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

### Answered 2026-11-20 (developer)

- **Billing is per lesson only.** Each lesson that happens posts one ledger charge of the
  lesson's rate once it has ended. There is no monthly cadence, so the `billing` field was dropped
  from the data model.
- **Cancelled lessons are never charged.** A lesson can only be cancelled or moved before it
  starts. After that it's billed, and staff void the charge in Accounts to waive it (the same
  approach as QA-12).
- **Hidden from the public calendar.** Private lessons appear only in the CMS. The public just sees
  Sunday's "By Appointment Only" hours from QA-06.
- **JR walkthrough skipped.** The ticket's data model was built as written (no room field).

## Pre-work

- [x] **Developer:** look at Abrianna Elliott's "Jazz Private (Thursdays)" setup in Jackrabbit.
      Skipped by the developer's choice (2026-11-20). See Findings.

## Implementation steps

### Data
- [x] `PrivateLesson` contract + schema (`libs/db/src/contracts/private-lesson.contract.ts`,
      `schemas/private-lesson.schema.ts`): `{ id, userId, attendee, instructorStaffId, title,
      schedule: weekly | once, rateCents, notes?, status: 'active' | 'ended', endedOn?,
      createdByUserId, createdAt, updatedAt }`. `billing` was dropped because billing is per lesson
      only.
- [x] `PrivateLessonException`: `{ lessonId, date, kind: 'cancelled' | 'moved', newDate?,
      newStartTime?, newEndTime? }`, unique on `(lessonId, date)`. `date` is the scheduled date,
      so a moved lesson keeps its identity and billing key.
- [x] Pure occurrence expansion `expandPrivateLesson(lesson, exceptions, closedDates, from, last)`
      in `libs/db/src/utils/private-lesson-sessions.ts`, beside the class session expansion, with
      a vitest spec. Closures skip an occurrence unless it was moved (a make-up). Moves into and
      out of the range are handled.

### Billing
- [x] Lazy, idempotent ledger accrual (`libs/ecommerce/src/ledger/private-lesson-accrual.ts`).
      Each finished, non-cancelled occurrence posts one `private_lesson` charge (with the student
      set and the due date set to the lesson date). The ledger has a new unique key
      `(privateLessonId, lessonDate)`. It runs wherever tuition accrual runs (the account ledger
      and the CMS dashboard balances widget), plus `GET /api/private-lessons/mine`, and before a
      lesson is edited or deleted, so a rate change never re-prices lessons already taught.

### API
- [x] CRUD `/api/private-lessons` (new capability `privates:manage`, admin + editor by default)
      plus `POST /:id/end`, `POST /:id/exceptions` (cancel/move) and
      `DELETE /:id/exceptions/:date` (undo). A lesson can only be deleted if it was never
      charged; otherwise staff end it.
- [x] `GET /api/private-lessons/mine` for families (no staff notes).
- [x] `GET /api/private-lessons/schedule?from&to&instructorStaffId` for the staff schedule (max 62
      days), `GET /api/private-lessons/instructors`, and `GET /api/users/:id/private-lessons`
      (`privates:manage` or `registrations:desk`).
- [x] Calendar service: **unchanged**. The public feed never includes private lessons (the answer
      was hidden). Staff see them in the module's Schedule tab instead.
- [x] `GET /api/desk/accounts` and `/api/desk/accounts/:id` also accept `privates:manage`, so the
      create dialog can reuse the desk account picker.

### CMS
- [x] `private-lessons-admin.module.tsx` ("Private Lessons"). **Lessons** tab: filter by
      instructor and status, sorted by weekday and time, with a create/edit dialog (account picker,
      student, instructor, title, weekly or one-time schedule, rate, staff notes), per-date
      cancel/move/undo on upcoming dates, end lesson (with last date), delete, and a link to the
      account's ledger.
- [x] The instructor's schedule: the module's **Schedule** tab is a week-by-week, day-by-day list
      with an instructor filter and per-occurrence cancel/move/undo. This is the "CMS calendar"
      for privates: the existing CMS Calendar module only manages entries and holidays and has no
      calendar view to add to.
- [x] Front Desk / Users → "Registrations" panel lists the account's private lessons (read-only).

### Web
- [x] Profile → Registrations: a "Private Lessons" section with the schedule, instructor, rate,
      and the next upcoming dates (moved and cancelled dates are marked).

### Docs
- [x] Postman: Private Lessons folder (13 requests, `privateLessonId` variable).

## Findings

The Jackrabbit walkthrough was skipped (developer's decision, 2026-11-20). The model follows the
ticket as written. If the client later relies on something JR captured (room, attendance), add it
as a follow-up.

## Acceptance criteria

- [ ] Staff can set up "Jazz Private, Thursdays 5:00–5:30 PM with <instructor>, starting
      <date>", and it recurs weekly, skipping studio closures. *(built; awaiting manual check)*
- [ ] Staff can cancel or move a single occurrence. *(built; awaiting manual check)*
- [ ] The family sees upcoming lessons on their profile, and charges appear in their ledger per
      the billing cadence. *(built; awaiting manual check)*
- [x] No student names are exposed publicly. The public calendar is untouched, and every lesson
      route except `/mine` (the family's own) requires `privates:manage`.
- [x] Type-check passes for all touched projects (db, ecommerce, permissions, api-core,
      api-client, cms, web, api). `db` tests pass (55). Postman updated.

## Manual test plan

1. Sign in to the CMS as an admin or editor. Open **Private Lessons** → **Lessons** → **New
   private lesson**. Pick a family, a student, an instructor, "Jazz Private", every week on
   Thursday, 5:00–5:30 PM, starting on a past Thursday, $45.
2. **Schedule** tab: it shows on each Thursday. Add a closure on a Thursday in Calendar and
   check that the lesson disappears that week.
3. Cancel a future date, then move another one. Both show as marked, and **Restore**/**Undo
   move** put them back. Started lessons have no buttons.
4. Open the family's ledger (Lessons → Ledger). Past Thursdays each have a $45 "Private lesson"
   charge, and the cancelled one doesn't. Reload the ledger: no duplicate charges.
5. Sign in as the family. Profile → Registrations shows the lesson with upcoming dates. The public
   `/calendar` shows nothing for it.
6. Try deleting the lesson (rejected, it has charges), then **End** it. No dates after the last
   date appear or get charged.

## Note for the client response

- Private lessons are set up by the studio in the CMS under **Private Lessons**. Families can't
  book them online. Sunday's "By Appointment Only" on the Contact page links to the contact form
  for requests.
- Each lesson can repeat weekly (like Abrianna's Thursday Jazz Private) or happen once. Studio
  closures and holidays skip a lesson automatically, the same as classes.
- You can cancel or move a single lesson from the **Schedule** tab before it starts. Cancelled
  lessons aren't charged.
- After each lesson, its rate is added to the family's account balance. They can pay online from
  their profile, or you can record cash or check in Accounts. To waive a lesson that already
  happened, void its charge in Accounts.
- Families see their upcoming private lessons on their profile. Lessons never appear on the
  public calendar, and student names are never shown publicly.
- Access: admins and editors can manage private lessons by default. You can grant it to others in
  Permissions ("Private Lessons").

## Open questions (for the client)

- ~~What's the private lesson rate, and is it billed per lesson or monthly on the 1st?~~ Per
  lesson, rate set per lesson in the CMS (answered 2026-11-20).
- ~~Should Sunday private lessons appear on the public calendar?~~ Hidden (answered 2026-11-20).
