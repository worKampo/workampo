import { Navigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { CodeForm } from './code-form'

// After a reload the email is gone (it never travels in the URL): back to /login. Read once, on
// arrival: while the next page loads, the current location already lacks it.
export function CodePage() {
  const router = useRouter()
  const [{ signInEmail: email, signInReturnTo: returnTo }] = useState(
    () => router.state.location.state,
  )
  if (!email) return <Navigate to="/login" />

  return <CodeForm email={email} returnTo={returnTo} />
}
