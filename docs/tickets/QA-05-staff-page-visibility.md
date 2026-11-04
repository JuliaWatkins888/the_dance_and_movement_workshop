# QA-05: Hide staff from the public Staff page (Melissa)

- **Status:** `done`
- **Priority:** P1
- **Depends on:** -
- **Branch:** `feature/qa-05-staff-visibility`

## Client request

> Melissa won't be featured on my teacher/staff page, but will need an account so she can clock
> in/out

## Current state

- Time Clock access is **role-based**, not tied to Staff records: any `contributor`/`editor`/`admin`
  gets `time:track` (`libs/permissions/src/roles/role-capability-defaults.ts`,
  `libs/time/src/timeAccess.ts`). A contributor account with no Staff record can already clock
  in.
- Every Staff record (`libs/db/src/contracts/staff.contract.ts`) shows on the public `/staff`
  page. A Staff record is also what makes someone selectable as a section/workshop instructor.

## Decisions

- Add a **"Show on Staff page"** toggle to Staff records (default on). This covers Melissa
  whether or not she teaches, and anyone similar later.

## Implementation steps

- [x] `staff.contract.ts` + `staff.schema.ts` (db): add `isListed: boolean`, default `true`, so
      existing records stay visible without a migration (Mongoose default + read-side `?? true`).
- [x] `libs/api-core/src/schemas/staff.schema.ts`: accept `isListed` on create/update.
- [x] `staff.route.ts`: the public listing filters to `isListed !== false`. CMS/admin listing and
      instructor pickers still return all staff.
- [x] Public class/workshop pages: confirm an unlisted instructor's name still shows on a section
      they teach, and decide whether it links to `/staff` (don't link if unlisted). Names still
      show, because the instructor lookups don't use the listed filter. No public page links an
      instructor to `/staff`, so there was no link to change.
- [x] CMS `StaffEditDialog.tsx`: add the toggle. `StaffAdminModule.tsx`: show a "Hidden" pill on
      unlisted rows.
- [x] Update Postman: Staff create/update bodies include `isListed`. The collection had no Staff
      folder, so this adds one covering every `/api/staff` route, plus a `staffId` variable.
- [x] ~~Setup note for the developer: create Melissa's user account in CMS → Users with role
      `contributor`. Add a Staff record (unlisted) only if she'll be assigned to sections.~~
      Handed to the client. See "Closeout".

## Acceptance criteria

- [x] An unlisted staff member doesn't appear on `/staff` but can still be picked as an instructor.
- [x] A contributor with no Staff record can log into `/time` and clock in/out.
- [x] Existing staff records still show on `/staff` after deploy.
- [x] Type-check passes for `db`, `api-core`, `cms`, `apps/web`. Postman collection updated.

The first three were confirmed by reading the code, not by running the app.

## Closeout

**Melissa's account was NOT created.** The developer closed this ticket on 2026-11-04 on the basis
that the owner can do the whole setup in the CMS, with no developer help:

- **Create the account:** CMS → Users, with role `contributor`. The owner sets the initial password.
- **Narrow the permissions:** CMS → Permissions switches off individual capabilities for one person.
  A new time-keeping-only role was considered and rejected in favor of this. `time:track` isn't
  listed in that dialog, so the owner can't switch off clock-in by accident.
- **Keep her off the Staff page:** the "Show on Staff page" toggle on her Staff record. With no
  Staff record she isn't on the page at all, so she only needs one if she'll be assigned to
  sections or workshops.

## Note for the client response

Include this in the client response. Send it only once this branch is deployed, because the toggle
doesn't exist before then.

> We haven't created Melissa's account, but you can set it up yourself in the CMS:
>
> - **Create her account:** Go to Users, add a new user with her name and email, choose a temporary
>   password (at least 8 characters), and set the role to Contributor. Then share the login with
>   her.
> - **Narrow her permissions:** Contributors can manage areas like classes, staff and policies by
>   default. Go to Permissions, open Melissa's entry, switch off anything she doesn't need, and
>   save. Her time clock access isn't in that list and stays on.
> - **Keep her off the Staff page:** She'll only appear there if you add her under Staff, so if she
>   won't be teaching, there's nothing to do. If you do need to assign her to classes or workshops,
>   add her under Staff and switch off "Show on Staff page". Her name will still show on the
>   classes and workshops she teaches.
> - **Clocking in:** Melissa signs in at `/time` to clock in and out.
