# QA-14: Adult class cards + CMS check-in

- **Status:** `review`
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
- [x] `ClassCardType` (admin catalog): `{ id, name, classCount, priceCents, isActive }`.
- [x] `ClassCard` (owned card): `{ id, userId, attendee, cardTypeId, classesTotal,
      classesUsed, orderId?, ledgerEntryId?, createdAt }`.
- [x] `ClassCardRedemption`: `{ id, cardId, sectionId, classDate, redeemedByUserId, voidedAt?,
      createdAt }`, with a unique index on `(cardId, sectionId, classDate)` to prevent
      double-taps. Increment `classesUsed` atomically, never past `classesTotal`.
- [ ] Optional general `Attendance` record per `(sectionId, classDate, attendee)` with a
      `via: 'registration' | 'drop_in' | 'class_card'` field. Recommended so check-in can also
      mark regular students present later. Keep it minimal now.

### Ecommerce
- [x] `class_card` PurchasableSource: options `{ attendee, childId? }`. Validation: the attendee is
      18+ today. `onPaid` creates the `ClassCard`. One-time billing.

### API
- [x] CRUD for card types (`classes:manage`).
- [x] `GET /api/class-cards/mine`.
- [x] `GET /api/check-in/sessions?date=`: today's sections (calendar expansion, minus closures),
      each with its registered students, drop-ins, and adults holding an active card.
- [x] `POST /api/check-in/redeem { cardId, sectionId, classDate }`, rejected for a non-adult
      course or an exhausted card. `POST /api/check-in/redemptions/:id/void` restores the class.
- [x] New capability `checkin:manage` (contributor and up, so desk staff and teachers can use
      it).

### CMS
- [x] `class-cards-admin.module.tsx` (or inside Classes): manage card types.
- [x] `check-in.module.tsx`: date picker (default today), section list, and per-adult "Use 1
      class (3 left)" buttons, with undo.
- [x] User detail: their cards and redemption history.

### Web
- [x] Class page (adult courses): "Buy a class card" option.
- [x] Profile: "Class Cards" section with remaining classes and history.

### Docs
- [x] Postman: Class Cards + Check-in folders.

## Acceptance criteria

- [ ] An adult buys a 5-class card online for $80, and the profile shows 5 classes left.
- [ ] Staff check them into an adult class in the CMS → 4 left. A second tap for the same class
      date is rejected. Undo restores it.
- [ ] A card can't be bought for a student under 18 or redeemed in a kids' class.
- [ ] Cards never expire.
- [x] Type-check passes for all touched projects. Postman updated.

## Open questions (for the client)

Answered by the developer on 2026-11-19 (still worth confirming with the client, see the note at
the end):

- Can a card be used for **any** adult class? **Yes**, any course with `minAgeYears >= 18`. There's
  no per-course switch.
- Can two adults on one account share a card? **No**, each card belongs to one person.

Further rules decided on 2026-11-19:

- **Capacity:** a card check-in needs a free seat. It counts against the same per-date seats as
  drop-ins, so a full class can't take one.
- **Refunds:** marking the card's order **refunded** cancels the card, and any unused classes are
  lost.
- **Desk sales on the ledger:** the card works straight away, even before the ledger charge is
  paid.

## Notes from QA-09

Registration lines need a policy signature. Set `requiresPolicyConsent: true` on the new purchasable
source, and add `policySchoolYearId` if its lines belong to a specific school year. Without that
function, a line counts toward the current school year.

## Work done

- **Data.** `libs/db/src/contracts/class-card.contract.ts` and `schemas/class-card.schema.ts` add
  `ClassCardType`, `ClassCard` and `ClassCardRedemption`. A card keeps a snapshot of its type's name
  and class count, so editing a type never changes cards already sold. `useClass` increments
  `classesUsed` with a compare-and-set that can't pass `classesTotal`. A redemption has a status
  (`active` / `voided`) rather than only `voidedAt`, so the unique index can be partial.
