# QA-10: Show-semester withdrawal lock for dancers 7+

- **Status:** `done`
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

- [x] `SemesterEntity`: add `isShowSemester?: boolean` and `withdrawalLockDate?: Date` (UTC
      midnight, like the other semester dates). Validate the lock date falls inside the semester
      in `libs/api-core/src/schemas/classes.schema.ts`.
- [x] Pure helper in `libs/db/src/utils/` (next to class-pricing):
      `isWithdrawalLocked({ registration, schoolYear, attendeeBirthDate, now }) => boolean`. A
      registration is locked if `now` falls in any show semester the registration spans, on or
      after its lock date, and the attendee is ≥7 on that lock date. Edge cases to cover: turns 7
      the day after the lock date, lock date = today, monthly registration spanning both
      semesters. `libs/db` has no test runner yet (only `libs/ui` has Vitest), so either add
      Vitest to `db` for this helper or list the verified cases in the PR description.
- [x] Cancel route: throw `ConflictError` with the message above when locked.
- [x] `toRegistrationDto`: `canCancel` false plus a `cancelLockedReason` when locked, so the UI
      doesn't offer a button that will fail.
- [x] Profile Registrations tab: show the locked message in place of Cancel.
- [x] CMS Classes → School Year editor: per-semester "Show semester" toggle + lock date picker.
- [x] Class detail page: a notice on sections in a show semester ("Withdrawals close <date> for
      dancers 7+").
- [x] Add the lock rule to the policy seed copy only if the client wants it in their written
      policy (they write their own policies; just flag it).
- [x] Postman: cancel request example showing the 409.

## Acceptance criteria

- [x] Before the lock date, a parent can cancel a monthly registration as today.
- [x] On/after the lock date, a parent can't cancel for a 7+ dancer (UI hides it, API rejects
      it), but can for a 6-year-old.
- [x] An admin can still withdraw a locked registration from the CMS.
- [x] Type-check passes for `db`, `api-core`, `cms`, `apps/web`. Helper edge cases are verified.

## Work done

- Admins mark a semester as a show semester and set its lock date in CMS Classes → School Years.
- The rule lives in `isWithdrawalLocked` (`libs/db/src/utils/class-withdrawal.ts`), covered by 13
  Vitest cases. Vitest is new to `db`: run it with `npx nx run db:test`.
- The helper takes the section's semesters rather than the whole school year, so a section that
  skips a show semester isn't locked by it.
- A child profile that no longer exists has no birthdate, so it locks the same way as an adult and
  the family contacts the studio.

Added beyond the original steps:

- `DELETE /api/subscriptions/mine/:id/lines/:lineId` also enforces the lock. The website doesn't
  call this route, but a logged-in account could have used it to get around the lock.
- CMS Subscriptions gets a **Cancel item** button, backed by
  `POST /api/subscriptions/admin/:id/lines/:lineId/cancel`. It appears when a subscription has more
  than one active line. The existing admin cancel stops the whole subscription, which would also
  have stopped billing for a sibling.
- CMS Subscriptions now shows the dancer next to each class. Siblings in the same class otherwise
  had identical rows, so an admin could not tell which one they were withdrawing.

The developer tested this in the app with a four-student test family and closed the ticket before
opening the PR.

## Note for the client response

Include this in the client response. Send it only once this branch is deployed, because these
settings don't exist before then.

> The show-semester withdrawal lock is ready for you to use. It stops families from pulling a dancer
> close to a show, while you can still withdraw anyone yourself. It stays off until you turn it on.
>
> **Setting it up**
>
> 1. In the CMS, go to **Classes**, open **School Years**, and edit the school year.
> 2. Under the semester, switch on **Show semester**.
> 3. Choose the **Withdrawal Lock Date**. It has to fall inside that semester.
> 4. Click **Save**.
>
> The lock applies as soon as its date arrives, including to families who are already registered. If
> you change the date or switch it off, that takes effect as soon as you save.
>
> **Who is locked**
>
> From the lock date through the last day of the semester, families can't cancel online for:
>
> - Dancers on a monthly plan who are 7 or older on the lock date. A dancer who turns 7 after that
>   date can still be withdrawn online for the rest of the semester.
> - Adults on a monthly plan who registered themselves.
>
> Dancers under 7 can still cancel as usual. Semester and full-year plans aren't affected, because
> they're paid up front and could never be cancelled online.
>
> **What families see**
>
> - **Before they sign up:** Each class time in a show semester shows a notice like "Spring is a show
>   semester: monthly withdrawals close Apr 15 for dancers 7+." The payment section explains it too.
> - **Before the lock date:** Nothing changes. They can cancel from the **Registrations** tab on their
>   profile. There are no more monthly charges, and the dancer attends through the month already paid.
> - **From the lock date on:** The Cancel button is replaced with "Withdrawals for this class are
>   closed for the show. Please contact the studio." and a link to your contact page.
>
> **When a family contacts you to withdraw**
>
> 1. In the CMS, go to **Subscriptions** and find the family.
> 2. If they have more than one class on the subscription, click **Cancel item** next to the right
>    dancer. Their other classes keep billing.
> 3. If they have only one class, click **Cancel**. **Don't use Cancel on a subscription with several
>    classes unless you mean to stop all of them**, because it ends billing for every dancer on it.
>
> Either way, billing stops right away with no refund or proration, and the dancer attends through
> the month already paid. This can't be undone.
>
> **Good to know**
>
> - **Start time:** The lock begins the evening before your chosen date, because the system changes
>   dates at midnight UTC. If that matters, tell families a date one day later than the one you set.
> - **Two show semesters:** Each has its own lock date. Once the first semester ends, online
>   withdrawals reopen until the second semester's lock date.
> - **Missed payments:** The lock only stops families from cancelling online. It doesn't change how a
>   failed monthly payment is handled.
>
> **Two things we need from you**
>
> 1. Which semester(s) are show semesters this year, and what date should withdrawals lock? You can
>    also set this yourself using the steps above.
> 2. Your written Withdrawal Policy only says notice is due before the 1st of the month. You may want
>    to add this rule when you next update your policies, since you write those yourself.

## Open questions (for the client)

- Which semester(s) are show semesters this year, and what's the lock date? This doesn't block
  closing the ticket: the answer is entered in the CMS, not in code.
