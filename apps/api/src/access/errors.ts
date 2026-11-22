import type { AccessErrorCode } from '@workampo/domain/access/errors'

// One class: the code tells the cases apart, and problem-json turns it into its answer.
export class AccessError extends Error {
  constructor(readonly code: AccessErrorCode) {
    super(code)
  }
}
