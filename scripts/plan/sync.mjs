// Writes tasks.md as the issue checklist between markers (ADR-0020, ADR-0034). GH_TOKEN comes from the environment.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const [issue, file = 'tasks.md'] = args.filter((a) => !a.startsWith('--'))
  if (!/^\d+$/.test(issue ?? '')) {
    console.error('usage: plan:sync <issue> [file=tasks.md] [--dry-run]')
    process.exit(2)
  }
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
