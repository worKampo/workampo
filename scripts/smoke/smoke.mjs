// Read-only smoke: GET <url>/health until it serves the expected SHA. Usage: smoke.mjs <url> <expected-sha>
import { pathToFileURL } from 'node:url'

const TIMEOUT_MS = 3 * 60 * 1000
const RETRY_DELAY_MS = 10 * 1000
const REQUEST_TIMEOUT_MS = 10 * 1000

export function checkHealth(status, body, expectedSha) {
  if (status !== 200) return { ok: false, reason: `status ${status}` }
  if (body?.status !== 'ok')
    return { ok: false, reason: `status field is ${JSON.stringify(body?.status)}` }
  if (body.sha !== expectedSha)
    return { ok: false, reason: `sha is ${JSON.stringify(body.sha)}, expected ${expectedSha}` }
  return { ok: true, reason: 'healthy' }
}

async function attempt(url, expectedSha) {
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const body = await response.json().catch(() => null)
    return checkHealth(response.status, body, expectedSha)
  } catch (error) {
    return { ok: false, reason: `request failed: ${error.message}` }
  }
}

export async function smoke(url, expectedSha) {
  const deadline = Date.now() + TIMEOUT_MS
  for (let n = 1; ; n++) {
    const result = await attempt(url, expectedSha)
    console.log(`attempt ${n}: ${result.ok ? 'ok' : 'fail'} (${result.reason})`)
    if (result.ok) return true
    if (Date.now() + RETRY_DELAY_MS > deadline) return false
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [url, sha] = process.argv.slice(2)
  if (!url || !sha) {
    console.error('Usage: smoke.mjs <url> <expected-sha>')
    process.exit(1)
  }
  const passed = await smoke(url, sha)
  console.log(
    passed ? `smoke passed: ${url} serves ${sha}` : `smoke failed: ${url} did not serve ${sha}`,
  )
  process.exit(passed ? 0 : 1)
}
