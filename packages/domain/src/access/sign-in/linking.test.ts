import { describe, expect, it } from 'vitest'
import type { VerifiedIdentity } from '../../_shared/identity'
import { decideSignIn } from './linking'

const identity = (overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity => ({
  provider: 'workos',
  subject: 'user_1',
  email: 'ana@example.com',
  isEmailVerified: true,
  ...overrides,
})
const ana = { id: 'user-ana', email: 'ana@example.com' }
const other = { id: 'user-other', email: 'other@example.com' }

describe('decideSignIn', () => {
  it('@id:access-96-2 a new identity with a free email creates the user', () => {
    expect(decideSignIn({ identity: identity(), userBySubject: null, userByEmail: null })).toEqual({
      kind: 'create',
      email: 'ana@example.com',
    })
  })

  it('@id:access-96-2 the email of a new user is stored normalised', () => {
    expect(
      decideSignIn({
        identity: identity({ email: ' Ana@Example.com' }),
        userBySubject: null,
        userByEmail: null,
      }),
    ).toEqual({ kind: 'create', email: 'ana@example.com' })
  })

  it('@id:access-96-8 a linked identity opens its own user', () => {
    expect(decideSignIn({ identity: identity(), userBySubject: ana, userByEmail: ana })).toEqual({
      kind: 'open',
      userId: 'user-ana',
    })
  })

  it('@id:access-96-9 an identity without a verified email is refused, linked or not', () => {
    for (const userBySubject of [null, ana])
      expect(
        decideSignIn({
          identity: identity({ isEmailVerified: false }),
          userBySubject,
          userByEmail: null,
        }),
      ).toEqual({ kind: 'refuse', code: 'access.email_not_verified' })
  })

  it('@id:access-96-10 a new identity with the email of another user is refused, never linked', () => {
    expect(decideSignIn({ identity: identity(), userBySubject: null, userByEmail: ana })).toEqual({
      kind: 'refuse',
      code: 'access.contact_support',
    })
  })

  it('@id:access-96-11 a new verified email of a linked identity is stored', () => {
    expect(
      decideSignIn({
        identity: identity({ email: 'Ana.Nueva@example.com' }),
        userBySubject: ana,
        userByEmail: null,
      }),
    ).toEqual({ kind: 'open', userId: 'user-ana', newEmail: 'ana.nueva@example.com' })
  })

  it('@id:access-96-11 the same email in another case is not a change', () => {
    expect(
      decideSignIn({
        identity: identity({ email: 'ANA@example.com' }),
        userBySubject: ana,
        userByEmail: ana,
      }),
    ).toEqual({ kind: 'open', userId: 'user-ana' })
  })

  it('@id:access-96-12 a new verified email that belongs to another user changes nothing', () => {
    expect(
      decideSignIn({
        identity: identity({ email: 'other@example.com' }),
        userBySubject: ana,
        userByEmail: other,
      }),
    ).toEqual({ kind: 'refuse', code: 'access.contact_support' })
  })
})
