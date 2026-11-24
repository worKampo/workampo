// Added lines carry no email except the project's noreply and the test domains of docs/process/review.md (No entra).
import { EMAIL, isAllowedEmail } from '../lib/no-entra.mjs'

export const name = 'Emails in the diff'

export function emailErrors(addedLines, commitEmail) {
  return addedLines.flatMap(({ file, line, text }) =>
    [...text.matchAll(EMAIL)]
      .map(([email]) => email)
      .filter((email) => !isAllowedEmail(email, commitEmail))
      .map((email) => `${file}:${line}: email not allowed: ${email}`),
  )
}

export function check(ctx) {
  return { errors: emailErrors(ctx.addedLines(), ctx.commitEmail) }
}
