import { Link, useNavigate } from '@tanstack/react-router'
import { useMe } from '@workampo/app-core/access/me'
import { useSignOut } from '@workampo/app-core/access/session/sign-out'
import { useCompanyPicker } from '@workampo/app-core/companies/selection/company-picker'
import { buttonClassName } from '@workampo/ui/actions'
import { Avatar, Text } from '@workampo/ui/content'
import { CardScreen } from '@workampo/ui/layout'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SignOutButton } from '../../../_shared/components/sign-out-button'
import { inAppPath } from '../../../_shared/router/in-app-path'

export function CompanyPickerPage() {
  const { t, i18n } = useTranslation('companies')
  const navigate = useNavigate()
  const signOut = useSignOut()
  const { data: me } = useMe()
  const { companies } = useCompanyPicker(i18n.language)

  // Names and the email go through JSX only: React escapes them, so markup stays text.
  return (
    <CardScreen title={t('company_picker.title')}>
      {me && <Text tone="muted">{t('company_picker.signed_in_as', { email: me.email })}</Text>}
      <ul>
        {companies?.map((company) => (
          <li key={company.slug}>
            <CompanyLink company={company}>
              <Avatar kind="company" name={company.name} />
              <span>{company.name}</span>
              <Text size="xs" tone="muted">
                /c/{company.slug}
              </Text>
            </CompanyLink>
          </li>
        ))}
      </ul>
      <Link to="/companies/new" className={buttonClassName()}>
        {t('company_picker.create')}
      </Link>
      <SignOutButton
        state={signOut}
        onSignOut={() => signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) })}
      />
    </CardScreen>
  )
}

// A company on another origin (its subdomain) is a full navigation; the router shows only ours,
// where the url is the workspace route of the slug.
function CompanyLink({
  company,
  children,
}: {
  company: { slug: string; url: string }
  children: ReactNode
}) {
  const className = buttonClassName({ variant: 'quiet' })

  return inAppPath(company.url) ? (
    <Link to="/c/$slug" params={{ slug: company.slug }} className={className}>
      {children}
    </Link>
  ) : (
    <a href={company.url} className={className}>
      {children}
    </a>
  )
}
