import { type ErrorComponentProps, Link } from '@tanstack/react-router'
import { ApiError } from '@workampo/app-core/api-error'
import { Button, buttonClassName } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { SystemPage } from '@workampo/ui/layout'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentTitle } from '../document-title/document-title'

// A fixed destination: never built from returnTo or anything else in the URL.
function HomeLink() {
  const { t } = useTranslation('common')
  return (
    <Link to="/" className={buttonClassName({ variant: 'secondary' })}>
      {t('system_pages.home')}
    </Link>
  )
}

// Nothing from the path or the query is rendered, so a foreign and a missing company look the same.
export function NotFoundPage() {
  const { t } = useTranslation('common')
  useDocumentTitle(t('system_pages.not_found.title'))

  return (
    <SystemPage
      title={t('system_pages.not_found.title')}
      body={t('system_pages.not_found.body')}
      code={t('system_pages.not_found.code')}
      actions={<HomeLink />}
    />
  )
}

// Lazy to keep its tooltip out of the entry bundle: a reference means the API answered, so the code
// was loading; a failed code load has no reference and needs none.
const CopyableReference = lazy(() =>
  import('./error-reference').then(
    ({ CopyableReference }) => ({ default: CopyableReference }),
    () => ({ default: PlainReference }),
  ),
)

// While CopyableReference loads, or if it cannot: the line alone, still selectable by hand.
function PlainReference({ reference, labels }: { reference: string; labels: { line: string } }) {
  const [before, after] = labels.line.split(reference)
  return (
    <Text size="xs" tone="muted">
      {before}
      <code dir="ltr" translate="no" className="select-all break-all">
        {reference}
      </code>
      {after}
    </Text>
  )
}

function Reference({ reference }: { reference: string }) {
  const { t } = useTranslation('common')
  const labels = {
    line: t('system_pages.reference.label', { reference }),
    copy: t('system_pages.reference.copy_label'),
    copied: t('system_pages.reference.copied'),
    copiedStatus: t('system_pages.reference.copied_status'),
    copyFailed: t('system_pages.reference.copy_failed'),
  }

  return (
    <Suspense fallback={<PlainReference reference={reference} labels={labels} />}>
      <CopyableReference reference={reference} labels={labels} />
    </Suspense>
  )
}

// Never shows error.message or the stack; the reference only when the server gave a valid one.
export function ErrorPage({ error }: ErrorComponentProps) {
  const { t } = useTranslation('common')
  useDocumentTitle(t('system_pages.error.title'))
  const reference = error instanceof ApiError ? error.reference : undefined

  return (
    <SystemPage
      title={t('system_pages.error.title')}
      body={t('system_pages.error.body')}
      code={t('system_pages.error.code')}
      reference={reference && <Reference reference={reference} />}
      actions={
        <>
          <Button onClick={() => window.location.reload()}>{t('system_pages.error.retry')}</Button>
          <HomeLink />
        </>
      }
    />
  )
}
