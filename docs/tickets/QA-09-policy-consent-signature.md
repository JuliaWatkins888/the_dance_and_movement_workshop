# QA-09: Policy acknowledgement + typed signature at registration

- **Status:** `todo`
- **Priority:** P0 (client's legal requirement)
- **Depends on:** -
- **Branch:** `feature/qa-09-policy-consent`

## Client request

> Implement something where parents must acknowledge and "sign" or check a box that says
> they've read all the policies upon registration.
>
> Would also like people registering to check a box that says they agree and consent to the
> policies and have them digitally sign for my own legal purposes

## Current state

- Policies are CMS-managed categories/items with rich HTML (`libs/db/src/contracts/policy.contract.ts`),
  rendered publicly at `/policies`. They aren't versioned.
- Checkout (`apps/web/src/pages/CheckoutPage.tsx` → `POST /api/checkout` in
  `libs/api-core/src/routes/ecommerce/checkout.route.ts` → `placeOrder` in `@inithium/ecommerce`)
  has no consent step.

## Decisions

- Required **once per school year per account**, and again if the policies change after the
  account signed.
- Signature = **checkbox + typed full legal name**.
- Required when the cart has a class, workshop or drop-in/class-card line (registration). Not
  required for merch-only or event-ticket-only carts.
- Each signature stores an immutable **snapshot of the full policy text** the person agreed to,
  so later edits can't change what was signed.
- Desk registrations (QA-12): staff can record that the family signed a paper copy. That is
  stored as a separate method, `paper`, with the staff member's id.

## Implementation steps

### Data
- [ ] `PolicyConsent` contract + schema in `libs/db`: `{ userId, schoolYearId, policyVersionHash,
      policySnapshot (categories → items, HTML), signedName, agreedAt, ipAddress, userAgent,
      method: 'online' | 'paper', recordedByUserId?, orderId? }`. Create-only, no update/delete
      in the repository.
- [ ] Policy version: a pure `hashPolicies(categories)` over the ordered titles and content
      (SHA-256). Computed on read, so no migration is needed.

### Backend
- [ ] `GET /api/policy-consent/status`: `{ required: boolean, schoolYearId, versionHash }` for
      the current user and the school year of the registration items in their cart (or the
      current school year).
- [ ] `POST /api/policy-consent { versionHash, signedName, agreed: true }`: rejects with 409 if
      `versionHash` isn't the current one (policies changed mid-checkout). Captures IP/UA
      server-side.
- [ ] `placeOrder` guard: if the cart needs consent and none is valid for the school year +
      current hash, fail with a typed error (`POLICY_CONSENT_REQUIRED`). Enforce it server-side,
      not just in the UI.
- [ ] Admin: `GET /api/users/:id/policy-consents` (`users:manage`) and
      `POST /api/users/:id/policy-consents/paper` for desk use.

### Frontend
- [ ] Checkout: when consent is required, show a "Studio Policies" step before payment. Include
      a scrollable policy view or a link opening `/policies` in a new tab, the checkbox "I have
      read and agree to all studio policies", and a "Type your full legal name" field. The pay
      button stays disabled until both are done.
- [ ] Profile: show "Policies signed for 2026–27 on <date>" on the account/registrations tab.
- [ ] CMS → Users detail: list the user's consents, each viewable as the exact snapshot with
      name, date and IP. Add a "Print" view for the client's records.
- [ ] RTK Query endpoints injected into `baseApi`.

### Docs
- [ ] Postman: Policy Consent folder.

## Acceptance criteria

- [ ] A first-time registrant for the school year can't pay until they check the box and type
      their name.
- [ ] A second registration in the same school year doesn't ask again, unless the policies were
      edited in between.
- [ ] Calling `POST /api/checkout` directly without consent fails.
- [ ] The CMS shows exactly what text was agreed to, by whom and when, even after policies are
      edited.
- [ ] Type-check passes for `db`, `ecommerce`, `api-core`, `api-client`, `cms`, `apps/web`.
      Postman updated.
