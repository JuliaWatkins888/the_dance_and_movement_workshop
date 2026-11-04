# QA-02: Fix "Continue shopping" after registration

- **Status:** `done`
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

## Decisions

- "Continue shopping" goes back to the catalog of whatever was just bought or is in the cart:
  - order/cart contains a class → `/classes`
  - otherwise a workshop → `/workshops`; event → `/events`; product → `/merch`
  - fallback `/classes` (the studio's main offering)
- If the target page is unpublished, the next fallback in the list is used.

## Implementation steps

- [x] Reproduce on the deployed site: note what the button does after a class checkout (404,
      no-op, wrong page) and whether the `merch` page record is published. Record it under
      "Findings".
- [x] Add one pure helper (e.g. `continueShoppingPath(lines)` in `apps/web/src/pages/ecommerce/`)
      that maps order/cart line `sourceType`s to a catalog path using the priority above.
- [x] Use it in `OrderPage`, `CartPage` (both buttons) and `CheckoutPage`.
- [x] Make sure the click actually navigates: the page-transition navigator
      (`useNavigateWithTransition`) must not be swallowed while an exit animation or modal is
      open.
- [x] Check the `/order/:id` page for a failed order still shows "Back to cart".

## Findings

Root cause was in the page router, not the button or the transition navigator:

- `apps/web/src/app/app.tsx` rendered RTK Query's `data` from `useGetPageByRouteQuery`, which keeps
  the *previous* route's page when the new route fails. With `/merch` unresolvable (unpublished or
  restricted), the URL changed but the order confirmation stayed on screen, so the click looked
  like a no-op. Fixed by dropping the page when `isError` is set for the current route, so a
  missing page now renders `NotFoundPage`. This also fixes the same symptom for any internal link
  to an unpublished page.
- `useNavigateWithTransition` is a plain wrapper over `navigate`, and `PageShell` restarts its exit
  timer when the target page changes, so navigation is never swallowed.
- New `apps/web/src/pages/ecommerce/continueShopping.ts`: pure `continueShoppingPath(lines,
  isAvailable)` plus the `useContinueShoppingPath` hook, which marks a catalog unavailable when its
  page fails to resolve. Order: catalogs in the order/cart (class → workshop → event → merch),
  then the remaining catalogs in that same order, then `/`.
- Wired into `OrderPage`, both `CartPage` buttons and `CheckoutPage`. Failed orders still show
  "Back to cart".
- Unrelated pre-existing type error fixed along the way: `contact.notification-hook.tsx` imported
  `../registry` instead of `./registry` (present since the scaffold commit).

Merged in PR #25 and deployed 2026-11-04.

## Acceptance criteria

- [x] After checking out a class, "Continue shopping" lands on `/classes`.
- [x] After a merch-only order, it lands on `/merch`. Workshops → `/workshops`, events → `/events`.
- [x] Empty-cart buttons go to `/classes`.
- [x] `npx tsc --noEmit -p apps/web/tsconfig.app.json` passes.
