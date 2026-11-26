import type { ReactNode } from 'react'
import { Text } from '../content/text'
import { CardScreen } from './card-screen'

// docs/design/components.md, "System page".
export function SystemPage({
  title,
  body,
  code,
  reference,
  actions,
}: {
  title: ReactNode
  body: ReactNode
  code: ReactNode
  reference?: ReactNode
  actions: ReactNode
}) {
  return (
    <CardScreen title={title} focusTitle>
      <Text tone="muted">{body}</Text>
      <div className="flex flex-col gap-1">
        <Text size="xs" tone="muted">
          {code}
        </Text>
        {reference}
      </div>
      <div className="flex flex-col gap-3">{actions}</div>
    </CardScreen>
  )
}
