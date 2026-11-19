// Traceability checks of a pull request (ADR-0042, ADR-0030, ADR-0052): `pnpm check:pr`.
// Env: BASE_SHA, HEAD_SHA, HEAD_REF, PR_BODY, PR_LABELS, PR_AUTHOR (Renovate exemption), GH_TOKEN, GH_REPO, optional VERIFICATION_FILE.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import * as acceptanceOrder from './acceptance-order.mjs'
import * as author from './author.mjs'
import * as branch from './branch.mjs'
import * as commits from './commits.mjs'
import { createContext } from './context.mjs'
import * as duplication from './duplication.mjs'
import * as emails from './emails.mjs'
import * as examples from './examples.mjs'
import * as paidPlan from './paid-plan.mjs'
import * as prBody from './pr-body.mjs'
import * as size from './size.mjs'
import * as temporaries from './temporaries.mjs'

export const CHECKS = [
  branch,
  commits,
  prBody,
  size,
  temporaries,
  examples,
  acceptanceOrder,
  author,
  emails,
  paidPlan,
  duplication,
]
const REQUIRED_ENV = ['BASE_SHA', 'HEAD_SHA', 'HEAD_REF', 'GH_REPO']

export function runChecks(checks, ctx, log = console.log) {
  let failed = 0
  for (const { name, check } of checks) {
    let result
    try {
      result = check(ctx)
    } catch (error) {
      result = { errors: [error.message] }
    }
    const { errors = [], warnings = [] } = result
    if (errors.length) failed++
    log(`${errors.length ? 'FAIL' : 'PASS'} ${name}`)
    for (const error of errors) log(`  - ${error}`)
    for (const warning of warnings) log(`::warning::${name}: ${warning}`)
  }
  return failed
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key])
  if (missing.length) {
    console.error(`Missing environment: ${missing.join(', ')}`)
    process.exit(1)
  }
  const project = parse(readFileSync(new URL('../../project.yaml', import.meta.url), 'utf8'))
  const ctx = createContext({ env: process.env, commitEmail: project.github.commitEmail })
  const failed = runChecks(CHECKS, ctx)
  if (failed) {
    console.error(`${failed} check(s) failed`)
    process.exit(1)
  }
}
