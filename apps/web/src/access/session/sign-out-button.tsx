import { useNavigate } from '@tanstack/react-router'
import { useSignOut } from '@workampo/client/access/session/hooks'
import { Button } from '@workampo/ui/actions'
import { useTranslation } from 'react-i18next'

export function SignOutButton() {
  const { t } = useTranslation('access')
  const navigate = useNavigate()
  const signOut = useSignOut()

  return (
    <Button
      variant="secondary"
      disabled={signOut.isPending}
      onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) })}
    >
      {t('home.sign_out')}
    </Button>
  )
}
