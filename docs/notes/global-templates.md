# Global templates copied to each company

> Status: proposal, not decided, from proposal P-1 of the former decisions log (2026-11-13). The next step is decided with an ADR by the first PRD that needs it (probably the public page).

- **Idea**: starting content in `DB_GLOBAL` that each company receives and customizes in its shard. Candidates: sections and themes of the public page ([ADR-0004](../adr/0004-landings-rendered-in-the-worker.md)), texts of emails and notifications, default values of settings, catalogs of a vertical, onboarding lists. It does not apply to roles ([ADR-0054](../adr/0054-roles-and-permissions.md)).
- **Three types that are not mixed**:

| Type | Owner | Where it lives | Example |
|---|---|---|---|
| Reference data ([ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md)) | The system; the company only reads it | `DB_GLOBAL` | Plans, flag definitions |
| Template that is copied | The company, from the copy | Source in global, copy in the shard | Landing section, email text |
| Template with per-company settings | The system, with the company's changes | Global + settings table in the shard | Large catalog that almost nobody modifies |

- **Rule of thumb**: small and customizable → copied; large and almost unchanged → referenced with settings; system-owned → reference data.
- **Fit with what is decided**:
  - The source is stored as text (`template_id`, `template_version`), with no foreign key across databases ([ADR-0010](../adr/0010-shard-1-from-v1.md)). The version allows offering "there is a new version" with its diff, without forcing it.
  - The copy crosses two databases and is not atomic: idempotent, unique per company and template (`uq_<table>__tenant_id_template_id`).
  - It is copied on first use, not when the company is created.
  - Copying large catalogs multiplies rows per shard (D1 size limit).
  - Updating copies by force is a backfill ([ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md)), with the person's approval.
- **Template company** (how they are edited): a system company edited with the normal app, like the corporate website of [ADR-0049](../adr/0049-platform-content.md). "Publish template" (🧑, from the backoffice) generates a versioned snapshot in `DB_GLOBAL`. New companies copy from the snapshot, never from the live company: this way half-edited states are not copied and shards are not crossed. Only the allowed tables are copied (never members, billing, audit or invitations) and IDs are generated again, also inside JSON. It is not a seed: seeds never reach production ([ADR-0044](../adr/0044-migrations-reference-data-seeds-and-backfills.md)).
- **Demo for prospective customers**:
  - **Now**: demo guided by the person in a normal production company marked `is_demo` ([ADR-0029](../adr/0029-testing-strategy.md)).
  - **With the vertical product**: "Start with sample data" when creating the company, with "Delete sample data" afterwards, from the published template.
  - **Only if marketing asks for it**: own demo per visitor, in a temporary company copied from the template, which expires and is deleted, with abuse protection (Turnstile).
  - **Ruled out**: a shared demo company (read-only it shows little; with write access, each visitor changes what the next one sees and it is exposed to spam).
