# QA-06: CMS-editable studio hours & contact info

- **Status:** `done`
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

- [x] Add settings definitions (group `Studio Info`):
  - `studio.name` (string), `studio.address` (string), `studio.phone` (string, display format).
    Derive the `tel:` href by stripping non-digits, so no separate field.
  - `studio.email` (string), `studio.facebookUrl` / `studio.instagramUrl` (string, may be blank
    → icon hidden).
  - `studio.hours` (json): an ordered list of `{ day, text, linkUrl? }` for Mon–Sun. Stored as
    `{ days: [...] }`, because the `json` setting type only accepts objects.
- [x] Validate server-side in the settings schema (`libs/api-core/src/schemas/settings.schema.ts`).
      Hours must be exactly 7 entries, text ≤ 60 chars, link a relative path or https URL, and
      the email/URLs well-formed. Also rejects blank name, address, phone, email and hours text,
      a phone with fewer than 7 digits, and days out of order.
- [x] If the generic `json` editor is too raw for a non-technical owner, add a small dedicated
      editor in the CMS Settings module for `studio.hours`: 7 rows, text input plus optional link.
      `StudioHoursEditor.tsx`, chosen by an `editor` field on the setting definition.
- [x] Add typed web hooks (e.g. `useStudioInfo()`) in `@inithium/api-client` that return the
      settings merged over the defaults. The CMS definitions import the same defaults.
- [x] Replace the constants in `ContactPage.tsx`, `studioLocation.ts` and `eventFormat.ts` with
      the hook. Keep `googleMapsLink` as a pure helper.
- [x] Contact page: render a day's `linkUrl` as a link on its hours text.
- [x] Make sure the footer (if it shows phone/address) reads from the same source. It shows
      neither, so there was nothing to change.
- [x] Update Postman if any new settings route or shape is introduced. No new routes, but the
      collection had no Settings folder, so this adds one with the `studio.*` update bodies.

Added beyond the steps above, because the feature doesn't work without them:

- `ContactPage.tsx` read `?subject=` only on mount, and a link from `/contact` to `/contact` doesn't
  remount the page, so the Sunday link wouldn't have prefilled anything. It now applies new params
  and focuses Message, which brings the form into view on a phone.
- `SettingRow.tsx` ignored failed saves, so a value rejected by the new validation would have failed
  silently. Failed saves on every setting now show an alert, using the first validation message
  from the API.

## Acceptance criteria

- [x] The owner can change phone, email, address, social links and each day's hours in CMS →
      Settings → Studio Info, and the Contact page reflects it after refresh.
- [x] Sunday shows "By Appointment Only" and links to a prefilled contact form.
- [x] Events marked "At the studio" show the address from settings.
- [x] No hardcoded studio contact constants remain in `apps/web`.
- [x] Type-check passes for `cms`, `api-core`, `api-client`, `apps/web`. `apps/web` has no
      `type-check` target, so it was checked with `tsc --noEmit -p apps/web/tsconfig.app.json`.

The developer tested this in the app and merged it to `main` in PR #31. The validation rules were
also exercised directly against the schema (26 cases, all passing).

## Note for the client response

Include this in the client response. Send it only once this branch is deployed, because these
settings don't exist before then.

> You can now edit your studio's contact details and hours yourself. In the CMS, go to **Settings**
> and scroll to **Studio Info**. Each item has its own **Save** button, so save each one you change.
>
> - **Name, address, phone and email:** The address also updates the map on the Contact page and any
>   events marked "At the studio".
> - **Facebook and Instagram:** Paste the full link. Leave one blank to hide its icon.
> - **Hours:** Each day takes any text, such as "3:00 PM – 8:30 PM", "Closed" or "By Appointment
>   Only". You can also add a link to make that day's text clickable.
>
> Sunday now says "By Appointment Only". It links to your contact form with the subject filled in as
> "Private lesson", so families can send you a request. Visitors need to be logged in to send the
> form, like any other message through it.
