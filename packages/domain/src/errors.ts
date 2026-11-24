import { ACCESS_ERROR_CODES } from './access/errors'
import { COMPANIES_ERROR_CODES } from './companies/errors'

// Every domain's error codes: the API, app-core and the texts' test read the union from here.
export const ERROR_CODES = [...ACCESS_ERROR_CODES, ...COMPANIES_ERROR_CODES] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export function isErrorCode(value: unknown): value is ErrorCode {
  return (ERROR_CODES as readonly unknown[]).includes(value)
}
