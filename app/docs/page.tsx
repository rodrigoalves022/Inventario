import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { DocsHub } from '@/components/docs-hub'
import { Header, Sidebar } from '@/components/sidebar'
import { getSessionPermissionUser } from '@/lib/permissions'

/** Sprint A9: Central de Documentação in-app, mesma casca de /account, /users e /security. */
export default async function DocsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const permissionUser = getSessionPermissionUser(session)
  const user = { name: session.user.name, email: session.user.email, role: permissionUser.role }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={user} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Documentação & Guia de Operação</h1>
              <p className="text-muted-foreground">
                Arquitetura da plataforma, instalação do agente, console local de PowerUser, comandos remotos e segurança.
              </p>
            </div>
            <DocsHub />
          </div>
        </main>
      </div>
    </div>
  )
}
