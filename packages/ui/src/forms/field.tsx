import { type ReactNode, useId } from 'react'
import { cx } from '../_shared/cx'

type ControlProps = { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }

// The label, a fixed hint, the status (error, success or help) and the ids that tie them to the control.
export function Field({
  label,
  hint,
  help,
  success,
  error,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  help?: ReactNode
  success?: ReactNode
  error?: ReactNode
  children: (control: ControlProps) => ReactNode
}) {
  const id = useId()
  // || and not ??: a false or empty error or success means none, so the help still shows.
  const message = error || success || help
  const messageId = `${id}-message`
  const hintId = `${id}-hint`
  const describedBy = [message && messageId, hint && hintId].filter(Boolean).join(' ')
  const positive = !error && Boolean(success)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs leading-4 font-medium text-text-1">
        {label}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {hint && (
        <p id={hintId} className="text-xs leading-4 text-text-2">
          {hint}
        </p>
      )}
      {/* Always rendered: a live region added together with its text is often not announced. */}
      <p
        id={messageId}
        aria-live="polite"
        className={cx(
          'text-xs leading-4',
          Boolean(error) && 'flex items-center gap-1 text-neg',
          positive && 'flex items-center gap-1 text-pos',
          !(error || positive) && 'text-text-2',
          // Empty, it must not add the column gap under the control.
          !message && '-mt-1.5',
        )}
      >
        {/* The state is never told by colour alone (WCAG 1.4.1). */}
        {Boolean(error) && (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3.5M8 11h.01" />
          </svg>
        )}
        {positive && (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="size-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
        )}
        {message}
      </p>
    </div>
  )
}
