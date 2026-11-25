import { z } from 'zod'

const MAX_PAGE_SIZE = 100

// Digits only: Number() would also take '', ' 1', '1e3' and '0x10'.
const positiveInteger = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)

// ADR-0078 rule 5.2. Not strict: other query fields are the endpoint's filters, never this schema's.
export const pageQuerySchema = z.object({
  page: positiveInteger.refine(Number.isSafeInteger).default(1),
  pageSize: positiveInteger.transform((size) => Math.min(size, MAX_PAGE_SIZE)).default(50),
})

export type PageQuery = z.infer<typeof pageQuerySchema>
