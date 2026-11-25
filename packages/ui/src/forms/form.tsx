import type { ComponentProps, ReactNode } from 'react'

// Our own validation (Zod) shows the messages, so the browser's is off; fields stack 16 px apart.
export function Form(props: Omit<ComponentProps<'form'>, 'className' | 'noValidate'>) {
  return <form {...props} noValidate className="flex flex-col gap-4" />
}

// The form's buttons, right-aligned in reading order (secondary, then primary); they wrap on a narrow screen.
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>
}
