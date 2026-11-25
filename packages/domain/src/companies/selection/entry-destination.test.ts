import { describe, expect, it } from 'vitest'

import { entryDestination } from './entry-destination'

type Item = { name: string; slug: string; url: string }

const item = (slug: string): Item => ({
  name: slug,
  slug,
  url: `https://app.test/c/${slug}/`,
})

describe('entryDestination', () => {
  it('@id:companies-91-1 with one company it is that company, by its url', () => {
    expect(entryDestination({ items: [item('northwind')], total: 1 })).toEqual({
      kind: 'company',
      url: 'https://app.test/c/northwind/',
    })
  })

  it('@id:companies-91-1 the url is the one the list gives, even on another host', () => {
    const onSubdomain = { ...item('northwind'), url: 'https://northwind.workampo.test/' }

    expect(entryDestination({ items: [onSubdomain], total: 1 })).toEqual({
      kind: 'company',
      url: 'https://northwind.workampo.test/',
    })
  })

  it('@id:companies-91-2 with several companies it is the picker', () => {
    expect(
      entryDestination({
        items: [item('northwind'), item('sol-bakery'), item('clinica-norte')],
        total: 3,
      }),
    ).toEqual({ kind: 'choose' })
  })

  it('@id:companies-91-2 it counts the total, not the rows of the page', () => {
    expect(entryDestination({ items: [item('northwind')], total: 101 })).toEqual({ kind: 'choose' })
  })

  it('@id:companies-91-3 with no company it is the creation form', () => {
    expect(entryDestination({ items: [], total: 0 })).toEqual({ kind: 'create' })
  })
})
