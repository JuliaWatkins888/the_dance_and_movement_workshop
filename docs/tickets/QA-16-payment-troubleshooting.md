# QA-16: Payment troubleshooting runbook + CMS payment health

- **Status:** `todo`
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

## Implementation steps

### Runbook (`docs/runbooks/payments.md`)
- [ ] How payments flow: checkout → Stripe → webhook → order paid → registration created (one
      diagram).
- [ ] Symptom table, each row with "check" and "fix":
  - Checkout shows a payment error for everyone → Stripe keys wrong/rotated (env vars), Stripe
    account restricted (Stripe Dashboard banner).
  - Card charged but order stuck in "pending" → webhook failing: Stripe Dashboard → Developers →
    Webhooks → endpoint → failed deliveries → "Resend". Check `STRIPE_WEBHOOK_SECRET`.
  - Monthly renewal failed / "past due" → customer card declined; how to have the family update
    their card; how to record a cash payment instead (QA-11).
  - A family says they paid but no registration → find the order in CMS Orders by email, check
    its status history, match it to the Stripe payment.
  - Refunds → done in the Stripe Dashboard, then mark the order refunded in the CMS. Note the
    current manual-refund behavior.
- [ ] Who owns what: the Stripe account login (owner), env vars/hosting (Martin/developer), and
      when to escalate to the developer.
- [ ] List every payment-related env var and where it's set (no values).

### CMS Payment Health
- [ ] `GET /api/admin/payments/health` (`orders:manage`): Stripe API key valid (a cheap
      `balance.retrieve` or account call), webhook endpoint configured, last webhook received
      at, count of orders `pending` > 1h, failed orders in the last 7 days, and `past_due`
      subscriptions.
- [ ] `GET /api/admin/payments/events?page`: recent `PaymentEvent`s (type, order, status,
      received at), paginated.
- [ ] Dashboard widget `payment-health.widget.tsx`: green/amber/red summary linking to a detail
      screen (inside the Orders module or its own module) with stuck orders, past-due
      subscriptions, and recent events.
- [ ] Postman: both admin endpoints.

## Acceptance criteria

- [ ] The runbook lets a non-developer resolve the stuck-webhook and declined-renewal cases using
      only the Stripe Dashboard and the CMS.
- [ ] The CMS dashboard shows red when the Stripe key is invalid or no webhook has arrived in
      over 24h while orders are pending.
- [ ] Type-check passes for `api-core`, `ecommerce`, `api-client`, `cms`. Postman updated.
