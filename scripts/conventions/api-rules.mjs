// Rules of the API that are not imports, so dependency-cruiser cannot see them (ADR-0053, ADR-0075, ADR-0077).

const API = /^apps\/api\/src\//
const isTest = (path) => /\.(test|int\.test)\.ts$|\/_shared\/testing\/|\/e2e\//.test(path)

// Each provider called over HTTP names its host only in its adapter.
const PROVIDER_HOSTS = { 'api.workos.com': 'apps/api/src/_shared/identity/workos-' }

// Only the deploy metadata is read from the raw bindings, so /health answers even when the
// configuration fails to parse; every other variable comes from the parsed env.
const RAW_ENV_READERS = [
  'apps/api/src/_shared/env.ts',
  'apps/api/src/index.ts',
  'apps/api/src/_shared/http/app-version-header.ts',
]

// A router only lists: methods live in the use cases' .route.ts.
export function routerErrors({ path, text }) {
  if (!/\.router\.ts$/.test(path)) return []
  const method = text.match(/\.(get|post|put|patch|delete|all|on)\(/)

  return method
    ? [`${path}: a router only chains .route(); .${method[1]}() belongs in a use case's .route.ts`]
    : []
}

// Reading a variable from c.env; passing c.env whole to the logic, for its databases, is fine.
export function rawEnvErrors({ path, text }) {
  if (!API.test(path) || isTest(path) || RAW_ENV_READERS.includes(path)) return []
  const read = text.match(/\bc\.env\.([A-Z][A-Z0-9_]*)/)

  return read ? [`${path}: c.env.${read[1]} read outside env.ts; take it from c.var.env`] : []
}

// The database bindings and batch() only in repos and _shared/db/.
export function databaseBindingErrors({ path, text }) {
  if (!API.test(path) || isTest(path) || /\.repo\.ts$|\/_shared\/db\//.test(path)) return []
  const use = text.match(/\benv\.(DB_[A-Z0-9_]+)|\.batch\(/)

  return use
    ? [
        `${path}: ${use[1] ? `env.${use[1]}` : 'batch()'} outside a repo; move the database access to a .repo.ts`,
      ]
    : []
}

export function providerHostErrors({ path, text }) {
  if (!/^(apps|packages)\//.test(path) || isTest(path)) return []

  return Object.entries(PROVIDER_HOSTS)
    .filter(([host, home]) => text.includes(host) && !path.startsWith(home))
    .map(([host, home]) => `${path}: ${host} is named only in its adapter (${home}*)`)
}
