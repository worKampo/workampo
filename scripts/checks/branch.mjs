// Branch name and open ticket (ADR-0042); Renovate's branches are exempt.
export const name = 'Branch'

export function branchErrors(ref, ticket, issue) {
  if (!ticket) return [`"${ref}" does not match ^(feature|bugfix|hotfix)/<issue>-<kebab-slug>$`]
  if (!issue || issue.pull) return [`#${ticket} is not an issue of this repo`]
  if (issue.state !== 'open') return [`issue #${ticket} is ${issue.state}, not open`]
  return []
}

export function check(ctx) {
  if (ctx.isRenovate()) return { errors: [] }
  return { errors: branchErrors(ctx.ref, ctx.ticket, ctx.ticket && ctx.issue()) }
}
