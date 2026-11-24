import type { Bindings, ParsedEnv } from '../env'

export type AppEnv = { Bindings: Bindings; Variables: { env: ParsedEnv } }
