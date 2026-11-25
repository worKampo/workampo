import { z } from 'zod'
import { slugSchema } from '../../_shared/slug'

// C0/C1 controls plus the bidi marks and isolates that can reorder rendered text.
const FORBIDDEN_CHARS = /[\p{Cc}؜‎‏‪-‮⁦-⁩]/u

const textSchema = z
  .string()
  .transform((value) => value.trim().normalize('NFC'))
  .pipe(
    z
      .string()
      .min(1)
      .max(80)
      .refine((value) => !FORBIDDEN_CHARS.test(value)),
  )

export function makeCreateCompanySchema(languages: readonly string[]) {
  return z.strictObject({
    name: textSchema,
    slug: slugSchema,
    defaultLanguage: z.string().refine((language) => languages.includes(language)),
    userName: textSchema.optional(),
  })
}
