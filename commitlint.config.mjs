// Conventional commits plus `Refs: #<ticket>` in every commit (ADR-0042). `pnpm check:pr` sets TICKET.
import { CLOSING_HINT, closingRefs } from './scripts/lib/closing-keywords.mjs'
import { parseRefs } from './scripts/smoke/verification-comment.mjs'

export function refsTicket(parsed, when = 'always', ticket = '') {
  if (!ticket) return [true]
  const raw = parsed.raw ?? ''
  // The squash body feeds close-unobserved, which closes every ticket named in a Refs trailer:
  // valid means parseRefs sees this ticket and no other.
  const refs = parseRefs(raw)
  const extra = refs.filter((ref) => String(ref) !== ticket)
  const valid = refs.length > 0 && extra.length === 0
  const found =
    extra.length > 0 ? `; found other references: ${extra.map((r) => `#${r}`).join(', ')}` : ''
  return [
    when === 'never' ? !valid : valid,
    `every commit needs the trailer "Refs: #${ticket}" and no other Refs${found}`,
  ]
}

// The squash commit carries every commit message, and GitHub closes what they name after "fixes".
export function noClosingKeyword(parsed) {
  const refs = closingRefs(parsed.raw ?? '')
  return [
    refs.length === 0,
    `the message closes ${refs.map((r) => `#${r}`).join(', ')}: ${CLOSING_HINT}`,
  ]
}

// biome-ignore lint/style/noDefaultExport: commitlint loads the config from the default export.
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [{ rules: { 'refs-ticket': refsTicket, 'no-closing-keyword': noClosingKeyword } }],
  rules: {
    // Bodies are unwrapped prose, and GitHub writes trailers with long noreply addresses.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'refs-ticket': [2, 'always', process.env.TICKET ?? ''],
    'no-closing-keyword': [2, 'always'],
  },
}
