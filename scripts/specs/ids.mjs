// Gives every example under a `@wip(#n)` rule its `@id:<domain>-<issue>-<n>` (ADR-0052).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXAMPLE = /^(\s*)(Scenario Outline|Scenario Template|Scenario|Example):/
const isTag = (line) => /^\s*@/.test(line)

export function assignIds(text, domain) {
  const last = new Map()
  for (const [, issue, n] of text.matchAll(new RegExp(`@id:${domain}-(\\d+)-(\\d+)`, 'g')))
    last.set(issue, Math.max(last.get(issue) ?? 0, Number(n)))

  const out = []
  const missing = []
  let wip = null
  let tags = []
  for (const [i, line] of text.split('\n').entries()) {
    if (isTag(line)) tags.push(out.length)
    else if (line.trim()) {
      if (/^\s*Rule:/.test(line))
        wip = tags.map((t) => out[t].match(/@wip\(#(\d+)\)/)?.[1]).find(Boolean) ?? null
      else if (EXAMPLE.test(line) && wip && !tags.some((t) => /@id:/.test(out[t]))) {
        missing.push(i + 1)
        const next = (last.get(wip) ?? 0) + 1
        last.set(wip, next)
        const id = `@id:${domain}-${wip}-${next}`
        if (tags.length) out[tags.at(-1)] += ` ${id}`
        else out.push(`${line.match(EXAMPLE)[1]}${id}`)
      }
      tags = []
    }
    out.push(line)
  }
  return { text: out.join('\n'), missing }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check')
  const dir = fileURLToPath(new URL('../../docs/domains/', import.meta.url))
  const files = readdirSync(dir, { recursive: true }).filter(
    (f) => f.endsWith('.md') && f !== 'README.md',
  )
  const problems = []
  for (const file of files) {
    const path = join(dir, file)
    const result = assignIds(readFileSync(path, 'utf8'), basename(file, '.md'))
    if (!result.missing.length) continue
    problems.push(
      ...result.missing.map((line) => `docs/domains/${file}:${line}: example without @id`),
    )
    if (!check) writeFileSync(path, result.text)
  }
  if (check && problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  console.log(problems.length ? `assigned ${problems.length} ids` : 'every example has an @id')
}
