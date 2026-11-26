import { createLink, getRouteApi, Outlet, useNavigate } from '@tanstack/react-router'
import { useMe } from '@workampo/app-core/access/me'
import { useSignOut } from '@workampo/app-core/access/session/sign-out'
import { useCompanyContext } from '@workampo/app-core/companies/workspace/read-context'
import { errorKeyOf } from '@workampo/app-core/errors'
import { Avatar, Text } from '@workampo/ui/content'
import { AppShell, CompanyLink, NavItem, TopbarCompany, UserButton } from '@workampo/ui/layout'
import {
  Menu,
  MenuContent,
  MenuHeader,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from '@workampo/ui/overlays'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DocumentTitleProvider } from '../../../_shared/document-title/document-title'

const workspaceRoute = getRouteApi('/c/$slug')
const RouterCompanyLink = createLink(CompanyLink)
const RouterNavItem = createLink(NavItem)

const SIDEBAR_KEY = 'workampo:sidebar'

// Kept per browser; a browser that refuses storage still folds the menu for this visit.
function useRail() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'rail'
    } catch {
      return false
    }
  })
  const change = (next: boolean) => {
    setCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'rail' : 'expanded')
    } catch {}
  }
  return [collapsed, change] as const
}

export function CompanyShell() {
  const { t } = useTranslation('companies')
  const { slug } = workspaceRoute.useParams()
  const { data: company } = useCompanyContext(slug)
  const [collapsed, setCollapsed] = useRail()

  // The loader cached the context before the shell renders.
  if (!company) return null

  const avatar = <Avatar kind="company" name={company.name} />

  return (
    <DocumentTitleProvider company={company.name}>
      <AppShell
        labels={{
          skipToContent: t('shell.skip_to_content'),
          navigation: t('shell.main_nav'),
          openNav: t('shell.open_nav'),
          closeNav: t('shell.close_nav'),
          navDialog: t('shell.nav_dialog'),
          collapse: t('shell.collapse'),
          expand: t('shell.expand'),
        }}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        company={
          <RouterCompanyLink
            to="/companies"
            aria-description={t('shell.switch_company')}
            avatar={avatar}
            name={company.name}
            meta={t(`shell.roles.${company.role}`)}
          />
        }
        nav={
          <RouterNavItem
            to="/c/$slug"
            params={{ slug }}
            icon={<HomeIcon />}
            label={t('shell.home')}
            activeOptions={{ exact: true }}
            activeProps={{ current: true }}
          />
        }
        user={<AccountMenu />}
        topbar={
          <>
            <TopbarCompany avatar={avatar} name={company.name} />
            <AccountMenu />
          </>
        }
      >
        <Outlet />
      </AppShell>
    </DocumentTitleProvider>
  )
}

// The sidebar and the topbar each hold one; both show the same sign-out state.
function AccountMenu() {
  const { t } = useTranslation(['companies', 'access', 'api', 'common'])
  const navigate = useNavigate()
  const signOut = useSignOut()
  const { data: me } = useMe()

  if (!me) return null

  return (
    <Menu>
      <MenuTrigger asChild>
        <UserButton
          avatar={<Avatar kind="person" name={me.name ?? me.email} />}
          name={me.name ?? undefined}
          email={me.email}
          aria-busy={signOut.isPending || undefined}
        />
      </MenuTrigger>
      <MenuContent aria-label={t('companies:shell.account_menu')}>
        <MenuHeader>
          <span dir="auto">{me.name ?? me.email}</span>
          {me.name && (
            <Text dir="auto" size="xs" tone="muted">
              {me.email}
            </Text>
          )}
        </MenuHeader>
        <MenuSeparator />
        <MenuItem
          busy={signOut.isPending}
          onSelect={(event) => {
            // The menu stays open while signing out, to show the busy state or the error.
            event.preventDefault()
            signOut.mutate(undefined, { onSuccess: () => navigate({ to: '/login' }) })
          }}
        >
          {t('common:sign_out')}
        </MenuItem>
        {signOut.error ? (
          <MenuHeader>
            <Text role="alert" tone="negative">
              {t(errorKeyOf(signOut.error))}
            </Text>
          </MenuHeader>
        ) : null}
      </MenuContent>
    </Menu>
  )
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={16}
      height={16}
    >
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}
