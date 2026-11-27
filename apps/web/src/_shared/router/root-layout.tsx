import { Outlet } from '@tanstack/react-router'
import { NewVersionPrompts } from '../new-version/new-version-prompts'

export function RootLayout() {
  return (
    <>
      <Outlet />
      <NewVersionPrompts />
    </>
  )
}
