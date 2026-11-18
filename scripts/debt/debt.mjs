// Lists every `paid-plan(<decision>)` mark and fails on a malformed one (ADR-0056).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const MARK = /paid-plan\((?:[^)\n]*\))?/g
const VALID = /^paid-plan\((ADR-\d{4}|D\d{2})\)$/

export function findMarks(text) {
  return text
    .split('\n')
    .flatMap((line, i) =>
      [...line.matchAll(MARK)].map(([mark]) => ({ line: i + 1, mark, valid: VALID.test(mark) })),
    )
}

// Docs describe the mark with placeholders and this folder holds its own bad samples.
const skipped = (f) =>
  /\.(md|html)$/.test(f) || f.startsWith('scripts/debt/') || f.includes('node_modules/')

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((f) => f && !skipped(f))
  let bad = 0
  for (const file of files) {
    let text
    try {
      text = readFileSync(`${ROOT}${file}`, 'utf8')
    } catch {
      continue
    }
    for (const { line, mark, valid } of findMarks(text)) {
      console.log(`${file}:${line}: ${mark}${valid ? '' : '  <- malformed'}`)
      if (!valid) bad++
    }
  }
  if (bad) {
    console.error(`${bad} malformed paid-plan mark(s)`)
    process.exit(1)
  }
}
