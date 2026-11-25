import { errorKeyOf } from '@workampo/app-core/errors'
import { Button } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { useTranslation } from 'react-i18next'

// Only the look: _shared knows no domain, so the page wires useSignOut and passes its state.
export function SignOutButton({
  onSignOut,
  state,
}: {
  onSignOut: () => void
  state: { isPending: boolean; error: unknown }
}) {
  const { t } = useTranslation(['access', 'companies', 'api', 'common'])

  return (
    <>
      <Button variant="secondary" disabled={state.isPending} onClick={onSignOut}>
        {t('common:sign_out')}
      </Button>
      {state.error ? (
        <Text role="alert" tone="negative">
          {t(errorKeyOf(state.error))}
        </Text>
      ) : null}
    </>
  )
}
