# Known failures of the deferred pieces

> Status: reference, from the section "Fallos conocidos de las piezas aplazadas" of the former decisions log. They will be recorded in their ADRs so they are not reopened.

- **Offline sync (§5)**: two devices editing the same row lose data silently. It needs a server-assigned version and conflict handling; queueing the push (§13) makes it impossible to return the conflict.
- **Postgres (§8)**: two Drizzle schemas with types that are not unified.
- **`is_test_mode` sandbox (§33)**: same leak risk as `tenant_id`.
- **Vector search (§7)**: compare Tinybird with Vectorize.
