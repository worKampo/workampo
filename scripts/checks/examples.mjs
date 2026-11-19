// Every living-spec example has a test citing its @id and no test cites a missing one (ADR-0052).
import { writeFileSync } from 'node:fs'

export const name = 'Examples and tests'
// The whole token up to a delimiter: a valid prefix with a bad suffix is malformed, never indexed.
const TOKEN = /@id:[^\s'"`),\]]*/g
const VALID = /^@id:([a-z][a-z0-9-]*-\d+-\d+)$/
const tokens = (hit) => [...hit.text.matchAll(TOKEN)].map(([raw]) => raw)

function index(hits) {
  const ids = new Map()
  for (const hit of hits)
    for (const raw of tokens(hit)) {
      const id = VALID.exec(raw)?.[1]
      if (id) ids.set(id, [...(ids.get(id) ?? []), `${hit.file}:${hit.line}`])
    }
  return ids
}

function malformed(hits) {
  return hits.flatMap((hit) =>
    tokens(hit)
      .filter((raw) => !VALID.test(raw))
      .map((raw) => `${hit.file}:${hit.line}: malformed ${raw}`),
  )
}

export function verificationMatrix(specHits, testHits, headSha) {
  const specHitsOnly = specHits.filter((hit) => hit.file !== 'docs/domains/README.md')
  const specs = index(specHitsOnly)
  const tests = index(testHits)
  const files = (places) => [...new Set(places.map((place) => place.replace(/:\d+$/, '')))]
  const errors = malformed([...specHitsOnly, ...testHits])
  const rows = []
  for (const [id, places] of specs) {
    const citing = files(tests.get(id) ?? [])
    if (!citing.length) errors.push(`${places[0]}: example @id:${id} has no test`)
    rows.push(`| \`${id}\` | ${places[0]} | ${citing.join('<br>') || '**missing**'} |`)
  }
  for (const [id, places] of tests)
    if (!specs.has(id))
      errors.push(`${places.join(', ')}: cites @id:${id}, which no living spec has`)
  const markdown = [
    '## Verification',
    '',
    ...(headSha ? [`Verified commit: ${headSha}`, ''] : []),
    rows.length
      ? ['| Example | Living spec | Tests |', '|---|---|---|', ...rows].join('\n')
      : 'No living-spec example has an @id yet.',
    ...(errors.length ? ['', '### Problems', '', ...errors.map((e) => `- ${e}`)] : []),
    '',
  ].join('\n')
  return { errors, markdown }
}

export function check(ctx) {
  const { errors, markdown } = verificationMatrix(
    ctx.grep('@id:', ['docs/domains']),
    ctx.grep('@id:', ['apps', 'packages']),
    ctx.env.HEAD_SHA,
  )
  if (ctx.env.VERIFICATION_FILE) writeFileSync(ctx.env.VERIFICATION_FILE, markdown)
  return { errors }
}
