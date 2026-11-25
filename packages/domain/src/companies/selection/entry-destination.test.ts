import { describe, expect, it } from 'vitest'

// entry-destination.ts arrives with the domain rules task; a non-literal path keeps typecheck green
// until then. Once it exists, import it statically.
const ENTRY_DESTINATION: string = './entry-destination'
type Item = { name: string; slug: string; url: string }
type Destination = { kind: 'create' } | { kind: 'choose' } | { kind: 'company'; url: string }
type EntryDestinationModule = {
  entryDestination: (page: { items: Item[]; total: number }) => Destination
}
const load = (): Promise<EntryDestinationModule> => import(ENTRY_DESTINATION)

const item = (slug: string): Item => ({
  name: slug,
  slug,
  url: `https://app.test/c/${slug}/`,
})

describe('entryDestination', () => {
  it.fails('@id:companies-91-1 with one company it is that company, by its url', async () => {
    const { entryDestination } = await load()

    expect(entryDestination({ items: [item('northwind')], total: 1 })).toEqual({
      kind: 'company',
      url: 'https://app.test/c/northwind/',
    })
  })

  it.fails('@id:companies-91-1 the url is the one the list gives, even on another host', async () => {
    const { entryDestination } = await load()
    const onSubdomain = { ...item('northwind'), url: 'https://northwind.workampo.test/' }

    expect(entryDestination({ items: [onSubdomain], total: 1 })).toEqual({
      kind: 'company',
      url: 'https://northwind.workampo.test/',
    })
  })

  it.fails('@id:companies-91-2 with several companies it is the picker', async () => {
    const { entryDestination } = await load()

    expect(
      entryDestination({
        items: [item('northwind'), item('sol-bakery'), item('clinica-norte')],
        total: 3,
      }),
    ).toEqual({ kind: 'choose' })
  })

  it.fails('@id:companies-91-2 it counts the total, not the rows of the page', async () => {
    const { entryDestination } = await load()

    expect(entryDestination({ items: [item('northwind')], total: 101 })).toEqual({ kind: 'choose' })
  })

  it.fails('@id:companies-91-3 with no company it is the creation form', async () => {
    const { entryDestination } = await load()

    expect(entryDestination({ items: [], total: 0 })).toEqual({ kind: 'create' })
  })
})