- **Seats.** A check-in holds a seat through the drop-in `DropInSeat` counter for that section and
  date. Drop-ins and card check-ins therefore share a date's room
  (`capacity − enrolled − drop-ins − card check-ins`). The class page's drop-in dates already
  account for check-ins.
- **Checkout.** `libs/ecommerce/src/purchasables/class-card.purchasable.ts`, source type
  `class_card`. The cart line is `sourceId = card type id`, with options `{ attendee, childId? }`.
  The account holder can always buy one. A student must be 18+ today. One-time billing, one card per
  line, and a policy signature is required for the current school year. `onPaid` issues the card
  and is safe to run twice, because it is keyed by the order line.
- **Refunds.** `PurchasableSource` has a new optional `onRefunded` hook.
  `setOrderStatusByAdmin(…, 'refunded')` now calls it for every line after the ledger reversal. Any
  failure is added to the order's fulfillment errors and doesn't block the refund. The class card
  source cancels the card.
- **Check-in.** `libs/ecommerce/src/class-cards/class-card-check-in.ts`. Redeeming checks, in order:
  - the card is active and has classes left
  - the course is adult
  - the date isn't in the future, the class meets that day, and the studio is open (a class already
    under way is fine)
  - the adult isn't registered in the section or holding a drop-in for that date
  - there's a free seat

  It then reserves the seat, uses the class and writes the redemption. If a later step fails, the
  earlier steps are undone. A second check-in for the same adult, section and date hits the unique
  index and returns 409. **Undo** voids the redemption, gives the class back and frees the seat.
- **API.** `libs/api-core/src/routes/class-cards.route.ts`:
  - `GET /api/class-card-types` (public, for-sale types only)
  - `GET /api/class-card-types/admin`, `POST`, `PUT /:id` and `DELETE /:id` (`classes:manage`).
    Delete is refused once a card of that type has been sold.
  - `GET /api/class-cards/mine`
  - `GET /api/users/:id/class-cards` (`checkin:manage` or `registrations:desk`)
  - `GET /api/check-in/sessions?date=`, `POST /api/check-in/redeem` and
    `POST /api/check-in/redemptions/:id/void` (`checkin:manage`)

  The day view is built in `services/check-in.service.ts`. `requirePermission` now also accepts a
  list of capabilities and passes when the user holds any one of them.
- **Capability.** `checkin:manage` is in the role defaults for contributor, editor and admin, and the
  Permissions screen lists it as "Class Check-in".
- **CMS.**
  - **Classes → Class Cards** tab: create, edit, turn off and delete card types.
  - New **Check-in** module (`check-in.module.tsx`). It has a date picker that defaults to today in
    studio time. Each class meeting that day shows its registered students, drop-ins and card
    check-ins, and seats taken out of capacity. Adult classes also get an adult picker with
    **Use 1 class (N left)**, and every card check-in has an **Undo** button.
  - **Front Desk** "Add" picker: new **Class card** option.
  - **Users → Registrations** dialog (also opened from Front Desk): a **Class Cards** group with
    classes left and every class used.
  - Discount editor: a new **Class cards** item type.
- **Web.** Every adult class page with a card type for sale shows a **Buy a class card** box. The
  shopper picks a card and, if there's more than one adult on the account, who it's for. The
  **Profile → Registrations** tab has a **Class Cards** section with classes left, purchase date
  and the history of classes used. The cart describes card lines, and "Continue shopping" goes
  back to /classes.
- **Postman.** New **Class Cards** and **Check-in** folders after Drop-Ins, with the variables
  `classCardTypeId`, `classCardId` and `classCardRedemptionId`.
- **Type-check** passes for db, ecommerce, api-core, api-client, cms, permissions, apps/api and
  apps/web.

### Notes for the developer

- **No card types exist yet.** The client creates "5-Class Card / 5 / $80" and
  "10-Class Card / 10 / $160" under Classes → Class Cards. Until then, adult pages show no card box
  and the desk picker says none are for sale.
