# QA-12: Staff registers families from the CMS (desk registration)

- **Status:** `review`
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

## Answers (developer, 2026-11-17)

- **Card at the desk is taxed like online checkout** (Stripe Tax). Staff enter the family's billing
  address. Pay-in-person orders get no tax, the same as other ledger charges.
- **Withdrawing a pay-in-person monthly class:** a month whose tuition has posted (on the 1st) stays
  owed, even if unpaid. The dancer attends to the end of that month and no later months post. Staff
  void the charge in Accounts to waive it.
- **Access:** new capability `registrations:desk` ("Front Desk Registration"), admin + editor by
  default.
- QA-11 was committed on its own branch first (`8cac392`), and this branch starts from it.

## Implementation steps

### Backend
- [x] `ClassRegistrationEntity`: add `billingMode: 'subscription' | 'ledger' | 'prepaid'`
      (defaults derive from existing data, so no migration: `subscriptionId` → subscription,
      otherwise prepaid).
- [x] Extend `manual-order.service.ts`:
  - accept a `payment: { mode: 'card', paymentMethodId } | { mode: 'in_person', record?: {
    method, amountCents, checkNumber? } }`;
  - allow recurring lines: mode `card` → create a subscription; mode `in_person` → a `ledger`
    registration with no subscription;
  - write ledger entries per QA-11.
- [x] Tuition accrual helper `accrueLedgerTuition(userId, now)`: pure month computation in
      `libs/db/src/utils/class-pricing` plus an idempotent write.
- [x] ~~`POST /api/users/:id/payment-setup-intent`~~ Not needed: card-at-desk uses the same
      Payment Element confirmation token as online checkout (see "Work done").
- [x] Withdraw endpoint for staff on any registration: `POST /api/class-registrations/:id/withdraw`
      (admin), covering both subscription and ledger modes.

### CMS
- [x] "New Registration" flow, as a module or a dialog launched from Users/Orders:
  1. Account: search by name/email/phone, or create (first, last, email, phone).
  2. Students: list/add (reuse the student form from QA-04).
  3. Items: pick class section + plan (monthly/semester/year), workshop days, drop-in date
     (QA-13) or class card (QA-14). Eligibility/capacity errors show inline.
  4. Policies: typed signature or "signed paper copy".
  5. Payment: card (Payment Element) or in person (+ optional record cash/check now).
  6. Review → submit → confirmation with links to the order and ledger.
- [x] Registrations admin view per account: list registrations with billing mode + withdraw
      action.

### Docs
- [x] Postman: new "Front Desk" folder (account search/create, add student, quote, order in both
      payment modes, confirm card payment) and two staff requests under "Class Registrations".

## Acceptance criteria

Awaiting the developer's manual test. Only the type-check item is verified so far.

- [ ] A desk staffer can create a grandparent's account and student, register the student for a
      monthly class paid **in person**, and record the first $60 in cash. The ledger shows the
      charge and payment, and next month's charge appears on/after the 1st.
- [ ] The same flow with **card at desk** starts a Stripe subscription that renews on the 1st like
      an online one.
- [ ] Semester/year plans and workshops can be registered at the desk in both modes.
- [ ] Eligibility, capacity and consent rules match online checkout.
- [x] Type-check passes for all touched projects. Postman updated.

## Notes from QA-09

- `createManualOrder` doesn't check policy consent. QA-09 only guards `placeOrder`, so the desk flow
  has to enforce it itself to meet "consent rules match online checkout".
- Paper signatures already exist: `POST /api/users/:id/policy-consents/paper`, with a form in
  CMS → Users. `recordPaperPolicyConsent` in `@inithium/ecommerce` is the service to reuse.
- `PolicyConsentEntity.orderId` exists but nothing sets it yet. Records are create-only, so it has
  to be passed when the record is created.

## Work done

- **CMS → Front Desk** (`libs/cms/src/modules/desk/`) is one page with six numbered sections:
  account (search by name, email or phone, or create one), students, classes and workshops, studio
  policies, payment, and review. Eligibility, capacity and "already registered" errors from the API
  show under the line they belong to. The confirmation links to the order, the account ledger and
  the family's registrations.
- **CMS → Users** has a new Registrations button per account, listing every class registration with
  how it's billed and a **Withdraw** action for monthly plans.
- The API is `libs/api-core/src/routes/desk.route.ts` (`/api/desk/*`, all behind
  `registrations:desk`), plus two routes in `class-registrations.route.ts`:
  `GET /api/users/:id/class-registrations` and `POST /api/class-registrations/:id/withdraw`.
