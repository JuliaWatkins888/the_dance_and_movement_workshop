# QA-03: Rename "Child" → "Student" and remove the under-18 limit

- **Status:** `todo`
- **Priority:** P1
- **Depends on:** -
- **Branch:** `feature/qa-03-students`

## Client request

> I have a few students who are "children" but they're over the age of 18 and their parents
> still pay for classes for them. Maybe instead of the verbiage "Add Child" we could say "Add
> Student" and not have an age limit.

## Current state

- `libs/api-core/src/schemas/children.schema.ts` rejects any birthdate where the person is 18 or
  older (`ageInYears(date, now) < 18`).
- UI copy says "Child" / "Child Account" in the profile (`apps/web/src/pages/profile/tabs/children.tab.tsx`,
  `ChildFormDialog.tsx`), the CMS Children module (`libs/cms/src/modules/children/`), and the
  class/workshop attendee pickers ("Add a child profile").
- Eligibility (`listEligibleAttendees` in `@inithium/db`) compares a child's birthdate with the
  course min/max age. Self-registration is allowed only for courses with `minAgeYears >= 18`.

## Decisions

- Remove the age cap entirely. Birthdate must still be a real date and not in the future.
- Eligibility stays purely birthdate vs. course min/max for *every* student, so a 20-year-old
  student on a parent's account **can** register for adult (18+) courses. Self-registration rules
  for the account holder are unchanged.
- **User-facing copy only.** The DB collection, `ChildEntity`, the `/api/children` routes and the
  `childId` cart option keep their names. Renaming internals would be a migration with no user
  benefit.

## Implementation steps

- [ ] Drop the `< 18` rule in `children.schema.ts`. Keep "valid date, not in the future", and add
      a sanity floor (born after 1900) so typos don't pass.
- [ ] Check `listEligibleAttendees` and the class/workshop purchasables don't assume children are
      under 18 anywhere (e.g. skipping children for adult-only courses). Fix them so the rule is
      birthdate vs. min/max only.
- [ ] Rename copy: "Child" → "Student", "Child Accounts" → "Students", "Add Child" → "Add
      Student", "Add a child profile" → "Add a student", in the web profile tab, the child form
      dialog, the class/workshop detail pages, the CMS Children module (nav label → "Students"),
      and alerts/empty states. Grep for `child` in user-facing strings across `apps/web` and
      `libs/cms`.
- [ ] Keep the `?tab=child-accounts` URL working (old links), or add `?tab=students` and redirect
      the old value.
- [ ] Update the "self vs. student" helper text on attendee pickers where it says children must
      be under 18.
- [ ] Update any policy/FAQ seed copy that says "child accounts".

## Acceptance criteria

- [ ] A parent can add a student born in 2000, and that student can register for an 18+ course
      from the parent's account.
- [ ] A future birthdate is still rejected.
- [ ] No user-visible "Child"/"Children" wording remains in the profile, registration, or CMS
      screens (internal identifiers are unchanged).
- [ ] Type-check passes for `api-core`, `db`, `cms` and `apps/web`.
