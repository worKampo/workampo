// Conventional commits plus `Refs: #<ticket>` in every commit (ADR-0042). `pnpm check:pr` sets TICKET.
export function refsTicket(parsed, when = 'always', ticket = '') {
  if (!ticket) return [true]
  const hasRefs = new RegExp(`^Refs: #${ticket}\\s*$`, 'm').test(parsed.raw ?? '')
  return [
    when === 'never' ? !hasRefs : hasRefs,
    `every commit needs the trailer "Refs: #${ticket}"`,
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
