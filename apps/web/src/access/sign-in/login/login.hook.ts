import { zodResolver } from '@hookform/resolvers/zod'
import { useStartCodeSignIn } from '@workampo/app-core/access/sign-in/start-code'
import { startCodeFormSchema } from '@workampo/app-core/access/sign-in/start-code/form'
import { errorKey, errorKeyOf } from '@workampo/app-core/errors'
import type { AccessErrorCode } from '@workampo/domain/access/errors'
import { useForm } from 'react-hook-form'

// The login page asks for an email, or shows the error Google's callback sent back.
export function useLoginPage({
  googleError,
  onCodeSent,
}: {
  googleError: AccessErrorCode | undefined
  onCodeSent: (email: string) => void
}) {
  const startCode = useStartCodeSignIn()
  const form = useForm({ resolver: zodResolver(startCodeFormSchema), defaultValues: { email: '' } })

  const submit = form.handleSubmit(({ email }) =>
    startCode.mutate({ email }, { onSuccess: () => onCodeSent(email) }),
  )

  return { form, submit, isPending: startCode.isPending, messageKey: messageKey() }

  function messageKey() {
    if (form.formState.errors.email) return errorKey('access.invalid_email')
    if (startCode.error) return errorKeyOf(startCode.error)
    if (googleError) return errorKey(googleError)

    return undefined
  }
}