- The order logic is `createDeskOrder` / `quoteDeskOrder` in
  `libs/ecommerce/src/orders/manual-order.service.ts`. Both modes go through the same line rules,
  promo codes, seat reservation and fulfillment as checkout. The old "Create order" dialog in
  Orders (already paid, products only) is unchanged.
- **Pay in person:** the order's payment provider is `ledger`. No subscription is created. One-time
  items post one charge for the order, and each monthly class posts its tuition month by month. A
  cash or check payment entered at the desk is applied to this order's charges.
- **Monthly tuition accrual** (`libs/ecommerce/src/ledger/tuition-accrual.ts`) runs when a ledger is
  read (CMS Accounts, the family's Billing tab), when registrations are listed (profile and CMS),
  and when the CMS dashboard's Outstanding balances widget loads, which catches up every account.
  The month rules are pure and tested in `libs/db/src/utils/class-pricing.ts` (11 Vitest cases,
  `npx nx run db:test`). Each charge carries `registrationId` + `billingMonth` under a unique index,
  so a month can't post twice.
- **Card at the desk:** the family types their card into the same Stripe Payment Element as checkout,
  now shared from `@inithium/ui` (`PaymentFields`). It's charged once, the card is saved when a monthly
  plan is included, and the existing subscription code starts renewals on the 1st. A 3-D Secure
  prompt is completed on the staff screen.
- **Consent:** if the family hasn't signed for the year, the desk shows the policy text and records
  either a typed signature (new method `desk`) or a paper copy (`paper`), tied to the order through
  `orderId`. The order is refused without it, the same as checkout.
- Accounts can now hold a **phone number** (optional, searchable by digits in any format).

Choices the ticket left open, for the developer to check:

- **No SetupIntent endpoint.** Card-at-desk always charges something today, the same as online, so
  the checkout charge-and-save path covers it. That leaves one Stripe code path instead of two.
- **The first month posts at registration**, even for an early sign-up whose first class is next
  month, matching what online checkout charges up front.
- **A promo code on a pay-in-person monthly class** applies to the first month, then follows the
  code's duration (once / for N months / forever), as the card subscription would.
- **Posted tuition can be voided** in Accounts to waive a month. A voided month is never re-posted.
  Order entries still can't be voided.
- **Marking a pay-in-person order refunded** reverses its charges and the tuition posted so far, but
  doesn't stop future months. Withdraw the registration as well.
- **Families can't cancel a pay-in-person monthly class from their profile.** It shows without a
  Cancel button, so they ask the studio, and staff withdraw it from the desk.
- **Desk accounts can be created without a password.** The account gets an unguessable one, and staff
  set a real password in Users when the family wants to sign in. There's no email provider (QA-07/08).
- **A desk order shows as "paid" in Orders**, like other completed orders, with the payment line
  reading "owed on the family's account". The ledger shows what's actually outstanding. Sales reports
  count it on the day it was registered.
- **Card-at-desk payments are labelled "Card online"** in the ledger and CSV export, because they go
  through Stripe and reconcile against Stripe payouts, not the cash drawer.
- **Drop-ins (QA-13) and class cards (QA-14)** aren't offered yet. They'll be added to the desk item
  picker when those tickets land.
- The Stripe payment fields moved from `apps/web` into `@inithium/ui` so the CMS can use them;
  checkout imports them from there.

## Note for the client response

Include this in the client response. Send it only once this branch is deployed.

> **Registering families at the front desk.** There's a new **Front Desk** page in the admin area.
> Find the family by name, email or phone, or create their account (an email address is required).
> Add their dancers, pick classes or workshops, and the page applies the same age, class-size and
> pricing rules as the website.
>
> - If the family hasn't signed this year's studio policies, the page shows them. The family can
>   type their name on your screen, or you can tick that they signed a paper copy.
> - **Card now:** the family enters their card on your screen. Monthly classes then renew on that
>   card on the 1st, the same as online.
> - **Pay in person:** nothing is charged to a card. The total goes on the family's account (see
>   **Accounts**), and you can record cash or a check right there. Monthly classes add that month's
>   tuition to their account on the 1st.
>
> To stop a monthly class, open **Users**, click the family's Registrations button, and choose
> **Withdraw**. A month that has already been billed stays owed and the dancer finishes it. If you
> want to waive it, void that month's tuition in **Accounts**.
>
> Accounts made at the desk don't have a password yet. When a family wants to sign in online, set
> one for them in **Users**.
