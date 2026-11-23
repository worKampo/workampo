import type { Hono } from 'hono'
import type { AppEnv } from '../http/app-env'
import { FAKE_PROVIDER_MARK } from './fake-identities'

export const FAKE_CONSENT_PATH = '/api/sessions/google/fake-consent'
const CALLBACK_PATH = '/api/sessions/google/callback'

// Stands in for Google's consent screen: a page, not a redirect, so the browser reaches our
// callback with a new navigation, as it does coming back from Google (@id:access-96-7).
export function mountFakeConsentPage(app: Hono<AppEnv>) {
  app.get(FAKE_CONSENT_PATH, (c) => {
    const { code = '', state = '', redirect_uri: redirectUri = '' } = c.req.query()
    const origin = new URL(c.req.url).origin
    const callback = new URL(redirectUri, origin)

    // Only our own callback: the page must not become an open redirect.
    if (callback.origin !== origin || callback.pathname !== CALLBACK_PATH)
      return c.text('redirect_uri is not our callback', 400)

    callback.search = new URLSearchParams({ code, state }).toString()
    const href = callback.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')

    return c.html(
      `<!doctype html><title>${FAKE_PROVIDER_MARK}</title><meta http-equiv="refresh" content="0;url=${href}">`,
    )
  })
}
