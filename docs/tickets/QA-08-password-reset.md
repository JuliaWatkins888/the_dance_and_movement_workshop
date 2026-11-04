# QA-08: Forgot-password flow + staff-initiated reset

- **Status:** `todo`
- **Priority:** P0
- **Depends on:** QA-07
- **Branch:** `feature/qa-08-password-reset`

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
