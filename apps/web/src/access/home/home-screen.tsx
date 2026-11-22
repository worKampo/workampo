import { CardScreen } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'
import { SignOutButton } from '../session/sign-out-button'

// Empty state until the person belongs to a company: what is not there yet and one action.
export function HomeScreen() {
  const { t } = useTranslation('access')

  return (
    <CardScreen title={t('home.title')}>
      <p className="text-sm text-text-2">{t('home.body')}</p>
      <SignOutButton />
    </CardScreen>
  )
}
