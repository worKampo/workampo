import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate, useRouter } from '@tanstack/react-router'
import { errorKeyOf } from '@workampo/app-core/_shared/error-key'
import { codeFormSchema } from '@workampo/app-core/access/sign-in/sign-in-forms'
import { useStartCodeSignIn, useVerifyCode } from '@workampo/app-core/access/sign-in/sign-in-hooks'
import { Button } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { Field, Input } from '@workampo/ui/forms'
import { CardScreen } from '@workampo/ui/layout'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { RouterTextLink } from '../../_shared/router/router-text-link'

// After a reload the email is gone (it never travels in the URL): back to /login. Read once, on
// arrival: while the next screen loads, the current location already lacks it.
export function CodeScreen() {
  const router = useRouter()
  const [email] = useState(() => router.state.location.state.signInEmail)
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
      <Text>
        <Trans
          t={t}
          i18nKey="code.sent_to"
          values={{ email }}
          components={{ strong: <strong /> }}
        />
      </Text>
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
        {/* Not while a code is being checked: resetting that check would drop its navigation. */}
        <Button
          variant="secondary"
          onClick={resendCode}
          disabled={resend.isPending || verify.isPending}
        >
          {t('code.resend')}
        </Button>
      </form>
      <Text align="center">
        <RouterTextLink to="/login">{t('code.other_email')}</RouterTextLink>
      </Text>
    </CardScreen>
  )

  function message() {
    if (form.formState.errors.code) return t('errors.invalid_code')
    if (verify.error) return t(errorKeyOf(verify.error))
    if (resend.error) return t(errorKeyOf(resend.error))

    return undefined
  }
}
