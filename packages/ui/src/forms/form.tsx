import type { ComponentProps } from 'react'

// Our own validation (Zod) shows the messages, so the browser's is off; fields stack 16 px apart.
export function Form(props: Omit<ComponentProps<'form'>, 'className' | 'noValidate'>) {
  return <form {...props} noValidate className="flex flex-col gap-4" />
}
