import { Link, useNavigate } from '@tanstack/react-router'
import { SLUG_MAX } from '@workampo/domain/_shared/slug'
import { LANGUAGES } from '@workampo/i18n'
import { Button, buttonClassName } from '@workampo/ui/actions'
import { Banner } from '@workampo/ui/feedback'
import { Field, Form, FormActions, Input, InputGroup, Select } from '@workampo/ui/forms'
import { useTranslation } from 'react-i18next'
import { inAppPath } from '../../../_shared/router/in-app-path'
import { useNewCompanyPage } from './new-company.hook'

const SLUG_MESSAGES = {
  available: { success: 'new_company.available', error: undefined },
  taken: { success: undefined, error: 'new_company.unavailable' },
  reserved: { success: undefined, error: 'new_company.reserved' },
  invalid: { success: undefined, error: 'new_company.invalid_format' },
  checking: { success: undefined, error: undefined },
} as const

// The path every company URL shares; the host varies by environment, so it is elided.
const SLUG_PREFIX = '…/c/'

export function NewCompanyForm() {
  const { t, i18n } = useTranslation(['companies', 'access', 'api', 'common'])
  const navigate = useNavigate()
  const page = useNewCompanyPage({
    language: i18n.resolvedLanguage,
    onCreated: (url) => {
      const path = inAppPath(url)
      if (path) navigate({ href: path })
      else window.location.assign(url)
    },
  })
  const slugMessage = SLUG_MESSAGES[page.slugStatus ?? 'checking']
  const languageNames = new Intl.DisplayNames(i18n.resolvedLanguage, { type: 'language' })
  const errors = page.fieldErrorKeys
  const slugError = errors.slug ?? (slugMessage.error && `companies:${slugMessage.error}`)

  return (
    <Form onSubmit={page.submit}>
      {page.messageKey && (
        <Banner variant="negative" ref={page.banner}>
          {t(page.messageKey)}
        </Banner>
      )}
      <Field label={t('new_company.name')} error={errors.name && t(errors.name)}>
        {(control) => (
          <Input
            autoComplete="organization"
            maxLength={80}
            dir="auto"
            required
            aria-required
            {...control}
            {...page.form.register('name')}
          />
        )}
      </Field>
      <Field
        label={t('new_company.url')}
        hint={t('new_company.url_hint')}
        success={slugMessage.success && t(slugMessage.success)}
        error={slugError && t(slugError)}
      >
        {(control) => (
          <InputGroup
            prefix={SLUG_PREFIX}
            required
            aria-required
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            maxLength={SLUG_MAX}
            {...control}
            {...page.form.register('slug')}
          />
        )}
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
              required
              aria-required
              {...control}
              {...page.form.register('userName')}
            />
          )}
        </Field>
      )}
      <FormActions>
        <Link to="/companies" className={buttonClassName({ variant: 'quiet' })}>
          {t('new_company.back_to_companies')}
        </Link>
        {/* Not disabled: a disabled button drops the focus; the hook ignores a second submit. */}
        <Button
          type="submit"
          aria-busy={page.isPending || undefined}
          aria-disabled={page.isPending || undefined}
        >
          {t(page.isPending ? 'new_company.submitting' : 'new_company.submit')}
        </Button>
      </FormActions>
    </Form>
  )
}

// Intl gives language names in lowercase in Spanish and Catalan («español»); a list item starts with a capital.
function capitalize(text: string, locale: string | undefined) {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
}
