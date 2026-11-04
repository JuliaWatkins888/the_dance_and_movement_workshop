# QA-10: Show-semester withdrawal lock for dancers 7+

- **Status:** `todo`
- **Priority:** P1
- **Depends on:** -
- **Branch:** `feature/qa-10-show-lock`

## Client request

> Parents are able to cancel, but I have it in my policy that they need to give us notice before
> they pull their child. As long as it is before the first of the month they can pull them. I'm
> going to implement something a little more strict for kids 7+ for show semesters because I
> don't want people to pull their child from choreography a week or something stupid before it
> hits the stage.

## Current state

- **The base rule already matches.** Monthly cancel (`POST /api/class-registrations/mine/:id/cancel`
  in `libs/api-core/src/routes/class-registrations.route.ts`) stops the next 1st-of-month charge,
  and the dancer attends through the paid month. Semester/year plans can't be cancelled.
- Semesters (`SemesterEntity` in `libs/db/src/contracts/school-year.contract.ts`) have no "show"
  concept.
- Admins can already cancel subscriptions (`cancelSubscriptionByAdmin` in `@inithium/ecommerce`).

## Decisions

- Admin marks a semester as a **show semester** and sets a **withdrawal lock date** on it.
- From the lock date until the semester ends, families **cannot self-cancel** a monthly
  registration for a student who is **7 or older on the lock date** (by birthdate; account-holder
  "self" registrations are adults, so they're locked too). The profile shows "Withdrawals for this
  class are closed for the show. Please contact the studio." with a link to the contact page.
- Admins can still withdraw anyone from the CMS.
- Before the lock date, the normal rule applies.
- The locked state is shown *before* checkout too: the class page/plan picker for a show semester
  explains the lock date so families know when they sign up.

## Implementation steps

- [ ] `SemesterEntity`: add `isShowSemester?: boolean` and `withdrawalLockDate?: Date` (UTC
      midnight, like the other semester dates). Validate the lock date falls inside the semester
      in `libs/api-core/src/schemas/classes.schema.ts`.
- [ ] Pure helper in `libs/db/src/utils/` (next to class-pricing):
      `isWithdrawalLocked({ registration, schoolYear, attendeeBirthDate, now }) => boolean`. A
      registration is locked if `now` falls in any show semester the registration spans, on or
      after its lock date, and the attendee is ≥7 on that lock date. Edge cases to cover: turns 7
      the day after the lock date, lock date = today, monthly registration spanning both
      semesters. `libs/db` has no test runner yet (only `libs/ui` has Vitest), so either add
      Vitest to `db` for this helper or list the verified cases in the PR description.
- [ ] Cancel route: throw `ConflictError` with the message above when locked.
- [ ] `toRegistrationDto`: `canCancel` false plus a `cancelLockedReason` when locked, so the UI
      doesn't offer a button that will fail.
- [ ] Profile Registrations tab: show the locked message in place of Cancel.
- [ ] CMS Classes → School Year editor: per-semester "Show semester" toggle + lock date picker.
- [ ] Class detail page: a notice on sections in a show semester ("Withdrawals close <date> for
      dancers 7+").
- [ ] Add the lock rule to the policy seed copy only if the client wants it in their written
      policy (they write their own policies; just flag it).
- [ ] Postman: cancel request example showing the 409.

## Acceptance criteria

- [ ] Before the lock date, a parent can cancel a monthly registration as today.
- [ ] On/after the lock date, a parent can't cancel for a 7+ dancer (UI hides it, API rejects
      it), but can for a 6-year-old.
- [ ] An admin can still withdraw a locked registration from the CMS.
- [ ] Type-check passes for `db`, `api-core`, `cms`, `apps/web`. Helper edge cases are verified.

## Open questions (for the client)

- Which semester(s) are show semesters this year, and what's the lock date?
