import { Button } from '@workampo/ui/actions'
import { Banner } from '@workampo/ui/feedback'
import { AlertDialog } from '@workampo/ui/overlays'
import { useState } from 'react'

// Texts come from NewVersionPrompts, so this chunk shares nothing with the screens but packages/ui.
type Labels = { text: string; reload: string }

// Inside the status that NewVersionPrompts always renders, so it takes no role of its own (E5).
export function NewVersionNotice({ labels, reload }: { labels: Labels; reload: () => void }) {
  return (
    <Banner variant="info" floating role="none">
      {labels.text}{' '}
      <Button size="small" variant="secondary" onClick={reload}>
        {labels.reload}
      </Button>
    </Banner>
  )
}

// Only its button reloads (R7); it stays busy until the page unloads (E6).
export function OutdatedDialog({
  labels,
  reload,
}: {
  labels: Labels & { title: string }
  reload: () => void
}) {
  const [isReloading, setIsReloading] = useState(false)

  return (
    <AlertDialog
      open
      title={labels.title}
      description={labels.text}
      actions={
        <Button
          aria-busy={isReloading}
          onClick={() => {
            setIsReloading(true)
            reload()
          }}
        >
          {labels.reload}
        </Button>
      }
    />
  )
}
