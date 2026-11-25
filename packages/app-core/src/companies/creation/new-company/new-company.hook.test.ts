import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { problem, type Sent } from '../../../_shared/testing/fake-api'
import { hookWrapper } from '../../../_shared/testing/hook-wrapper'
import { useNewCompanyPage } from './new-company.hook'

type Field = 'name' | 'slug' | 'defaultLanguage' | 'userName'
type NewCompanyPage = ReturnType<typeof useNewCompanyPage>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const URL_OF = 'https://app.test/c/clinica-norte/'

// The API as the page meets it: me, the slug check and the creation, each overridable.
function api({
  name = null,
  available = true,
  create = () =>
    Response.json(
      { id: 'c1', slug: 'clinica-norte', name: 'Clínica Norte', url: URL_OF },
      { status: 201 },
    ),
}: {
  name?: string | null
  available?: boolean
  create?: () => Response
} = {}) {
  return ({ method, url }: Sent) => {
    const { pathname } = new URL(url)
    if (pathname === '/api/me') return Response.json({ id: 'u1', email: 'ana@example.com', name })
    if (pathname === '/api/companies/availability') return Response.json({ available })
    if (pathname === '/api/companies' && method === 'POST') return create()

    return new Response(null, { status: 404 })
  }
}

const posts = (sent: Sent[]) =>
  sent.filter((s) => s.method === 'POST' && s.url.endsWith('/api/companies'))
const checks = (sent: Sent[]) =>
  sent.filter((s) => s.url.includes('/api/companies/availability?slug='))

async function renderPage(answer = api(), onCreated = vi.fn()) {
  const { wrapper, sent, queryClient } = hookWrapper(answer)
  const { result } = renderHook(() => useNewCompanyPage({ onCreated }), { wrapper })

  return { result, sent, onCreated, queryClient }
}

function fill(page: { current: NewCompanyPage }, values: Partial<Record<Field, string>>) {
  act(() => {
    for (const [field, value] of Object.entries(values))
      page.current.form.setValue(field as Field, value, { shouldDirty: true })
  })
}

