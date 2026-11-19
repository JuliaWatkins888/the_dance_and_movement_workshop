# QA-13: Drop-in class purchases ($22)

- **Status:** `review`
- **Priority:** P1
- **Depends on:** QA-11 (cash drop-ins recorded via ledger). Desk flow lands in QA-12.
- **Branch:** `feature/qa-13-drop-ins`

## Client request

> Option for "Drop-in" missing ($22/drop in)…

## Current state

- Class plans are `monthly` | `semester` | `year` (`ClassPlanKind`, `libs/db/src/utils/class-pricing`).
  The `class` PurchasableSource (`libs/ecommerce/src/purchasables/class.purchasable.ts`) reserves a
  seat on the section for the whole term.
- Section capacity is one `enrolled` counter (`ClassSectionEntity.enrolled`), not per date.
- The calendar already expands section weekdays over semesters and hides closure days
  (`libs/api-core/src/services/calendar.service.ts`). Reuse that to list valid drop-in dates.

## Decisions

- Drop-ins are open to **any eligible attendee** (same age rules as the course), not just adults.
- The price is **admin-set per course** (`dropInPriceCents`, default $22). Leaving it blank
  disables drop-ins for that course.
- Bought **online** on the class page by picking a specific upcoming class date, or **at the
  desk** (QA-12), where a cash drop-in is just a ledger charge + cash payment.
- A drop-in takes **one seat on that date only**: it's blocked when term enrollments + drop-ins
  for that date reach capacity.
- No discounts/plan math. Promo codes apply only if the admin targets them (existing promo
  scoping).

## Answers (developer, 2026-11-18)

- **Online cutoff:** a drop-in for a date can be bought until that class starts, in studio local
  time (the time zone set under Time Clock settings).
- **Cancelling:** staff only, from the CMS. Cancelling frees the seat. Money is handled separately:
  refund the order, or void the ledger charge if it was paid in person. Families can't cancel.
- **Enrolled dancers** may drop in to a *different* section of a course they're enrolled in (e.g. a
  makeup class). They're blocked only when they already hold a seat in that exact section on that
  date, from an enrollment or another drop-in.
- QA-11 and QA-12 were merged to `main` first, and this branch starts from `main`.

## Implementation steps

### Data
- [x] `CourseEntity`: add `dropInPriceCents?: number` (CMS-editable, prefilled 2200 for new
      courses).
- [x] `DropInRegistration` contract + schema: `{ id, userId, attendee, sectionId, courseId,
      classDate, orderId?, orderLineId?, ledgerEntryId?, status: 'active' | 'cancelled',
      createdAt }`, with a unique index on `(sectionId, classDate, attendee key)`.
- [x] Repository `countForSectionDate(sectionId, date)`.

### Ecommerce
- [x] New `drop_in` PurchasableSource. Cart line options `{ attendee, childId?, classDate }`,
      one-time billing. Validation: the date is a real upcoming session of the section (weekday
      in a semester, not a closure, not in the past), the attendee is eligible, and
      `enrolled + dropInsOnDate < capacity`. `onPaid` creates the DropInRegistration.
- [x] Register it in `purchasables/registry.ts` so it appears in promo targeting automatically.

### API
- [x] `GET /api/classes/sections/:id/drop-in-dates?from&to`: upcoming valid dates with
      remaining seats. Reuse calendar expansion + closures.

### Web
- [x] Class detail page: a "Drop-in" option beside monthly/semester/year when the course has a
      drop-in price. Picking it shows a date list (next ~6 weeks) with seats left, then
      add-to-cart.
- [x] Profile Registrations tab: list drop-ins (date, class, student), read-only.

### CMS
- [x] Course editor: drop-in price field.
- [x] ~~Section roster~~ There's no section roster in the CMS yet. Drop-ins show (with Cancel) in
      the account's Registrations dialog. Per-date lists are left for check-in (QA-14), which can use
      `findBySectionDate(sectionId, classDate)` on the drop-in repository.

### Docs
- [x] Postman: drop-in dates endpoint; cart add example with `sourceType: drop_in`.

## Acceptance criteria

Awaiting the developer's manual test. Only the type-check item is verified so far.

- [ ] A parent can buy a $22 drop-in for an eligible student for a specific upcoming date, and it
      shows on their profile.
- [ ] A drop-in can't be bought for a closure day, a past date, an ineligible student, or a full
      date.
- [ ] A cash drop-in recorded at the desk shows in the ledger as charge + cash payment.
- [x] Type-check passes for `db`, `ecommerce`, `api-core`, `api-client`, `cms`, `apps/web`.
      Postman updated.

## Open questions (for the client)

