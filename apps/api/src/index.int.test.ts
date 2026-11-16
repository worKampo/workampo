import { exports } from 'cloudflare:workers'
import { expect, it } from 'vitest'

it('answers /health inside workerd', async () => {
  const response = await exports.default.fetch('https://app.test/health')

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: 'broken-on-purpose' })
})
