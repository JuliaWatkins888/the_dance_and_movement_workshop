# QA-02: Fix "Continue shopping" after registration

- **Status:** `todo`
- **Priority:** P0
- **Depends on:** -
- **Branch:** `fix/qa-02-continue-shopping`

## Client request

> Continue Shopping button doesn't work after registration

## Current state

Every "Continue shopping" button hardcodes `navigate('/merch')`:

- `apps/web/src/pages/OrderPage.tsx` (order confirmation, the screen after registration)
- `apps/web/src/pages/CheckoutPage.tsx` (empty-cart state)
- `apps/web/src/pages/CartPage.tsx` (empty cart + under the Checkout button)

The `/merch` route comes from a DB-managed page record (`libs/db/src/page-seeds/products.page-seed.ts`).
If that page is unpublished, renamed, or access-restricted in the live DB, the button goes to a
404 or does nothing visible. Two problems either way:

1. A family that just registered for a class gets sent to the merch store, which reads as "it
   didn't work" even when the route resolves.
2. The destination is hardcoded rather than derived from what's in the order.

## Decisions (recommended, confirm or override)

- "Continue shopping" goes back to the catalog of whatever was just bought or is in the cart:
  - order/cart contains a class → `/classes`
  - otherwise a workshop → `/workshops`; event → `/events`; product → `/merch`
  - fallback `/classes` (the studio's main offering)
- If the target page is unpublished, the next fallback in the list is used.

## Implementation steps

- [ ] Reproduce on the deployed site: note what the button does after a class checkout (404,
      no-op, wrong page) and whether the `merch` page record is published. Record it under
      "Findings".
- [ ] Add one pure helper (e.g. `continueShoppingPath(lines)` in `apps/web/src/pages/ecommerce/`)
      that maps order/cart line `sourceType`s to a catalog path using the priority above.
- [ ] Use it in `OrderPage`, `CartPage` (both buttons) and `CheckoutPage`.
- [ ] Make sure the click actually navigates: the page-transition navigator
      (`useNavigateWithTransition`) must not be swallowed while an exit animation or modal is
      open.
- [ ] Check the `/order/:id` page for a failed order still shows "Back to cart".

## Findings

_(Fill in after reproducing.)_

## Acceptance criteria

- [ ] After checking out a class, "Continue shopping" lands on `/classes`.
- [ ] After a merch-only order, it lands on `/merch`. Workshops → `/workshops`, events → `/events`.
- [ ] Empty-cart buttons go to `/classes`.
- [ ] `npx tsc --noEmit -p apps/web/tsconfig.app.json` passes.
