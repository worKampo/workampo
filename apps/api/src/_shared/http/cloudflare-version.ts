import type { Bindings } from '../env'

// A version created after the deploy (a `wrangler secret put`) has no tag but keeps GIT_SHA.
export function deployedSha(env: Bindings): string | undefined {
  return env.CF_VERSION_METADATA.tag || env.GIT_SHA || undefined
}

export function versionId(env: Bindings): string {
  return env.CF_VERSION_METADATA.id
}
