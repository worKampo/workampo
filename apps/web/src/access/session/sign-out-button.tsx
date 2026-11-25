import { useNavigate } from '@tanstack/react-router'
import { useSignOut } from '@workampo/app-core/access/session/sign-out'
import { errorKeyOf } from '@workampo/app-core/errors'
import { Button } from '@workampo/ui/actions'
import { Text } from '@workampo/ui/content'
import { useTranslation } from 'react-i18next'

export function SignOutButton() {
  const { t } = useTranslation(['access', 'companies', 'api', 'common'])
  const navigate = useNavigate()
  const signOut = useSignOut()

  return (
    <>
      <Button
        variant="secondary"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) })}
      >
        {t('home.sign_out')}
      </Button>
      {signOut.error && (
        <Text role="alert" tone="negative">
          {t(errorKeyOf(signOut.error))}
        </Text>
      )}
    </>
  )
}
