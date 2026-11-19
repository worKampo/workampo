// Writes .work/tasks.md as the issue checklist between markers (ADR-0020, ADR-0034). GH_TOKEN comes from the environment.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { parseTasks } from './tasks.mjs'

const START = '<!-- tasks:start -->'
const END = '<!-- tasks:end -->'

export function renderBlock(tasks) {
  const lines = tasks.map(({ id, title, status }) => {
    if (status === 'done') return `- [x] ${id} · ${title}`
    return `- [ ] ${id} · ${title}${status === 'doing' ? ' · 🔄 in progress' : ''}`
  })
  return [START, ...lines, END].join('\n')
}

export function applyBlock(body, block) {
  const text = body.replace(/\r\n/g, '\n')
  const from = text.indexOf(START)
  const to = text.indexOf(END)
  if (from !== -1 && to > from) return text.slice(0, from) + block + text.slice(to + END.length)
  return `${text.trimEnd()}\n\n## Tasks\n\n${block}\n`
}

const USAGE = 'usage: plan:sync <issue> [file=.work/tasks.md] [--dry-run]'

// Strict: a misspelled flag such as --dryrun must stop the run, not edit the issue for real.
export function parseSyncArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { 'dry-run': { type: 'boolean', default: false } },
    allowPositionals: true,
  })
  const [issue, file = '.work/tasks.md', ...extra] = positionals
  if (!/^\d+$/.test(issue ?? '') || extra.length) throw new Error(USAGE)
  return { issue, file, dryRun: values['dry-run'] }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let parsed
  try {
    parsed = parseSyncArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error.message === USAGE ? USAGE : `${error.message}\n${USAGE}`)
    process.exit(2)
  }
  const { issue, file, dryRun } = parsed
  const block = renderBlock(parseTasks(readFileSync(file, 'utf8')).tasks)
  const current = execFileSync('gh', ['issue', 'view', issue, '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8',
  })
    .replace(/\r\n/g, '\n')
    .replace(/\n$/, '')
  const next = applyBlock(current, block)
  if (dryRun) console.log(next)
  else if (next.trimEnd() === current.trimEnd()) console.log(`#${issue} already up to date`)
  else {
    execFileSync('gh', ['issue', 'edit', issue, '--body-file', '-'], { input: next })
    console.log(`#${issue} checklist updated`)
  }
}
