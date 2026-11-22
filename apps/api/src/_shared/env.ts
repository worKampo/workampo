import { z } from 'zod'
import type { AppEnv } from './http/app-env'

const threshold = z.coerce.number().int().positive()
const rateLimits = {
  RATE_LIMIT_CODE_REQUESTS_PER_EMAIL: threshold,
  RATE_LIMIT_CODE_REQUESTS_PER_IP: threshold,
  RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL: threshold,
  RATE_LIMIT_WINDOW_SECONDS: threshold,
}

const envSchema = z.discriminatedUnion('IDENTITY_PROVIDER', [
  z.object({ IDENTITY_PROVIDER: z.literal('fake'), ...rateLimits }),
  z.object({
    IDENTITY_PROVIDER: z.literal('workos'),
    WORKOS_API_KEY: z.string().min(1),
    WORKOS_CLIENT_ID: z.string().min(1),
    ...rateLimits,
  }),
])

export type ParsedEnv = z.infer<typeof envSchema>

// Only the local vars name a provider; stg and prod fall back to the real one.
export function parseEnv(bindings: AppEnv['Bindings']): ParsedEnv {
  return envSchema.parse({ ...bindings, IDENTITY_PROVIDER: bindings.IDENTITY_PROVIDER ?? 'workos' })
}
