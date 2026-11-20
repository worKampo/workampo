// Conventional commits plus `Refs: #<ticket>` in every commit (ADR-0042). `pnpm check:pr` sets TICKET.
import { parseRefs } from './scripts/smoke/verification-comment.mjs'

export function refsTicket(parsed, when = 'always', ticket = '') {
  if (!ticket) return [true]
  const raw = parsed.raw ?? ''
  const hasRefs = new RegExp(`^Refs: #${ticket}\\s*$`, 'm').test(raw)
  // The squash body feeds close-unobserved, which closes every ticket named in a Refs trailer.
  const extra = parseRefs(raw).filter((ref) => String(ref) !== ticket)
  const valid = hasRefs && extra.length === 0
  const found =
    extra.length > 0 ? `; found other references: ${extra.map((r) => `#${r}`).join(', ')}` : ''
  return [
    when === 'never' ? !valid : valid,
    `every commit needs the trailer "Refs: #${ticket}" and no other Refs${found}`,
  ]
}

// biome-ignore lint/style/noDefaultExport: commitlint loads the config from the default export.
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [{ rules: { 'refs-ticket': refsTicket } }],
  rules: {
    // Bodies are unwrapped prose, and GitHub writes trailers with long noreply addresses.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'refs-ticket': [2, 'always', process.env.TICKET ?? ''],
  },
}
