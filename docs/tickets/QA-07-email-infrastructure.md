# QA-07: Transactional email package (Resend)

- **Status:** `todo`
- **Priority:** P0 (blocks QA-08 password reset)
- **Depends on:** -
- **Branch:** `feature/qa-07-email`

## Why this ticket exists

The app currently sends **no email at all**. The contact form only creates an in-app
notification thread (`libs/api-core/src/routes/contact.route.ts`). Password reset (QA-08) needs
email, and receipts, ledger balance notices (QA-11) and desk-registration invites (QA-12) will
reuse it, so it gets its own infrastructure ticket.

## Decisions

- New workspace package **`@inithium/email`** (`libs/email`), following the same provider-contract
  pattern as `@inithium/payments` and `@inithium/storage`: an `EmailProvider` contract, a
  `providers/resend/` implementation, and an `active-provider.ts` swap point.
- **Resend** is the first provider. It needs DNS records (SPF/DKIM) on the studio's sending
  domain.
- Pure template functions (`(data) => { subject, html, text }`), not a templating engine.

## Implementation steps

- [ ] Scaffold `libs/email` per `CLAUDE.md` §4: `package.json` with `"type": "module"`,
      `project.json` with `build` + `type-check` targets, `tsconfig.lib.json`, and a
      `tsconfig.base.json` path alias `"@inithium/email": ["./libs/email/src/index.ts"]`.
- [ ] `contracts/email-provider.contract.ts`:
      `send({ to, subject, html, text, replyTo? }) => Promise<{ id: string }>`.
- [ ] `providers/resend/resend.provider.ts`, with Zod-validated env: `EMAIL_RESEND_API_KEY`,
      `EMAIL_FROM` (e.g. `The Dance and Movement Workshop <no-reply@studio-domain>`),
      `EMAIL_REPLY_TO` (optional).
- [ ] `sendEmail(templateResult, to)` as the one public send function. It logs failures with the
      provider error, never the body, and returns a typed result so callers can decide whether a
      failure is fatal.
- [ ] A shared HTML layout helper (logo, studio name, footer with address) that every template
      wraps. Keep it inline-styled, since email clients ignore Tailwind.
- [ ] Dev mode: if `EMAIL_RESEND_API_KEY` is unset outside production, log the rendered email to
      the console instead of sending, so local work doesn't need a key.
- [ ] Add `resend` to the root `package.json` and `pnpm-lock.yaml`.
- [ ] README: document the env vars and the Resend domain verification steps (which DNS
      records, where).

## Developer / client setup (manual)

- [ ] Create a Resend account and verify the studio's sending domain (add the DNS records it
      lists).
- [ ] Set `EMAIL_RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` on the deployed API.

## Acceptance criteria

- [ ] `npx nx run email:type-check` and `npx nx build email` pass.
- [ ] With no API key locally, calling `sendEmail` logs the rendered message.
- [ ] With a key, a test email arrives from the verified domain, not in spam.
