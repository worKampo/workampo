import { getRouteApi, Link, useLocation } from '@tanstack/react-router'
import { useCompanyContext } from '@workampo/app-core/companies/workspace/read-context'
import { buttonClassName } from '@workampo/ui/actions'
import { Card, DescriptionList, Text } from '@workampo/ui/content'
import { Page } from '@workampo/ui/layout'
import { useTranslation } from 'react-i18next'
import { useDocumentTitle } from '../../../_shared/document-title/document-title'

const workspaceRoute = getRouteApi('/c/$slug')

// A company on its subdomain is reached at the origin itself; on the shared host, under /c/{slug}.
function appAddress(slug: string, pathname: string) {
  const { host } = window.location
  return pathname.startsWith(`/c/${slug}`) ? `${host}/c/${slug}` : host
}

export function CompanyHomePage() {
  const { t } = useTranslation('companies')
  const { slug } = workspaceRoute.useParams()
  const { data } = useCompanyContext(slug)
  const { pathname } = useLocation()
  useDocumentTitle(t('shell.home'))

  // The name goes through JSX only: React escapes it, so markup in a name stays text.
  return (
    <Page title={data && t('company_home.title', { name: data.name })}>
      <Card heading={t('company_home.addresses')}>
        <DescriptionList
          items={[
            {
              term: t('company_home.app_address'),
              details: appAddress(slug, pathname),
              dir: 'ltr',
            },
          ]}
        />
      </Card>
    </Page>
  )
}

// Inside a company the person belongs to: the loader already cached its context.
export function CompanyPageNotFoundPage() {
  const { t } = useTranslation('companies')
  const { slug } = workspaceRoute.useParams()
  const { data } = useCompanyContext(slug)
  useDocumentTitle(t('page_not_found.title'))

  return (
    <Page title={t('page_not_found.title')} align="start">
      <Text tone="muted">{t('page_not_found.body')}</Text>
      <Link
        to="/c/$slug"
        params={{ slug }}
        activeOptions={{ exact: true }}
        className={buttonClassName({ variant: 'secondary' })}
      >
        {t('page_not_found.back', { name: data?.name })}
      </Link>
    </Page>
  )
}
