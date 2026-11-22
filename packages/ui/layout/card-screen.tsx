import type { ReactNode } from 'react'
import { Logo } from '../brand/logo'
import { Card } from '../content/card'

// docs/design/patterns.md, "Card screens": a card on the chrome at every size, the logo in a
// header above it, at the top on phone so the keyboard does not cover it.
export function CardScreen({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-chrome px-4 py-6 sm:py-16">
      <header className="mx-auto mb-6 max-w-sm">
        <Logo />
      </header>
      <main className="mx-auto max-w-sm">
        <Card className="flex flex-col gap-5">
          <h1 className="text-xl font-semibold text-text">{title}</h1>
          {children}
        </Card>
      </main>
    </div>
  )
}
