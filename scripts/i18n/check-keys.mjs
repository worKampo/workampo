// Every language of packages/i18n/locales/ has the same files and keys as en (ADR-0047), and every
// screen group of en has its description for translators in _context/ (docs/design/content.md).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from '../db/d1.mjs'

const LOCALES_DIR = join(ROOT, 'packages', 'i18n', 'locales')
const BASE = 'en'
const CONTEXT = '_context'

// locales: { <lang>: Map<file name, parsed JSON> }
export function keyErrors(locales) {
  const errors = []

  for (const [language, files] of Object.entries(locales)) {
    if (language === BASE || language.startsWith('_')) continue

    for (const [file, texts] of locales[BASE]) {
      if (!files.has(file)) {
        errors.push(`${language}/${file} is missing`)
        continue
      }

      const expected = new Set(keysOf(texts))
      const actual = new Set(keysOf(files.get(file)))

      for (const key of expected)
        if (!actual.has(key)) errors.push(`${language}/${file} misses ${key}`)

      for (const key of actual)
        if (!expected.has(key))
          errors.push(`${language}/${file} has ${key}, which ${BASE} does not`)
    }
  }

  return errors
}

export function contextErrors(locales) {
  const errors = []

  for (const [file, texts] of locales[BASE]) {
    const context = locales[CONTEXT]?.get(file)

    if (!context) {
      errors.push(`${CONTEXT}/${file} is missing`)
      continue
    }

    for (const group of Object.keys(texts))
      if (!context[group]?._screen) errors.push(`${CONTEXT}/${file} has no _screen for ${group}`)
  }

  return errors
}

function readLocales(dir) {
  return Object.fromEntries(
    readdirSync(dir).map((language) => [
      language,
      new Map(
        readdirSync(join(dir, language))
          .filter((file) => file.endsWith('.json'))
          .map((file) => [file, JSON.parse(readFileSync(join(dir, language, file), 'utf8'))]),
      ),
    ]),
  )
}

// An empty text counts as missing.
function keysOf(texts, prefix = '') {
  return Object.entries(texts).flatMap(([key, value]) => {
    if (typeof value === 'object' && value !== null) return keysOf(value, `${prefix}${key}.`)

    return value === '' ? [] : [`${prefix}${key}`]
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const locales = readLocales(LOCALES_DIR)
  const errors = [...keyErrors(locales), ...contextErrors(locales)]

  for (const error of errors) console.error(error)
  if (errors.length > 0) process.exit(1)
}
