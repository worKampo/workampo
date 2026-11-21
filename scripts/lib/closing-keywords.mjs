// GitHub closes an issue named after one of these words when the PR merges or the commit lands on
// master. Tickets close only through their observation window or ADR-0068, never at the merge.
const CLOSING =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b\s*:?\s*(?:[\w.-]+\/[\w.-]+)?#(\d+)\b/gi

export function closingRefs(text) {
  return [...(text ?? '').matchAll(CLOSING)].map((match) => Number(match[1]))
}

export const CLOSING_HINT = 'GitHub would close it at the merge; write "ticket N" instead'
