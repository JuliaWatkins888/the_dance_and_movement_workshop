# QA-09: Policy acknowledgement + typed signature at registration

- **Status:** `done`
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
- [x] `PolicyConsent` contract + schema in `libs/db`: `{ userId, schoolYearId, policyVersionHash,
      policySnapshot (categories → items, HTML), signedName, agreedAt, ipAddress, userAgent,
      method: 'online' | 'paper', recordedByUserId?, orderId? }`. Create-only, no update/delete
      in the repository.
- [x] Policy version: a pure `hashPolicies(categories)` over the ordered titles and content
      (SHA-256). Computed on read, so no migration is needed.

### Backend
- [x] `GET /api/policy-consent/status`: `{ required: boolean, schoolYearId, versionHash }` for
      the current user and the school year of the registration items in their cart (or the
      current school year).
- [x] `POST /api/policy-consent { versionHash, signedName, agreed: true }`: rejects with 409 if
      `versionHash` isn't the current one (policies changed mid-checkout). Captures IP/UA
      server-side.
- [x] `placeOrder` guard: if the cart needs consent and none is valid for the school year +
      current hash, fail with a typed error (`POLICY_CONSENT_REQUIRED`). Enforce it server-side,
      not just in the UI.
- [x] Admin: `GET /api/users/:id/policy-consents` (`users:manage`) and
      `POST /api/users/:id/policy-consents/paper` for desk use.

### Frontend
- [x] Checkout: when consent is required, show a "Studio Policies" step before payment. Include
      a scrollable policy view or a link opening `/policies` in a new tab, the checkbox "I have
      read and agree to all studio policies", and a "Type your full legal name" field. The order
      can't be placed until both are done (see the validation note under Implementation notes).
- [x] Profile: show "Policies signed for 2026–27 on <date>" on the account/registrations tab.
- [x] CMS → Users detail: list the user's consents, each viewable as the exact snapshot with
      name, date and IP. Add a "Print" view for the client's records.
- [x] RTK Query endpoints injected into `baseApi`.

### Docs
- [x] Postman: Policy Consent folder.

## Acceptance criteria

- [x] A first-time registrant for the school year can't pay until they check the box and type
      their name.
- [x] A second registration in the same school year doesn't ask again, unless the policies were
      edited in between.
- [x] Calling `POST /api/checkout` directly without consent fails.
- [x] The CMS shows exactly what text was agreed to, by whom and when, even after policies are
      edited.
- [x] Type-check passes for `db`, `ecommerce`, `api-core`, `api-client`, `cms`, `apps/web`.
      Postman updated.

## Implementation notes

Built on `feature/qa-09-policy-consent`. Type-check passes for every touched project and all 95
`libs/ui` tests pass. The consent logic also passed a throwaway run against in-memory repositories
(29 checks); that script wasn't added to the repo, so this ticket added no automated tests. The
developer tested the feature in the browser and signed it off on 2026-11-05.

Choices the ticket left open:

- **Which year a line counts toward:** a class uses its section's school year. A workshop has no
  school year, so it uses the published year in session, or the next one to start. If no year
  applies, the signature is stored with no school year and is still required, so a gap in the
  calendar can't skip signing.
- **Cart spanning two school years:** one signature creates one record per unsigned year.
- **No policies published:** registration isn't blocked, because there's nothing to agree to.
- **Failed payment:** the signature is saved after the card details are validated but before the
  charge. An incomplete card leaves no signature. If the charge itself is declined, the signature
  stands and the person isn't asked again on retry.
- **Status code:** `POLICY_CONSENT_REQUIRED` is a 403. `POLICY_VERSION_CHANGED` is the 409.

Differences from the steps above:

- **Validation (developer's call during browser testing):** the ticket had the pay button disabled
  until the step was complete. `Button` has no disabled styling, so it looked active and did
  nothing when clicked. The button now stays clickable. A click shows an alert, marks each
  incomplete field in red with helper text, and moves focus to the first one. This covers the
  whole checkout form, not just the policy step, and the card fields validate at the same time as
  everything else. It's only disabled while an order is being placed or when online payments
  aren't set up.
- **Disabled buttons site-wide (developer's call):** `Button` now dims when disabled and ignores
  the pointer, so hover colors can't make it look active. This covers `IconButton` too.
- `orderId` exists on the record, but nothing sets it yet. An online signature is made before the
  order exists and records are create-only, and one signature can cover many orders. QA-12 can
  set it at creation for desk orders.
- Added `GET /api/policy-consent/mine` for the profile line, and `schoolYearName` and
  `recordedByName` on the record so it stays accurate if those are later renamed or deleted.
- IP and user agent are only stored for online signatures. A paper record has the staff member
  instead.
- There's no Users detail page, so the signature list is a dialog opened from a new icon on each
  row in CMS → Users.

**For QA-12:** `createManualOrder` doesn't check consent. This ticket only guards `placeOrder`, so
staff-recorded orders can still include classes with no signature on file. QA-12 needs to decide
how the desk flow enforces it.

**For QA-13 and QA-14:** set `requiresPolicyConsent: true` on the new purchasable sources.

## Manual verification

Steps 1 to 7 are what the developer's browser pass covered. Step 8 can't be checked locally.

1. Register for a class on an unsigned account. Clicking to pay is refused, with every incomplete
   field marked at once, until the box is checked and a name is typed.
2. Register again in the same school year. The step doesn't appear.
3. Edit a policy in the CMS, then register again. The step returns.
4. Check out with only merch or event tickets. The step doesn't appear.
5. Call `POST /api/checkout` directly on an unsigned account with a class in the cart. It returns
   403 `POLICY_CONSENT_REQUIRED`.
6. In CMS → Users, open the signature icon. The old text still shows after the edit in step 3.
   Print works, and a paper signature can be recorded.
7. Check the Registrations tab on the profile, in light and dark mode.
8. **Still to do after deploying:** on production, check that the stored IP is the family's, not
   the load balancer's. This relies on `TRUST_PROXY` being set.

## Note for the client response

Include this in the client response once this branch is deployed.

> Families now have to read and sign your studio policies before they can pay for a class or
> workshop. They check a box saying they agree and type their full legal name. Merch and event
> tickets don't ask for this.
>
> - **How often:** once per school year per account, and again if you change the policies.
> - **Editing policies:** any change to a title, the wording or the order counts as a new version,
>   so every family is asked to sign again at their next registration. It's worth making your edits
>   in one go. Families who already registered aren't affected until they register again.
> - **Your records:** in the CMS, go to Users and click the signature icon next to a person. You'll
>   see each signature with the name, date and IP address, and the exact policy text they agreed
>   to, even if you've edited the policies since. Each one has a Print button.
> - **Paper copies:** if a family signs on paper, you can record that in the same place. It's saved
>   under your name and can't be edited afterward.
>
> Before families start signing, please read through the policies on the site to confirm they're
> the wording you want. If you need this to meet a specific legal standard, it's worth having your
> attorney look over the wording and this checkbox-and-typed-name approach.
