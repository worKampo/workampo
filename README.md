# worKampo

Multi-tenant SaaS base on Cloudflare Workers.

## Requirements

- Node.js 24 (`.nvmrc`)
- pnpm (version pinned in `package.json`)
- [gitleaks](https://github.com/gitleaks/gitleaks) on the `PATH`, used by the pre-commit hook

## Getting started

```bash
pnpm install
pnpm check
```

`pnpm check` runs typecheck, lint, architecture rules, unused-code detection and tests. It also runs before every commit.

Design documents live in [`docs/`](docs).

## Root of the repo

Only what a tool reads from the root stays here; code and data live in `apps/`, `packages/` and `scripts/`.

| File or folder                            | Read by             | Why at the root                                          |
| ----------------------------------------- | ------------------- | -------------------------------------------------------- |
| `package.json`                            | pnpm, Turborepo     | The workspace root and its scripts                       |
| `pnpm-workspace.yaml`                     | pnpm                | Declares the workspace packages                          |
| `pnpm-lock.yaml`                          | pnpm                | One lockfile for the whole workspace                     |
| `turbo.json`                              | Turborepo           | Task pipeline of every package                           |
| `tsconfig.base.json`                      | TypeScript          | Shared compiler options every package extends            |
| `.npmrc`                                  | pnpm                | Registry and install settings                            |
| `.nvmrc`                                  | nvm, CI             | The Node.js version                                      |
| `biome.json`                              | Biome               | Format and lint rules of the whole repo                  |
| `knip.json`                               | knip                | Unused files, exports and dependencies across workspaces |
| `.dependency-cruiser.cjs`                 | dependency-cruiser  | Architecture rules over `apps/` and `packages/`          |
| `.jscpd.json`                             | jscpd               | Duplicate-code detection settings                        |
| `commitlint.config.mjs`                   | commitlint          | Commit message rules                                     |
| `lefthook.yml`                            | lefthook            | Git hooks (pre-commit)                                   |
| `.editorconfig`                           | Editors             | Indentation and line endings                             |
| `.gitattributes`, `.gitignore`            | Git                 | Line endings and ignored files                           |
| `.github/`                                | GitHub, Renovate    | Workflows, templates, `renovate.json`                    |
| `.coderabbit.yaml`                        | CodeRabbit          | Review settings, read only from the root                 |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`     | Coding agents       | Each agent looks for its file at the root                |
| `.claude/`, `.cursor/`                    | Claude Code, Cursor | Agent settings, hooks and role adapters                  |
| `README.md`                               | People, GitHub      | The repo's front page                                    |
| `project.yaml`                            | `pnpm check`        | The project profile: accounts, environments, services    |
| `.work/`                                  | Agents, `pnpm work` | The branch's plan, tasks and progress; never on `master` |
| `apps/`, `packages/`, `scripts/`, `docs/` | Everyone            | Apps, shared packages, repo tooling and documentation    |

## License

© worKampo. All rights reserved. The source is visible but not licensed for any use.
