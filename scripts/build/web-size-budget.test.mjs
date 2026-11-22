import assert from 'node:assert/strict'
import { test } from 'node:test'
import { budgetErrors, initialChunks } from './web-size-budget.mjs'

const MANIFEST = {
  'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_shared.js'] },
  '_shared.js': { file: 'assets/shared.js' },
  '_forms.js': { file: 'assets/forms.js', imports: ['_shared.js'] },
  'src/login-screen.tsx': { file: 'assets/login.js', isDynamicEntry: true, imports: ['_forms.js'] },
  'src/home-screen.tsx': { file: 'assets/home.js', isDynamicEntry: true },
}
const SIZES = {
  'assets/index.js': 100,
  'assets/shared.js': 10,
  'assets/forms.js': 30,
  'assets/login.js': 5,
  'assets/home.js': 3,
}
const gzipSize = (file) => SIZES[file]

test('the initial JS of a screen is the entry, the screen and what they import, once each', () => {
  const chunks = initialChunks(MANIFEST, 'src/login-screen.tsx')

  assert.deepEqual(chunks.sort(), [
    'assets/forms.js',
    'assets/index.js',
    'assets/login.js',
    'assets/shared.js',
  ])
})

test('a screen over its budget fails, one within passes', () => {
  const budgets = [
    { name: '/login', screen: 'src/login-screen.tsx', maxBytes: 144 },
    { name: 'shell', screen: 'src/home-screen.tsx', maxBytes: 113 },
  ]

  const errors = budgetErrors({ manifest: MANIFEST, gzipSize, budgets })

  assert.deepEqual(errors, ['/login: 145 gzip bytes, over its budget of 144'])
})

test('a screen missing from the build fails instead of passing', () => {
  const budgets = [{ name: 'gone', screen: 'src/gone-screen.tsx', maxBytes: 1000 }]

  const errors = budgetErrors({ manifest: MANIFEST, gzipSize, budgets })

  assert.deepEqual(errors, ['gone: src/gone-screen.tsx is not a chunk of the build'])
})
