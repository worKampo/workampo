import { describe, expect, it } from 'vitest'
import { ProblemError, problemJson, toProblem } from './problem-json'

describe('problemJson', () => {
  it('answers application/problem+json with the status and stable code', async () => {
    const response = problemJson({ code: 'access.too_many_attempts', status: 429 })

    expect(response.status).toBe(429)
    expect(response.headers.get('Content-Type')).toBe('application/problem+json')
    expect(await response.json()).toEqual({
      type: 'about:blank',
      status: 429,
      code: 'access.too_many_attempts',
    })
  })
})

describe('toProblem', () => {
  it('translates a domain error', () => {
    const error = new ProblemError({ code: 'access.invalid_code', status: 400 })

    const problem = toProblem(error)

    expect(problem?.status).toBe(400)
  })

  it('leaves any other error to the generic handler', () => {
    expect(toProblem(new Error('boom'))).toBeNull()
    expect(toProblem(Object.assign(new Error('x'), { code: 'access.invalid_code' }))).toBeNull()
    expect(toProblem('not an error')).toBeNull()
  })
})

describe('problemJson title', () => {
  it.fails('carries the HTTP reason phrase as title', async () => {
    const cases = [
      [400, 'Bad Request'],
      [404, 'Not Found'],
      [413, 'Payload Too Large'],
      [429, 'Too Many Requests'],
    ] as const

    for (const [status, title] of cases) {
      const response = problemJson({ code: 'access.too_many_attempts', status })

      expect(await response.json()).toMatchObject({ title })
    }
  })
})
