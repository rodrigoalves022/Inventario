import {
  Activity,
  AlertTriangle,
  Cpu,
  Download,
  FileText,
  HardDrive,
  Layers,
  Monitor,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'
import { formatAnydeskId } from '@/components/anydesk-badge'
import { LATEST_AGENT_VERSION } from '@/lib/agent-binary'
import { requirePortalContext } from '@/lib/portal-context'
import {
  getDeviceReportRows,
  buildDeviceReportSummary,
  getBlacklistedSoftwareHistory,
  type DeviceReportRow,
} from '@/lib/reports/device-report'
import { getDefaultAlertSettings, getTenantAlertSettingsByClientId } from '@/lib/tenant-alert-settings'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
} from '@/lib/table-styles'

const BAR_TONE_CLASS = {
  info: 'bg-info/60',
  success: 'bg-success/65',
  warning: 'bg-warning/70',
  destructive: 'bg-destructive/75',
} as const

function BarRow({
  label,
  right,
  percent,
  destructive,
  tone = 'info',
  href,
}: {
  label: string
  right: string
  percent: number
  destructive?: boolean
  tone?: keyof typeof BAR_TONE_CLASS
  href?: string
}) {
  const barTone = destructive ? 'destructive' : tone
  const content = (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className={destructive ? 'font-medium text-destructive' : 'text-foreground'}>{label}</span>
        <span className="text-muted-foreground">{right}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${BAR_TONE_CLASS[barTone]}`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  )
  if (!href) return content
  return (
    <Link
      href={href}
      className="group -mx-2.5 block rounded-lg border border-transparent px-2.5 py-1.5 transition-colors hover:border-surface-line hover:bg-secondary/40"
    >
      {content}
    </Link>
  )
}

function BoolBadge({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return <StatusPill tone="neutral" label={`${label} ?`} dot={false} />
  return <StatusPill tone={value ? 'success' : 'destructive'} label={label} dot={false} />
}

function statusTone(status: string) {
  if (status === 'online') return 'success' as const
  if (status === 'warning') return 'warning' as const
  return 'destructive' as const
}

function DiskCell({ row }: { row: DeviceReportRow }) {
  if (row.discoCapacidadeGb == null || row.discoCapacidadeGb <= 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const livre = row.discoLivreGb ?? 0
  const usado = Math.max(row.discoCapacidadeGb - livre, 0)
  const pct = Math.round((usado / row.discoCapacidadeGb) * 100)
  return (
    <div className="min-w-[180px] space-y-1">
      <div className="h-1.5 rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${pct >= 95 ? 'bg-destructive/75' : pct >= 80 ? 'bg-warning/70' : 'bg-info/60'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {usado}/{row.discoCapacidadeGb} GB ({pct}%) · {livre} GB livres
      </p>
    </div>
  )
}

export default async function PortalReportsPage() {
  const context = await requirePortalContext()
  const tenantAlertSettings = await getTenantAlertSettingsByClientId(context.clientId)
  const { alertOfflineHours, alertDiskThresholdGb } = tenantAlertSettings ?? getDefaultAlertSettings()

  const rows = await getDeviceReportRows({ clientId: context.clientId }, alertOfflineHours, alertDiskThresholdGb)
  const summary = buildDeviceReportSummary(rows)
  const blacklistedSoftware = await getBlacklistedSoftwareHistory(context.clientId, 10)

  const gov = summary.fleetGovernance
  const sec = summary.securityCompliance
  const securityBars = [
    { label: 'BitLocker ativo em todos os discos', percent: sec.bitlockerActivePercent, known: sec.bitlockerKnownCount },
    { label: 'Antivírus ativo', percent: sec.antivirusActivePercent, known: sec.antivirusActiveKnownCount },
    { label: 'Assinaturas de antivírus atualizadas', percent: sec.antivirusUpdatedPercent, known: sec.antivirusUpdatedKnownCount },
    { label: 'Firewall ativo', percent: sec.firewallActivePercent, known: sec.firewallKnownCount },
  ]
  const governanceItems = [
    {
      label: 'Composição do parque',
      value: `${summary.computadores} computador(es) · ${summary.servidores} servidor(es)`,
      href: '/portal',
    },
    {
      label: `Agentes atualizados (v${LATEST_AGENT_VERSION})`,
      value: `${gov.agentUpToDateCount} atualizado(s) · ${gov.agentOutdatedCount} desatualizado(s) (${gov.agentCompliancePercent}%)`,
      href: '/portal',
    },
    {
      label: 'Cobertura AnyDesk',
      value: `${gov.anydeskCount} de ${summary.totalDevices} máquina(s) (${gov.anydeskPercent}%)`,
      href: '/portal',
    },
    {
      label: 'Cobertura de patrimônio',
      value: `${gov.patrimonioRegisteredCount} de ${summary.totalDevices} com etiqueta/responsável (${gov.patrimonioPercent}%)`,
      href: '/portal',
    },
    {
      label: 'Valor patrimonial cadastrado',
      value: `R$ ${gov.totalAssetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      href: '/portal',
    },
    {
      label: 'Ciclo de vida / Garantias',
      value: `${gov.warrantyActiveCount} em dia · ${gov.warrantyExpiringSoonCount} vencendo em 30d · ${gov.warrantyExpiredCount} vencida(s)`,
      href: '/portal',
    },
  ]
  const maxDisk = Math.max(...summary.diskUsageDistribution.map((b) => b.count), 1)
  const maxRam = Math.max(...summary.ramDistribution.map((b) => b.count), 1)
  const maxCpu = Math.max(...summary.processorDistribution.map((b) => b.value), 1)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Resumo do parque de {context.clientName}, baseado exclusivamente nos dados coletados.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/api/portal/reports/csv">
              <Download className="h-4 w-4" />
              Baixar CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/api/portal/reports/pdf">
              <FileText className="h-4 w-4" />
              Baixar PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Taxa de disponibilidade"
          subtitle="proporção online do parque"
          icon={<Activity />}
          value={`${summary.availabilityPercent}%`}
          tone="success"
          emphasizeValue
          href="/portal"
        />
        <KpiCard
          label="Dispositivos online"
          subtitle="conectados recentemente"
          icon={<Wifi />}
          value={summary.online}
          tone="info"
          emphasizeValue
          href="/portal"
        />
        <KpiCard
          label="Dispositivos offline"
          subtitle="sem comunicação recente"
          icon={<WifiOff />}
          value={summary.offline}
          tone="destructive"
          emphasizeValue
          href="/portal"
        />
        <KpiCard
          label="Status warning"
          subtitle="com alerta operacional"
          icon={<AlertTriangle />}
          value={summary.warning}
          tone="warning"
          emphasizeValue
          href="/portal"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            icon={<ShieldCheck />}
            title="Conformidade de segurança do parque"
            description="Percentual sobre as máquinas com dado apurado — não apurado não é tratado como desativado."
          />
          <PanelBody className="space-y-4">
            {securityBars.map((bar) => (
              <BarRow
                key={bar.label}
                label={bar.label}
                right={`${bar.percent}% (${bar.known} de ${summary.totalDevices} máquinas apuradas)`}
                percent={Number(bar.percent)}
                href="/portal"
                tone={Number(bar.percent) >= 80 ? 'success' : Number(bar.percent) >= 50 ? 'warning' : 'info'}
              />
            ))}
            <div className="border-t border-surface-line pt-4">
              <h3 className="section-label mb-2">Softwares não autorizados recentes</h3>
              {blacklistedSoftware.length === 0 ? (
                <Link href="/portal/software?tab=blacklisted" className="inline-block">
                  <StatusPill tone="success" label="Nenhum software proibido detectado" />
                </Link>
              ) : (
                <ul className="divide-y divide-surface-line">
                  {blacklistedSoftware.map((event, index) => (
                    <li key={`${event.hostname}-${event.softwareNome}-${index}`}>
                      <Link
                        href="/portal/software?tab=blacklisted"
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg py-2 text-sm transition-colors hover:bg-secondary/40"
                      >
                      <span>
                        <span className="data-mono font-medium text-foreground">{event.hostname}</span>
                        <span className="text-muted-foreground">
                          {' '}— {event.softwareNome}
                          {event.softwareVersao ? ` (v${event.softwareVersao})` : ''}
                        </span>
                      </span>
                      <StatusPill
                        tone={event.resolvedAt ? 'neutral' : 'destructive'}
                        label={event.resolvedAt ? 'Resolvido' : 'Em aberto'}
                      />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            icon={<Layers />}
            title="Governança, agentes, acesso remoto e patrimônio (ITAM)"
            description="Composição do parque, versão dos agentes, cobertura de acesso remoto e ciclo de vida dos ativos."
          />
          <PanelBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {governanceItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block rounded-lg border border-surface-line bg-secondary/25 p-3 transition-colors hover:border-surface-line-strong hover:bg-secondary/50"
                >
                  <p className="section-label">{item.label}</p>
                  <p className="mt-1 text-sm text-foreground">{item.value}</p>
                </Link>
              ))}
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            icon={<HardDrive />}
            title="Uso de disco por máquina & Discos críticos"
            description="Faixas de uso por máquina — discos de tamanhos diferentes não se resumem a um único percentual."
          />
          <PanelBody className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {summary.storageUsedGb} GB usados de {summary.storageCapacityGb} GB totais · {summary.storageFreeGb} GB livres
            </p>
            {summary.diskUsageDistribution.every((bucket) => bucket.count === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhum disco reportado ainda.</p>
            ) : (
              <div className="space-y-3">
                {summary.diskUsageDistribution.map((bucket) => (
                  <BarRow
                    key={bucket.label}
                    label={bucket.label}
                    right={String(bucket.count)}
                    percent={Math.round((bucket.count / maxDisk) * 100)}
                    destructive={bucket.label.includes('crítico')}
                    href="/portal"
                    tone={
                      bucket.label.includes('crítico')
                        ? 'destructive'
                        : bucket.label.includes('80–95')
                          ? 'warning'
                          : bucket.label.includes('50–80')
                            ? 'info'
                            : 'success'
                    }
                  />
                ))}
              </div>
            )}
            <div className="border-t border-surface-line pt-4">
              <h3 className="section-label mb-2">Discos abaixo de {alertDiskThresholdGb} GB livres</h3>
              {summary.criticalDisks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum disco abaixo do limiar crítico</p>
              ) : (
                <ul className="divide-y divide-surface-line">
                  {summary.criticalDisks.map((disk, index) => (
                    <li key={`${disk.hostname}-${disk.unidade}-${index}`}>
                      <Link
                        href={disk.deviceId ? `/portal/devices/${disk.deviceId}` : '/portal'}
                        className="flex items-center justify-between gap-3 rounded-lg py-2 text-sm transition-colors hover:bg-secondary/40"
                      >
                        <span className="data-mono text-foreground">
                          {disk.hostname} — {disk.unidade ?? 'disco'}
                        </span>
                        <span className="text-destructive">
                          {disk.espacoLivreGb ?? '—'} GB livres de {disk.capacidadeGb ?? '—'} GB
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            icon={<Cpu />}
            title="Distribuição de sistemas, processadores e memória RAM"
            description="Máquinas por sistema operacional, família de processador e memória instalada."
          />
          <PanelBody className="space-y-5">
            <section className="space-y-3">
              <h3 className="section-label">Distribuição de sistemas operacionais</h3>
              {summary.osDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum sistema operacional reportado ainda.</p>
              ) : (
                summary.osDistribution.map((item) => {
                  const percent = summary.totalDevices > 0 ? Math.round((item.value / summary.totalDevices) * 100) : 0
                  return (
                    <BarRow
                      key={item.name}
                      label={item.name}
                      right={`${item.value} (${percent}%)`}
                      percent={percent}
                      tone="info"
                      href="/portal"
                    />
                  )
                })
              )}
            </section>
            <section className="space-y-3 border-t border-surface-line pt-4">
              <h3 className="section-label">Famílias de processadores</h3>
              {summary.processorDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum processador reportado ainda.</p>
              ) : (
                summary.processorDistribution.map((item) => (
                  <BarRow
                    key={item.name}
                    label={item.name}
                    right={String(item.value)}
                    percent={Math.round((item.value / maxCpu) * 100)}
                    tone="info"
                    href="/portal"
                  />
                ))
              )}
            </section>
            <section className="space-y-3 border-t border-surface-line pt-4">
              <h3 className="section-label">Distribuição de RAM</h3>
              {summary.ramDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma informação de memória reportada ainda.</p>
              ) : (
                summary.ramDistribution.map((item) => (
                  <BarRow
                    key={item.label}
                    label={item.label}
                    right={String(item.count)}
                    percent={Math.round((item.count / maxRam) * 100)}
                    tone="info"
                    href="/portal"
                  />
                ))
              )}
            </section>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          icon={<Monitor />}
          title="Matriz analítica por máquina"
          description="Cruzamento de hardware, ocupação de armazenamento, postura de segurança, acesso remoto e governança patrimonial."
        />
        <PanelBody flush>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th className={TABLE_HEAD_CLASS}>Máquina / Tipo</th>
                  <th className={TABLE_HEAD_CLASS}>Sistema &amp; Hardware</th>
                  <th className={TABLE_HEAD_CLASS}>Ocupação de Disco</th>
                  <th className={TABLE_HEAD_CLASS}>Postura de Segurança</th>
                  <th className={TABLE_HEAD_CLASS}>AnyDesk</th>
                  <th className={TABLE_HEAD_CLASS}>Patrimônio &amp; Responsável</th>
                  <th className={TABLE_HEAD_CLASS}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-line">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-sm text-muted-foreground">
                      Nenhuma máquina reportada ainda.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.hostname} className={STATIC_ROW_HOVER_CLASS}>
                      <td className={TABLE_CELL_CLASS}>
                        <Link
                          href={row.id ? `/portal/devices/${row.id}` : '/portal'}
                          className="data-mono font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {row.hostname}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusPill
                            tone={row.deviceType === 'servidor' ? 'info' : 'neutral'}
                            label={row.deviceType === 'servidor' ? 'Servidor' : 'Computador'}
                            dot={false}
                          />
                          {row.agentVersion && (
                            <span className="text-xs text-muted-foreground">Agente v{row.agentVersion}</span>
                          )}
                        </div>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <p className="text-foreground">{row.sistema ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{row.processador ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{row.ramTotalGb ?? '—'} GB RAM</p>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <DiskCell row={row} />
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <div className="flex flex-wrap gap-1.5">
                          <BoolBadge label="AV" value={row.antivirusAtivo} />
                          <BoolBadge label="FW" value={row.firewallAtivo} />
                          <BoolBadge label="BitLocker" value={row.bitlockerAtivo} />
                        </div>
                      </td>
                      <td className={`${TABLE_CELL_CLASS} data-mono`}>
                        {row.anydeskId ? formatAnydeskId(row.anydeskId) : '—'}
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <p className="text-foreground">{row.etiquetaPatrimonio ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{row.responsavel ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{row.localizacao ?? '—'}</p>
                      </td>
                      <td className={TABLE_CELL_CLASS}>
                        <StatusPill tone={statusTone(row.status)} label={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PanelBody>
      </Panel>
    </div>
  )
}
