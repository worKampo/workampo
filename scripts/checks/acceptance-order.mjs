// Commits touching e2e/acceptance/ come before code (ADR-0030). A later one needs a trailer
// `Reopen: <comment-id>` naming the person's /reopen-acceptance comment on the issue, one commit
// per comment. Commit dates are set by whoever commits, so they decide nothing here.
export const name = 'Acceptance order'

const HOW_TO_REOPEN =
  'the person comments /reopen-acceptance on the issue and the commit carries the trailer `Reopen: <comment-id>`'

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

// isTrusted(id) says whether the id names a trusted /reopen-acceptance comment.
export function acceptanceErrors(commits, isTrusted) {
  const errors = []
  const used = new Set()
  let firstOther = null
  for (const commit of commits) {
    if (firstOther && commit.files.some(isAcceptance)) {
      const id = commit.reopens.find((id) => !used.has(id) && isTrusted(id))
      if (id) used.add(id)
      else
        errors.push(
          `${commit.sha.slice(0, 7)} touches e2e/acceptance/ after ${firstOther.slice(0, 7)} touched other paths and has no unused Reopen trailer from a trusted /reopen-acceptance; to reopen, ${HOW_TO_REOPEN}`,
        )
    }
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

function reopenComments(ctx) {
  if (!ctx.ticket || !ctx.issue()) return new Map()
  const comments = ctx
    .gh(['api', '--paginate', `repos/${ctx.repo}/issues/${ctx.ticket}/comments`, '--jq', '.[]'])
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(isReopenCandidate)
  return new Map(comments.map((comment) => [String(comment.id), comment]))
}

export function check(ctx) {
  const commits = ctx.commits()
  if (!commits.some((commit) => commit.files.some(isAcceptance))) return { errors: [] }
  let comments
  const trusted = new Map()
  const isTrusted = (id) => {
    comments ??= reopenComments(ctx)
    const comment = comments.get(id)
    if (!comment) return false
    if (!trusted.has(id)) trusted.set(id, isAdmin(ctx, comment.user.login))
    return trusted.get(id)
  }
  return { errors: acceptanceErrors(commits, isTrusted) }
}
