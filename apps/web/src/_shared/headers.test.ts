import { expect, it } from 'vitest'
import headers from '../../public/_headers?raw'

it('@id:access-96-16 every page has a strict same-origin CSP and no-sniff', () => {
  const page = headersFor('/*')

  expect(page).toContain(
    "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  )
  expect(page).toContain('X-Content-Type-Options: nosniff')
  expect(page).toContain('Referrer-Policy: same-origin')
})

it('hashed assets are immutable and index.html is never cached', () => {
  const assets = headersFor('/assets/*')
  const index = headersFor('/index.html')

  expect(assets).toEqual(['Cache-Control: public, max-age=31536000, immutable'])
  expect(index).toEqual(['Cache-Control: no-cache'])
})

// The header lines under one path of the Cloudflare _headers file.
function headersFor(path: string) {
  const blocks = headers.split(/\n(?=\S)/).map((block) => block.trim().split('\n'))
  const block = blocks.find(([line]) => line === path) ?? []

  return block.slice(1).map((line) => line.trim())
}
