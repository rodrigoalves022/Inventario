import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { AlertTriangle, Download, Info, KeyRound, Monitor, Shield, ShieldOff, WifiOff } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
import { formatRelativeAge } from '@/lib/dashboard/inventory-overview'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_DATA_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
} from '@/lib/table-styles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'

const OFFLINE_THRESHOLD_DAYS = 7

/** Teto de linhas da tabela. A lista completa sai pelo CSV. */
const DEVICE_TABLE_LIMIT = 200

/**
 * Recorte do painel inteiro: so maquinas com credencial de agente ativa. Uma
 * maquina cujo agente foi revogado nao reporta mais e ja aparece no KPI de
 * credenciais revogadas — conta-la tambem como "em alerta" ou "sem coleta"
 * seria contar o mesmo fato duas vezes.
 */
const ACTIVE_DEVICE_WHERE = { agentAuth: { is: { isActive: true } } } satisfies Prisma.DeviceWhereInput

const SECURITY_FILTERS = [
  'warning',
  'stale',
  'antivirus_off',
  'firewall_off',
  'secure_boot_off',
  'uac_off',
  'admin_accounts',
] as const

type SecurityFilter = (typeof SECURITY_FILTERS)[number]

const FILTER_LABELS: Record<SecurityFilter, string> = {
  warning: 'Máquinas em alerta',
  stale: `Sem coleta há ${OFFLINE_THRESHOLD_DAYS}+ dias`,
  antivirus_off: 'Antivírus inativo',
  firewall_off: 'Firewall desativado',
  secure_boot_off: 'Secure Boot desativado',
  uac_off: 'UAC desativado',
  admin_accounts: 'Contas admin habilitadas',
}

function parseSecurityFilter(value: string | undefined): SecurityFilter | null {
  return SECURITY_FILTERS.find((filter) => filter === value) ?? null
}

/**
 * Mesmo criterio das contagens acima, convertido em filtro de Device. `false`
 * explicito, nunca `null`: nulo significa nao apurado e nao entra no recorte.
 */
function filterWhere(filter: SecurityFilter | null, offlineSince: Date): Prisma.DeviceWhereInput {
  switch (filter) {
    case 'warning':
      return { status: 'warning' }
    case 'stale':
      return { updatedAt: { lt: offlineSince } }
    case 'antivirus_off':
      return { security: { is: { antivirusAtivo: false } } }
    case 'firewall_off':
      return { security: { is: { firewallAtivo: false } } }
    case 'secure_boot_off':
      return { security: { is: { secureBootAtivo: false } } }
    case 'uac_off':
      return { security: { is: { uacAtivo: false } } }
    case 'admin_accounts':
      return { localAccounts: { some: { isAdmin: true, habilitada: true } } }
    default:
      return {}
  }
}

/**
 * Fora do componente de proposito: `Date.now()` chamado direto dentro do
 * corpo de uma Server Component function e sinalizado pelo lint de pureza do
 * React Compiler como "chamada impura durante o render", mesmo sem
 * hooks/re-render envolvidos aqui. Um helper de modulo separado nao e
 * analisado como corpo de componente.
 */
function currentDate(): Date {
  return new Date()
}

function offlineSinceThreshold(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

function statusTone(status: string) {
  if (status === 'online') return 'success' as const
  if (status === 'warning') return 'warning' as const
  return 'destructive' as const
}

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  warning: 'Em alerta',
  offline: 'Offline',
}

