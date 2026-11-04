# QA-11: Account ledger: one-off charges, cash/check payments, pay balance online

- **Status:** `todo`
- **Priority:** P0 (foundation for QA-12, QA-13, QA-14, QA-15)
- **Depends on:** -
- **Branch:** `feature/qa-11-account-ledger`

## Client request

> Reminder: need to be able to add one off charges to people's accounts for costumes, or other
> possible charges that wouldn't be merch. I would also like to be able to track cash payments
> and check payments thru the system. That's one thing I do like about JR, I can input when my
> mom throws $22 my way for a drop-in each week and I just stick it in her account that she paid
> in cash.

## Current state

- No balance/ledger concept exists. Money is only tracked as **orders** (`libs/db/src/contracts/order.contract.ts`)
  and **billing subscriptions**.
- Staff can record a **manual order** (`libs/ecommerce/src/orders/manual-order.service.ts`,
  CMS `orders/CreateOrderDialog.tsx`). It assumes payment already happened outside the system,
  supports products only in the UI, blocks recurring lines, and doesn't record *how* it was
  paid.

## Decisions

- Every account gets a **ledger** of charges and payments with a running **balance**, modelled on
  Jackrabbit's family ledger.
- **Staff (CMS)** can:
  - add a **charge**: description, amount, category (costume, fee, tuition, drop-in, private
    lesson, other), optional student, optional due date.
  - record a **payment**: amount, method (`cash` | `check` | `card_in_person` | `other`), check
    number when method = check, date received, note. A payment can be applied to specific
    charges, or left unapplied (credit) and auto-applied oldest-first.
  - **void** an entry with a reason. No hard deletes: the ledger is an audit trail.
- **Online orders appear automatically**: a paid order or subscription renewal writes a matching
  charge + card payment pair, so the ledger is the full history and the balance stays 0 for
  prepaid items.
- **Families** see their balance and ledger on their profile and can **pay the outstanding
  balance by card** through the existing checkout/Stripe flow.

## Design notes

- Amounts in integer cents. Currency from `getStoreCurrency()`.
- A pure `computeBalance(entries)`. The balance is derived and never stored, so no drift.
- Paying a balance online = a cart line of a new `ledger_balance` PurchasableSource (one line,
  amount = selected charges). Its `onPaid` writes the card payment applied to those charges. This
  reuses checkout, tax handling (balance payments → no tax; costumes may be taxable, so confirm
  with Stripe Tax codes per category), receipts and webhooks instead of building a second
  payment path.

## Implementation steps

### Data (`libs/db`)
- [ ] `ledger-entry.contract.ts` + `ledger-entry.schema.ts`: `{ id, userId, kind: 'charge' |
      'payment', amountCents, category?, description, studentId?, dueDate?, method?, checkNumber?,
      receivedAt?, appliesTo?: { chargeId, amountCents }[], source: 'staff' | 'order' |
      'subscription' | 'system', orderId?, subscriptionId?, createdByUserId?, voidedAt?,
      voidedByUserId?, voidReason?, createdAt }`. Indexes: `userId + createdAt`.
- [ ] Repository: `create`, `findByUserId` (paginated), `findById`, `void`. No update or delete.
- [ ] Pure helpers: `computeBalance`, `openCharges` (charges minus applied payments),
      `autoApply(payment, openCharges)`.

### Ecommerce (`libs/ecommerce`)
- [ ] Order lifecycle hook: on order paid → write charge + card payment entries per order. On
      subscription renewal paid → the same. On refund → a negative payment/credit entry.
- [ ] `ledger_balance` PurchasableSource (`purchasables/ledger-balance.purchasable.ts`),
      registered in `purchasables/registry.ts`. It validates the charges belong to the buyer and
      are still open at checkout time.

### API (`libs/api-core`)
- [ ] New capability `ledger:manage` (admin + editor by default, adjust in
      `role-capability-defaults.ts`; desk staff need it).
- [ ] `GET /api/ledger/mine` (balance + entries), `GET /api/users/:id/ledger` (`ledger:manage`),
      `POST /api/users/:id/ledger/charges`, `POST /api/users/:id/ledger/payments`,
      `POST /api/ledger/:entryId/void`. Zod schemas in `schemas/ledger.schema.ts`.
- [ ] CSV export of payments by date range and method, so the client can reconcile cash/check
      deposits (reuse `@inithium/api-utils` csv).

### CMS (`libs/cms`)
- [ ] New `ledger-admin.module.tsx` ("Accounts" / "Billing"): search a family, see the balance
      and ledger, plus "Add charge", "Record payment" and "Void" dialogs. Also a dashboard widget
      with "Outstanding balances" (top N accounts owing).
- [ ] Link from CMS Users and Orders detail to the account's ledger.

### Web (`apps/web`)
- [ ] Profile "Billing" tab: balance, ledger history, and a "Pay balance" button → adds the
      `ledger_balance` line to the cart → checkout.

### Docs
- [ ] Postman: Ledger folder with all endpoints + status tests.

## Acceptance criteria

- [ ] Staff can add a $45 costume charge to an account. The family sees a $45 balance and can pay
      it by card, after which the balance is $0.
- [ ] Staff can record a $22 cash payment and a check payment with a check number. Both appear in
      the ledger and the CSV export.
- [ ] A voided entry stays visible (struck through, with reason) and no longer affects the
      balance.
- [ ] Online class/merch orders show up in the ledger automatically with a net $0 effect.
- [ ] Type-check passes for `db`, `ecommerce`, `api-core`, `permissions`, `api-client`, `cms`,
      `apps/web`. Postman updated.

## Open questions (developer)

- Should costume charges be taxable? Default: category → Stripe tax code map, with `other` and
  `costume` as general goods and tuition/drop-in/private as services. Confirm with the client's
  accountant if unsure.
