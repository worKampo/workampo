// Shapes from the "No entra" list of the public repo (ADR-0043, ADR-0064).
export const SECRET_SHAPES = [
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /\b(sk|rk|pk)_(live|test)_/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // Long mixed-case base64-like run: a generic key. Requiring a digit and both cases spares most paths, identifiers and hex hashes.
  /(?=[\w+/-]*\d)(?=[\w+/-]*[a-z])(?=[\w+/-]*[A-Z])\b[\w+/-]{40,}={0,2}/,
]
// The TLD must be letters so `react@18.3.1` is not an email.
export const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g
// Seed and doc domains are reserved by RFC 2606, so they never reach a real person.
const TEST_DOMAIN = /@(example\.(com|org)|[\w.-]+\.(test|example))$/i
const GITHUB_NOREPLY = /@users\.noreply\.github\.com$/i

// Of GitHub's noreply addresses only the project account's, with or without its numeric id
// (docs/process/review.md, No entra): another account's names a person.
export function isAllowedEmail(email, commitEmail) {
  if (!GITHUB_NOREPLY.test(email)) return TEST_DOMAIN.test(email)
  const account = (address) => address.replace(/^\d+\+/, '').toLowerCase()

  return Boolean(commitEmail) && account(email) === account(commitEmail)
}

// Every offending match, so a caller can tell new hits from ones a file already had.
export function noEntraMatches(text, commitEmail) {
  const secrets = SECRET_SHAPES.flatMap((shape) =>
    [...text.matchAll(new RegExp(shape.source, 'g'))].map((m) => m[0]),
  )
  const emails = [...text.matchAll(EMAIL)]
    .map((m) => m[0])
    .filter((e) => !isAllowedEmail(e, commitEmail))
  return [...secrets, ...emails]
}

export function findNoEntra(text, commitEmail) {
  const reasons = []
  for (const shape of SECRET_SHAPES)
    if (shape.test(text)) reasons.push(`looks like a secret: ${shape}`)
  for (const [email] of text.matchAll(EMAIL))
    if (!isAllowedEmail(email, commitEmail)) reasons.push(`email not allowed: ${email}`)
  return reasons
}
