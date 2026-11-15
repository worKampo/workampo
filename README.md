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

Design documents live in [`docs/`](docs/).

## License

© worKampo. All rights reserved. The source is visible but not licensed for any use.
