# QA-07: Transactional email package (Resend)

- **Status:** `closed` (not implemented, see "Closeout")
- **Priority:** P0 (blocked QA-08 password reset, which is also closed)
- **Depends on:** -
- **Branch:** none, no code changed

The steps and acceptance criteria below are unticked on purpose. Nothing in them was built. They
stay here as the spec if the client later chooses to add an email provider.

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

## Closeout

**`@inithium/email` was NOT built and no provider was added.** The developer closed this ticket on
2026-11-05. Its only firm consumer was the QA-08 forgot-password flow, and the owner and admins can
already reset passwords in the CMS (QA-08 has the steps, what was confirmed, and the limits).

The reasoning:

- **It's another dependency for the client to own.** That means a provider account, DNS records on
  their domain, and API keys to keep on the deployed API.
- **It might cost them money.** Some providers have a free tier, so a higher bill isn't certain, but
  the client may have to put a card down again, and they may not want to.
- **It should be their choice.** A logged-out reset can't be done without a provider, so if they want
  one, this ticket is the spec. Resend was only the first provider picked, so check current pricing
  and free-tier terms before recommending one.

**Nothing else is waiting on this.** The "Why this ticket exists" section says receipts, QA-11 balance
notices and QA-12 invites would reuse it, but neither QA-11 nor QA-12 includes a step that sends
email. If email is added later, those would be new work.

## Note for the client response

Covered by the note in [QA-08](QA-08-password-reset.md), including the email provider decision. Send
that note once. There's nothing separate to send for this ticket.
