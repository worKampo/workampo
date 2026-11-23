import { type ReactNode, useId } from 'react'

type ControlProps = { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }

// The label, the help or the error, and the ids that tie them to the control.
export function Field({
  label,
  help,
  error,
  children,
}: {
  label: ReactNode
  help?: ReactNode
  error?: ReactNode
  children: (control: ControlProps) => ReactNode
}) {
  const id = useId()
  const message = error ?? help
  const messageId = `${id}-message`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs leading-4 font-medium text-text-1">
        {label}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true } : {}),
        ...(message ? { 'aria-describedby': messageId } : {}),
      })}
      {message && (
        <p
          id={messageId}
          className={error ? 'text-xs leading-4 text-neg' : 'text-xs leading-4 text-text-2'}
        >
          {message}
        </p>
      )}
    </div>
  )
}
