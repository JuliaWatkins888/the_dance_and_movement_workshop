# QA-11: Account ledger: one-off charges, cash/check payments, pay balance online

- **Status:** `review`
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
  reuses checkout, tax handling (balance payments → no tax, see the answered question below),
  receipts and webhooks instead of building a second payment path.

## Implementation steps

### Data (`libs/db`)
- [x] `ledger-entry.contract.ts` + `ledger-entry.schema.ts`: `{ id, userId, kind: 'charge' |
      'payment', amountCents, category?, description, studentId?, dueDate?, method?, checkNumber?,
      receivedAt?, appliesTo?: { chargeId, amountCents }[], source: 'staff' | 'order' |
      'subscription' | 'system', orderId?, subscriptionId?, createdByUserId?, voidedAt?,
      voidedByUserId?, voidReason?, createdAt }`. Indexes: `userId + createdAt`.
- [x] Repository: `create`, `findByUserId` (paginated), `findById`, `void`. No update or delete.
- [x] Pure helpers: `computeBalance`, `openCharges` (charges minus applied payments),
      `autoApply(payment, openCharges)`.

### Ecommerce (`libs/ecommerce`)
- [x] Order lifecycle hook: on order paid → write charge + card payment entries per order. On
      subscription renewal paid → the same. On refund → a negative payment/credit entry.
- [x] `ledger_balance` PurchasableSource (`purchasables/ledger-balance.purchasable.ts`),
      registered in `purchasables/registry.ts`. It validates the charges belong to the buyer and
      are still open at checkout time.

### API (`libs/api-core`)
- [x] New capability `ledger:manage` (admin + editor by default, adjust in
      `role-capability-defaults.ts`; desk staff need it).
- [x] `GET /api/ledger/mine` (balance + entries), `GET /api/users/:id/ledger` (`ledger:manage`),
      `POST /api/users/:id/ledger/charges`, `POST /api/users/:id/ledger/payments`,
      `POST /api/ledger/:entryId/void`. Zod schemas in `schemas/ledger.schema.ts`.
- [x] CSV export of payments by date range and method, so the client can reconcile cash/check
      deposits (reuse `@inithium/api-utils` csv).

### CMS (`libs/cms`)
- [x] New `ledger-admin.module.tsx` ("Accounts" / "Billing"): search a family, see the balance
      and ledger, plus "Add charge", "Record payment" and "Void" dialogs. Also a dashboard widget
      with "Outstanding balances" (top N accounts owing).
- [x] Link from CMS Users and Orders detail to the account's ledger.

### Web (`apps/web`)
- [x] Profile "Billing" tab: balance, ledger history, and a "Pay balance" button → adds the
      `ledger_balance` line to the cart → checkout.

### Docs
- [x] Postman: Ledger folder with all endpoints + status tests.

## Acceptance criteria

Awaiting the developer's manual test. The type-check item is the only one verified so far.

- [ ] Staff can add a $45 costume charge to an account. The family sees a $45 balance and can pay
      it by card, after which the balance is $0.
- [ ] Staff can record a $22 cash payment and a check payment with a check number. Both appear in
      the ledger and the CSV export.
- [ ] A voided entry stays visible (struck through, with reason) and no longer affects the
      balance.
- [ ] Online class/merch orders show up in the ledger automatically with a net $0 effect.
- [x] Type-check passes for `db`, `ecommerce`, `api-core`, `permissions`, `api-client`, `cms`,
      `apps/web`. Postman updated.

## Work done

- The balance rules live in `libs/db/src/utils/ledger.ts`, covered by 17 Vitest cases. Run them with
  `npx nx run db:test`. Nothing about the balance is stored, so voiding an entry corrects everything
  on the next read.
- The money logic is in `libs/ecommerce/src/ledger/ledger.service.ts`. The CMS module is labelled
  **Accounts**, and the family tab is **Billing** on the profile.

Choices the ticket left open, for the developer to check:

