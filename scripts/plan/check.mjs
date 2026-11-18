// Validates tasks.md: dependencies, cycles, waves and file collisions inside a wave (ADR-0020).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseTasks } from './tasks.mjs'

// A trailing slash marks a folder, which contains every path under it.
const overlaps = (a, b) =>
  a === b || (a.endsWith('/') && b.startsWith(a)) || (b.endsWith('/') && a.startsWith(b))

function findCycle(tasks) {
  const deps = new Map(tasks.map((t) => [t.id, t.deps]))
  const done = new Set()
  const visit = (id, path) => {
    if (path.includes(id)) return [...path.slice(path.indexOf(id)), id]
    if (done.has(id) || !deps.has(id)) return null
    for (const dep of deps.get(id)) {
      const cycle = visit(dep, [...path, id])
      if (cycle) return cycle
    }
    done.add(id)
    return null
  }
  for (const { id } of tasks) {
    const cycle = visit(id, [])
    if (cycle) return cycle
  }
  return null
}

export function checkPlan(text) {
  const { tasks, waves } = parseTasks(text)
  const problems = []
  const known = new Set(tasks.map((t) => t.id))
  const waveOf = new Map(waves.flatMap(({ n, ids }) => ids.map((id) => [id, n])))

  for (const task of tasks) {
    for (const dep of task.deps)
      if (!known.has(dep)) problems.push(`${task.id}: unknown dependency ${dep}`)
    if (!waveOf.has(task.id)) problems.push(`${task.id}: missing from the waves`)
  }
  for (const id of waveOf.keys())
    if (!known.has(id)) problems.push(`Waves: ${id} is not in the table`)

  const cycle = findCycle(tasks)
  if (cycle) problems.push(`cycle: ${cycle.join(' → ')}`)

  for (const task of tasks)
    for (const dep of task.deps)
      if (waveOf.has(task.id) && waveOf.has(dep) && waveOf.get(task.id) <= waveOf.get(dep))
        problems.push(
          `${task.id}: in wave ${waveOf.get(task.id)} but depends on ${dep} in wave ${waveOf.get(dep)}`,
        )

  for (const { n, ids } of waves) {
    const inWave = tasks.filter((t) => ids.includes(t.id))
    inWave.forEach((a, i) => {
      for (const b of inWave.slice(i + 1))
        for (const pa of a.touches)
          for (const pb of b.touches.filter((pb) => overlaps(pa, pb)))
            problems.push(
              `wave ${n}: ${a.id} and ${b.id} both touch ${pa === pb ? pa : `${pa} / ${pb}`}`,
            )
    })
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? 'tasks.md'
  const problems = checkPlan(readFileSync(file, 'utf8'))
  if (problems.length) {
    console.error(`${file}:\n- ${problems.join('\n- ')}`)
    process.exit(1)
  }
  console.log(`${file} ok`)
}
