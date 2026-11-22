import type { Bindings, ParsedEnv } from '../env'

export type AppEnv = { Bindings: Bindings; Variables: { env: ParsedEnv } }

// A version created after the deploy (a `wrangler secret put`) has no tag but keeps GIT_SHA.
export function deployedSha(env: Bindings): string | undefined {
  return env.CF_VERSION_METADATA.tag || env.GIT_SHA || undefined
}