- Is $22 the drop-in price for every course (including 30-minute and kids' classes), or only
  some? (The per-course field handles either; this just sets what to enter.)

## Notes from QA-09

Registration lines need a policy signature. Set `requiresPolicyConsent: true` on the new purchasable
source, and add `policySchoolYearId` if its lines belong to a specific school year. Without that
function, a line counts toward the current school year.

## Work done

- **Data.** `CourseEntity.dropInPriceCents` (blank = no drop-ins). New `DropInRegistration` records
  (`libs/db/src/contracts/drop-in-registration.contract.ts`), with a partial unique index so a dancer
  holds at most one *active* drop-in per section and date. A booking cancelled by staff doesn't block
  rebooking.
- **Seats.** Each section and date has its own `DropInSeat` counter, separate from the term
  `enrolled` count. Checkout claims a seat atomically before payment, the same way workshop days
  work, so two families can't both take the last seat. A failed or abandoned checkout gives it back.
  A date's room is `capacity − enrolled − drop-ins held`.
- **Dates.** The calendar's session expansion and closure logic moved into `@inithium/db`
  (`utils/class-sessions.ts`, `class-registrations/drop-in.rules.ts`). The public calendar and
  drop-ins now share it, so a closure hides a class from both. The studio time-zone helpers moved
  from `api-core/routes/time/timeZoneMath.ts` to `db/utils/zoned-time.ts`, and the old path
  re-exports them.
- **Checkout.** `libs/ecommerce/src/purchasables/drop-in.purchasable.ts`, source type `drop_in`.
  Cart options: `{ attendee, childId?, classDate: 'YYYY-MM-DD' }`. It requires a policy signature for
  the section's school year. Each rule has its own rejection message: not a class day, studio closed,
  class already started, registration not open, ineligible dancer, already enrolled in this section,
  already has a drop-in that date, date full. Promo codes reach drop-ins through the new **Drop-ins**
  item type in the discount editor. Drop-in lines also carry the program name as their category, the
  same as class lines.
- **Front desk.** The Front Desk "Add" picker has a **Drop-in** option (class → section → date →
  dancer). Pay in person posts a ledger charge, and the cash recorded at the desk is applied to it,
  through QA-12's existing path. Card works like any one-time line.
- **API.** `GET /api/classes/sections/:id/drop-in-dates?from&to` (public; `to` is exclusive, default
  six weeks), `GET /api/drop-ins/mine`, `GET /api/users/:id/drop-ins` and
  `POST /api/drop-ins/:id/cancel` (both `registrations:desk`). Routes are in
  `libs/api-core/src/routes/drop-ins.route.ts`.
- **Web.** The class page shows a **Drop-in** card under "Choose how to pay" when the course has a
  price. Picking it adds a "Pick a date" step with seats left per date. The profile Registrations
  tab lists drop-ins read-only.
- **CMS.** The course editor has a Drop-in Price field, prefilled $22.00 for new courses. The catalog
  shows it beside the monthly price. CMS → Users → Registrations (and the Front Desk link) shows a
  Drop-ins group with **Cancel**.
- **Tests.** `libs/db/src/utils/class-sessions.spec.ts` covers session dates, closures, date-key
  validation and studio-time conversion. The whole db suite passes (48 tests).

### Notes for the developer

- **Existing courses have no drop-in price**, so drop-ins stay off until one is entered on each
  course. New courses start at $22.00. There's no seed script (per the ticket rules), so this is a
  CMS edit.
- **The start-time cutoff also applies at the desk.** Staff can't add a drop-in once that day's class
  has started. A walk-in after the start would be recorded as a plain ledger charge and payment in
  Accounts.
- **Term registrations don't check drop-ins.** A section with one seat left can still sell a monthly
  plan even if that seat is taken by a drop-in on some date. That date would then run one over
  capacity. The ticket only asked for drop-ins to be blocked by term enrollments, so this was left
  as is.
- The ticket's `ledgerEntryId` field wasn't added. A desk drop-in's ledger charge is already linked
  through `orderId`, the same way QA-12 links charges to orders.

### Manual test checklist

1. CMS → Classes: set a course's Drop-in Price (e.g. $22.00).
2. As a parent, open that class, pick a time, a student, then **Drop-in** → a date → Add to cart →
   checkout (sign policies if asked). The drop-in shows under Profile → Registrations.
3. Try a closure day (add a closure in CMS → Calendar), today after class start, a student outside
   the age range, and a date with no seats left (set capacity = enrolled + 1 and buy it twice). Each
   should be rejected.
4. Front Desk: add a **Drop-in** for a student, pay in person with $22 cash. Accounts shows the
   charge and the cash payment.
5. CMS → Users → Registrations: **Cancel** the drop-in. The seat reappears on the class page.

## Note for the client response

Include this in the client response once this branch is deployed.

> **Drop-ins are now available.** Each class has its own drop-in price, set in the CMS under
> Classes → edit the course → **Drop-in Price**. New courses start at $22.00. Existing courses are
> blank, which means no drop-ins, until you enter a price, so you choose which classes offer them.
>
> - **Online:** on a class page, families pick a time, the student, then **Drop-in** and a date from
>   the next six weeks. Dates the studio is closed don't appear, and a date can be booked until the
>   class starts. The same age rules apply as for regular registration. A drop-in uses a seat for
>   that date only, so a full class can't take drop-ins.
> - **At the front desk:** in Front Desk, choose **Drop-in** when adding items. If they pay cash,
>   choose "Pay in person" and record the cash. It shows on their account as a charge and a payment.
> - **Cancelling:** families can't cancel a drop-in themselves. In the CMS, open the family under
>   Users → **Registrations** and press **Cancel** next to the drop-in. That frees the seat. If they
>   should get their money back, refund the order (or void the charge in Accounts if they paid at
>   the desk).
> - **Promo codes** only apply to drop-ins when you tick **Drop-ins** under the code's item types.
>
> One question still open: is $22 the drop-in price for every class, including 30-minute and kids'
> classes? Each course has its own price field, so either way works. We just want to set it right.
