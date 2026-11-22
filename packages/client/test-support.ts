import { createApiClient } from './api-client'

export type Sent = { method: string; url: string; headers: Headers; body: unknown }

// A fetch that answers like our API, recording what the client sent: never a module mock.
export function fakeApi(answer: (sent: Sent) => Response) {
  const sent: Sent[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const text = await request.text()
    const entry = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: text ? JSON.parse(text) : undefined,
    }
    sent.push(entry)

    return answer(entry)
  }
  const client = createApiClient({ baseUrl: 'https://app.test', clientVersion: 'v1', fetch })

  return { client, sent }
}

export function problem({ status, code }: { status: number; code: string }) {
  return new Response(JSON.stringify({ type: 'about:blank', status, code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
