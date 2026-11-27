import { type ReactNode, useEffect, useId, useRef } from 'react'

// docs/design/components.md, "Dialog": 480 centred over the scrim; a bottom sheet on phone. A native
// modal <dialog>: showModal makes the page inert and traps the focus with no injected styles, which the
// CSP would block. Esc and the scrim close nothing: only the caller's actions change `open`.
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
  const dialog = useRef<HTMLDialogElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    dialog.current?.showModal()
    actionsRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => event.preventDefault()}
      // Chrome closes anyway on a repeated Esc without user activation; it reopens at once.
      onClose={() => dialog.current?.showModal()}
      className="mx-0 mt-auto mb-0 h-fit max-h-none w-full max-w-none rounded-t-2xl border-0 bg-surface p-0 pb-safe text-text shadow-(--shadow-modal) backdrop:bg-scrim sm:m-auto sm:max-w-120 sm:rounded-xl sm:pb-0"
    >
      <h2 id={titleId} className="px-6 pt-6 text-base font-semibold text-text">
        {title}
      </h2>
      <p id={descriptionId} className="px-6 pt-4 pb-6 text-body text-text-1">
        {description}
      </p>
      <div
        ref={actionsRef}
        className="flex flex-col gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end"
      >
        {actions}
      </div>
    </dialog>
  )
}
