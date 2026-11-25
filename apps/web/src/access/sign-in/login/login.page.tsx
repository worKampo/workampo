import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useLoginPage } from '@workampo/app-core/access/sign-in/login'
import { Button, buttonClassName } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { Field, Form, Input } from '@workampo/ui/forms'
import { CardScreen } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'

const loginRoute = getRouteApi('/login')

export function LoginPage() {
  const { t } = useTranslation(['access', 'companies', 'api', 'common'])
  const navigate = useNavigate()
  const { error: googleError, returnTo } = loginRoute.useSearch()
  const page = useLoginPage({
    googleError,
    onCodeSent: (email) =>
      navigate({ to: '/login/code', state: { signInEmail: email, signInReturnTo: returnTo } }),
  })

  return (
    <CardScreen title={t('login.title')}>
      <Form onSubmit={page.submit}>
        <Field label={t('login.email_label')} error={page.messageKey && t(page.messageKey)}>
          {(control) => (
            <Input
              type="email"
              autoComplete="email"
              {...control}
              {...page.form.register('email')}
            />
          )}
        </Field>
        <Button type="submit" disabled={page.isPending}>
          {t('login.continue')}
        </Button>
      </Form>
      <Text size="xs" tone="muted" align="center">
        {t('login.or')}
      </Text>
      {/* A full navigation: Google's flow leaves the app and comes back to our callback. */}
      <a
        href={
          returnTo
            ? `/api/sessions/google?returnTo=${encodeURIComponent(returnTo)}`
            : '/api/sessions/google'
        }
        className={buttonClassName({ variant: 'secondary' })}
      >
        {t('login.google')}
      </a>
    </CardScreen>
  )
}
