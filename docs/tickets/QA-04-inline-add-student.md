# QA-04: Add a student inline from the registration screen

- **Status:** `todo`
- **Priority:** P1
- **Depends on:** QA-03 (copy says "Student")
- **Branch:** `feature/qa-04-inline-add-student`

## Client request

> When adding a child in registration screen (if they have no child in their profile already)
> bring up the "add child modal" directly in the registration screen

## Current state

- `apps/web/src/pages/ClassDetailPage.tsx` (~L246) and `WorkshopDetailPage.tsx` (~L217) render a
  `<Link to="/profile/:id?tab=child-accounts">Add a child profile</Link>`. This sends the parent
  away from the class they were registering for and loses their section/plan choice.
- The modal already exists: `apps/web/src/pages/profile/tabs/ChildFormDialog.tsx`, opened from
  `children.tab.tsx` through the shared dialog helper.

## Decisions

- The "Add a student" action opens the existing student form dialog **in place**. On save, the
  attendee list refreshes and the new student is pre-selected *if eligible* for that course.
- Show the action whether or not the account already has students (a family may be adding a
  second one), not only when the list is empty.

## Implementation steps

- [ ] Move `ChildFormDialog` (and the open-dialog helper used by `children.tab.tsx`) to a shared
      location under `apps/web/src/pages/` (e.g. `pages/students/`) so the profile tab and both
      detail pages import the same component. No logic fork.
- [ ] Replace the profile link in `ClassDetailPage` and `WorkshopDetailPage` with a button that
      opens the dialog.
- [ ] After create: invalidate the attendee query (RTK Query tag used by
      `/api/class-registrations/attendees` and the workshop equivalent) so the list refetches,
      then auto-select the new student if they're in the eligible list.
- [ ] If the new student is *not* eligible (age outside the course range), show an inline note
      ("Added, but Ava isn't in the age range for this class") rather than failing silently.
- [ ] Preserve the selected section/plan/days across the dialog open/close.

## Acceptance criteria

- [ ] A parent with no students can open a class, click "Add a student", fill the modal, and
      finish adding to cart without leaving the page.
- [ ] Same on a workshop page.
- [ ] The profile Students tab still adds/edits students through the same component.
- [ ] `npx tsc --noEmit -p apps/web/tsconfig.app.json` passes.
