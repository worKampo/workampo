// PreToolUse: blocks writing anything from the "No entra" list (ADR-0043). Exit 2 + stderr blocks the call.
import { readFileSync } from 'node:fs'
import { findNoEntra } from '../../scripts/lib/no-entra.mjs'

const { tool_input: input = {} } = JSON.parse(readFileSync(0, 'utf8'))
const path = (input.file_path ?? input.notebook_path ?? '').replaceAll('\\', '/')
const text = [
  input.content,
  input.new_string,
  input.new_source,
  ...(input.edits ?? []).map((e) => e.new_string),
]
  .filter((t) => typeof t === 'string')
  .join('\n')

if (path.includes('/node_modules/') || text.includes('\0')) process.exit(0)
const reasons = findNoEntra(text)
if (reasons.length) {
  console.error(
    `Blocked by the "No entra" list of the public repo (AGENTS.md section 8):\n- ${reasons.join('\n- ')}`,
  )
  process.exit(2)
}
