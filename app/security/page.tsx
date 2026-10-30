import { notFound } from 'next/navigation'
import { AlertTriangle, Info, KeyRound, Shield, ShieldOff, WifiOff } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'

const OFFLINE_THRESHOLD_DAYS = 7

/**
 * Fora do componente de proposito: `Date.now()` chamado direto dentro do
 * corpo de uma Server Component function e sinalizado pelo lint de pureza do
 * React Compiler como "chamada impura durante o render", mesmo sem
 * hooks/re-render envolvidos aqui. Um helper de modulo separado nao e
 * analisado como corpo de componente.
 */
function offlineSinceThreshold(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export default async function SecurityPage() {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  if (!canAccessGlobalAdmin(user)) {
    notFound()
  }

  const offlineSince = offlineSinceThreshold(OFFLINE_THRESHOLD_DAYS)

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

  const postureItems = [
    { label: 'Antivírus inativo', value: antivirusOff },
    { label: 'Firewall desativado', value: firewallOff },
    { label: 'Secure Boot desativado', value: secureBootOff },
    { label: 'UAC desativado', value: uacOff },
    { label: 'Contas admin habilitadas', value: adminAccounts },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Segurança</h1>
              <p className="text-muted-foreground">
                Indicadores apurados a partir dos dados realmente coletados.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Máquinas em alerta"
                value={devicesWarning}
                icon={<AlertTriangle />}
                tone={devicesWarning > 0 ? 'warning' : 'neutral'}
                emphasizeValue={devicesWarning > 0}
                subtitle="disco ou memória abaixo do limiar"
              />
              <KpiCard
                label={`Sem coleta há ${OFFLINE_THRESHOLD_DAYS}+ dias`}
                value={devicesStale}
                icon={<WifiOff />}
                tone={devicesStale > 0 ? 'warning' : 'neutral'}
                emphasizeValue={devicesStale > 0}
                subtitle="agente removido, bloqueado ou inativo"
              />
              <KpiCard
                label="Credenciais de agente revogadas"
                value={revokedAgents}
                icon={<ShieldOff />}
                subtitle="chaves bloqueadas para envio"
              />
              <KpiCard
                label="Acessos a credenciais"
                value={credentialViews}
                icon={<KeyRound />}
                tone="info"
                subtitle="visualizações registradas na auditoria"
              />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-12">
              <div className="xl:col-span-8">
                <Panel>
                  <PanelHeader
                    icon={<Shield />}
                    title="Postura de segurança"
                    description={`${withPosture} de ${totalDevices} máquinas já reportaram postura de segurança.`}
                  />
                  <PanelBody>
                    {withPosture === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma máquina reportou postura de segurança ainda. O agente precisa ser
                        atualizado para a versão que coleta esses dados.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        <ul className="divide-y divide-surface-line">
                          {postureItems.map((item) => (
                            <li key={item.label} className="flex items-center justify-between gap-4 py-3">
                              <span className="text-sm text-foreground">{item.label}</span>
                              <StatusPill
                                tone={item.value > 0 ? 'destructive' : 'success'}
                                label={item.value > 0 ? `${item.value} afetada(s)` : 'Conforme'}
                              />
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          Só entram nestas contagens as máquinas que reportaram o item como desativado.
                          O que o agente não conseguiu apurar — antivírus em Windows Server, BitLocker
                          ausente, TPM sem privilégio — fica de fora em vez de ser contado como problema.
                        </p>
                      </div>
                    )}
                  </PanelBody>
                </Panel>
              </div>

              <div className="xl:col-span-4">
                <Panel>
                  <PanelHeader
                    icon={<Info />}
                    title="Escopo e governança da coleta"
                    description="O que entra e o que ainda não é coletado pelo agente."
                  />
                  <PanelBody className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Ainda não coletado:</span>{' '}
                      atualizações pendentes do Windows exigem a API do Windows Update Agent e ainda
                      não são coletadas.
                    </p>
                    <p>Nenhum indicador desta página é estimado.</p>
                  </PanelBody>
                </Panel>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
