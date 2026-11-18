# AGENTS.md

Context for any coding agent working in this repo. People start with [`README.md`](README.md).

## 1. Start here

1. If `.work/PROGRESS.md` exists on the branch, or the branch's open PR has a "Progress" comment, read it first and continue from its "Next" line. Reading order and format: [docs/procedures/progress.md](docs/procedures/progress.md).
2. Then the issue of the ticket (`Ticket #N`), then `.work/tasks.md` and `.work/plan.md` if they exist.
3. Read [docs/learnings.md](docs/learnings.md): the "General" section and the section of every domain the ticket touches.

## 2. This repo's rules win

Rules from the machine's other projects do not apply here. Work items are GitHub issues of `worKampo/workampo` only; no other tracker, no other references in commits. One GitHub identity: the agents' GitHub App (section 6).

## 3. Project

worKampo: a multi-tenant SaaS base on Cloudflare (Workers, D1, KV). Profile with accounts, environments, services and where secrets live: [project.yaml](project.yaml). Vision and roadmap: [docs/product/vision.md](docs/product/vision.md).

| Path               | What                                                    |
| ------------------ | ------------------------------------------------------- |
| `apps/api/`        | Hono API on a Worker, `/health`                         |
| `packages/db/`     | Schema, migrations, seeds and backfills (empty for now) |
| `packages/domain/` | Pure core: no I/O, no frameworks (empty for now)        |
| `scripts/github/`  | Repo setup and the App token                            |
| `scripts/project/` | `project.yaml` validation                               |
| `docs/`            | ADRs, process, domains, agents, design                  |

## 4. Commands

| Command                           | What                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                    | Install; also installs the git hooks                                                                                                                                                                                                  |
| `pnpm check`                      | Typecheck, lint, tests, architecture rules, unused code, `project.yaml` and the paths named by this file. The only definition of done of a task or a wave; a ticket's is the [Definition of Done](docs/process/definition-of-done.md) |
| `pnpm --filter @workampo/api dev` | API locally with `wrangler dev`                                                                                                                                                                                                       |
| `pnpm work`                       | Ticket cycle: `status`, `inbox`, `resume`, `start`, `pr`, `close`; numbers as `15` or `#15` ([work](docs/procedures/work.md))                                                                                                         |
| `pnpm work verify <n>`            | The person's local check: worktree of the branch, fresh seeded database, app on port 8787 ([work](docs/procedures/work.md#verify))                                                                                                    |
| `pnpm plan:check`, `plan:sync`    | Validate `.work/tasks.md`; write it as the issue checklist ([planning](docs/procedures/planning.md))                                                                                                                                  |
| `pnpm specs:ids`, `test:new`      | Assign `@id`s to examples; scaffold an integration test ([living specs](docs/procedures/living-specs.md), [testing](docs/procedures/testing.md))                                                                                      |
| `pnpm debt`                       | List `paid-plan(...)` marks                                                                                                                                                                                                           |
| `pnpm check:pr`                   | Traceability checks of a PR; CI runs it on every PR ([traceability](docs/procedures/traceability.md#ci-checks))                                                                                                                       |
| `pnpm e2e`                        | Playwright suites of the apps against a local `wrangler dev` ([testing](docs/procedures/testing.md#acceptance-scenarios))                                                                                                             |
| `pnpm db:seed`, `db:backfill`     | Local seed; batched backfills ([seeds](docs/procedures/seeds.md), [backfills](docs/procedures/backfills.md))                                                                                                                          |

Pre-commit runs gitleaks and `pnpm check`. Never skip it, except the documented `it.fails` first wave ([docs/process/cycle.md](docs/process/cycle.md)).

## 5. How work flows

- Ticket lifecycle, the person's three moments and the mandatory stops: [docs/process/cycle.md](docs/process/cycle.md). Branches and merges: [docs/process/branching.md](docs/process/branching.md).
- The orchestrator (the main session) follows [docs/agents/orchestrator.md](docs/agents/orchestrator.md); roles and levels: [docs/agents/](docs/agents/README.md) and [docs/agents/routing.md](docs/agents/routing.md).
- Behaviour lives in the living specs of [docs/domains/](docs/domains/README.md); terms in [`docs/glossary.md`](docs/glossary.md).
- Code: [docs/process/code-conventions.md](docs/process/code-conventions.md). Reviews: [`docs/process/review.md`](docs/process/review.md).
- Every decision and its why: [docs/adr/README.md](docs/adr/README.md). `D53` in older text means ADR-0053. Read the relevant ADR before changing anything; a new decision is a new ADR, only with the person's approval.
- Traceability formats (branch names, trailers, PR body): [docs/procedures/traceability.md](docs/procedures/traceability.md). Tools: [work](docs/procedures/work.md), [planning](docs/procedures/planning.md), [living specs](docs/procedures/living-specs.md), [testing](docs/procedures/testing.md); critical zones that force `size:L`: [critical-paths](docs/procedures/critical-paths.md).

## 6. GitHub identity

- Agents act on GitHub only as the App `workampo-agents`: `GH_TOKEN=$(node scripts/github/app-token.mjs) gh …`. Push with the token in an HTTP header, never in the URL: `T=$(node scripts/github/app-token.mjs); git -c http.https://github.com/.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$T" | base64 -w0)" push https://github.com/worKampo/workampo.git <branch>`. `-c` is visible in the process list too, so scripts pass it through `GIT_CONFIG_*` instead (`pnpm work` does).
- Never the person's `gh` login or SSH key. Never read `~/.workampo/` (the App key; denied in `.claude/settings.json`).
- Agents cannot merge, approve, push to `master` or approve deployments: the rulesets require the person ([ADR-0041](docs/adr/0041-agent-boundaries.md)).
- Commit author is the project's noreply address, set by git per folder; never change git identity.

## 7. Language

Code, identifiers, comments, commits, PR titles, tests, this file, agents, procedures and ADRs in English. Conversation with the person, process docs and living specs may be in Spanish ([ADR-0036](docs/adr/0036-language-and-glossary.md)).

## 8. No entra (public repo)

The repo is public ([ADR-0043](docs/adr/0043-public-repo.md)). None of this enters code, `docs/`, issues, PRs or commit messages:

| Does not enter                                                                                                                                  | Where it goes                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Secrets, tokens, keys, `.dev.vars`                                                                                                              | Cloudflare secrets and GitHub Environment secrets                                    |
| Personal data of customers or users, real emails, names of people                                                                               | Sentry and the database; people by role                                              |
| Business strategy: unpublished prices, margins, real or potential customers, business metrics, commercial agreements, unannounced product plans | Private repo `worKampo/business` (agents have no access)                             |
| Vertical product code with its own competitive value                                                                                            | Activates the trigger in [`docs/process/review.md`](docs/process/review.md#no-entra) |
| Unpatched vulnerabilities, exploitable incident details                                                                                         | Private vulnerability reporting and private advisories                               |
| Exact anti-abuse thresholds                                                                                                                     | Environment variables                                                                |
| Source maps of the web                                                                                                                          | Sentry only                                                                          |

Emails allowed: the project's noreply and the seed test domains (`*.test`, `example.com`). Before writing anything to the repo, an issue or a PR, check it against this list. If the person asks to include something on it, that is a mandatory stop: say why and where it goes instead.
