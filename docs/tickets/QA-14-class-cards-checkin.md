# QA-14: Adult class cards + CMS check-in

- **Status:** `todo`
- **Priority:** P1
- **Depends on:** QA-11 (cash/check sales via ledger)
- **Branch:** `feature/qa-14-class-cards`

## Client request

> …and also need a "class card" option for adults ONLY. (5 classes $80, 10 for $160 and they
> never expire)

## Current state

- There are no prepaid credits or attendance tracking (no check-in model anywhere).
- Adult courses are those with `minAgeYears >= 18`. Only the account holder ("self") can register
  for them today, and after QA-03 an 18+ student on a parent's account can too.

## Decisions

- Card products are **admin-configurable** (name, class count, price), seeded by the client in
  the CMS as "5-Class Card $80" and "10-Class Card $160". **No expiry.**
- **Adults only**: a card can be bought for the account holder or an 18+ student, and redeemed
  only in courses with `minAgeYears >= 18`.
- **Redemption is staff check-in in the CMS**: a new Check-in screen lists today's sections, and
  staff tap an adult to deduct one class. No online self-booking.
- Balance and history show on the adult's profile.
- Sold online (normal checkout) or at the desk (QA-12; cash/check via ledger).

## Implementation steps

### Data
- [ ] `ClassCardType` (admin catalog): `{ id, name, classCount, priceCents, isActive }`.
- [ ] `ClassCard` (owned card): `{ id, userId, attendee, cardTypeId, classesTotal,
      classesUsed, orderId?, ledgerEntryId?, createdAt }`.
- [ ] `ClassCardRedemption`: `{ id, cardId, sectionId, classDate, redeemedByUserId, voidedAt?,
      createdAt }`, with a unique index on `(cardId, sectionId, classDate)` to prevent
      double-taps. Increment `classesUsed` atomically, never past `classesTotal`.
- [ ] Optional general `Attendance` record per `(sectionId, classDate, attendee)` with a
      `via: 'registration' | 'drop_in' | 'class_card'` field. Recommended so check-in can also
      mark regular students present later. Keep it minimal now.

### Ecommerce
- [ ] `class_card` PurchasableSource: options `{ attendee, childId? }`. Validation: the attendee is
      18+ today. `onPaid` creates the `ClassCard`. One-time billing.

### API
- [ ] CRUD for card types (`classes:manage`).
- [ ] `GET /api/class-cards/mine`.
- [ ] `GET /api/check-in/sessions?date=`: today's sections (calendar expansion, minus closures),
      each with its registered students, drop-ins, and adults holding an active card.
- [ ] `POST /api/check-in/redeem { cardId, sectionId, classDate }`, rejected for a non-adult
      course or an exhausted card. `POST /api/check-in/redemptions/:id/void` restores the class.
- [ ] New capability `checkin:manage` (contributor and up, so desk staff and teachers can use
      it).

### CMS
- [ ] `class-cards-admin.module.tsx` (or inside Classes): manage card types.
- [ ] `check-in.module.tsx`: date picker (default today), section list, and per-adult "Use 1
      class (3 left)" buttons, with undo.
- [ ] User detail: their cards and redemption history.

### Web
- [ ] Class page (adult courses): "Buy a class card" option.
- [ ] Profile: "Class Cards" section with remaining classes and history.

### Docs
- [ ] Postman: Class Cards + Check-in folders.

## Acceptance criteria

- [ ] An adult buys a 5-class card online for $80, and the profile shows 5 classes left.
- [ ] Staff check them into an adult class in the CMS → 4 left. A second tap for the same class
      date is rejected. Undo restores it.
- [ ] A card can't be bought for a student under 18 or redeemed in a kids' class.
- [ ] Cards never expire.
- [ ] Type-check passes for all touched projects. Postman updated.

## Open questions (for the client)

- Can a card be used for **any** adult class (Yoga, adult tap, etc.)?
- Can two adults on one account share a card, or is each card tied to one person? (Default:
  tied to one person.)

## Notes from QA-09

Registration lines need a policy signature. Set `requiresPolicyConsent: true` on the new purchasable
source, and add `policySchoolYearId` if its lines belong to a specific school year. Without that
function, a line counts toward the current school year.
