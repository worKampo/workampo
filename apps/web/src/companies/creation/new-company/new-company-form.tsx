import { Link, useNavigate } from '@tanstack/react-router'
import { useNewCompanyPage } from '@workampo/app-core/companies/creation/new-company'
import { LANGUAGES } from '@workampo/i18n'
import { Button, buttonClassName } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { Field, Form, FormActions, Input, Select } from '@workampo/ui/forms'
import { useTranslation } from 'react-i18next'

const SLUG_MESSAGES = {
  available: { help: 'new_company.available', error: undefined },
  taken: { help: undefined, error: 'new_company.unavailable' },
  reserved: { help: undefined, error: 'new_company.reserved' },
  invalid: { help: undefined, error: 'new_company.invalid_format' },
  checking: { help: undefined, error: undefined },
} as const

export function NewCompanyForm() {
  const { t, i18n } = useTranslation(['companies', 'access', 'common'])
  const navigate = useNavigate()
  const page = useNewCompanyPage({
    language: i18n.resolvedLanguage,
    // The company's URL may live on another host (subdomain routing); only our own origin stays in the app.
    onCreated: (url) => {
      const target = new URL(url)
      if (target.origin === window.location.origin) navigate({ href: target.pathname })
      else window.location.assign(url)
    },
  })
  const slugMessage = SLUG_MESSAGES[page.slugStatus ?? 'checking']
  const languageNames = new Intl.DisplayNames(i18n.resolvedLanguage, { type: 'language' })
  const errors = page.fieldErrorKeys

  return (
    <Form onSubmit={page.submit}>
      <Field label={t('new_company.name')} error={errors.name && t(errors.name)}>
        {(control) => (
          <Input
            autoComplete="organization"
            maxLength={80}
            {...control}
            {...page.form.register('name')}
          />
        )}
      </Field>
      <Field
        label={t('new_company.url')}
        help={slugMessage.help && t(slugMessage.help)}
        error={slugMessage.error && t(slugMessage.error)}
      >
        {(control) => <Input autoComplete="off" {...control} {...page.form.register('slug')} />}
      </Field>
      <Field
        label={t('new_company.language')}
        help={t('new_company.language_hint')}
        error={errors.defaultLanguage && t(errors.defaultLanguage)}
      >
        {(control) => (
          <Select {...control} {...page.form.register('defaultLanguage')}>
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {capitalize(languageNames.of(language) ?? language, i18n.resolvedLanguage)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {page.askUserName && (
        <Field label={t('new_company.your_name')} error={errors.userName && t(errors.userName)}>
          {(control) => (
            <Input
              autoComplete="name"
              maxLength={80}
              {...control}
              {...page.form.register('userName')}
            />
          )}
        </Field>
      )}
      <FormActions>
        <Link to="/" className={buttonClassName({ variant: 'quiet' })}>
          {t('new_company.cancel')}
        </Link>
        <Button type="submit" disabled={page.isPending}>
          {t('new_company.submit')}
        </Button>
      </FormActions>
      {page.messageKey && (
        <Text role="alert" tone="negative">
          {t(page.messageKey)}
        </Text>
      )}
    </Form>
  )
}

// Intl gives language names in lowercase in Spanish and Catalan («español»); a list item starts with a capital.
function capitalize(text: string, locale: string | undefined) {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
}
