// Every commit of the PR is authored with the project's noreply email; Renovate is exempt (ADR-0042).
export const name = 'Author'

export function authorErrors(commits, commitEmail) {
  return commits
    .filter((commit) => commit.email !== commitEmail)
    .map((commit) => `${commit.sha.slice(0, 7)} is authored by ${commit.email}, not ${commitEmail}`)
}

export function check(ctx) {
  if (ctx.isRenovate()) return { errors: [] }
  return { errors: authorErrors(ctx.commits(), ctx.commitEmail) }
}
