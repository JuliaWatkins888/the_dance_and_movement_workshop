# QA-13: Drop-in class purchases ($22)

- **Status:** `todo`
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

## Implementation steps

### Data
- [ ] `CourseEntity`: add `dropInPriceCents?: number` (CMS-editable, prefilled 2200 for new
      courses).
- [ ] `DropInRegistration` contract + schema: `{ id, userId, attendee, sectionId, courseId,
      classDate, orderId?, orderLineId?, ledgerEntryId?, status: 'active' | 'cancelled',
      createdAt }`, with a unique index on `(sectionId, classDate, attendee key)`.
- [ ] Repository `countForSectionDate(sectionId, date)`.

### Ecommerce
- [ ] New `drop_in` PurchasableSource. Cart line options `{ attendee, childId?, classDate }`,
      one-time billing. Validation: the date is a real upcoming session of the section (weekday
      in a semester, not a closure, not in the past), the attendee is eligible, and
      `enrolled + dropInsOnDate < capacity`. `onPaid` creates the DropInRegistration.
- [ ] Register it in `purchasables/registry.ts` so it appears in promo targeting automatically.

### API
- [ ] `GET /api/classes/sections/:id/drop-in-dates?from&to`: upcoming valid dates with
      remaining seats. Reuse calendar expansion + closures.

### Web
- [ ] Class detail page: a "Drop-in" option beside monthly/semester/year when the course has a
      drop-in price. Picking it shows a date list (next ~6 weeks) with seats left, then
      add-to-cart.
- [ ] Profile Registrations tab: list drop-ins (date, class, student), read-only.

### CMS
- [ ] Course editor: drop-in price field.
- [ ] Section roster (if present) / check-in (QA-14): show drop-ins for a date.

### Docs
- [ ] Postman: drop-in dates endpoint; cart add example with `sourceType: drop_in`.

## Acceptance criteria

- [ ] A parent can buy a $22 drop-in for an eligible student for a specific upcoming date, and it
      shows on their profile.
- [ ] A drop-in can't be bought for a closure day, a past date, an ineligible student, or a full
      date.
- [ ] A cash drop-in recorded at the desk shows in the ledger as charge + cash payment.
- [ ] Type-check passes for `db`, `ecommerce`, `api-core`, `api-client`, `cms`, `apps/web`.
      Postman updated.

## Open questions (for the client)

- Is $22 the drop-in price for every course (including 30-minute and kids' classes), or only
  some? (The per-course field handles either; this just sets what to enter.)
