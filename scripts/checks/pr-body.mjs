// `Ticket #N`, `PRD #M` when the ticket has a parent, `type:` / `area:` labels (ADR-0042), and no
// GitHub closing keyword before an issue number.
import { CLOSING_HINT, closingRefs } from '../lib/closing-keywords.mjs'

export const name = 'PR body and labels'

export function bodyErrors({ body, labels, ticket, parent }) {
  const errors = []
  if (ticket && !new RegExp(`\\bTicket #${ticket}\\b`).test(body))
    errors.push(`the body needs "Ticket #${ticket}"`)
  if (parent && !new RegExp(`\\bPRD #${parent}\\b`).test(body))
    errors.push(`the body needs "PRD #${parent}" (parent of #${ticket})`)
  for (const ref of closingRefs(body))
    errors.push(`the body closes #${ref} with a closing keyword: ${CLOSING_HINT}`)
  for (const prefix of ['type:', 'area:'])
    if (!labels.some((label) => label.startsWith(prefix)))
      errors.push(`the PR needs a ${prefix} label`)
  return errors
}

export function check(ctx) {
  // Renovate has no ticket: only its labels are checked.
  const ticket = ctx.isRenovate() ? null : ctx.ticket
  return {
    errors: bodyErrors({
      body: ctx.env.PR_BODY ?? '',
      labels: ctx.labels,
      ticket,
      parent: ticket && ctx.issue() ? ctx.parent() : null,
    }),
  }
}
