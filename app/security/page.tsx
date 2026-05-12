import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { Sidebar, Header } from '@/components/sidebar'
import { AlertCircle, Shield, Lock, Eye } from 'lucide-react'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'

export default async function SecurityPage() {
  const session = await auth()
  const user = getSessionPermissionUser(session)
  if (!canAccessGlobalAdmin(user)) {
    notFound()
  }

  const securityAlerts = [
    { id: 1, title: 'Verificação de segurança necessária', desc: 'Alguns dispositivos não possuem antivírus atualizado', level: 'warning' },
    { id: 2, title: 'Senhas fracas detectadas', desc: '5 usuários com senhas fracas no registro', level: 'danger' },
    { id: 3, title: 'Firewall desativado', desc: '2 computadores com firewall desativado', level: 'warning' },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={user.role} />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segurança</h1>
              <p className="text-muted-foreground">Alertas e status de segurança</p>
            </div>

            <div className="space-y-4">
              {securityAlerts.map((alert) => (
                <div key={alert.id} className="bg-card rounded-lg border border-border p-4 flex gap-4">
                  <div className={alert.level === 'danger' ? 'text-destructive' : 'text-warning'}>
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{alert.title}</h3>
                    <p className="text-sm text-muted-foreground">{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
