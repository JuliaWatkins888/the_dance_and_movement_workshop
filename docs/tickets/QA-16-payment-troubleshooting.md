# QA-16: Payment troubleshooting runbook + CMS payment health

- **Status:** `review`
- **Priority:** P1
- **Depends on:** -
- **Branch:** `feature/qa-16-payment-health`

## Client request

> Martin brought up: What if the payment link breaks? Would I be able to troubleshoot and fix it
> by myself? What does that process look like?

## Current state

- Payments use Stripe embedded in checkout (Payment Element: `apps/web/src/pages/ecommerce/payment/StripePaymentFields.tsx`),
  not a hosted "payment link". The server side is `libs/payments/src/providers/stripe/`, and the
  webhook is handled by `libs/ecommerce/src/webhooks/payment-webhook.ts`, with events persisted
  as `PaymentEvent` (`libs/db/src/contracts/payment-event.contract.ts`).
- Orders can end in `failed` / `pending`. Subscriptions can go `past_due`.
- There's no admin view of payment events and no written troubleshooting guide.

## Decisions (recommended, confirm or override)

Two deliverables:

1. **A runbook** (`docs/runbooks/payments.md`) written for the owner and for Martin, with
   step-by-step symptom → check → fix.
2. **A small CMS "Payment Health" screen** so most issues can be diagnosed without server
   access.

Answered by the developer on 2026-11-25:

- **A past-due renewal paid by cash or check:** cancel the Stripe subscription in CMS →
  Subscriptions, re-register the dancer at the Front Desk as pay-in-person (ledger billing), and
  record the cash there. Never mark the Stripe invoice "paid outside Stripe", and never add a ledger
  payment on top of a Stripe renewal, because that counts the month twice.
- **How a family updates their card:** no in-app screen. The owner turns on Stripe's own
  failed-payment emails, which Stripe sends, so the app still sends no email (see QA-07). The owner
  can also copy a failed invoice's payment link and send it to the family.

## Implementation steps

### Runbook (`docs/runbooks/payments.md`)
- [x] How payments flow: checkout → Stripe → webhook → order paid → registration created (one
      Mermaid diagram).
- [x] Symptom table, each row with "check" and "fix":
  - Checkout shows a payment error for everyone → Stripe keys wrong/rotated (env vars), Stripe
    account restricted (Stripe Dashboard banner).
  - Card charged but order stuck in "pending" → webhook failing: Stripe Dashboard → Developers →
    Webhooks → endpoint → failed deliveries → "Resend". Check `STRIPE_WEBHOOK_SECRET`.
  - Monthly renewal failed / "past due" → customer card declined; how to have the family update
    their card; how to record a cash payment instead (QA-11).
  - A family says they paid but no registration → find the order in CMS Orders by email, check
    its status history, match it to the Stripe payment. *(Orders has no email search, so the
    runbook goes Stripe payment → `orderId` metadata → Orders filtered to that day.)*
  - Refunds → done in the Stripe Dashboard, then mark the order refunded in the CMS. Note the
    current manual-refund behavior.
- [x] Who owns what: the Stripe account login (owner), env vars/hosting (Martin/developer), and
      when to escalate to the developer.
- [x] List every payment-related env var and where it's set (no values).