- **Optional `Attendance` record not built.** The check-in screen derives who's in a class from
  registrations, drop-ins and redemptions. Marking regular students present is a later feature.
- **`ledgerEntryId` not added to `ClassCard`.** A desk sale on the ledger goes through a desk order,
  the same as drop-ins, so its charge is linked by `orderId`. Order-written ledger entries can't be
  voided (QA-11 rule). To cancel a desk-sold card, **mark its order refunded** in Orders. That
  reverses the ledger charge and cancels the card.
- **Unique index key.** The ticket suggested `(cardId, sectionId, classDate)`. It was built as
  `(sectionId, classDate, userId, attendeeKey)` over active redemptions, which is stricter: an adult
  with two cards still can't be checked in twice to the same class.
- **Only "refunded" cancels a card.** Marking an order "cancelled" leaves the card active.
- **Term registrations don't count card check-ins**, the same gap as drop-ins (see QA-13). A section
  with one term seat left can still sell a monthly plan even if a card holder took that seat on some
  date.
- **Future dates can't be checked in.** Past dates can, so staff can catch up on a missed tap.
- **Visibility.** Teachers (contributor) get Check-in by default. They don't get Users or Front
  Desk, so they see card balances only on the Check-in screen.

### Manual test checklist

1. CMS → Classes → **Class Cards**: add "5-Class Card", 5 classes, $80.
2. As an adult account, open an adult (18+) class page. **Buy a class card** → add to cart →
   checkout (sign policies if asked). Profile → Registrations shows **5 classes left**.
3. On a kids' class page there's no card box. With a parent account, try adding a card for an
   under-18 student through Postman. It's rejected ("Class cards are for adults 18 and over.").
4. CMS → **Check-in** (today): on an adult class, pick the adult → **Use 1 class (4 left)**. The
   profile now shows 4 left and lists the class. Pick them again for the same class: they no longer
   appear in the picker, and a direct POST returns 409. Press **Undo**: back to 5.
5. Set an adult class's capacity to its enrollment and try a check-in. It's rejected as full.
6. Front Desk: add a **Class card** for the account holder and pay in person with cash. The card is
   active right away, and Accounts shows the charge and the payment.
7. Orders: mark the online card order **Refunded**. The card shows "Refunded" and leaves the
   Check-in picker.
8. Log in as a contributor (teacher). **Check-in** is in the sidebar and works.

## Note for the client response

Include this in the client response once this branch is deployed.

> **Adult class cards are ready.** You set up the cards yourself in the CMS under
> Classes → **Class Cards**. Add "5-Class Card", 5 classes, $80 and "10-Class Card", 10 classes, $160.
> You can change prices or add other sizes any time. A change only affects cards bought afterwards,
> and cards never expire.
>
> - **Buying:** adults see a "Buy a class card" box on every adult (18+) class page. A card can be
>   bought for the account holder or for a student who is 18 or older, never for a younger
>   student. At the front desk, choose **Class card** when adding items. Cash or check works the
>   same as other desk sales, and the card can be used straight away.
> - **Using a card:** cards work in any adult class. There's a new **Check-in** screen in the CMS
>   that teachers and desk staff can open. It lists today's classes and who's registered. In an
>   adult class, pick the adult and press **Use 1 class**. If you tap the wrong person, press
>   **Undo** to put the class back. Someone can only be checked in once per class, and a full class
>   can't take a card check-in.
> - **Balances:** adults see their remaining classes and every class they've used under
>   Profile → Registrations. Staff see the same under Users → Registrations.
> - **Sharing:** each card belongs to one person and can't be shared between two adults on the
>   same account.
> - **Refunds:** to refund a card, mark its order **Refunded** in Orders. That cancels the card, and
>   any classes left on it can no longer be used.
>
> Please confirm two choices we made: cards work in **every** adult class, and each card is for
> **one** person. Let us know if either should be different.
