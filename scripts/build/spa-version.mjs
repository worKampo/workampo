// The one producer of the web client's version and build date (ADR-0059), used by the web build,
// the deploy and the web E2E server. Values from the environment win; otherwise git computes them.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
// The folders of pnpm-workspace.yaml.
const WORKSPACE_DIRS = ['apps', 'packages']
const WEB_DIR = 'apps/web'
const VERSION = /^[0-9a-f]{12}$/
const BUILD_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

export const isBuildDate = (value) =>
  BUILD_DATE.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value.replace('Z', '.000Z')

export function buildVersion({
  env,
  root = ROOT,
  run = (command, args) => execFileSync(command, args, { cwd: root, encoding: 'utf8' }),
}) {
  const fromEnv = env.VITE_APP_VERSION !== undefined || env.VITE_APP_BUILD_DATE !== undefined
  const { version, buildDate } = fromEnv
    ? { version: env.VITE_APP_VERSION, buildDate: env.VITE_APP_BUILD_DATE }
    : fromGit(spaInputs(root), run)
  if (typeof version !== 'string' || !VERSION.test(version))
    throw new Error(`Invalid SPA version ${JSON.stringify(version)}: expected 12 hex characters`)
  if (typeof buildDate !== 'string' || !isBuildDate(buildDate))
    throw new Error(
      `Invalid SPA build date ${JSON.stringify(buildDate)}: expected YYYY-MM-DDTHH:MM:SSZ`,
    )
  return { version, buildDate }
}

function fromGit(inputs, run) {
  const trees = run('git', ['ls-tree', 'HEAD', '--', ...inputs])
  if (!trees.trim()) throw new Error('git ls-tree found none of the SPA inputs')
  const committed = run('git', ['log', '-1', '--format=%cI', 'HEAD', '--', ...inputs]).trim()
  if (!committed) throw new Error('git log found no commit touching the SPA inputs')
  return {
    version: createHash('sha256').update(trees).digest('hex').slice(0, 12),
    buildDate: Number.isNaN(Date.parse(committed))
      ? committed
      : new Date(committed).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }
}

// The web and the workspace packages it reaches through `dependencies`, transitively. Never dev or
// peer dependencies: the API (app-core's peer) changing must not reload the clients.
function spaInputs(root) {
  const packages = new Map()
  for (const parent of WORKSPACE_DIRS) {
    if (!existsSync(join(root, parent))) continue
    for (const entry of readdirSync(join(root, parent), { withFileTypes: true })) {
      const file = join(root, parent, entry.name, 'package.json')
      if (!entry.isDirectory() || !existsSync(file)) continue
      const manifest = JSON.parse(readFileSync(file, 'utf8'))
      packages.set(manifest.name, { dir: `${parent}/${entry.name}`, manifest })
    }
  }
  const web = [...packages.values()].find((pkg) => pkg.dir === WEB_DIR)
  if (!web) throw new Error(`${WEB_DIR}/package.json not found under ${root}`)
  const inputs = new Set()
  const visit = ({ dir, manifest }) => {
    if (inputs.has(dir)) return
    inputs.add(dir)
    for (const name of Object.keys(manifest.dependencies ?? {}))
      if (packages.has(name)) visit(packages.get(name))
  }
  visit(web)
  return [...inputs].sort()
}
