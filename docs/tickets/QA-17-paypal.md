# QA-17: PayPal as a payment option (via Stripe)

- **Status:** `todo`
- **Priority:** P2 (client: "not urgent")
- **Depends on:** -
- **Branch:** `feature/qa-17-paypal`

## Client request

> Add PayPal as a way to pay (not urgent)

## Current state

- One payment provider: Stripe (`libs/payments/src/active-provider.ts`), with the Payment Element
  on the web (`apps/web/src/pages/ecommerce/payment/StripePaymentFields.tsx`).
- Monthly class plans are Stripe subscriptions billed to a saved card.

## Decisions

- **Try Stripe first.** If the studio's Stripe account can enable PayPal as a payment method, turn
  it on and let the Payment Element offer it. One-time payments only, at least initially. Monthly
  subscriptions stay card-only unless Stripe supports PayPal for recurring on this account.
- **Only if Stripe can't**, fall back to a native PayPal provider behind the existing
  `PaymentProvider` contract. That's a much larger, separately estimated scope, so stop and
  re-plan before starting it.

## Implementation steps

- [ ] **Eligibility check (developer/client):** Stripe Dashboard → Settings → Payment methods →
      look for PayPal. Record the result (available? one-time only? recurring?) under
      "Findings".
- [ ] If available: enable it in the Dashboard. Confirm how the PaymentIntent is created in
      `libs/payments/src/providers/stripe/` (automatic payment methods vs. an explicit
      `payment_method_types` list) and allow PayPal for one-time intents.
- [ ] Carts with a monthly plan: restrict to card (pass the method list explicitly for
      subscription setups) and show a short note: "PayPal is available for one-time payments."
- [ ] Handle redirect-based confirmation (PayPal redirects away and back). Make sure the
      `return_url` lands on the order page and `confirmOrderPayment` / the webhook completes the
      order. This is the existing `requires_action` path; verify it.
- [ ] Refund path: confirm Stripe refunds work for PayPal charges, and note it in the QA-16
      runbook.
- [ ] Test in Stripe test mode with PayPal test flows.

## Findings

_(Stripe eligibility result goes here.)_

## Acceptance criteria

- [ ] PayPal shows as an option at checkout for carts without monthly plans, and a successful
      PayPal payment marks the order paid and creates registrations exactly like a card.
- [ ] Carts with a monthly plan only offer card.
- [ ] Type-check passes for `payments`, `ecommerce`, `apps/web`.
