import { createMiddleware } from 'hono/factory'
import { z } from 'zod'

const optionalText = z.string().optional()
const threshold = z.coerce.number().int().positive()
const common = {
  ENABLE_DEBUG_ERROR: optionalText,
  RATE_LIMIT_CODE_REQUESTS_PER_EMAIL: threshold,
  RATE_LIMIT_CODE_REQUESTS_PER_IP: threshold,
  RATE_LIMIT_CODE_ATTEMPTS_PER_EMAIL: threshold,
  RATE_LIMIT_COMPANY_CREATES_PER_USER: threshold,
  RATE_LIMIT_COMPANY_CREATES_PER_IP: threshold,
  RATE_LIMIT_WINDOW_SECONDS: threshold,
  TENANT_ROUTING: z.enum(['path', 'subdomain']),
  PUBLIC_BASE_URL: z.url(),
  TENANT_HOST_SUFFIX: optionalText,
}

// Variables and secrets the Worker reads beyond what `wrangler types` generates in Env.
const extraVariablesSchema = z.object({
  APP_VERSION: optionalText,
  GIT_SHA: optionalText,
  SENTRY_DSN: optionalText,
  WORKOS_API_KEY: optionalText,
  WORKOS_CLIENT_ID: optionalText,
})

const envSchema = z
  .discriminatedUnion('IDENTITY_PROVIDER', [
    z.object({ IDENTITY_PROVIDER: z.literal('fake'), ...common }),
    z.object({
      IDENTITY_PROVIDER: z.literal('workos'),
      WORKOS_API_KEY: z.string().min(1),
      WORKOS_CLIENT_ID: z.string().min(1),
      ...common,
    }),
  ])
  .refine((env) => env.TENANT_ROUTING !== 'subdomain' || !!env.TENANT_HOST_SUFFIX, {
    path: ['TENANT_HOST_SUFFIX'],
    message: 'TENANT_HOST_SUFFIX is required when TENANT_ROUTING is subdomain',
  })

export type Bindings = Env & z.input<typeof extraVariablesSchema>

export type ParsedEnv = z.infer<typeof envSchema>

// Only the local vars name a provider; stg and prod fall back to the real one.
export function parseEnv(bindings: Bindings): ParsedEnv {
  return envSchema.parse({ ...bindings, IDENTITY_PROVIDER: bindings.IDENTITY_PROVIDER ?? 'workos' })
}

// Parsed once per request, for the routes that need the configuration (/health does not).
export const parsedEnv = createMiddleware<{ Bindings: Bindings; Variables: { env: ParsedEnv } }>(
  async (c, next) => {
    c.set('env', parseEnv(c.env))
    await next()
  },
)
