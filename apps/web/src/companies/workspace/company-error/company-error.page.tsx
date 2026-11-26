import { Link, useRouter } from '@tanstack/react-router'
import { Button, buttonClassName } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { CardScreen } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'

export function CompanyErrorPage() {
  const { t } = useTranslation(['companies', 'common'])
  const router = useRouter()

  return (
    <CardScreen title={t('companies:company_error.title')}>
      <Text tone="muted">{t('common:errors.unexpected')}</Text>
      <Button onClick={() => router.invalidate()}>{t('companies:company_error.retry')}</Button>
      <Link to="/companies" className={buttonClassName({ variant: 'secondary' })}>
        {t('companies:not_found.back')}
      </Link>
    </CardScreen>
  )
}
