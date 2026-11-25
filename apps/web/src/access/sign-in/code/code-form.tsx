import { useNavigate } from '@tanstack/react-router'
import { Button } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { Field, Form, Input } from '@workampo/ui/forms'
import { CardScreen } from '@workampo/ui/layout'
import { Trans, useTranslation } from 'react-i18next'
import { RouterTextLink } from '../../../_shared/router/router-text-link'
import { useCodePage } from './code.hook'

export function CodeForm({ email, returnTo }: { email: string; returnTo?: string | undefined }) {
  const { t } = useTranslation(['access', 'companies', 'api', 'common'])
  const navigate = useNavigate()
  const page = useCodePage({
    email,
    onSignedIn: () => (returnTo ? navigate({ href: returnTo }) : navigate({ to: '/' })),
  })

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
      <Form onSubmit={page.submit}>
        <Field
          label={t('code.code_label')}
          error={page.messageKey && t(page.messageKey)}
          help={page.isResent ? t('code.resent') : undefined}
        >
          {(control) => (
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              {...control}
              {...page.form.register('code')}
            />
          )}
        </Field>
        <Button type="submit" disabled={page.isVerifying}>
          {t('code.submit')}
        </Button>
        {/* Not while a code is being checked: resetting that check would drop its navigation. */}
        <Button
          variant="secondary"
          onClick={page.resendCode}
          disabled={page.isResending || page.isVerifying}
        >
          {t('code.resend')}
        </Button>
      </Form>
      <Text align="center">
        <RouterTextLink to="/login" search={returnTo ? { returnTo } : {}}>
          {t('code.other_email')}
        </RouterTextLink>
      </Text>
    </CardScreen>
  )
}
