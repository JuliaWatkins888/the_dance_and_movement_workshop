# QA-05: Hide staff from the public Staff page (Melissa)

- **Status:** `todo`
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

- [ ] `staff.contract.ts` + `staff.schema.ts` (db): add `isListed: boolean`, default `true`, so
      existing records stay visible without a migration (Mongoose default + read-side `?? true`).
- [ ] `libs/api-core/src/schemas/staff.schema.ts`: accept `isListed` on create/update.
- [ ] `staff.route.ts`: the public listing filters to `isListed !== false`. CMS/admin listing and
      instructor pickers still return all staff.
- [ ] Public class/workshop pages: confirm an unlisted instructor's name still shows on a section
      they teach, and decide whether it links to `/staff` (don't link if unlisted).
- [ ] CMS `StaffEditDialog.tsx`: add the toggle. `StaffAdminModule.tsx`: show a "Hidden" pill on
      unlisted rows.
- [ ] Update Postman: Staff create/update bodies include `isListed`.
- [ ] Setup note for the developer: create Melissa's user account in CMS → Users with role
      `contributor`. Add a Staff record (unlisted) only if she'll be assigned to sections.

## Acceptance criteria

- [ ] An unlisted staff member doesn't appear on `/staff` but can still be picked as an instructor.
- [ ] A contributor with no Staff record can log into `/time` and clock in/out.
- [ ] Existing staff records still show on `/staff` after deploy.
- [ ] Type-check passes for `db`, `api-core`, `cms`, `apps/web`. Postman collection updated.
