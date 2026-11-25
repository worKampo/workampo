import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  databaseBindingErrors,
  providerHostErrors,
  rawEnvErrors,
  routerErrors,
} from './api-rules.mjs'
import { conventionErrors } from './conventions.mjs'
import { exportPatternErrors, reexportErrors } from './package-rules.mjs'
import * as rules from './structure-rules.mjs'
import { arbitraryValueErrors, handwrittenTextErrors, pageClassErrors } from './web-rules.mjs'

const DOMAINS = ['access']

test('src/ holds only _shared/, domains and the files that gather them', () => {
  const ok = [
    'apps/api/src/access/access.router.ts',
    'apps/api/src/_shared/env.ts',
    'apps/api/src/index.ts',
    'apps/api/src/index.int.test.ts',
    'apps/web/src/route-tree.ts',
    'packages/i18n/src/load-namespace.ts',
    'packages/ui/src/styles/tokens.css',
  ]
  const bad = ['apps/api/src/helpers/x.ts', 'apps/web/src/utils.ts']

  assert.deepEqual(rules.srcLayoutErrors({ files: ok, domains: DOMAINS }), [])
  assert.equal(rules.srcLayoutErrors({ files: bad, domains: DOMAINS }).length, 2)
})

test('a folder with more than 8 code files fails; tests do not count', () => {
  const folder = (dir, n, suffix = '.ts') =>
    Array.from({ length: n }, (_, i) => `${dir}/f${i}${suffix}`)

  assert.deepEqual(rules.folderSizeErrors([...folder('a', 8), ...folder('a', 5, '.test.ts')]), [])
  assert.match(rules.folderSizeErrors(folder('b', 9))[0], /^b\/: 9 code files/)
  assert.deepEqual(rules.folderSizeErrors(folder('scripts/checks', 14, '.mjs')), [])
})

test('an app-core hook folder needs its API twin; hooks at the domain root are exempt', {
  todo: true,
}, () => {
  const app = 'packages/app-core/src'
  const api = 'apps/api/src'

  assert.equal(
    rules.hookMirrorErrors([`${app}/companies/creation/new-company/new-company.hook.ts`]).length,
    1,
  )
  assert.deepEqual(
    rules.hookMirrorErrors([
      `${app}/companies/creation/create-company/create-company.hook.ts`,
      `${api}/companies/creation/create-company/create-company.route.ts`,
    ]),
    [],
  )
  assert.deepEqual(rules.hookMirrorErrors([`${app}/access/me.hook.ts`]), [])
  assert.deepEqual(
    rules.hookMirrorErrors([`${app}/companies/creation/new-company/new-company.hook.test.ts`]),
    [],
  )
})

test('repos live only in _repo/ and API clients only in _api/; _shared/ is out', {
  todo: true,
}, () => {
  assert.equal(rules.layerFolderErrors(['apps/api/src/access/data/member.d1.repo.ts']).length, 1)
  assert.deepEqual(rules.layerFolderErrors(['apps/api/src/access/_repo/member.d1.repo.ts']), [])
  assert.equal(rules.layerFolderErrors(['packages/app-core/src/access/data/me.api.ts']).length, 1)
  assert.equal(
    rules.layerFolderErrors(['packages/app-core/src/access/data/me.api.test.ts']).length,
    1,
  )
  assert.deepEqual(
    rules.layerFolderErrors([
      'packages/app-core/src/access/_api/me.api.ts',
      'packages/app-core/src/access/_api/me.api.test.ts',
    ]),
    [],
  )
  assert.deepEqual(
    rules.layerFolderErrors(['apps/api/src/_shared/rate-limit/rate-limit.d1.repo.ts']),
    [],
  )
})

test('a router only chains .route()', () => {
  const path = 'apps/api/src/access/access.router.ts'

  assert.deepEqual(routerErrors({ path, text: "new Hono().route('/', x)" }), [])
  assert.equal(routerErrors({ path, text: "new Hono().get('/me', h)" }).length, 1)
  assert.equal(routerErrors({ path, text: "new Hono().options('/me', h)" }).length, 1)
})

