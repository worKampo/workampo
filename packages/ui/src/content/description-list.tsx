import type { ReactNode } from 'react'

type Item = { term: ReactNode; details: ReactNode; dir?: 'ltr' | 'rtl' | 'auto' }

// Term and details side by side, wrapping on a narrow screen; `dir` fixes the details' direction (an address).
export function DescriptionList({ items }: { items: Item[] }) {
  return (
    <dl className="flex flex-col gap-1 text-sm">
      {items.map(({ term, details, dir }, index) => (
        <div key={index} className="flex flex-wrap gap-x-3">
          <dt className="text-text-2">{term}</dt>
          <dd dir={dir} className="wrap-anywhere text-text">
            {details}
          </dd>
        </div>
      ))}
    </dl>
  )
}
