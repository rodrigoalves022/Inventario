import { notFound } from 'next/navigation'
import { AlertTriangle, KeyRound, ShieldOff, WifiOff } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
import { cn } from '@/lib/utils'

const OFFLINE_THRESHOLD_DAYS = 7

export default async function SecurityPage() {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  if (!canAccessGlobalAdmin(user)) {
    notFound()
  }

  const offlineSince = new Date(Date.now() - OFFLINE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

  const [
    devicesWarning,
    devicesStale,
    revokedAgents,
    credentialViews,
    totalDevices,
    withPosture,
    firewallOff,
    secureBootOff,
    uacOff,
    antivirusOff,
    adminAccounts,
  ] = await Promise.all([
    prisma.device.count({ where: { status: 'warning' } }),
    prisma.device.count({ where: { updatedAt: { lt: offlineSince } } }),
    prisma.agentAuth.count({ where: { isActive: false } }),
    prisma.auditLog.count({ where: { action: 'credentials.view' } }),
    prisma.device.count(),
    prisma.securityPosture.count(),
    // `false` explicito, nunca `null`: nulo significa nao apurado e nao pode
    // ser contado como problema.
    prisma.securityPosture.count({ where: { firewallAtivo: false } }),
    prisma.securityPosture.count({ where: { secureBootAtivo: false } }),
    prisma.securityPosture.count({ where: { uacAtivo: false } }),
    prisma.securityPosture.count({ where: { antivirusAtivo: false } }),
    prisma.localAccount.count({ where: { isAdmin: true, habilitada: true } }),
  ])

  const indicators = [
    {
      label: 'Máquinas em alerta',
      value: devicesWarning,
      description: 'Disco ou memória abaixo do limiar configurado no tenant.',
      icon: AlertTriangle,
    },
    {
      label: `Sem coleta há ${OFFLINE_THRESHOLD_DAYS}+ dias`,
      value: devicesStale,
      description: 'O agente pode ter sido removido, bloqueado ou a máquina desativada.',
      icon: WifiOff,
    },
    {
      label: 'Credenciais de agente revogadas',
      value: revokedAgents,
      description: 'Chaves que não podem mais enviar inventário.',
      icon: ShieldOff,
    },
    {
      label: 'Acessos a credenciais',
      value: credentialViews,
      description: 'Visualizações registradas na auditoria.',
      icon: KeyRound,
    },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segurança</h1>
              <p className="text-muted-foreground">
                Indicadores apurados a partir dos dados realmente coletados.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {indicators.map((indicator) => (
                <div key={indicator.label} className="rounded-xl border bg-card p-5 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <indicator.icon className="h-4 w-4" />
                    <p className="text-xs font-medium uppercase tracking-wide">{indicator.label}</p>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{indicator.value}</p>
                  <p className="text-xs text-muted-foreground">{indicator.description}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">Postura de segurança</h2>
                <p className="text-xs text-muted-foreground">
                  {withPosture} de {totalDevices} máquinas já reportaram
                </p>
              </div>

              {withPosture === 0 ? (
                <div className="rounded-xl border border-dashed p-6">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma máquina reportou postura de segurança ainda. O agente precisa ser
                    atualizado para a versão que coleta esses dados.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      { label: 'Antivírus inativo', value: antivirusOff },
                      { label: 'Firewall desativado', value: firewallOff },
                      { label: 'Secure Boot desativado', value: secureBootOff },
                      { label: 'UAC desativado', value: uacOff },
                      { label: 'Contas admin habilitadas', value: adminAccounts },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          'rounded-xl border p-4',
                          item.value > 0 ? 'border-destructive/30 bg-destructive/5' : 'bg-card'
                        )}
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <p
                          className={cn(
                            'mt-1 text-2xl font-bold',
                            item.value > 0 ? 'text-destructive' : 'text-foreground'
                          )}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Só entram nestas contagens as máquinas que reportaram o item como desativado.
                    O que o agente não conseguiu apurar — antivírus em Windows Server, BitLocker
                    ausente, TPM sem privilégio — fica de fora em vez de ser contado como problema.
                  </p>
                </>
              )}
            </div>

            <div className="rounded-xl border border-dashed p-6 space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Ainda não coletado</h2>
              <p className="text-sm text-muted-foreground">
                Atualizações pendentes do Windows exigem a API do Windows Update Agent e ainda não
                são coletadas. Nenhum indicador desta página é estimado.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