test('c.env variables are read only in env.ts and the deploy metadata; passing c.env is fine', () => {
  const path = 'apps/api/src/access/session/me/me.route.ts'

  assert.deepEqual(rawEnvErrors({ path, text: 'readMe(c.env, id)' }), [])
  assert.equal(rawEnvErrors({ path, text: 'if (c.env.RATE_LIMIT_WINDOW_SECONDS)' }).length, 1)
  assert.equal(rawEnvErrors({ path, text: 'const { APP_VERSION } = c.env' }).length, 1)
  assert.deepEqual(rawEnvErrors({ path: 'apps/api/src/index.ts', text: 'c.env.ENVIRONMENT' }), [])
})

test('database bindings and batch() only in repos and _shared/db/', () => {
  const logic = 'apps/api/src/access/sign-in/complete-sign-in.logic.ts'

  assert.equal(databaseBindingErrors({ path: logic, text: 'env.DB_GLOBAL.prepare(sql)' }).length, 1)
  assert.equal(databaseBindingErrors({ path: logic, text: 'db.batch([a])' }).length, 1)
  assert.deepEqual(
    databaseBindingErrors({
      path: 'apps/api/src/access/_repo/sign-in.d1.repo.ts',
      text: 'db.batch([a])',
    }),
    [],
  )
})

test("a provider's host is named only in its adapter", () => {
  const text = "fetch('https://api.workos.com/user_management')"

  assert.deepEqual(
    providerHostErrors({ path: 'apps/api/src/_shared/identity/workos-provider.ts', text }),
    [],
  )
  assert.equal(providerHostErrors({ path: 'apps/api/src/access/x.logic.ts', text }).length, 1)
})

test('pages carry no handwritten texts, arbitrary values or classes of their own', () => {
  const path = 'apps/web/src/access/sign-in/login/login.page.tsx'

  assert.deepEqual(handwrittenTextErrors({ path, text: "<Text>{t('login.title')}</Text>" }), [])
  assert.deepEqual(handwrittenTextErrors({ path, text: 'const f = (r: Response) => <A />' }), [])
  assert.equal(handwrittenTextErrors({ path, text: '<Text>Sign in</Text>' }).length, 1)
  assert.equal(handwrittenTextErrors({ path, text: '<Text>Sign in (code)</Text>' }).length, 1)
  assert.equal(arbitraryValueErrors({ path, text: '<a class="text-[13px]">' }).length, 1)
  assert.deepEqual(arbitraryValueErrors({ path, text: 'const xs = list[0]' }), [])
  assert.equal(pageClassErrors({ path, text: '<form className="flex">' }).length, 1)
  assert.deepEqual(
    pageClassErrors({ path, text: "<a className={buttonClassName({ variant: 'secondary' })}>" }),
    [],
  )
})

test('exports name each entry, and only family entries and the contract re-export', () => {
  const pkg = (exports) => ({ path: 'packages/x/package.json', text: JSON.stringify({ exports }) })

  assert.deepEqual(exportPatternErrors(pkg({ './a': './src/a.ts' })), [])
  assert.equal(exportPatternErrors(pkg({ './*': './src/*.ts' })).length, 1)
  assert.deepEqual(
    reexportErrors({
      path: 'packages/ui/src/forms/forms.ts',
      text: "export { Form } from './form'",
    }),
    [],
  )
  assert.equal(
    reexportErrors({ path: 'packages/app-core/src/access/x.ts', text: "export { y } from './y'" })
      .length,
    1,
  )
  assert.equal(
    reexportErrors({ path: 'packages/app-core/src/access/x.ts', text: "export * as y from './y'" })
      .length,
    1,
  )
})

test('the whole run gathers every rule', () => {
  const texts = { 'apps/api/src/access/access.router.ts': "x.get('/a', h)" }
  const errors = conventionErrors({
    files: Object.keys(texts),
    read: (path) => texts[path],
    domains: DOMAINS,
  })

  assert.equal(errors.length, 1)
})
