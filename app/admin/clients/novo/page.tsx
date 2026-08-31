import { notFound } from 'next/navigation'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import { getSessionPermissionUser, isOrgAdmin, isPlatformAdmin } from '@/lib/permissions'
import { getCurrentServerUrl } from '@/lib/server-url'
import { createClientAction as createClientProvisioningAction } from '../actions'
import { type ProvisioningActionState } from '../types'
import { NewClientWizard } from './new-client-wizard'

export default async function NewClientPage() {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  // Criar cliente e ato de administracao de conta: operador e portal nao entram.
  if (!isPlatformAdmin(user) && !isOrgAdmin(user)) {
    notFound()
  }

  const serverUrl = await getCurrentServerUrl()

  async function createClientAction(state: ProvisioningActionState, formData: FormData) {
    'use server'
    return createClientProvisioningAction(state, formData)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <NewClientWizard serverUrl={serverUrl} createClientAction={createClientAction} />
        </main>
      </div>
    </div>
  )
}
