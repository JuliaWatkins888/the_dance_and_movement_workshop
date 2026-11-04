# QA-04: Add a student inline from the registration screen

- **Status:** `done`
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
- Added during developer review (2026-11-04): a successful "Add to cart" redirects to `/cart`, on
  the class, workshop, event and merch flows. The assumption is one purchase at a time; "Continue
  shopping" on the cart covers anyone buying more.

## Implementation steps

- [x] Move `ChildFormDialog` (and the open-dialog helper used by `children.tab.tsx`) to a shared
      location under `apps/web/src/pages/` (e.g. `pages/students/`) so the profile tab and both
      detail pages import the same component. No logic fork.
- [x] Replace the profile link in `ClassDetailPage` and `WorkshopDetailPage` with a button that
      opens the dialog.
- [x] After create: invalidate the attendee query (RTK Query tag used by
      `/api/class-registrations/attendees` and the workshop equivalent) so the list refetches,
      then auto-select the new student if they're in the eligible list.
- [x] If the new student is *not* eligible (age outside the course range), show an inline note
      ("Added, but Ava isn't in the age range for this class") rather than failing silently.
- [x] Preserve the selected section/plan/days across the dialog open/close.
- [x] Redirect to `/cart` after a successful add on all four add-to-cart flows. `ProductsPage`'s
      dialog `onClose` no longer touches the URL once the user has left, since it would otherwise
      pull them back to `/merch`.

## Acceptance criteria

- [x] A parent with no students can open a class, click "Add a student", fill the modal, and
      finish adding to cart without leaving the page.
- [x] Same on a workshop page.
- [x] The profile Students tab still adds/edits students through the same component.
- [x] A successful "Add to cart" lands on `/cart` showing the new line, for a class, a workshop, an
      event and a merch item. Merch stays on `/cart` after the dialog's exit animation.
- [x] Closing the merch dialog normally still clears `?item=` and stays on `/merch`.
- [x] `npx tsc --noEmit -p apps/web/tsconfig.app.json` passes.
