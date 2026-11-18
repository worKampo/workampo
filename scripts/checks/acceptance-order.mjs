// Commits touching e2e/acceptance/ come first in each segment; an admin's /reopen-acceptance opens a new one (ADR-0030).
export const name = 'Acceptance order'

const isAcceptance = (file) => /(^|\/)e2e\/acceptance\//.test(file)
const isAllowedBefore = (file) =>
  isAcceptance(file) || file.startsWith('docs/') || file.startsWith('.work/')

export function isReopenCandidate(comment) {
  return (
    /^\/reopen-acceptance\b/.test((comment.body ?? '').trim()) &&
    comment.user?.type === 'User' &&
    comment.performed_via_github_app == null
  )
}

export function acceptanceErrors(commits, reopenTimes) {
  const errors = []
  let segment = null
  let firstOther = null
  for (const commit of commits) {
    const current = reopenTimes.filter((time) => time < commit.time).length
    if (current !== segment) {
      segment = current
      firstOther = null
    }
    if (firstOther && commit.files.some(isAcceptance))
      errors.push(
        `${commit.sha.slice(0, 7)} touches e2e/acceptance/ after ${firstOther.slice(0, 7)} touched other paths; only a /reopen-acceptance from the person allows it`,
      )
    if (!firstOther && !commit.files.every(isAllowedBefore)) firstOther = commit.sha
  }
  return errors
}

function isAdmin(ctx, login) {
  try {
    const permission = ctx.gh([
      'api',
      `repos/${ctx.repo}/collaborators/${encodeURIComponent(login)}/permission`,
      '--jq',
      '.permission',
    ])
    return permission.trim() === 'admin'
  } catch {
    return false
  }
}

function reopenTimes(ctx) {
  if (!ctx.ticket || !ctx.issue()) return []
  return ctx
    .gh(['api', '--paginate', `repos/${ctx.repo}/issues/${ctx.ticket}/comments`, '--jq', '.[]'])
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((comment) => isReopenCandidate(comment) && isAdmin(ctx, comment.user.login))
    .map((comment) => Date.parse(comment.created_at) / 1000)
}

export function check(ctx) {
  const commits = ctx.commits()
  if (!commits.some((commit) => commit.files.some(isAcceptance))) return { errors: [] }
  return { errors: acceptanceErrors(commits, reopenTimes(ctx)) }
}
