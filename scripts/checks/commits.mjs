// commitlint over BASE..HEAD with commitlint.config.mjs; TICKET drives its `Refs:` rule.
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
import { CLOSING_HINT, closingRefs } from '../lib/closing-keywords.mjs'

export const name = 'Commits'
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CLI = fileURLToPath(new URL('../../node_modules/@commitlint/cli/cli.js', import.meta.url))

// Keeps each failing commit's subject and its problems, not the echoed message bodies.
export function summarize(output) {
  const lines = stripVTControlCharacters(output).split('\n')
  const errors = []
  for (const [i, line] of lines.entries()) {
    if (line.includes('--- input ---')) errors.push(`commit "${lines[i + 1]?.trim()}"`)
    else if (line.startsWith('✖') && !/found \d+ problems/.test(line))
      errors.push(`  ${line.replace(/^✖\s*/, '')}`)
  }
  return errors.length ? errors : [output.trim()]
}

// Read here, not as a commitlint rule: commitlint skips merges, fixup! and squash! commits
// before any rule runs, and GitHub still reads them in the squash commit.
export function closingErrors(log) {
  return log
    .split('')
    .filter((entry) => entry.trim())
    .flatMap((entry) => {
      const [subject, body] = entry.split('')
      const refs = closingRefs(body)
      if (!refs.length) return []
      return [
        `commit "${subject.trim()}" closes ${refs.map((r) => `#${r}`).join(', ')}: ${CLOSING_HINT}`,
      ]
    })
}

export function check(ctx) {
  const range = `${ctx.env.BASE_SHA}..${ctx.env.HEAD_SHA}`
  const closing = closingErrors(ctx.run('git', ['log', '--format=%x1e%h %s%x1f%B', range]))
  const ticket = ctx.isRenovate() ? '' : String(ctx.ticket ?? '')
  try {
    ctx.run(process.execPath, [CLI, '--from', ctx.env.BASE_SHA, '--to', ctx.env.HEAD_SHA], {
      cwd: ROOT,
      env: { ...process.env, TICKET: ticket, NO_COLOR: '1' },
    })
    return { errors: closing }
  } catch (error) {
    const lint = summarize(`${error.stdout ?? ''}${error.stderr ?? ''}` || error.message)
    return { errors: [...lint, ...closing] }
  }
}