describe('useNewCompanyPage', () => {
  it('@id:companies-90-2 proposes the slug from the name and finds it available', async () => {
    const { result, sent } = await renderPage()

    fill(result, { name: 'Clínica Norte' })

    await waitFor(() => expect(result.current.form.getValues('slug')).toBe('clinica-norte'))
    await waitFor(() => expect(result.current.slugStatus).toBe('available'))
    expect(checks(sent).at(-1)?.url).toBe(
      'https://app.test/api/companies/availability?slug=clinica-norte',
    )
  })

  it('@id:companies-90-2 stops proposing once the slug is edited', async () => {
    const { result } = await renderPage()
    fill(result, { name: 'Clínica Norte' })
    await waitFor(() => expect(result.current.form.getValues('slug')).toBe('clinica-norte'))

    fill(result, { slug: 'mi-clinica' })
    fill(result, { name: 'Otra Clínica' })

    await waitFor(() => expect(result.current.slugStatus).toBe('available'))
    expect(result.current.form.getValues('slug')).toBe('mi-clinica')
  })

  it('@id:companies-90-2 checks once, 300 ms after the last change', async () => {
    const { result, sent } = await renderPage()

    fill(result, { slug: 'sol-a' })
    fill(result, { slug: 'sol-ab' })
    fill(result, { slug: 'sol-abc' })

    await waitFor(() => expect(result.current.slugStatus).toBe('available'))
    expect(checks(sent).map((s) => s.url)).toEqual([
      'https://app.test/api/companies/availability?slug=sol-abc',
    ])
  })

  it('@id:companies-90-3 a taken slug is not available and the company is not created', async () => {
    const { result, sent } = await renderPage(api({ available: false }))
    fill(result, { name: 'Clínica Norte', userName: 'Ana' })
    await waitFor(() => expect(result.current.slugStatus).toBe('taken'))

    await act(() => result.current.submit())

    expect(posts(sent)).toEqual([])
  })

  it('@id:companies-90-3 sending a taken slug moves focus to it', async () => {
    const { result } = await renderPage(api({ available: false }))
    const setFocus = vi.spyOn(result.current.form, 'setFocus')
    fill(result, { name: 'Clínica Norte', userName: 'Ana' })
    await waitFor(() => expect(result.current.slugStatus).toBe('taken'))

    await act(() => result.current.submit())

    expect(setFocus).toHaveBeenCalledWith('slug')
  })

  it('@id:companies-90-4 a reserved slug says so without asking the API, and is not created', async () => {
    const { result, sent } = await renderPage()
    fill(result, { name: 'Reservada', slug: 'api', userName: 'Ana' })

    await waitFor(() => expect(result.current.slugStatus).toBe('reserved'))
    await act(() => result.current.submit())

    expect(checks(sent)).toEqual([])
    expect(posts(sent)).toEqual([])
  })

  it('@id:companies-90-5 an invalid slug says so without asking the API, and is not created', async () => {
    for (const slug of ['ab', 'mi--empresa', '-norte', 'norte-stg']) {
      const { result, sent } = await renderPage()
      fill(result, { name: 'Formato', slug, userName: 'Ana' })

      await waitFor(() => expect(result.current.slugStatus, slug).toBe('invalid'))
      await act(() => result.current.submit())

      expect(checks(sent), slug).toEqual([])
      expect(posts(sent), slug).toEqual([])
    }
  })

  it('@id:companies-90-8 asks for my name when my account has none', async () => {
    const { result } = await renderPage(api({ name: null }))

    await waitFor(() => expect(result.current.askUserName).toBe(true))
  })

  it('@id:companies-90-9 does not ask for my name, nor send one, when my account has it', async () => {
    const { result, sent } = await renderPage(api({ name: 'Ana' }))
    await waitFor(() => expect(sent.some((s) => s.url.endsWith('/api/me'))).toBe(true))
    await waitFor(() => expect(result.current.askUserName).toBe(false))
    fill(result, { name: 'Clínica Norte', defaultLanguage: 'es' })
    await waitFor(() => expect(result.current.slugStatus).toBe('available'))

    await act(() => result.current.submit())

    expect(posts(sent)).toHaveLength(1)
    expect(posts(sent)[0]?.body).not.toHaveProperty('userName')
  })

  it('@id:companies-90-1 creates the company with one idempotency key and hands over its URL', async () => {
    const { result, sent, onCreated } = await renderPage(api({ name: null }))
    fill(result, { name: 'Clínica Norte', defaultLanguage: 'es', userName: 'Ana' })
    await waitFor(() => expect(result.current.slugStatus).toBe('available'))

    await act(() => result.current.submit())

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(URL_OF))
    expect(posts(sent)[0]?.body).toEqual({
      name: 'Clínica Norte',
      slug: 'clinica-norte',
      defaultLanguage: 'es',
      userName: 'Ana',
    })
    expect(posts(sent)[0]?.headers.get('Idempotency-Key')).toMatch(UUID)
  })

  it('@id:companies-90-11 a retry after a failure sends the same idempotency key', async () => {
    let calls = 0
    const create = () =>
      ++calls === 1
        ? new Response('down', { status: 503 })
        : Response.json(
            { id: 'c1', slug: 'clinica-norte', name: 'Clínica Norte', url: URL_OF },
            { status: 201 },
          )
    const { result, sent, onCreated } = await renderPage(api({ create }))
    fill(result, { name: 'Clínica Norte', userName: 'Ana' })
    await waitFor(() => expect(result.current.slugStatus).toBe('available'))

    await act(() => result.current.submit())
    await act(() => result.current.submit())

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    const keys = posts(sent).map((s) => s.headers.get('Idempotency-Key'))
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(UUID)
    expect(keys[1]).toBe(keys[0])
  })

  it('@id:companies-90-11 a retry completes the half-created company that now holds the slug', async () => {
    let created = 0
    const answer = api({ create: () => new Response('down', { status: 503 }) })
    const halfCreated = (sent: Sent) => {
      const { pathname } = new URL(sent.url)
      if (pathname === '/api/companies/availability') return Response.json({ available: !created })
      if (pathname === '/api/companies' && sent.method === 'POST' && created++ > 0)
        return Response.json(
          { id: 'c1', slug: 'clinica-norte', name: 'Clínica Norte', url: URL_OF },
          { status: 201 },
        )

      return answer(sent)
    }
    const { result, sent, onCreated, queryClient } = await renderPage(halfCreated)
    fill(result, { name: 'Clínica Norte', userName: 'Ana' })
    await waitFor(() => expect(result.current.slugStatus).toBe('available'))
    await act(() => result.current.submit())
    await waitFor(() => expect(result.current.messageKey).toBe('common:errors.unexpected'))

    await act(() => queryClient.invalidateQueries())
    await waitFor(() => expect(result.current.slugStatus).toBe('taken'))
    await act(() => result.current.submit())

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(URL_OF))
    const keys = posts(sent).map((s) => s.headers.get('Idempotency-Key'))
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
  })

  it('@id:companies-90-10 a slug taken meanwhile shows as not available', async () => {
    const { result, onCreated } = await renderPage(
      api({ create: () => problem({ status: 409, code: 'companies.slug_taken' }) }),
    )
    fill(result, { name: 'Sol', slug: 'sol', userName: 'Ana' })
    await waitFor(() => expect(result.current.slugStatus).toBe('available'))

    await act(() => result.current.submit())

    await waitFor(() => expect(result.current.slugStatus).toBe('taken'))
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('@id:companies-90-8 a missing name shows at its own field, not as a screen message', async () => {
    const { result, sent } = await renderPage(api({ name: null }))
    await waitFor(() => expect(result.current.askUserName).toBe(true))
    fill(result, { name: '   ', slug: 'sol', userName: '' })

    await act(() => result.current.submit())

    expect(result.current.fieldErrorKeys).toEqual({
      name: 'companies:new_company.name_required',
      defaultLanguage: undefined,
      userName: 'companies:errors.user_name_required',
    })
    expect(result.current.messageKey).toBeUndefined()
    expect(posts(sent)).toEqual([])
  })
})
