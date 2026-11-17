---
status: accepted
date: 2026-11-14
---

# ADR-0062: Files: R2, images and PDFs

## Context

The product needs to store files (logos, avatars, documents, generated PDFs). It is built with the first PRD that needs it (probably the company logo in "Access and first company" or "Company public site").

## Decision

**Decision** (2026-11-14): files (logos, avatars, documents, generated PDFs) are stored in **R2**, private, behind the `_shared/storage/` adapter ([ADR-0053](0053-code-conventions.md)). It is built with the first PRD that needs it (probably the company logo in "Access and first company" or "Company public site").

- **Where**:
  - One bucket per environment: `files-stg` and `files-prod` ([ADR-0013](0013-ci-cd-with-github-actions.md)). R2 does not charge for egress; the free plan includes about 10 GB per month (confirm on the official page).
  - Keys by owner: `t/<tenant_id>/<type>/<file_id>.<ext>` for what belongs to a company; `u/<user_id>/avatar/<file_id>.webp` for what belongs to a person.
  - Metadata in the owner's database ([ADR-0053](0053-code-conventions.md)): `files` table in the shard (name, type, size, `uploaded_by`, `status`); the logo and the avatar, as a reference in `companies` and `users` of `DB_GLOBAL`, because the company selector uses them.
  - Locally and in tests, `wrangler dev` and Vitest simulate R2: no own fake of the adapter is needed.
- **Uploading**:
  - Small images and documents (up to about 10 MB), **through the Worker**: session, permission (`can`, [ADR-0054](0054-roles-and-permissions.md)), size and real type (by its first bytes, not by the extension), and storage in R2.
  - Images are prepared in the browser before uploading: resized (avatar 256 px, logo 512 px), converted to WebP with `canvas` and **without EXIF metadata**, which can carry the GPS location ([ADR-0056](0056-async-work.md): heavy computation, in the browser).
  - Large files, in the future: signed URL to upload directly to R2 (S3 API, with an R2 token as a secret), only when needed.
- **Serving**:

| Type | How |
|---|---|
| Private (company documents) | Route `/api/t/:slug/files/:id`: checks the permission and returns from R2 with `private` cache |
| Public (logo on the landing, avatars) | Public route with `immutable` cache; when the file changes its `file_id` changes, and so does the URL |
| Temporary (link in an email, export) | URL signed by the Worker itself with an expiry (e.g. 24 h); the signature is checked before serving |

- **Sizes and formats**: no thumbnails in advance; the normalized version that the browser uploads is enough for avatars and logos. If several sizes are needed (landing images), Cloudflare Images transformations on R2: the free plan includes 5,000 unique transformations per month. With a fixed set of sizes (64, 256, 512, 1200) and `format=auto` (AVIF or WebP). When they are exceeded, the cached ones keep working and new ones fail without charge: the code serves the original and carries its `paid-plan` mark ([ADR-0056](0056-async-work.md)).
- **Generated PDFs**: in the browser when the user requests them (`pdf-lib` or printing with a print stylesheet). If they have to be generated on the server (attachment to an email), Workers Paid or Browser Rendering, with an ADR and a `paid-plan` mark. Temporary ones (exports, [ADR-0027](0027-legal-and-data-protection.md)) go to `t/<tenant_id>/exports/` with an R2 expiry rule that deletes them after 7 days.
- **Security**:
  - Only allowed types per category: PNG, JPEG, WebP and PDF. **Never SVG or HTML uploaded by users** (they can run code on our domain).
  - When serving: `Content-Type` set by us, `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment` for anything that is not an image.
  - Space per company summed from `files`, for the plan limits (`billing`).
  - Deletion: when a company is deleted, the Workflow of [ADR-0053](0053-code-conventions.md) empties the `t/<tenant_id>/` prefix; when an account is deleted, `u/<user_id>/` ([ADR-0027](0027-legal-and-data-protection.md)).
- **Libraries**: almost none. The R2 binding; the browser's `canvas` and `createImageBitmap`; `aws4fetch` only with direct uploads to R2; `pdf-lib` only when there are generated PDFs.

## Consequences

- Pending check: confirm the R2 free-plan allowance (about 10 GB per month) on the official page.
- Cloudflare Images: beyond 5,000 unique transformations per month, new ones fail and the original is served, with a `paid-plan` mark.
- Server-side PDF generation requires Workers Paid or Browser Rendering, with an ADR and a `paid-plan` mark.
- Direct uploads to R2 (signed URL) are deferred until needed.
