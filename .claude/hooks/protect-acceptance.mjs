// PreToolUse for the implementer only (its frontmatter): acceptance scenarios belong to the test designer (ADR-0030).
import { readFileSync } from 'node:fs'

const { tool_input: input = {} } = JSON.parse(readFileSync(0, 'utf8'))
const path = (input.file_path ?? input.notebook_path ?? '').replaceAll('\\', '/')
if (/(^|\/)e2e\/acceptance\//.test(path)) {
  console.error(
    `Blocked: ${path} is a protected acceptance scenario; the implementer cannot change it (ADR-0030).`,
  )
  process.exit(2)
}
