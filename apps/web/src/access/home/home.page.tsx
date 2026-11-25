import { Link } from '@tanstack/react-router'
import { buttonClassName } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { CardScreen } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'
import { SignOutButton } from '../session/sign-out-button'

// Empty state until the person belongs to a company: what is not there yet and one action.
export function HomePage() {
  const { t } = useTranslation('access')

  return (
    <CardScreen title={t('home.title')}>
      <Text tone="muted">{t('home.body')}</Text>
      <Link to="/companies/new" className={buttonClassName()}>
        {t('home.create_company')}
      </Link>
      <SignOutButton />
    </CardScreen>
  )
}
