# QA-01: Fix CMS uploads on R2 + clearer upload errors

- **Status:** `in-progress`
- **Priority:** P0
- **Depends on:** -
- **Branch:** `fix/qa-01-r2-uploads`

## Client request

> Error message when uploading photos on all fronts and different files too (jpeg, png, pdf,
> etc.) - Just activated R2 tho so could be the issue here.

## Current state

- Every CMS upload goes through `POST /api/storage/upload`
  (`libs/api-core/src/routes/storage.route.ts`) → `uploadObject` in `@inithium/storage`
  (`libs/storage/src/providers/s3/s3.provider.ts`, AWS SDK v3 `PutObjectCommand`).
- Allowed types are JPEG/PNG/WebP/GIF only, max 5 MB. **PDFs are rejected on purpose**, and SVG
  is blocked as an XSS vector.
- Required env: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`,
  `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_BASE_URL`; optional `STORAGE_REGION` (default
  `auto`) and `STORAGE_FORCE_PATH_STYLE`.
- Since every image type fails, the failure is almost certainly the R2 configuration or provider
  call, not file validation. Likely causes, most to least likely:
  1. Env vars missing or wrong on the deployed API (the endpoint must be
     `https://<accountid>.r2.cloudflarestorage.com` with **no** bucket in the path).
  2. The R2 API token lacks *Object Read & Write* on this bucket.
  3. `STORAGE_PUBLIC_BASE_URL` isn't the bucket's public `r2.dev` URL or custom domain, so the
     upload succeeds but the image 404s afterward.
  4. An SDK checksum incompatibility. Newer `@aws-sdk/client-s3` versions send CRC32 checksums by
     default, which R2 can reject. The fix is `requestChecksumCalculation: 'WHEN_REQUIRED'` /
     `responseChecksumValidation: 'WHEN_REQUIRED'` on the client.
- The CMS shows a generic error, so neither the client nor we can tell which one it is.

## Decisions

- Images only for this ticket. PDF/document support is **out of scope** until the client says
  where documents would be used (see Open questions). If it's needed, it becomes a new ticket.

## Implementation steps

- [ ] Get the exact error: read the API logs for a failed `POST /api/storage/upload` on the
      deployed environment (or have the developer reproduce locally with the production R2
      credentials) and record the root cause in this ticket under "Findings".
- [ ] Fix the root cause (env, token scope, public URL, or SDK checksum config in
      `s3.provider.ts`).
- [x] Wrap provider failures in `uploadObject` so the API logs the underlying S3/R2 error code
      server-side but returns a clean `AppError` (e.g. "Image storage is unavailable, please try
      again or contact support") instead of a raw 500.
- [x] Add a startup/health log line that confirms the storage env parsed (bucket + endpoint host,
      never secrets), so a misconfigured deploy is obvious from the first boot log.
- [x] Client-side, in `libs/cms/src/media/CloudImageUploadButton.tsx`: `accept` already limits
      the picker, but the "All files" option bypasses it. Check `file.type` and size before
      sending and show "Only JPEG, PNG, WebP or GIF images (max 5 MB) can be uploaded here".
      Replace the catch-all `'Upload failed. Please try again.'` with the server's error message
      (via the shared `readApiError` helper pattern).
- [ ] Verify every upload purpose works end-to-end: gallery, staff, program, product, workshop,
      setting (logo / hero image).
- [ ] Verify replacing/deleting an image still releases the old R2 object.
- [x] Document the R2 env setup (endpoint format, token scope, public URL) in the README's
      environment section.

## Findings

**Confirmed from the code (2026-11-04):**

- The installed `@aws-sdk/client-s3` is **3.1143.0**. Since 3.729, the SDK sends CRC32 checksums
  on every `PutObject` by default, so cause #4 applies to this codebase. Fixed in `s3.provider.ts`:
  `requestChecksumCalculation` / `responseChecksumValidation` are now `'WHEN_REQUIRED'`.
- Env values are now trimmed (a trailing space or newline pasted into the host dashboard caused
  `SignatureDoesNotMatch`). `STORAGE_ENDPOINT` and `STORAGE_PUBLIC_BASE_URL` must now be full URLs.

**Still to confirm on the deployed API (developer):** deploy this branch, then check:

1. The boot log. It should show `🪣 Storage: bucket "…" via <account>.r2.cloudflarestorage.com, public URL …`
   with no `⚠️ Storage` lines. A `⚠️` line names the env problem (cause #1 or #3).
2. Try an upload. If it still fails, the API log has `[storage] Storage upload failed: <Code> (HTTP n)`.
   `AccessDenied` means token scope (cause #2). `NoSuchBucket` means the bucket name or endpoint
   path is wrong. Record the code here.
3. If the upload succeeds but the image is broken, `STORAGE_PUBLIC_BASE_URL` is wrong (cause #3).

**Also changed:** R2 failures now return `503 SERVICE_UNAVAILABLE` ("Image storage is
unavailable…") with `details.reason` = the S3 error code, on both upload and asset delete. Every
CMS image field now checks the file type before sending and shows the server's own error message.
The cropped fields (staff, program/workshop/event, product) check the type only, because the crop
re-encodes large photos below 5 MB.

## Acceptance criteria

- [ ] JPEG, PNG, WebP and GIF uploads succeed in every CMS screen that accepts images and render
      from the R2 public URL.
- [ ] Uploading a PDF (or other unsupported type) shows a clear, specific message and never hits
      the server.
- [ ] An R2/provider failure shows a friendly message in the CMS and a detailed log line in the
      API.
- [x] `npx nx run api-core:type-check`, `npx nx run storage:type-check` and `npx nx run cms:type-check` pass.

## Open questions (for the client)

- Which screen were you on when the PDF failed? Is there a place you need to post documents
  (registration forms, recital packets, policies)?