### CMS Payment Health
- [x] `GET /api/admin/payments/health` (`ecommerce:manage-orders`, the existing Orders
      capability; the ticket said `orders:manage`, which doesn't exist): Stripe secret key valid
      (`balance.retrieve`), publishable key set and in the same mode, webhook secret set, webhook
      endpoint registered in Stripe for `/api/payments/webhook` (enabled, all handled events
      subscribed), last webhook received at, last rejected (bad-signature) delivery, orders
      `pending` > 1h, failed orders in the last 7 days, and `past_due` subscriptions.
- [x] `GET /api/admin/payments/events?page&pageSize&status`: recent `PaymentEvent`s (type, order,
      status, error, received at), paginated.
- [x] Dashboard widget `payment-health.widget.tsx`: green/amber/red summary with a button to a new
      **Payment Health** CMS module (its own module, same capability as Orders) listing the
      checks, setup facts, stuck orders (open in the order dialog), past-due subscriptions, and
      recent Stripe messages.
- [x] Postman: both admin endpoints (new **Payments** folder).

### What changed underneath
- `PaymentEvent` now has a `status` (`processing` / `processed` / `failed` / `rejected`),
  `reference` (payment or subscription id), `orderId` and `error`. Before, a delivery whose
  handler threw was **deleted** so Stripe's retry could run. Now it's kept as `failed`, and a
  retry can claim it again, so failures show up in the CMS. Records from before this change read
  as `processed`.
- Deliveries with a bad signature (the classic "secret was rolled" case) bump one rolling
  `rejected` record per provider rather than one row each, because anyone can post to the
  webhook URL.
- `PaymentProvider.checkHealth()` added to the provider contract
  (`libs/payments/src/providers/stripe/stripe-health.ts`). It returns only facts, never key
  values.
- The green/amber/red rules are a pure function (`libs/ecommerce/src/payment-health/payment-health.rules.ts`)
  with a vitest spec. `ecommerce` gained a `test` target like `db`'s.
- Status colors: OK uses `secondary`, amber uses `accent`, red uses the safelisted `red` the CMS
  already uses for destructive states. Each also has its own icon.

## Findings

- **Cancelling a subscription withdraws the dancer.** Their access lasts to the end of the
  current period, and then the seat is released. The cash-for-a-past-due-renewal flow therefore
  re-registers the dancer at the Front Desk. If the class is full, the old seat may still be held
  until the period ends, and the runbook says to call the developer. Revisit if this comes up
  often.
- Marking an order **Refunded** only reverses the ledger and cancels a class card. It doesn't
  withdraw a dancer or stop a subscription. The runbook says to do those separately.
- A stuck pending order whose payment succeeded is also finished by the lazy sweep the next time
  anyone starts a checkout. Renewals have no such backup and depend on the webhook.
- Possible follow-up: a customer/email search in CMS Orders.

## Acceptance criteria

- [x] The runbook lets a non-developer resolve the stuck-webhook and declined-renewal cases using
      only the Stripe Dashboard and the CMS. (Changing an env var after a rolled key or secret
      still needs hosting access. The runbook marks those steps "Developer/hosting".)
- [x] The CMS dashboard shows red when the Stripe key is invalid or no webhook has arrived in
      over 24h while orders are pending. *(covered by the spec; awaiting manual check)*
- [x] Type-check passes for `api-core`, `ecommerce`, `api-client`, `cms` (and `db`, `payments`).
      `ecommerce` tests pass (13). Postman updated.

## Manual test plan

1. Sign in to the CMS as an admin. The Dashboard shows a **Payment Health** card. Open it with
   **Open Payment Health**. With correct test keys and the Stripe CLI forwarding webhooks, expect
   amber at most ("No Stripe webhook endpoint is set up" is amber in test mode).
2. Place a test checkout. **Messages from Stripe** shows "Payment succeeded · Processed" with the
   order number.
3. Set `STRIPE_WEBHOOK_SECRET` to a wrong value and restart the API. Place another checkout and
   **Check again**: "Messages from Stripe are being rejected" is red, and a "Rejected (bad
   signature)" row appears. Restore the secret.
4. Set `STRIPE_SECRET_KEY` to a wrong value and restart: "The server cannot talk to Stripe" is
   red, on both the module and the Dashboard card. Restore it.
5. Pay with the 3-D Secure test card `4000 0027 6000 3184` and close the challenge. After an hour
   the order appears under **Orders waiting on payment for over an hour** (amber while webhooks
   are arriving). **View** opens the order.
6. Postman → **Payments** → both requests return 200 for an admin. A user without the Orders
   capability gets 403.

## Note for the client response

Send this once the branch is deployed.

> **Martin's question: "What if the payment link breaks?"**
>
> There's no separate payment link that can break. The card form on checkout is Stripe's own,
> built into the site. When payments have trouble, it's almost always one of two things: the Stripe
> keys on the server were changed, or Stripe can't deliver its confirmation messages ("webhooks")
> to the site. The second one matters most for monthly tuition, because renewals are recorded only
> through those messages.
>
> - **Check it yourself:** the CMS now has a **Payment Health** page, also shown on the
>   Dashboard. It checks Stripe live and shows green, amber or red, with a plain-English reason and
>   what to do. It also lists orders stuck waiting on payment, families whose monthly card was
>   declined, and every message Stripe has sent the site.
> - **Fix it yourself:** we've written a step-by-step guide (`docs/runbooks/payments.md`, which
>   we'll send you) covering: checkout failing for everyone, a family charged but the order stuck,
>   a declined monthly renewal, a family who paid but has no registration, and refunds. Most fixes
>   happen in the Stripe Dashboard and the CMS. Changing a Stripe key on the server is the one step
>   that needs hosting access.
> - **One-time Stripe setting to turn on (owner):** in the Stripe Dashboard, under Settings →
>   Billing → Subscriptions and emails, turn on the emails Stripe sends when a card payment fails,
>   with the link that lets the customer update their card. Stripe sends these emails itself at no
>   cost, so families with an expired card can fix it without calling the studio.
> - **If a family wants to pay cash after a declined card:** cancel their monthly plan in CMS →
>   Subscriptions, re-register the dancer at the Front Desk as "Pay in person", and record the
>   cash there. Cancelling a plan withdraws the dancer, so do the re-registration right away.
> - **Refunds** take two steps: refund the payment in the Stripe Dashboard, then mark the order
>   Refunded in the CMS so the family's account is correct. Stop a monthly plan or withdraw a
>   dancer separately if needed.
> - It helps if the owner invites Martin to the Stripe account (Settings → Team) so he can follow
>   the guide.
