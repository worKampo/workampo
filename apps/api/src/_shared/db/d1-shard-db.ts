import { drizzle } from 'drizzle-orm/d1'

const SHARD_BINDING = /^DB_SHARD_[1-9][0-9]*$/

// The only reader of the DB_SHARD_* bindings: a missing or foreign name throws, never another shard.
export function shardDb(env: object, bindingName: string) {
  const binding = SHARD_BINDING.test(bindingName)
    ? (env as Record<string, D1Database | undefined>)[bindingName]
    : undefined
  if (!binding) throw new Error(`No shard binding named ${JSON.stringify(bindingName)}`)

  return drizzle(binding, { casing: 'snake_case' })
}
