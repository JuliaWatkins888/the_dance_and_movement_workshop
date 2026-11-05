# QA-12: Staff registers families from the CMS (desk registration)

- **Status:** `todo`
- **Priority:** P0
- **Depends on:** QA-03 (students), QA-09 (paper consent), QA-11 (ledger)
- **Branch:** `feature/qa-12-desk-registration`

## Client request

> Some parents or grandparents might not want or know how to use the site… I will need a way for
> my desk people or I to manually register in people's accounts

## Current state

- Staff can create users (`POST /api/users`, `users:manage`) and children in the CMS Children
  module (with a parent picker).
- Staff **manual orders** (`libs/ecommerce/src/orders/manual-order.service.ts`) run lines through
  the same purchasable rules as checkout, but:
  - the CMS dialog (`libs/cms/src/modules/orders/CreateOrderDialog.tsx`) only offers products;
  - recurring lines are rejected ("can't be added to a staff-created order"), so **monthly class
    plans can't be registered at the desk at all**;
  - there's no payment method record.

## Decisions

- Desk staff work from one CMS flow: **find or create account → add students → pick
  classes/workshops/drop-ins → choose how it's paid**.
- An email address is **required** on every account (so password reset works later).
- Payment modes:
  1. **Card at the desk**: staff enter the family's card in a Stripe Payment Element inside the
     CMS. One-time items are charged immediately. Monthly plans start a normal auto-billing
     subscription on that card, exactly like online checkout.
  2. **Pay in person**: nothing is charged by Stripe. One-time items post a charge to the ledger
     (QA-11), and staff can record the cash/check payment in the same dialog. Monthly plans
     create the registration with `billingMode: 'ledger'`, and a tuition charge is posted to the
     ledger for each month on the 1st (same months as the online plan rules).
- The policy consent step (QA-09) appears in the flow: staff either have the family sign on the
  desk screen (typed name) or tick "Family signed a paper copy", which is recorded as
  `method: 'paper'`.

## Design notes

- **There is no job runner** in this codebase (see the comment in
  `libs/api-core/src/routes/time/timeSweep.ts`). Monthly ledger tuition must be **lazily
  accrued**: when a ledger or registration is read (and on CMS dashboard load), post any missing
  monthly charges for `billingMode: 'ledger'` registrations up to the current month. Make it
  idempotent with a unique key `(registrationId, yyyy-mm)`. Don't add a cron dependency without
  discussing it.
- Card-at-desk subscriptions reuse the payment provider: create/attach the payment method to the
  customer (`payment-customer.ts`) via a SetupIntent, then reuse the existing subscription
  creation from checkout, with the customer as the payer and the staff member recorded on the
  order as `createdByUserId`.
- Withdrawal of a `ledger` monthly registration follows the same rules as online (stop future
  months; QA-10 lock applies to self-service only).

## Implementation steps

### Backend
- [ ] `ClassRegistrationEntity`: add `billingMode: 'subscription' | 'ledger' | 'prepaid'`
      (defaults derive from existing data, so no migration: `subscriptionId` → subscription,
      otherwise prepaid).
- [ ] Extend `manual-order.service.ts`:
  - accept a `payment: { mode: 'card', paymentMethodId } | { mode: 'in_person', record?: {
    method, amountCents, checkNumber? } }`;
  - allow recurring lines: mode `card` → create a subscription; mode `in_person` → a `ledger`
    registration with no subscription;
  - write ledger entries per QA-11.
- [ ] Tuition accrual helper `accrueLedgerTuition(userId, now)`: pure month computation in
      `libs/db/src/utils/class-pricing` plus an idempotent write.
- [ ] `POST /api/users/:id/payment-setup-intent` (`orders:manage` or a new `registrations:desk`
      capability) for card-at-desk.
- [ ] Withdraw endpoint for staff on any registration: `POST /api/class-registrations/:id/withdraw`
      (admin), covering both subscription and ledger modes.

### CMS
- [ ] "New Registration" flow, as a module or a dialog launched from Users/Orders:
  1. Account: search by name/email/phone, or create (first, last, email, phone).
  2. Students: list/add (reuse the student form from QA-04).
  3. Items: pick class section + plan (monthly/semester/year), workshop days, drop-in date
     (QA-13) or class card (QA-14). Eligibility/capacity errors show inline.
  4. Policies: typed signature or "signed paper copy".
  5. Payment: card (Payment Element) or in person (+ optional record cash/check now).
  6. Review → submit → confirmation with links to the order and ledger.
- [ ] Registrations admin view per account: list registrations with billing mode + withdraw
      action.

### Docs
- [ ] Postman: updated manual-order body, setup-intent, staff withdraw.

## Acceptance criteria

- [ ] A desk staffer can create a grandparent's account and student, register the student for a
      monthly class paid **in person**, and record the first $60 in cash. The ledger shows the
      charge and payment, and next month's charge appears on/after the 1st.
- [ ] The same flow with **card at desk** starts a Stripe subscription that renews on the 1st like
      an online one.
- [ ] Semester/year plans and workshops can be registered at the desk in both modes.
- [ ] Eligibility, capacity and consent rules match online checkout.
- [ ] Type-check passes for all touched projects. Postman updated.

## Notes from QA-09

- `createManualOrder` doesn't check policy consent. QA-09 only guards `placeOrder`, so the desk flow
  has to enforce it itself to meet "consent rules match online checkout".
- Paper signatures already exist: `POST /api/users/:id/policy-consents/paper`, with a form in
  CMS → Users. `recordPaperPolicyConsent` in `@inithium/ecommerce` is the service to reuse.
- `PolicyConsentEntity.orderId` exists but nothing sets it yet. Records are create-only, so it has
  to be passed when the record is created.
