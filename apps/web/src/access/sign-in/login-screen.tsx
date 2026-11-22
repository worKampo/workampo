import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { errorKey, errorKeyOf } from '@workampo/app-core/_shared/error-key'
import { loginFormSchema } from '@workampo/app-core/access/sign-in/sign-in-forms'
import { useStartCodeSignIn } from '@workampo/app-core/access/sign-in/sign-in-hooks'
import { Button, buttonClassName } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { Field, Input } from '@workampo/ui/forms'
import { CardScreen } from '@workampo/ui/layout'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

const loginRoute = getRouteApi('/login')

export function LoginScreen() {
  const { t } = useTranslation(['access', 'common'])
  const navigate = useNavigate()
  const { error: googleError } = loginRoute.useSearch()
  const startCode = useStartCodeSignIn()
  const form = useForm({ resolver: zodResolver(loginFormSchema), defaultValues: { email: '' } })

  const submit = form.handleSubmit(({ email }) =>
    startCode.mutate(
      { email },
      { onSuccess: () => navigate({ to: '/login/code', state: { signInEmail: email } }) },
    ),
  )

  return (
    <CardScreen title={t('login.title')}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label={t('login.email_label')} error={message()}>
          {(control) => (
            <Input type="email" autoComplete="email" {...control} {...form.register('email')} />
          )}
        </Field>
        <Button type="submit" disabled={startCode.isPending}>
          {t('login.continue')}
        </Button>
      </form>
      <Text size="xs" tone="muted" align="center">
        {t('login.or')}
      </Text>
      {/* A full navigation: Google's flow leaves the app and comes back to our callback. */}
      <a href="/api/sessions/google" className={buttonClassName({ variant: 'secondary' })}>
        {t('login.google')}
      </a>
    </CardScreen>
  )

  function message() {
    if (form.formState.errors.email) return t('errors.invalid_email')
    if (startCode.error) return t(errorKeyOf(startCode.error))
    if (googleError) return t(errorKey(googleError))

    return undefined
  }
}
