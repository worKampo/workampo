// Reads the tasks.md table and its Waves line (ADR-0020).
const cells = (line) =>
  line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim())

function parseDeps(cell) {
  const ids = new Set()
  const rest = cell.replace(/T(\d+)\s*[–-]\s*T(\d+)/g, (_, from, to) => {
    for (let n = Number(from); n <= Number(to); n++) ids.add(`T${n}`)
    return ''
  })
  for (const [id] of rest.matchAll(/T\d+/g)) ids.add(id)
  return [...ids]
}

export function parseTasks(text) {
  const tasks = text
    .split('\n')
    .filter((line) => line.trimStart().startsWith('|'))
    .map(cells)
    .filter((row) => /^T\d+$/.test(row[0] ?? ''))
    .map(([id, title, deps, touches, , , status]) => ({
      id,
      title,
      deps: parseDeps(deps),
      touches: touches
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t && t !== '—'),
      status,
    }))
  const wavesLine = text.split('\n').find((line) => line.trimStart().startsWith('Waves:')) ?? ''
  const waves = wavesLine
    .replace('Waves:', '')
    .split('·')
    .map((part) => part.split('→'))
    .filter(([n, ids]) => /^\s*\d+\s*$/.test(n) && ids !== undefined)
    .map(([n, ids]) => ({ n: Number(n), ids: ids.match(/T\d+/g) ?? [] }))
  return { tasks, waves }
}
