// A unique index refused a write: repos throw it, whatever the engine says, so logic can react.
export class UniqueViolationError extends Error {}

// D1 names the refused index only in its message: a unique refusal becomes UniqueViolationError, anything else goes on.
export function rethrowUniqueViolation(error: unknown): never {
  if (error instanceof Error && /UNIQUE constraint failed/.test(`${error.message} ${error.cause}`))
    throw new UniqueViolationError(error.message, { cause: error })

  throw error
}
