import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

const CONSENT = 'https://app.test/api/sessions/google/fake-consent'
const CALLBACK = 'https://app.test/api/sessions/google/callback'

describe('the fake consent page', () => {
  it('navigates to our callback with the code and state, as Google does', async () => {
    const query = new URLSearchParams({ redirect_uri: CALLBACK, code: 'fake-google', state: 's1' })

    const response = await exports.default.fetch(`${CONSENT}?${query}`)

    expect(response.status).toBe(200)
    expect(await response.text()).toContain(
      `content="0;url=${CALLBACK}?code=fake-google&amp;state=s1"`,
    )
  })

  it('refuses to send the browser anywhere but our callback', async () => {
    const elsewhere = ['https://evil.test/api/sessions/google/callback', 'https://app.test/login']

    const responses = await Promise.all(
      elsewhere.map((uri) =>
        exports.default.fetch(`${CONSENT}?${new URLSearchParams({ redirect_uri: uri })}`),
      ),
    )

    for (const response of responses) expect(response.status).toBe(400)
  })
})
