// PreToolUse: blocks writing anything from the "No entra" list (ADR-0043). Exit 2 + stderr blocks the call.
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { findNoEntra, noEntraMatches } from '../../scripts/lib/no-entra.mjs'

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

// An edit can join two harmless halves into a secret, so also scan the file as it will be.
// Only matches the edit adds count: a file that already had one must stay editable.
// Never read outside the repo: the hook's message reaches the agent, and files such as the App key are off limits.
function addedByEdits() {
  const edits = input.edits ?? (input.old_string === undefined ? [] : [input])
  const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())
  const file = input.file_path ? resolve(input.file_path) : ''
  const inside = file && !relative(root, file).startsWith('..') && !isAbsolute(relative(root, file))
  if (!edits.length || !inside || !existsSync(file)) return []
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const { old_string: from = '', new_string: to = '', replace_all: all } of edits)
    after = all ? after.replaceAll(from, to) : after.replace(from, () => to)
  const old = noEntraMatches(before)
  return noEntraMatches(after).filter((m) => {
    const i = old.indexOf(m)
    if (i === -1) return true
    old.splice(i, 1)
    return false
  })
}

// Name the kind of match, never its value.
const formed = addedByEdits().length
const reasons = [
  ...new Set([
    ...findNoEntra(text).map((r) => r.replace(/^email not allowed: .*/, 'email not allowed')),
    ...(formed
      ? [`this edit forms ${formed} secret-shaped value(s) or real email(s) in the file`]
      : []),
  ]),
]
if (reasons.length) {
  console.error(
    `Blocked by the "No entra" list of the public repo (AGENTS.md section 8):\n- ${reasons.join('\n- ')}`,
  )
  process.exit(2)
}
