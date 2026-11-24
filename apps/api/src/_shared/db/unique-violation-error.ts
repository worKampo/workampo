// A unique index refused a write: repos throw it, whatever the engine says, so logic can react.
export class UniqueViolationError extends Error {}
