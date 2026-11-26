import { Text } from '@workampo/ui/content'
import { CardScreen } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'
import { NewCompanyForm } from './new-company-form'

export function NewCompanyPage() {
  const { t } = useTranslation('companies')

  return (
    <CardScreen title={t('new_company.title')}>
      <Text>{t('new_company.intro')}</Text>
      <NewCompanyForm />
    </CardScreen>
  )
}
