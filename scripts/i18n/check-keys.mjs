// Every language of packages/i18n/src/locales/ has the same files and keys as en (ADR-0047), and every
// screen group of en has its description for translators in _context/ (docs/design/content.md).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from '../db/d1.mjs'

const LOCALES_DIR = join(ROOT, 'packages', 'i18n', 'src', 'locales')
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

    for (const file of files.keys())
      if (!locales[BASE].has(file)) errors.push(`${language}/${file} has no ${BASE} counterpart`)
  }

  return errors
}

// Every language, en included: an empty text is a missing translation.
export function emptyTextErrors(locales) {
  return Object.entries(locales)
    .filter(([language]) => !language.startsWith('_'))
    .flatMap(([language, files]) =>
      [...files].flatMap(([file, texts]) =>
        keysOf(texts)
          .filter((key) => valueAt(texts, key) === '')
          .map((key) => `${language}/${file} has an empty text at ${key}`),
      ),
    )
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

function keysOf(texts, prefix = '') {
  return Object.entries(texts).flatMap(([key, value]) => {
    if (typeof value === 'object' && value !== null) return keysOf(value, `${prefix}${key}.`)

    return [`${prefix}${key}`]
  })
}

function valueAt(texts, key) {
  return key.split('.').reduce((node, part) => node?.[part], texts)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const locales = readLocales(LOCALES_DIR)
  const errors = [...keyErrors(locales), ...emptyTextErrors(locales), ...contextErrors(locales)]

  for (const error of errors) console.error(error)
  if (errors.length > 0) process.exit(1)
}
