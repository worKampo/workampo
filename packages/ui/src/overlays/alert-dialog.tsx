import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

// docs/design/components.md, "Dialog": 480 centred over the scrim; a bottom sheet on phone. No onOpenChange,
// so Esc, the scrim and an outside click have nothing to close: only the caller's actions change `open`.
export function AlertDialog({
  open,
  title,
  description,
  actions,
}: {
  open: boolean
  title: string
  description: string
  actions: ReactNode
}) {
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface pb-safe shadow-(--shadow-modal) sm:inset-0 sm:pb-0 sm:m-auto sm:h-fit sm:w-full sm:max-w-120 sm:rounded-xl"
        >
          <Dialog.Title className="px-6 pt-6 text-base font-semibold text-text">
            {title}
          </Dialog.Title>
          <Dialog.Description className="px-6 pt-4 pb-6 text-body text-text-1">
            {description}
          </Dialog.Description>
          <div className="flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            {actions}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
