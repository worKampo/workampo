// The initial JS of /login and of the signed-in shell stays under its budget and carries no
// translations, which load per language on demand (ADR-0073 point 4).
//   node scripts/build/web-size-budget.mjs <web dist dir>
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

// Gzip bytes: the first measurement with the startup translations (2026-11-22: 157,023 and
// 120,692) plus about 10 %. Raise one only on purpose, in its own commit that says why.
export const BUDGETS = [
  {
    name: '/login',
    screen: 'src/access/sign-in/login/login.page.tsx',
    namespaces: ['common', 'access'],
    maxBytes: 172_700,
  },
  {
    name: 'signed-in shell',
    // Where / lands a person with several companies; / itself has no page.
    screen: 'src/companies/selection/company-picker/company-picker.page.tsx',
    namespaces: ['common', 'access', 'companies'],
    maxBytes: 134_000,
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

// Looks in the chunks' text, not the manifest: a JSON imported statically is inlined into its
// importer and has no chunk of its own.
export function budgetErrors({
  manifest,
  gzipSize,
  readText = () => '',
  texts = [],
  budgets = BUDGETS,
}) {
  return budgets.flatMap((budget) => {
    const { name, screen, maxBytes } = budget
    if (!manifest[screen]) return [`${name}: ${screen} is not a chunk of the build`]

    const bytes = initialChunks(manifest, budget).reduce((sum, file) => sum + gzipSize(file), 0)
    const errors = initialChunks(manifest, { screen })
      .filter((file) => {
        const code = readText(file)

        return texts.some((text) => code.includes(text))
      })
      .map((file) => `${name}: ${file} carries translations; texts load per language on demand`)

    return bytes > maxBytes
      ? [...errors, `${name}: ${bytes} gzip bytes, over its budget of ${maxBytes}`]
      : errors
  })
}

// The longest stretch of each text without quotes, backslashes or line breaks, which a minifier
// may escape, when long enough to be unmistakable; every language, _context/ is for translators.
export function translationTexts(localesDir) {
  const values = (node) => (typeof node === 'string' ? [node] : Object.values(node).flatMap(values))

  return readdirSync(localesDir)
    .filter((language) => language !== '_context')
    .flatMap((language) =>
      readdirSync(join(localesDir, language)).flatMap((file) =>
        values(JSON.parse(readFileSync(join(localesDir, language, file), 'utf8'))),
      ),
    )
    .map((text) => text.split(/["'`\\\n\r\t]/).reduce((a, b) => (b.length > a.length ? b : a)))
    .filter((text) => text.length >= 12)
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
  const readText = (file) => readFileSync(join(dir, file), 'utf8')
  const texts = translationTexts(
    fileURLToPath(new URL('../../packages/i18n/src/locales', import.meta.url)),
  )
  const errors = budgetErrors({ manifest, gzipSize, readText, texts })
  for (const error of errors) console.error(error)
  if (errors.length > 0) process.exit(1)
}
