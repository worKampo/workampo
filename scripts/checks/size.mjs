// `size:` on the issue, and `size:L` when the diff touches a critical path (ADR-0052).
import { matchesGlob } from 'node:path/posix'

export const name = 'Size'
const CRITICAL_PATHS = 'docs/procedures/critical-paths.md'

export function parseCriticalPaths(text) {
  return [...(text ?? '').matchAll(/^- `([^`]+)`/gm)].map((match) => match[1])
}

export function sizeErrors({ ticket, issueLabels, files, globs }) {
  const size = issueLabels.find((label) => label.startsWith('size:'))
  if (!size) return [`issue #${ticket} has no size: label`]
  const critical = files.filter((file) => globs.some((glob) => matchesGlob(file, glob)))
  if (critical.length && size !== 'size:L')
    return [
      `the diff touches critical paths, so issue #${ticket} needs size:L, not ${size}: ${critical.join(', ')}`,
    ]
  return []
}

export function check(ctx) {
  const issue = ctx.isRenovate() ? null : ctx.issue()
  if (!issue) return { errors: [] }
  return {
    errors: sizeErrors({
      ticket: ctx.ticket,
      issueLabels: issue.labels,
      files: ctx.changedFiles(),
      globs: parseCriticalPaths(ctx.showFile(CRITICAL_PATHS)),
    }),
  }
}
