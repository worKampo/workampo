import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createApiClient } from '@workampo/app-core/api-client'
import { shouldRetry } from '@workampo/app-core/errors'
import { watchSessionExpiry } from '@workampo/app-core/session-expiry'
import { routeTree } from '../../route-tree'
import { AppProviders } from '../providers/app-providers'
import { createAppRouter } from '../router/create-app-router'

// Where a reload goes, recorded: jsdom cannot spy or redefine window.location.
export type LocationPort = { origin: string; assign: (url: string) => void; reload: () => void }

export type Timers = {
  setTimeout: (run: () => void, ms: number) => number
  clearTimeout: (handle: number) => void
}

// The whole app at `path`, with the API answered by `answer` instead of the network. `version`,
// `buildDate`, `storage` (sessionStorage), `location` and `timers` play the new-version checks.
export function renderApp({
  path,
  answer,
}: {
  path: string
  answer: (request: Request) => Response | Promise<Response>
  version?: string
  buildDate?: string
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  location?: LocationPort
  timers?: Timers
}) {
  const apiClient = createApiClient({
    baseUrl: 'https://app.test',
    clientVersion: 'test',
    fetch: async (input, init) => answer(new Request(input, init)),
  })
  // As main.tsx: a 4xx is final, so an expired session shows at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } })
  const router = createAppRouter({
    routeTree,
    context: { queryClient, apiClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  watchSessionExpiry(queryClient, () => router.invalidate())
  render(<AppProviders queryClient={queryClient} apiClient={apiClient} router={router} />)

  return { router, queryClient }
}

export function problem({
  status,
  code,
  reference,
}: {
  status: number
  code: string
  reference?: string
}) {
  return Response.json(
    { type: 'about:blank', status, code, ...(reference && { reference }) },
    { status },
  )
}

// A session that ends on the server after the app cached me: later calls to /api/me answer 401 too.
export function sessionEndsAfterFirstMe(
  answer: (request: Request) => Response | Promise<Response>,
) {
  let meCalls = 0
  return (request: Request) =>
    new URL(request.url).pathname === '/api/me' && meCalls++ > 0
      ? problem({ status: 401, code: 'access.unauthenticated' })
      : answer(request)
}

// A location that only records: reloads are counted, never run.
export function recordingLocation(origin = window.location.origin) {
  const assigned: string[] = []
  const reloads = { count: 0 }
  const location: LocationPort = {
    origin,
    assign: (url) => assigned.push(url),
    reload: () => {
      reloads.count++
    },
  }

  return { location, assigned, reloads }
}

// A sessionStorage of its own per test; `failing` throws on every call, as a blocked storage does.
export function memoryStorage({ failing = false } = {}) {
  const values = new Map<string, string>()
  const fail = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  }

  return {
    getItem: (key: string) => (failing ? fail() : (values.get(key) ?? null)),
    setItem: (key: string, value: string) => (failing ? fail() : void values.set(key, value)),
  }
}

// Timers that move only when the test says, so 30 minutes pass without fake timers over the app.
export function manualTimers() {
  let now = 0
  let lastHandle = 0
  const pending = new Map<number, { at: number; run: () => void }>()
  const timers: Timers = {
    setTimeout: (run, ms) => {
      pending.set(++lastHandle, { at: now + ms, run })
      return lastHandle
    },
    clearTimeout: (handle) => {
      pending.delete(handle)
    },
  }
  const advance = (ms: number) => {
    now += ms
    for (const [handle, timer] of [...pending].sort(([, a], [, b]) => a.at - b.at)) {
      if (timer.at > now) continue
      pending.delete(handle)
      timer.run()
    }
  }

  return { timers, advance }
}

// Every answer of `answer` with the version headers a deploy would add.
export function servedVersion(
  answer: (request: Request) => Response | Promise<Response>,
  headers: () => Record<string, string>,
) {
  return async (request: Request) => {
    const response = await answer(request)
    const withHeaders = new Response(response.body, response)
    for (const [name, value] of Object.entries(headers())) withHeaders.headers.set(name, value)

    return withHeaders
  }
}
