# Client QA Round 1 — Ticket Board

Source: client QA email received 2026-11-03 (after the go-live QA pass). Each ticket below covers
one deliverable and is self-contained: what the client asked for, where the code is today, the
decisions already confirmed, the implementation steps, and the acceptance criteria.

## How to use these tickets

- **Status** lives in each ticket's header (`todo` → `in-progress` → `review` → `done`, or
  `blocked`) *and* in the checklist below. Update both when a ticket changes state.
- Work a ticket on its own branch (name given in the ticket), following the Git & PR strategy in
  `CLAUDE.md`. One ticket = one PR unless the ticket says otherwise.
- Tick each implementation step (`- [x]`) as it lands, so a half-finished ticket shows exactly
  where it stopped.
- A ticket is **done** only when every acceptance criterion is ticked, type-check passes for every
  touched project, the Postman collection is updated for any API change, and the developer has
  verified it manually (agents never run dev servers - see `CLAUDE.md` §7).
- "Decisions" sections record answers confirmed by the developer on 2026-11-03. Do not
  re-litigate them; anything under "Open questions" must be answered before the step that needs
  it.
- Test data is created by hand in the CMS. No seed scripts against the Atlas DB.

## Priority key

- **P0**: go-live blocker (broken or legally required)
- **P1**: needed for go-live operations
- **P2**: can ship after launch

## Board

Tick a box only when the ticket's own status is `done`.

- [ ] [QA-01](QA-01-fix-r2-uploads.md): Fix CMS uploads on R2 + clearer upload errors · **P0**
- [x] [QA-02](QA-02-continue-shopping.md): Fix "Continue shopping" after registration · **P0**
- [x] [QA-03](QA-03-child-to-student.md): Rename "Child" → "Student" and remove the under-18 limit · **P1**
- [x] [QA-04](QA-04-inline-add-student.md): Add a student inline from the registration screen · **P1** · needs QA-03
- [x] [QA-05](QA-05-staff-page-visibility.md): Hide staff from the public Staff page (Melissa) · **P1**
- [ ] [QA-06](QA-06-editable-hours-contact.md): CMS-editable studio hours & contact info · **P1**
- [ ] [QA-07](QA-07-email-infrastructure.md): Transactional email package (Resend) · **P0**
- [ ] [QA-08](QA-08-password-reset.md): Forgot-password flow + staff-initiated reset · **P0** · needs QA-07
- [ ] [QA-09](QA-09-policy-consent-signature.md): Policy acknowledgement + typed signature at registration · **P0**
- [ ] [QA-10](QA-10-show-semester-withdrawal-lock.md): Show-semester withdrawal lock for dancers 7+ · **P1**
- [ ] [QA-11](QA-11-account-ledger.md): Account ledger: one-off charges, cash/check payments, pay balance online · **P0**
- [ ] [QA-12](QA-12-desk-registration.md): Staff registers families from the CMS (desk registration) · **P0** · needs QA-03, QA-09, QA-11
- [ ] [QA-13](QA-13-drop-ins.md): Drop-in class purchases ($22) · **P1** · needs QA-11
- [ ] [QA-14](QA-14-class-cards-checkin.md): Adult class cards + CMS check-in · **P1** · needs QA-11
- [ ] [QA-15](QA-15-private-lessons.md): Recurring private lessons (admin-scheduled) · **P1** · needs QA-06, QA-11
- [ ] [QA-16](QA-16-payment-troubleshooting.md): Payment troubleshooting runbook + CMS payment health · **P1**
- [ ] [QA-17](QA-17-paypal.md): PayPal as a payment option (via Stripe) · **P2**

## Suggested order

1. Quick fixes: QA-01, QA-02, QA-03 → QA-04, QA-05, QA-06
2. Account & legal: QA-07 → QA-08, QA-09, QA-10
3. Money: QA-11 → QA-12, QA-13, QA-14, QA-15
4. Ops & extras: QA-16, QA-17

## Questions to send back to the client

Collected from the tickets so they can go out in one message:

1. **Uploads (QA-01):** Which screen were you on when a PDF upload failed? Is there somewhere you
   need to post documents (registration forms, recital info, policies)? Today the site only
   accepts images, on purpose.
2. **Show semesters (QA-10):** Which semester(s) are show semesters this year, and what date
   should withdrawals lock for dancers 7+?
3. **Drop-ins (QA-13):** Is $22 the drop-in price for *every* class, including 30-minute and kids'
   classes, or only some courses?
4. **Class cards (QA-14):** Can a class card be used for any adult class, and can one card be
   shared between two adults on the same account?
5. **Private lessons (QA-15):** What rate do you charge for privates (per lesson or monthly), and
   is it billed like tuition on the 1st or after each lesson? Should booked Sunday privates show
   on the public calendar as anonymous "booked" blocks, or stay hidden?
6. **PayPal (QA-17):** Not urgent. Okay to launch with card only and add PayPal after?
