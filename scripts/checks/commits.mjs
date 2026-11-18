// commitlint over BASE..HEAD with commitlint.config.mjs; TICKET drives its `Refs:` rule.
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'

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

export function check(ctx) {
  const ticket = ctx.isRenovate() ? '' : String(ctx.ticket ?? '')
  try {
    ctx.run(process.execPath, [CLI, '--from', ctx.env.BASE_SHA, '--to', ctx.env.HEAD_SHA], {
      cwd: ROOT,
      env: { ...process.env, TICKET: ticket, NO_COLOR: '1' },
    })
    return { errors: [] }
  } catch (error) {
    return { errors: summarize(`${error.stdout ?? ''}${error.stderr ?? ''}` || error.message) }
  }
}
