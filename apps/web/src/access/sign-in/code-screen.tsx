import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate, useRouterState } from '@tanstack/react-router'
import { codeFormSchema } from '@workampo/app-core/access/sign-in/sign-in-forms'
import { useStartCodeSignIn, useVerifyCode } from '@workampo/app-core/access/sign-in/sign-in-hooks'
import { Button } from '@workampo/ui/actions'
import { Field, Input } from '@workampo/ui/forms'
import { CardScreen } from '@workampo/ui/layout'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { errorMessageKey } from '../error-message'

// After a reload the email is gone (it never travels in the URL): back to /login.
export function CodeScreen() {
  const email = useRouterState({ select: (state) => state.location.state.signInEmail })
  if (!email) return <Navigate to="/login" />

  return <CodeForm email={email} />
}

function CodeForm({ email }: { email: string }) {
  const { t } = useTranslation(['access', 'common'])
  const navigate = useNavigate()
  const verify = useVerifyCode()
  const resend = useStartCodeSignIn()
  const form = useForm({ resolver: zodResolver(codeFormSchema), defaultValues: { code: '' } })

  const submit = form.handleSubmit(({ code }) => {
    resend.reset()
    verify.mutate({ email, code }, { onSuccess: () => navigate({ to: '/' }) })
  })

  const resendCode = () => {
    verify.reset()
    resend.mutate({ email })
  }

  return (
    <CardScreen title={t('code.title')}>
      <p className="text-sm text-text-1">
        <Trans
          t={t}
          i18nKey="code.sent_to"
          values={{ email }}
          components={{ strong: <strong /> }}
        />
      </p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field
          label={t('code.code_label')}
          error={message()}
          help={resend.isSuccess ? t('code.resent') : undefined}
        >
          {(control) => (
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              {...control}
              {...form.register('code')}
            />
          )}
        </Field>
        <Button type="submit" disabled={verify.isPending}>
          {t('code.submit')}
        </Button>
        <Button variant="secondary" onClick={resendCode} disabled={resend.isPending}>
          {t('code.resend')}
        </Button>
      </form>
      <Link to="/login" className="text-center text-sm text-text-1 underline underline-offset-4">
        {t('code.other_email')}
      </Link>
    </CardScreen>
  )

  function message() {
    if (form.formState.errors.code) return t('errors.invalid_code')
    if (verify.error) return t(errorMessageKey(verify.error))
    if (resend.error) return t(errorMessageKey(resend.error))

    return undefined
  }
}
