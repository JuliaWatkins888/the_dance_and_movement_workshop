# QA-06: CMS-editable studio hours & contact info

- **Status:** `todo`
- **Priority:** P1
- **Depends on:** -
- **Branch:** `feature/qa-06-studio-info-settings`

## Client request

> I can't figure out how to edit the hours/contact info. If it's not already an option, I would
> like to have Sunday say "By Appointment Only" so people can book private lessons on Sundays.

## Current state

The info isn't editable. It's hardcoded:

- `apps/web/src/pages/ContactPage.tsx`: `STUDIO_PHONE`, `STUDIO_PHONE_TEL`, `STUDIO_EMAIL`,
  `FACEBOOK_URL`, `INSTAGRAM_URL`, `STUDIO_HOURS` (Sun = "Closed").
- `apps/web/src/app/studioLocation.ts`: `STUDIO_NAME`, `STUDIO_ADDRESS`, also used by
  `apps/web/src/pages/events/eventFormat.ts` for "At the studio" events.
- CMS settings live in `libs/cms/src/settings/definitions/*.setting.ts`. Types include `string`,
  `json` and `stringList`, and are read on the web through `@inithium/api-client` settings hooks.

## Decisions

- Move all of it into CMS settings under a new **"Studio Info"** group.
- Each day's hours is free text, so "By Appointment Only", "Closed" or "3:00 PM – 8:30 PM" all
  work. Each day also gets an optional link (e.g. Sunday → `/contact?subject=Private%20lesson`)
  so "By Appointment Only" can point families at a booking request. Public self-booking is out of
  scope (see QA-15).
- Defaults equal today's hardcoded values, with Sunday changed to "By Appointment Only", so the
  page looks right on first deploy.

## Implementation steps

- [ ] Add settings definitions (group `Studio Info`):
  - `studio.name` (string), `studio.address` (string), `studio.phone` (string, display format).
    Derive the `tel:` href by stripping non-digits, so no separate field.
  - `studio.email` (string), `studio.facebookUrl` / `studio.instagramUrl` (string, may be blank
    → icon hidden).
  - `studio.hours` (json): an ordered array of `{ day, text, linkUrl? }` for Mon–Sun.
- [ ] Validate server-side in the settings schema (`libs/api-core/src/schemas/settings.schema.ts`).
      Hours must be exactly 7 entries, text ≤ 60 chars, link a relative path or https URL, and
      the email/URLs well-formed.
- [ ] If the generic `json` editor is too raw for a non-technical owner, add a small dedicated
      editor in the CMS Settings module for `studio.hours`: 7 rows, text input plus optional link.
- [ ] Add typed web hooks (e.g. `useStudioInfo()`) in `@inithium/api-client` that return the
      settings merged over the defaults.
- [ ] Replace the constants in `ContactPage.tsx`, `studioLocation.ts` and `eventFormat.ts` with
      the hook. Keep `googleMapsLink` as a pure helper.
- [ ] Contact page: render a day's `linkUrl` as a link on its hours text.
- [ ] Make sure the footer (if it shows phone/address) reads from the same source.
- [ ] Update Postman if any new settings route or shape is introduced.

## Acceptance criteria

- [ ] The owner can change phone, email, address, social links and each day's hours in CMS →
      Settings → Studio Info, and the Contact page reflects it after refresh.
- [ ] Sunday shows "By Appointment Only" and links to a prefilled contact form.
- [ ] Events marked "At the studio" show the address from settings.
- [ ] No hardcoded studio contact constants remain in `apps/web`.
- [ ] Type-check passes for `cms`, `api-core`, `api-client`, `apps/web`.
