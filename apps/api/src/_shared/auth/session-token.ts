import { randomToken } from '../crypto/random-token'
import { sha256Hex } from '../crypto/sha256-hex'

// The cookie carries the token; the database keeps only its hash, so a copy of it opens no session.
export const newSessionToken = randomToken

export const hashSessionToken = sha256Hex
