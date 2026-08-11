import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, KeyRound, ShieldOff, WifiOff } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'

const OFFLINE_THRESHOLD_DAYS = 7

export default async function SecurityPage() {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  if (!canAccessGlobalAdmin(user)) {
    notFound()
  }

  const offlineSince = new Date(Date.now() - OFFLINE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

  const [devicesWarning, devicesStale, revokedAgents, credentialViews] = await Promise.all([
    prisma.device.count({ where: { status: 'warning' } }),
    prisma.device.count({ where: { updatedAt: { lt: offlineSince } } }),
    prisma.agentAuth.count({ where: { isActive: false } }),
    prisma.auditLog.count({ where: { action: 'credentials.view' } }),
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

            <div className="rounded-xl border border-dashed p-6 space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Ainda não coletado</h2>
              <p className="text-sm text-muted-foreground">
                Antivírus, firewall, BitLocker, Secure Boot, atualizações pendentes e contas locais
                administradoras dependem da coleta de segurança, que ainda não foi implementada no
                agente. Enquanto isso, esta página mostra apenas o que existe de fato — nenhum
                indicador aqui é estimado.
              </p>
              <p className="text-sm text-muted-foreground">
                Escopo definido em{' '}
                <Link href="/clients/audit" className="underline underline-offset-4">
                  auditoria
                </Link>{' '}
                e no documento de produto (Fase B1).
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
