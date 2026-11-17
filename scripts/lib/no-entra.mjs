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
export const ALLOWED_EMAIL =
  /@(users\.noreply\.github\.com|example\.(com|org)|[\w.-]+\.(test|example))$/i

// Every offending match, so a caller can tell new hits from ones a file already had.
export function noEntraMatches(text) {
  const secrets = SECRET_SHAPES.flatMap((shape) =>
    [...text.matchAll(new RegExp(shape.source, 'g'))].map((m) => m[0]),
  )
  const emails = [...text.matchAll(EMAIL)].map((m) => m[0]).filter((e) => !ALLOWED_EMAIL.test(e))
  return [...secrets, ...emails]
}

export function findNoEntra(text) {
  const reasons = []
  for (const shape of SECRET_SHAPES)
    if (shape.test(text)) reasons.push(`looks like a secret: ${shape}`)
  for (const [email] of text.matchAll(EMAIL))
    if (!ALLOWED_EMAIL.test(email)) reasons.push(`email not allowed: ${email}`)
  return reasons
}
