// Errors of the HTTP layer itself, owned by no domain.
export const API_ERROR_CODES = [
  'api.malformed_json',
  'api.not_found',
  'api.body_too_large',
] as const
