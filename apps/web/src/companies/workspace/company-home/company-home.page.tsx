import { getRouteApi } from '@tanstack/react-router'
import { useCompanyContext } from '@workampo/app-core/companies/workspace/read-context'
import { Text } from '@workampo/ui/content'
import { CardScreen } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'

const workspaceRoute = getRouteApi('/c/$slug')

export function CompanyHomePage() {
  const { t } = useTranslation('companies')
  const { slug } = workspaceRoute.useParams()
  const { data } = useCompanyContext(slug)

  // The name goes through JSX only: React escapes it, so markup in a name stays text.
  return (
    <CardScreen title={data && t('company_home.welcome', { name: data.name })}>{null}</CardScreen>
  )
}

// A company the person does not belong to and one that does not exist look the same (@id:companies-90-12).
export function CompanyNotFoundPage() {
  const { t } = useTranslation('companies')

  return (
    <CardScreen title={t('not_found.title')}>
      <Text tone="muted">{t('not_found.body')}</Text>
    </CardScreen>
  )
}
