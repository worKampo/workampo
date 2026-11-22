export type AppEnv = {
  Bindings: Env & {
    APP_VERSION?: string
    GIT_SHA?: string
    SENTRY_DSN?: string
    WORKOS_API_KEY?: string
    WORKOS_CLIENT_ID?: string
  }
}

// A version created after the deploy (a `wrangler secret put`) has no tag but keeps GIT_SHA.
export function deployedSha(env: AppEnv['Bindings']): string | undefined {
  return env.CF_VERSION_METADATA.tag || env.GIT_SHA || undefined
}
