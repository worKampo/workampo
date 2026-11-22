// The initial JS of /login and of the signed-in shell stays under its budget (ADR-0073 point 4).
//   node scripts/build/web-size-budget.mjs <web dist dir>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

// Gzip bytes: the first measurement with the startup translations (2026-11-22: 157,023 and
// 120,692) plus about 10 %. Raise one only on purpose, in its own commit that says why.
export const BUDGETS = [
  {
    name: '/login',
    screen: 'src/access/sign-in/login-screen.tsx',
    namespaces: ['common', 'access'],
    maxBytes: 172_700,
  },
  {
    name: 'signed-in shell',
    screen: 'src/access/home/home-screen.tsx',
    namespaces: ['common', 'access'],
    maxBytes: 132_800,
  },
]

// The heaviest language to start in: Catalan loads its own texts and those of its fallbacks.
export const WORST_LANGUAGE_CHAIN = ['ca', 'es', 'en']

// The entry chunk, the screen's lazy chunk, every chunk they import statically, and the
// translations the screen needs before it shows: its namespaces along the language chain.
export function initialChunks(manifest, { screen, namespaces = [] }) {
  const files = new Set()
  const visit = (key) => {
    const chunk = manifest[key]
    if (!chunk || files.has(chunk.file)) return

    files.add(chunk.file)
    for (const imported of chunk.imports ?? []) visit(imported)
  }
  const entry = Object.keys(manifest).find((key) => manifest[key].isEntry)
  visit(entry)
  visit(screen)
  for (const language of WORST_LANGUAGE_CHAIN)
    for (const namespace of namespaces) {
      const key = Object.keys(manifest).find((k) =>
        k.endsWith(`/locales/${language}/${namespace}.json`),
      )
      visit(key)
    }

  return [...files]
}

export function budgetErrors({ manifest, gzipSize, budgets = BUDGETS }) {
  return budgets.flatMap((budget) => {
    const { name, screen, maxBytes } = budget
    if (!manifest[screen]) return [`${name}: ${screen} is not a chunk of the build`]

    const bytes = initialChunks(manifest, budget).reduce((sum, file) => sum + gzipSize(file), 0)

    return bytes > maxBytes ? [`${name}: ${bytes} gzip bytes, over its budget of ${maxBytes}`] : []
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? 'dist'
  const manifest = JSON.parse(readFileSync(join(dir, '.vite', 'manifest.json'), 'utf8'))
  const gzipSize = (file) => gzipSync(readFileSync(join(dir, file))).length
  for (const budget of BUDGETS) {
    const { name } = budget
    const bytes = initialChunks(manifest, budget).reduce((sum, file) => sum + gzipSize(file), 0)
    console.log(`${name}: ${bytes} gzip bytes of initial JS`)
  }
  const errors = budgetErrors({ manifest, gzipSize })
  for (const error of errors) console.error(error)
  if (errors.length > 0) process.exit(1)
}
