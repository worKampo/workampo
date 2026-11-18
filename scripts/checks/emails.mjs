// Added lines carry no email except the project's noreply and the seed test domains (ADR-0043).
import { ALLOWED_EMAIL, EMAIL } from '../lib/no-entra.mjs'

export const name = 'Emails in the diff'

// ALLOWED_EMAIL takes any GitHub noreply; here only the project account's, with or without its id.
const isAllowed = (email, commitEmail) => {
  const account = commitEmail.replace(/^\d+\+/, '').toLowerCase()
  if (/@users\.noreply\.github\.com$/i.test(email))
    return email.replace(/^\d+\+/, '').toLowerCase() === account
  return ALLOWED_EMAIL.test(email)
}

export function emailErrors(addedLines, commitEmail) {
  return addedLines.flatMap(({ file, line, text }) =>
    [...text.matchAll(EMAIL)]
      .map(([email]) => email)
      .filter((email) => !isAllowed(email, commitEmail))
      .map((email) => `${file}:${line}: email not allowed: ${email}`),
  )
}

export function check(ctx) {
  return { errors: emailErrors(ctx.addedLines(), ctx.commitEmail) }
}
