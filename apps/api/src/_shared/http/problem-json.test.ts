import { describe, expect, it } from 'vitest'
import { problemJson, toProblem } from './problem-json'

describe('problemJson', () => {
  it('answers application/problem+json with the status and stable code of the error', async () => {
    const response = problemJson('access.too_many_attempts')

    expect(response.status).toBe(429)
    expect(response.headers.get('Content-Type')).toBe('application/problem+json')
    expect(await response.json()).toEqual({
      type: 'about:blank',
      status: 429,
      code: 'access.too_many_attempts',
    })
  })

  it.each([
    ['access.invalid_email', 400],
    ['access.invalid_code', 400],
    ['access.too_many_code_requests', 429],
    ['access.email_not_verified', 403],
    ['access.contact_support', 409],
    ['access.unauthenticated', 401],
  ] as const)('%s answers %i', (code, status) => {
    expect(problemJson(code).status).toBe(status)
  })
})

describe('toProblem', () => {
  it('translates a thrown error that carries a known code', () => {
    const error = Object.assign(new Error('wrong code'), { code: 'access.invalid_code' })

    expect(toProblem(error)?.status).toBe(400)
  })

  it('leaves any other error to the generic handler', () => {
    expect(toProblem(new Error('boom'))).toBeNull()
    expect(toProblem(Object.assign(new Error('x'), { code: 'access.unknown' }))).toBeNull()
    expect(toProblem('not an error')).toBeNull()
  })
})
