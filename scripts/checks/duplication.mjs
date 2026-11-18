// Duplicated .tsx blocks found by jscpd with .jscpd.json; warnings only, no threshold.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'Duplicated .tsx'
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const CLI = fileURLToPath(new URL('../../node_modules/jscpd/run-jscpd.js', import.meta.url))

export function duplicationWarnings(report) {
  const where = (f) => `${f.name.replaceAll('\\', '/')}:${f.start}-${f.end}`
  return (report.duplicates ?? []).map(
    ({ firstFile, secondFile, lines }) =>
      `${where(firstFile)} duplicates ${where(secondFile)} (${lines} lines)`,
  )
}

export function check(ctx) {
  const output = mkdtempSync(join(tmpdir(), 'jscpd-'))
  try {
    ctx.run(process.execPath, [CLI, '--config', '.jscpd.json', '--output', output], { cwd: ROOT })
    const report = JSON.parse(readFileSync(join(output, 'jscpd-report.json'), 'utf8'))
    return { errors: [], warnings: duplicationWarnings(report) }
  } catch (error) {
    // Warnings only: a jscpd crash must not fail the PR either.
    return { errors: [], warnings: [`jscpd could not run: ${error.message.split('\n')[0]}`] }
  } finally {
    rmSync(output, { recursive: true, force: true })
  }
}
