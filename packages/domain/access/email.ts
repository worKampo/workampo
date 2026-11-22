import { z } from 'zod'

// RFC 5321 path limit.
export const EMAIL_MAX_LENGTH = 254

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email({ pattern: z.regexes.unicodeEmail }).max(EMAIL_MAX_LENGTH))
