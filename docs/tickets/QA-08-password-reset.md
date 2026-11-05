# QA-08: Forgot-password flow + staff-initiated reset

- **Status:** `closed` (not implemented, see "Closeout")
- **Priority:** P0
- **Depends on:** QA-07
- **Branch:** none, no code changed

The steps and acceptance criteria below are unticked on purpose. Nothing in them was built. They
stay here as the spec if the client later chooses self-service reset.

## Client request

> There is no way to reset a password if forgotten on the login screen

## Current state

- `libs/api-core/src/routes/auth.route.ts` has only register, login and `/auth/me`. A logged-in
  user can change their password from the profile (`/api/profile/me/password`), but nothing
  exists for a logged-out user.
- Login page: `apps/web/src/pages/LoginPage.tsx`. The CMS and Time Clock have their own login
  pages (`libs/cms/src/CmsLoginPage.tsx`, `libs/time/src/TimeLoginPage.tsx`).

## Decisions

- **Self-serve:** "Forgot password?" → enter email → emailed single-use link, valid **1 hour** →
  set a new password.
- **Staff fallback** (for families who can't manage email): in CMS → Users, staff with
  `users:manage` can (a) send the reset email on the user's behalf, or (b) set a temporary
  password that the user must change at next login.

## Implementation steps

### Backend
- [ ] `PasswordResetToken` contract + schema in `libs/db`: `{ userId, tokenHash, expiresAt,
      usedAt?, createdAt }`, with a TTL index on `expiresAt`. Store **only a SHA-256 hash** of the
      token.
- [ ] `POST /auth/password/forgot { email }`:
  - Always returns 200 with the same message whether the email exists or not (no account
    enumeration).
  - Rate-limit per IP and per email (reuse the existing `registerRateLimiter` pattern).
  - Invalidates earlier unused tokens for that user, creates a new one, and sends the email via
    `@inithium/email` with a link to `/reset-password?token=…`.
- [ ] `POST /auth/password/reset { token, password }`: validates the hash, expiry and unused
      state. Uses the same password rules as registration. Marks the token used. Invalidates
      existing sessions/refresh tokens if the auth provider supports it (check
      `libs/auth/src/providers/jwt`).
- [ ] `POST /api/users/:id/password-reset-email` (`users:manage`): sends the same email.
- [ ] `POST /api/users/:id/temporary-password` (`users:manage`): sets a password plus a
      `mustChangePassword` flag on the user. Login returns that flag, and the web forces the
      change-password dialog (`libs/ui/src/composites/ChangePasswordDialog.tsx`) before anything
      else.
- [ ] Email template "Reset your password" in `libs/email`.

### Frontend
- [ ] "Forgot password?" link on the web, CMS and Time login pages → `/forgot-password`.
- [ ] `/forgot-password` and `/reset-password` pages (anonymous-only page records + seeds, like
      `login.page-seed.ts`). Show clear states for expired, used, and success → link to login.
- [ ] RTK Query endpoints injected into `baseApi` (no new API slice).
- [ ] CMS `UsersModule` / `UserFormDialog`: "Send reset email" and "Set temporary password"
      actions.

### Docs
- [ ] Postman: add the four endpoints in the Auth / Users folders, with status-code tests.

## Acceptance criteria

- [ ] A logged-out user can reset their password from the login screen via email.
- [ ] The link works once, expires after 1 hour, and the response never reveals whether an
      email is registered.
- [ ] Staff can send a reset email or set a temporary password. A user with a temporary password
      must change it on next login.
- [ ] Type-check passes for `db`, `auth`, `api-core`, `email`, `api-client`, `cms`, `time`,
      `apps/web`. Postman updated.

## Closeout

**The forgot-password flow was NOT built.** The developer closed this ticket on 2026-11-05, because a
logged-out reset needs an email provider (QA-07) and that is a new dependency the client may have to
pay for. The owner and admins can already reset a password in the CMS, so that is the answer for now.

**How it works today:** CMS → Users → pencil icon on the user → New Password → Save Changes.
This is `UserFormDialog.tsx` calling `PATCH /api/users/:id`. The password is hashed the same way as
at registration, and the user's existing sessions are revoked.

**Confirmed on 2026-11-05** by sending the same request body the dialog sends through the real route,
permission, auth and bcrypt code over HTTP, with the database swapped for an in-memory user store:

- The owner and an admin can each reset a family account. The old password then fails, the new one
  signs in, and a device already signed in as that family gets a 401.
- An admin can also reset a contributor or another default admin. The owner can reset an admin who
  holds extra grants.
- A blank password leaves the current password unchanged.
- A contributor gets 403, an anonymous request gets 401, and a password under 8 characters gets 400.

Not exercised: the Mongo repository (read only, its `update` does write `passwordHash`) and the dialog
in a browser. **Still to do by hand:** reset one test account in the deployed CMS before sending the
note below.

**Limits of the manual approach**, all confirmed by the same test or by reading the code:

- **Nobody can reset the owner account in the CMS.** An admin gets 403. The owner editing their own
  row gets 400, because the dialog always sends `role`. If the owner forgets their password while
  signed out, the developer has to fix it directly in the database. Ownership transfer doesn't help,
  because it requires being signed in as the owner.
- **Admins can't reset themselves in Users either**, for the same reason. While signed in they can use
  Change Password. If they've forgotten it, the owner or another admin resets it.
- **An admin can't reset an account with more permissions than their own.** Only the owner can.
- **These blocked cases show a generic error** in the dialog ("Could not save this user. Check the
  fields and try again."), not the real reason.
- **No forced change.** There is no `mustChangePassword` flag, so the temporary password keeps working
  until the user changes it, and the staff member who set it knows it until then.
- **No identity check or audit trail.** Staff have to confirm who is asking, and nothing records who
  reset a password.
- **A reset doesn't clear the sign-in rate limit.** After 10 failed attempts per IP in 15 minutes, or
  20 per account in an hour, the user still has to wait.
- **The client's original complaint still stands on screen.** The login pages show nothing about a
  forgotten password. A "Forgot your password? Contact the studio" line needs no provider, but it
  hasn't been added.

## Note for the client response

Include this in the client response. It covers QA-07 as well, so send it once. These are the points
to cover, not the final email. There's no code change to deploy first.

> A "Forgot password?" link on the login screen needs the site to be able to send email, and it can't
> do that today. We haven't added that, because it means signing you up for another outside service.
> You can already reset anyone's password yourself in the CMS:
>
> - **Resetting a password:** Go to Users, find the person, and click the pencil icon. Enter a temporary
>   password (at least 8 characters) under New Password and click Save Changes. The field hides what
>   you type, so type it carefully.
> - **Who can do this:** The owner, and anyone with the Admin role. An admin can't reset an account
>   that has more permissions than they do. If saving fails, that's the likely reason, and the owner
>   will need to do it.
> - **What happens next:** The old password stops working right away and the person is signed out on
>   every device. Give them the temporary password and ask them to change it under Change Password in
>   their account settings. The site doesn't make them change it, so it's worth asking.
> - **Check who's asking:** Nothing verifies the person's identity for you, so make sure it's really
>   them before giving out a new password.
> - **If they're still locked out:** After too many wrong attempts, the site can make someone wait up to
>   an hour before trying again, even with the new password.
> - **The owner's own password:** Nobody can reset the owner account from the CMS. While signed in, you
>   can change it under Change Password. If you forget it, contact us and we'll fix it for you, so
>   please keep it somewhere safe.
>
> **If you'd like families to reset their own passwords without logging in**, we'd need to add a
> third-party email provider. Some providers have a free tier, so this wouldn't necessarily cost you
> more, but it would mean another account in your name, possibly another card on file, and a few DNS
> records on your domain. It would also let the site send other email later, like receipts. The work
> is already scoped, so let us know if you'd like it. Otherwise, the CMS reset covers this.
