import { Link, useNavigate } from '@tanstack/react-router'
import { useSignOut } from '@workampo/app-core/access/session/sign-out'
import { buttonClassName } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { CardScreen } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'
import { SignOutButton } from '../../_shared/components/sign-out-button'

// Empty state until the person belongs to a company: what is not there yet and one action.
export function HomePage() {
  const { t } = useTranslation('access')
  const navigate = useNavigate()
  const signOut = useSignOut()

  return (
    <CardScreen title={t('home.title')}>
      <Text tone="muted">{t('home.body')}</Text>
      <Link to="/companies/new" className={buttonClassName()}>
        {t('home.create_company')}
      </Link>
      <SignOutButton
        state={signOut}
        onSignOut={() => signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) })}
      />
    </CardScreen>
  )
}