- **Refunds also reverse the charge.** The ticket asked for a negative payment. On its own that
  would leave a refunded family owing the full amount, because the order's charge still stands. Marking
  an order refunded now writes a negative payment and a negative charge, which nets to $0. If the
  refunded order was a balance payment, only the payment reverses, so the costume charge it paid
  reopens and staff void it if it's no longer owed.
- **Order entries can't be voided.** Voiding one half of an order's charge/payment pair would make a
  paid order look unpaid. Those entries change only by marking the order refunded. Staff entries can
  be voided.
- **Promo codes skip balance lines**, so a code can't discount money already owed. They don't count
  toward a code's minimum order amount either.
- **A manual order's payment is recorded as method `other`**, because a manual order doesn't record
  how it was paid. Staff who need cash or check on the export should use **Record payment** instead.
- **Added payment method `card_online`**, written only by checkout and renewals.
- **Staff notes are hidden from families**, along with who entered or voided an entry. A void reason
  is visible to the family, and the void screen says so.
- **The Billing tab pays all open charges together.** The API takes specific charges, but the tab has
  no per-charge picker because the ticket only asked for a "Pay balance" button.
- **Only orders paid after this ships appear in the ledger.** Earlier orders aren't backfilled. They
  would net to $0, so no balance is wrong.

## Note for the client response

Include this in the client response. Send it only once this branch is deployed, because these screens
don't exist before then.

> You can now keep a running account for each family, like the ledger you use in Jackrabbit. Add
> one-off charges like costumes, record cash and check payments, and let families pay what they owe
> online.
>
> **Adding a charge**
>
> 1. In the CMS, go to **Accounts** and search for the family. You can also open an account from the
>    wallet icon in **Users**, or from **View account ledger** on an order.
> 2. Click **Add charge** and enter a description, amount and category. A student and due date are
>    optional.
>
> The family then sees the balance under **Billing** on their profile.
>
> **Recording cash or a check**
>
> 1. Open the account and click **Record payment**.
> 2. Enter the amount, method and date received. A check also needs its check number.
> 3. To pay particular charges, tick them. Otherwise, the payment goes to the oldest charges first.
>
> If someone pays before there's a charge, like your mom's $22 drop-in, the payment stays on the
> account as a credit and is used automatically on the next charge.
>
> **Fixing a mistake**
>
> Click **Void** on the entry and give a reason. It stays on the ledger, crossed out, and stops counting
> toward the balance. Nothing is ever deleted, so you always have the full history. **Families can see
> the void reason**, so word it accordingly. Staff notes are only visible to staff.
>
> **How families pay**
>
> On the **Billing** tab, they click **Pay** and check out by card as usual. Their balance updates once
> the payment goes through. They pay all open charges together, and promo codes don't apply.
>
> **Online orders**
>
> Class, merch and other online purchases appear on the ledger automatically, from now on, as a charge
> and a matching payment. They don't change the balance.
>
> **Refunds**
>
> Marking an order **Refunded** in **Orders** updates the ledger, but it doesn't send the money back.
> You still issue the refund in Stripe, as you do today. If the refunded order was a balance payment,
> the charge it paid shows as owed again, so void that charge if the family no longer owes it.
>
> **Matching your deposits**
>
> At the bottom of **Accounts**, choose a date range and method and click **Export CSV**. You get a
> spreadsheet of the payments received, without voided ones. The dashboard also has a new **Outstanding
> Balances** card showing who owes the most.
>
> **One thing to check with your accountant**
>
> No sales tax is added to these charges, so the family pays exactly the amount you enter, whether by
> card or in cash. If something you charge for is taxable, such as a costume, include the tax in the
> amount you enter, and ask your accountant how to report it.

## Open questions (developer)

Answered by the developer on 2026-11-06: **no tax is added to balance payments.** The family pays
exactly the amount on the charge, by any method. Every balance line carries Stripe's nontaxable code
(`txcd_00000000`), set in one place in `ledger-balance.purchasable.ts`. The client note asks the client
to check with their accountant.
