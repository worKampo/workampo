import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react'

const FIELDS =
  'input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled)'

// Our own validation (Zod) shows the messages, so the browser's is off; fields stack 16 px apart.
// A form is the page's task, so its first field takes the focus (components.md, Forms); a form
// that is not, such as a list's filters, passes focusFirstField={false}.
export function Form({
  focusFirstField = true,
  ...props
}: Omit<ComponentProps<'form'>, 'className' | 'noValidate' | 'ref'> & {
  focusFirstField?: boolean
}) {
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!focusFirstField) return
    // A field that is not rendered refuses the focus: go on to the next one.
    for (const field of ref.current?.querySelectorAll<HTMLElement>(FIELDS) ?? []) {
      if (field.closest('[hidden], [inert]')) continue
      field.focus()
      if (document.activeElement === field) return
    }
  }, [focusFirstField])

  return <form {...props} ref={ref} noValidate className="flex flex-col gap-4" />
}

// The form's buttons, right-aligned in reading order (secondary, then primary); they wrap on a narrow screen.
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>
}
