import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getAccountOverviewAction } from '@/app/account/actions'
import { AccountPageContent } from '@/app/account/account-page-content'
import { Header, Sidebar } from '@/components/sidebar'
import { getSessionPermissionUser } from '@/lib/permissions'

/**
 * Sprint V26.2: mesma casca das telas administrativas (`space-y-6` alinhado a
 * esquerda do <main>, sem `max-w` centralizado). A aba ativa (`?tab=`) e lida
 * no client por `AccountPageContent`.
 */
export default async function AccountPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

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
                Identidade, contato de plantão, preferências e segurança do seu acesso ao painel.
              </p>
            </div>
            <AccountPageContent user={user} initialOverview={overview} />
          </div>
        </main>
      </div>
    </div>
  )
}
