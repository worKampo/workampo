import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { errorKey, errorKeyOf } from '../../../_shared/error-key'
import { useStartCodeSignIn } from '../start-code/start-code.hook'
import { verifyCodeFormSchema } from '../verify-code/verify-code.form'
import { useVerifyCode } from '../verify-code/verify-code.hook'

// The code page checks a code or sends a new one; each clears the other's error.
export function useCodePage({ email, onSignedIn }: { email: string; onSignedIn: () => void }) {
  const verify = useVerifyCode()
  const resend = useStartCodeSignIn()
  const form = useForm({ resolver: zodResolver(verifyCodeFormSchema), defaultValues: { code: '' } })

  const submit = form.handleSubmit(({ code }) => {
    resend.reset()
    verify.mutate({ email, code }, { onSuccess: onSignedIn })
  })

  const resendCode = () => {
    verify.reset()
    resend.mutate({ email })
  }

  return {
    form,
    submit,
    resendCode,
    isVerifying: verify.isPending,
    isResending: resend.isPending,
    isResent: resend.isSuccess,
    messageKey: messageKey(),
  }

  function messageKey() {
    if (form.formState.errors.code) return errorKey('access.invalid_code')
    if (verify.error) return errorKeyOf(verify.error)
    if (resend.error) return errorKeyOf(resend.error)

    return undefined
  }
}
