// PreToolUse: blocks writing anything from the "No entra" list (ADR-0043). Exit 2 + stderr blocks the call.
import { readFileSync } from 'node:fs'
import { findNoEntra } from '../../scripts/lib/no-entra.mjs'

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8')).tool_input ?? {}
} catch {
  // Fail closed: a guard that cannot read its input must not let the write through.
  console.error('Blocked: the "No entra" hook could not parse its input.')
  process.exit(2)
}
const text = [
  input.content,
  input.new_string,
  input.new_source,
  ...(input.edits ?? []).map((e) => e.new_string),
]
  .filter((t) => typeof t === 'string')
  .join('\n')
  .replaceAll('\0', '')

const reasons = findNoEntra(text)
if (reasons.length) {
  console.error(
    `Blocked by the "No entra" list of the public repo (AGENTS.md section 8):\n- ${reasons.join('\n- ')}`,
  )
  process.exit(2)
}
