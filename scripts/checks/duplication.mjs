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

const firstLine = (text) =>
  String(text ?? '')
    .split('\n')
    .find((line) => line.trim())
    ?.trim()

// Warnings only: neither a jscpd crash nor its temporary directory may fail the PR.
export function check(ctx) {
  let output
  const warnings = []
  try {
    output = mkdtempSync(join(tmpdir(), 'jscpd-'))
    ctx.run(process.execPath, [CLI, '--config', '.jscpd.json', '--output', output], { cwd: ROOT })
    const report = JSON.parse(readFileSync(join(output, 'jscpd-report.json'), 'utf8'))
    warnings.push(...duplicationWarnings(report))
  } catch (error) {
    // The launcher names the cause on stderr; the message's first line is only the command.
    warnings.push(`jscpd could not run: ${firstLine(error.stderr) ?? firstLine(error.message)}`)
  }
  try {
    if (output) rmSync(output, { recursive: true, force: true })
  } catch (error) {
    warnings.push(`could not remove ${output}: ${firstLine(error.message)}`)
  }
  return { errors: [], warnings }
}