function PostureBadge({ label, value }: { label: string; value: boolean | null | undefined }) {
  if (value == null) return <StatusPill tone="neutral" label={`${label} ?`} dot={false} />
  return <StatusPill tone={value ? 'success' : 'destructive'} label={label} dot={false} />
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  if (!canAccessGlobalAdmin(user)) {
    notFound()
  }

  const { filter } = (await searchParams) ?? {}
  const activeFilter = parseSecurityFilter(filter)
  const now = currentDate()
  const offlineSince = offlineSinceThreshold(now, OFFLINE_THRESHOLD_DAYS)
  const activeDeviceRelation = { device: ACTIVE_DEVICE_WHERE }

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
    tableDevices,
    tableTotal,
  ] = await Promise.all([
    prisma.device.count({ where: { ...ACTIVE_DEVICE_WHERE, status: 'warning' } }),
    prisma.device.count({ where: { ...ACTIVE_DEVICE_WHERE, updatedAt: { lt: offlineSince } } }),
    prisma.agentAuth.count({ where: { isActive: false } }),
    prisma.auditLog.count({ where: { action: 'credentials.view' } }),
    prisma.device.count({ where: ACTIVE_DEVICE_WHERE }),
    prisma.securityPosture.count({ where: activeDeviceRelation }),
    // `false` explicito, nunca `null`: nulo significa nao apurado e nao pode
    // ser contado como problema.
    prisma.securityPosture.count({ where: { ...activeDeviceRelation, firewallAtivo: false } }),
    prisma.securityPosture.count({ where: { ...activeDeviceRelation, secureBootAtivo: false } }),
    prisma.securityPosture.count({ where: { ...activeDeviceRelation, uacAtivo: false } }),
    prisma.securityPosture.count({ where: { ...activeDeviceRelation, antivirusAtivo: false } }),
    prisma.localAccount.count({ where: { ...activeDeviceRelation, isAdmin: true, habilitada: true } }),
    prisma.device.findMany({
      where: { ...ACTIVE_DEVICE_WHERE, ...filterWhere(activeFilter, offlineSince) },
      orderBy: [{ hostname: 'asc' }],
      take: DEVICE_TABLE_LIMIT,
      select: {
        id: true,
        hostname: true,
        status: true,
        updatedAt: true,
        // Device so tem o `clientId` desnormalizado, sem relacao: o cliente vem
        // da credencial do agente, a mesma origem desse campo.
        agentAuth: { select: { client: { select: { name: true, slug: true } } } },
        security: {
          select: { antivirusAtivo: true, firewallAtivo: true, secureBootAtivo: true, uacAtivo: true },
        },
        localAccounts: { where: { isAdmin: true, habilitada: true }, select: { usuario: true } },
      },
    }),
    prisma.device.count({ where: { ...ACTIVE_DEVICE_WHERE, ...filterWhere(activeFilter, offlineSince) } }),
  ])

  const postureItems: Array<{ label: string; value: number; filter: SecurityFilter }> = [
    { label: 'Antivírus inativo', value: antivirusOff, filter: 'antivirus_off' },
    { label: 'Firewall desativado', value: firewallOff, filter: 'firewall_off' },
    { label: 'Secure Boot desativado', value: secureBootOff, filter: 'secure_boot_off' },
    { label: 'UAC desativado', value: uacOff, filter: 'uac_off' },
    { label: 'Contas admin habilitadas', value: adminAccounts, filter: 'admin_accounts' },
  ]

  const tableDescription = activeFilter
    ? `Filtro: ${FILTER_LABELS[activeFilter]} — ${tableTotal} máquina(s).`
    : `${tableTotal} máquina(s) com agente ativo.`

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Segurança</h1>
                <p className="text-muted-foreground">
                  Indicadores apurados a partir dos dados realmente coletados.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/api/security/csv">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar CSV
                </a>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                href="/security?filter=warning"
                active={activeFilter === 'warning'}
                label="Máquinas em alerta"
                value={devicesWarning}
                icon={<AlertTriangle />}
                tone={devicesWarning > 0 ? 'warning' : 'neutral'}
                emphasizeValue={devicesWarning > 0}
                subtitle="disco ou memória abaixo do limiar"
              />
              <KpiCard
                href="/security?filter=stale"
                active={activeFilter === 'stale'}
                label={`Sem coleta há ${OFFLINE_THRESHOLD_DAYS}+ dias`}
                value={devicesStale}
                icon={<WifiOff />}
                tone={devicesStale > 0 ? 'warning' : 'neutral'}
                emphasizeValue={devicesStale > 0}
                subtitle="agente ativo que parou de reportar"
              />
              <KpiCard
                href="/admin/clients"
                label="Credenciais de agente revogadas"
                value={revokedAgents}
                icon={<ShieldOff />}
                subtitle="chaves bloqueadas para envio"
              />
              <KpiCard
                href="/admin/clients/audit"
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
                          {postureItems.map((item) => {
                            const isActive = activeFilter === item.filter
                            return (
                              <li key={item.label}>
                                <Link
                                  href={`/security?filter=${item.filter}`}
                                  aria-current={isActive ? 'true' : undefined}
                                  className={cn(
                                    'flex items-center justify-between gap-4 py-3 hover:bg-surface-hover/60 rounded-lg px-2 -mx-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    isActive && 'bg-surface-hover/60'
                                  )}
                                >
                                  <span className={cn('text-sm text-foreground', isActive && 'font-medium')}>
                                    {item.label}
                                  </span>
                                  <StatusPill
                                    tone={item.value > 0 ? 'destructive' : 'success'}
                                    label={item.value > 0 ? `${item.value} afetada(s)` : 'Conforme'}
                                  />
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          Só entram nestas contagens as máquinas com agente ativo que reportaram o item como
                          desativado. O que o agente não conseguiu apurar — antivírus em Windows Server,
                          BitLocker ausente, TPM sem privilégio — fica de fora em vez de ser contado como problema.
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
                      atualizações pendentes do Windows não entram no check-in periódico do agente.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Sob demanda:</span>{' '}
                      os comandos remotos agora incluem <code className="data-mono">defender_quick_scan</code>{' '}
                      (atualiza assinaturas e roda a varredura rápida do Defender) e{' '}
                      <code className="data-mono">windows_update_check</code> (verifica atualizações
                      pendentes), disparados por máquina.
                    </p>
                    <p>Nenhum indicador desta página é estimado.</p>
                  </PanelBody>
                </Panel>
              </div>
            </div>

            <Panel>
              <PanelHeader
                icon={<Monitor />}
                title="Máquinas monitoradas e postura detalhada"
                description={tableDescription}
                action={
                  activeFilter ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/security">Limpar filtro</Link>
                    </Button>
                  ) : undefined
                }
              />
              <PanelBody flush className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={TABLE_HEAD_ROW_CLASS}>
                      <th className={TABLE_HEAD_CLASS}>Cliente</th>
                      <th className={TABLE_HEAD_CLASS}>Hostname</th>
                      <th className={TABLE_HEAD_CLASS}>Status</th>
                      <th className={TABLE_HEAD_CLASS}>Última coleta</th>
                      <th className={TABLE_HEAD_CLASS}>Postura</th>
                      <th className={TABLE_HEAD_CLASS}>Admins habilitados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-line">
                    {tableDevices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          {activeFilter
                            ? 'Nenhuma máquina com agente ativo se enquadra neste filtro.'
                            : 'Nenhuma máquina com agente ativo ainda.'}
                        </td>
                      </tr>
                    ) : (
                      tableDevices.map(({ agentAuth: { client }, ...device }) => (
                        <tr key={device.id} className={STATIC_ROW_HOVER_CLASS}>
                          <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                            {client?.name ?? '—'}
                          </td>
                          <td className={cn(TABLE_DATA_CELL_CLASS, 'font-medium')}>
                            {client ? (
                              <Link
                                href={`/app/${client.slug}/assets/${device.id}`}
                                className="text-primary hover:underline"
                              >
                                {device.hostname}
                              </Link>
                            ) : (
                              device.hostname
                            )}
                          </td>
                          <td className={TABLE_CELL_CLASS}>
                            <StatusPill
                              tone={statusTone(device.status)}
                              label={STATUS_LABELS[device.status] ?? device.status}
                            />
                          </td>
                          <td className={cn(TABLE_CELL_CLASS, 'whitespace-nowrap text-muted-foreground')}>
                            {formatRelativeAge(device.updatedAt, now)}
                          </td>
                          <td className={TABLE_CELL_CLASS}>
                            {device.security ? (
                              <div className="flex flex-wrap gap-1.5">
                                <PostureBadge label="Antivírus" value={device.security.antivirusAtivo} />
                                <PostureBadge label="Firewall" value={device.security.firewallAtivo} />
                                <PostureBadge label="Secure Boot" value={device.security.secureBootAtivo} />
                                <PostureBadge label="UAC" value={device.security.uacAtivo} />
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Não reportada</span>
                            )}
                          </td>
                          <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                            {device.localAccounts.length > 0
                              ? device.localAccounts.map((account) => account.usuario).join(', ')
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {tableTotal > tableDevices.length && (
                  <p className="border-t border-surface-line px-5 py-3 text-xs text-muted-foreground">
                    Exibindo {tableDevices.length} de {tableTotal} máquinas. A lista completa sai no CSV.
                  </p>
                )}
              </PanelBody>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  )
}
