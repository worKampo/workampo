// Every living-spec example has a test citing its @id and no test cites a missing one (ADR-0052).
import { writeFileSync } from 'node:fs'

export const name = 'Examples and tests'
const ID = /@id:([a-z][a-z0-9-]*-\d+-\d+)/g

function index(hits) {
  const ids = new Map()
  for (const hit of hits)
    for (const [, id] of hit.text.matchAll(ID))
      ids.set(id, [...(ids.get(id) ?? []), `${hit.file}:${hit.line}`])
  return ids
}

// A malformed id would match nothing above and slip past both checks.
function malformed(hits) {
  return hits.flatMap((hit) =>
    [...hit.text.matchAll(/@id:[\w<>-]*/g)]
      .map(([raw]) => raw)
      .filter((raw) => !/^@id:[a-z][a-z0-9-]*-\d+-\d+$/.test(raw))
      .map((raw) => `${hit.file}:${hit.line}: malformed ${raw}`),
  )
}

export function verificationMatrix(specHits, testHits) {
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
  )
  if (ctx.env.VERIFICATION_FILE) writeFileSync(ctx.env.VERIFICATION_FILE, markdown)
  return { errors }
}
