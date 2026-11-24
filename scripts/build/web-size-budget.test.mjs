import assert from 'node:assert/strict'
import { test } from 'node:test'
import { budgetErrors, initialChunks } from './web-size-budget.mjs'

const MANIFEST = {
  'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_shared.js'] },
  '_shared.js': { file: 'assets/shared.js' },
  '_forms.js': { file: 'assets/forms.js', imports: ['_shared.js'] },
  'src/access/sign-in/login/login.page.tsx': {
    file: 'assets/login.js',
    isDynamicEntry: true,
    imports: ['_forms.js'],
  },
  'src/access/home/home.page.tsx': { file: 'assets/home.js', isDynamicEntry: true },
  '../i18n/locales/ca/access.json': { file: 'assets/access-ca.js', isDynamicEntry: true },
  '../i18n/locales/es/access.json': { file: 'assets/access-es.js', isDynamicEntry: true },
  '../i18n/locales/en/access.json': { file: 'assets/access-en.js', isDynamicEntry: true },
  '../i18n/locales/ca/billing.json': { file: 'assets/billing-ca.js', isDynamicEntry: true },
}
const SIZES = {
  'assets/index.js': 100,
  'assets/shared.js': 10,
  'assets/forms.js': 30,
  'assets/login.js': 5,
  'assets/home.js': 3,
  'assets/access-ca.js': 1,
  'assets/access-es.js': 1,
  'assets/access-en.js': 1,
  'assets/billing-ca.js': 1,
}
const gzipSize = (file) => SIZES[file]

test('a translation inlined in an initial chunk fails, whatever the budget', () => {
  const contents = { 'assets/shared.js': 'const t={title:"Entra a worKampo"};' }
  const readText = (file) => contents[file] ?? ''
  const budgets = [
    { name: '/login', screen: 'src/access/sign-in/login/login.page.tsx', maxBytes: 1_000 },
  ]

  const errors = budgetErrors({
    manifest: MANIFEST,
    gzipSize,
    readText,
    texts: ['Entra a worKampo'],
    budgets,
  })

  assert.deepEqual(errors, [
    '/login: assets/shared.js carries translations; texts load per language on demand',
  ])
})

test('the initial JS of a screen is the entry, the screen and what they import, once each', () => {
  const chunks = initialChunks(MANIFEST, { screen: 'src/access/sign-in/login/login.page.tsx' })

  assert.deepEqual(chunks.sort(), [
    'assets/forms.js',
    'assets/index.js',
    'assets/login.js',
    'assets/shared.js',
  ])
})

test('the namespaces of a screen count along the whole language chain, and no other', () => {
  const chunks = initialChunks(MANIFEST, {
    screen: 'src/access/home/home.page.tsx',
    namespaces: ['access'],
  })

  assert.deepEqual(chunks.sort(), [
    'assets/access-ca.js',
    'assets/access-en.js',
    'assets/access-es.js',
    'assets/home.js',
    'assets/index.js',
    'assets/shared.js',
  ])
})

test('a screen over its budget fails, one within passes', () => {
  const budgets = [
    { name: '/login', screen: 'src/access/sign-in/login/login.page.tsx', maxBytes: 144 },
    { name: 'shell', screen: 'src/access/home/home.page.tsx', maxBytes: 113 },
  ]

  const errors = budgetErrors({ manifest: MANIFEST, gzipSize, budgets })

  assert.deepEqual(errors, ['/login: 145 gzip bytes, over its budget of 144'])
})

test('a screen missing from the build fails instead of passing', () => {
  const budgets = [{ name: 'gone', screen: 'src/gone/gone.page.tsx', maxBytes: 1000 }]

  const errors = budgetErrors({ manifest: MANIFEST, gzipSize, budgets })

  assert.deepEqual(errors, ['gone: src/gone/gone.page.tsx is not a chunk of the build'])
})
