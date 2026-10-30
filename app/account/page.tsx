import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getAccountOverviewAction } from '@/app/account/actions'
import { AccountSettingsContent, type AccountDialogTab } from '@/components/account-dialog'
import { Header, Sidebar } from '@/components/sidebar'
import { Panel, PanelBody } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'
import { getSessionPermissionUser, ROLE_LABELS } from '@/lib/permissions'

const TABS: AccountDialogTab[] = ['profile', 'preferences', 'security', 'sessions']

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || '??').trim()
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; client?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { tab } = (await searchParams) ?? {}
  const initialTab = TABS.find((value) => value === tab) ?? 'profile'
  const permissionUser = getSessionPermissionUser(session)
  const user = { name: session.user.name, email: session.user.email, role: permissionUser.role }
  const overview = await getAccountOverviewAction()

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={user} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Minha conta</h1>
              <p className="text-muted-foreground">
                Dados de acesso, contato de plantão, aparência e segurança da sua conta.
              </p>
            </div>
            <Panel>
              <PanelBody className="flex flex-wrap items-center gap-4 pt-5">
                <div
                  aria-hidden
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary"
                >
                  {getInitials(user.name, user.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground">{user.name ?? user.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {user.role && <StatusPill tone="neutral" label={ROLE_LABELS[user.role]} />}
                  <StatusPill tone="success" label="Sessão ativa" />
                </div>
              </PanelBody>
            </Panel>
            <Panel>
              <PanelBody className="pt-5">
                <AccountSettingsContent user={user} initialTab={initialTab} initialOverview={overview} wide />
              </PanelBody>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  )
}
