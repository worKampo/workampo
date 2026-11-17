// PreToolUse for the implementer only (its frontmatter): acceptance scenarios belong to the test designer (ADR-0030).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8')).tool_input ?? {}
} catch {
  console.error('Blocked: the acceptance hook could not parse its input.')
  process.exit(2)
}
// Resolve `..` segments and lowercase: Windows paths are case-insensitive, so E2E/Acceptance is the same folder.
const raw = input.file_path ?? input.notebook_path ?? ''
const path = raw ? resolve(raw).replaceAll('\\', '/').toLowerCase() : ''
if (/(^|\/)e2e\/acceptance(\/|$)/.test(path)) {
  console.error(
    `Blocked: ${raw} is a protected acceptance scenario; the implementer cannot change it (ADR-0030).`,
  )
  process.exit(2)
}
