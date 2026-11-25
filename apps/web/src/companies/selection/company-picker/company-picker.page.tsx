import { Link, useNavigate } from '@tanstack/react-router'
import { useMe } from '@workampo/app-core/access/me'
import { useSignOut } from '@workampo/app-core/access/session/sign-out'
import { buttonClassName } from '@workampo/ui/actions'
import { Avatar, CardList, ListRowLink, Text } from '@workampo/ui/content'
import { CardScreen } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'
import { SignOutButton } from '../../../_shared/components/sign-out-button'
import { inAppPath } from '../../../_shared/router/in-app-path'
import { RouterListRowLink } from '../../../_shared/router/router-list-row-link'
import { useCompanyPicker } from './company-picker.hook'

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
      <CardList>
        {companies?.map((company) => (
          <li key={company.slug}>
            <CompanyLink company={company} />
          </li>
        ))}
      </CardList>
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
function CompanyLink({ company }: { company: { name: string; slug: string; url: string } }) {
  const row = {
    leading: <Avatar kind="company" name={company.name} />,
    title: company.name,
    subtitle: `/c/${company.slug}`,
  }

  return inAppPath(company.url) ? (
    <RouterListRowLink to="/c/$slug" params={{ slug: company.slug }} {...row} />
  ) : (
    <ListRowLink href={company.url} {...row} />
  )
}
