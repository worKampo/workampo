export type AppEnv = {
  Bindings: Env & { APP_VERSION?: string; GIT_SHA?: string; SENTRY_DSN?: string }
}

// A version created after the deploy (a `wrangler secret put`) has no tag but keeps GIT_SHA.
export function deployedSha(env: AppEnv['Bindings']): string | undefined {
  return env.CF_VERSION_METADATA.tag || env.GIT_SHA || undefined
}
