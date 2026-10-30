import Link from 'next/link'
import { ArrowLeft, Monitor } from 'lucide-react'
import { AnydeskBadge } from '@/components/anydesk-badge'
import { Button } from '@/components/ui/button'
import { Panel, PanelBody } from '@/components/ui/panel'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { DeviceDetailTabs } from '@/components/device-detail-tabs-lazy'
import prisma from '@/lib/prisma'
import { getPortalDeviceMetrics, requirePortalContext, requirePortalDevice } from '@/lib/portal-context'
import { getTenantAlertSettingsByClientId } from '@/lib/tenant-alert-settings'
import { deriveInventoryIssues, getEffectiveDeviceStatus } from '@/lib/inventory-alerts'

function getStatusTone(status: string): StatusPillTone {
  if (status === 'online') return 'success'
  if (status === 'offline') return 'destructive'
  return 'warning'
}

function formatStatus(status: string) {
  if (status === 'online') return 'Online'
  if (status === 'offline') return 'Offline'
  return 'Atenção'
}

// Funcao de modulo (fora do corpo do componente) para o Date.now() nao ser
// tratado como chamada impura durante o render pela regra react-hooks/purity.
function computeCheckinLatencyMinutes(lastCollectedAt: Date | null): number | null {
  if (!lastCollectedAt) return null
  return Math.floor((Date.now() - lastCollectedAt.getTime()) / 60000)
}

export default async function PortalDeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const context = await requirePortalContext()
  const device = await requirePortalDevice(id, context.clientId)
  const [metrics, client, alertSettings] = await Promise.all([
    getPortalDeviceMetrics(device.id),
    prisma.client.findUnique({ where: { id: context.clientId }, select: { metricsRetentionDays: true } }),
    getTenantAlertSettingsByClientId(context.clientId),
  ])

  const latestLog = device.logs[0]
  const primaryNetwork = device.networks[0]

  // Portal nao recebe polling (Sprint 9, A.3 e' escopada a /app/[clientSlug]/*)
  // — so o snapshot estatico do SSR, mesmo calculo usado la.
  const lastCollectedAt = latestLog?.coletadoEm ?? device.updatedAt
  const deviceIssues = alertSettings?.alertsEnabled
    ? deriveInventoryIssues(
        {
          updatedAt: device.updatedAt,
          lastCollectionAt: lastCollectedAt,
          hardware: device.hardware,
          disks: device.disks,
        },
        alertSettings
      )
    : []
  const deviceHealth = {
    status: device.status,
    effectiveStatus: getEffectiveDeviceStatus(device.status, deviceIssues) as 'online' | 'warning' | 'offline',
    lastCollectedAt: lastCollectedAt?.toISOString() ?? null,
    checkinLatencyMinutes: computeCheckinLatencyMinutes(lastCollectedAt),
    agentVersion: device.agentVersion,
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2 text-muted-foreground hover:text-foreground">
            <Link href="/portal">
              <ArrowLeft className="h-4 w-4" />
              Máquinas
            </Link>
          </Button>
        </div>

        <Panel>
          <PanelBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"
              >
                <Monitor className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="data-mono truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {device.hostname}
                  </h1>
                  <StatusPill
                    tone={getStatusTone(deviceHealth.effectiveStatus)}
                    label={formatStatus(deviceHealth.effectiveStatus)}
                  />
                  {device.agentVersion ? (
                    <StatusPill tone="info" label={`Agente v${device.agentVersion}`} />
                  ) : null}
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="data-mono">{primaryNetwork?.ip ?? 'IP não informado'}</span>
                  {device.hardware?.sistema ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{device.hardware.sistema}</span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>
                    Última coleta:{' '}
                    <span className="data-mono text-foreground">
                      {latestLog?.coletadoEm
                        ? new Date(latestLog.coletadoEm).toLocaleString('pt-BR')
                        : 'sem coletas'}
                    </span>
                  </span>
                </p>
                <AnydeskBadge anydeskId={device.anydeskId} />
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* canRunCommands=false: a aba de comandos nem e montada no portal. */}
      <DeviceDetailTabs
        deviceId={device.id}
        device={{
          hostname: device.hostname,
          serial: device.serial,
          fabricante: device.fabricante,
          modelo: device.modelo,
          dominio: device.dominio,
          usuario: device.usuario,
          anydeskId: device.anydeskId,
          status: device.status,
          lastCollectedAt: latestLog?.coletadoEm?.toISOString() ?? null,
        }}
        hardware={
          device.hardware
            ? {
                sistema: device.hardware.sistema,
                versaoSO: device.hardware.versaoSO,
                processador: device.hardware.processador,
                ramTotalGb: device.hardware.ramTotalGb,
                placaMae: device.hardware.placaMae,
                tipoArmazenamento: device.hardware.tipoArmazenamento,
                slots: [
                  { slot: 'Slot 1', value: device.hardware.slot1 },
                  { slot: 'Slot 2', value: device.hardware.slot2 },
                  { slot: 'Slot 3', value: device.hardware.slot3 },
                  { slot: 'Slot 4', value: device.hardware.slot4 },
                ],
              }
            : null
        }
        disks={device.disks.map((disk) => ({
          id: disk.id,
          unidade: disk.unidade,
          modelo: disk.modelo,
          tipo: disk.tipo,
          capacidadeGb: disk.capacidadeGb,
          espacoLivreGb: disk.espacoLivreGb,
          criptografia: disk.criptografia,
        }))}
        networks={device.networks.map((network) => ({
          id: network.id,
          ip: network.ip,
          mac: network.mac,
          gateway: network.gateway,
          dns: network.dns,
          dhcp: network.dhcp,
          isPrimary: network.isPrimary,
        }))}
        software={device.software.map((item) => ({
          id: item.id,
          nome: item.nome,
          versao: item.versao,
          editor: item.editor,
          installadoEm: item.installadoEm?.toISOString() ?? null,
        }))}
        commands={[]}
        canRunCommands={false}
        security={
          device.security
            ? {
                antivirusNome: device.security.antivirusNome,
                antivirusAtivo: device.security.antivirusAtivo,
                antivirusAtualizado: device.security.antivirusAtualizado,
                firewallAtivo: device.security.firewallAtivo,
                secureBootAtivo: device.security.secureBootAtivo,
                tpmPresente: device.security.tpmPresente,
                uacAtivo: device.security.uacAtivo,
                observacao: device.security.observacao,
                coletadoEm: device.security.coletadoEm.toISOString(),
              }
            : null
        }
        localAccounts={device.localAccounts.map((account) => ({
          id: account.id,
          usuario: account.usuario,
          isAdmin: account.isAdmin,
          habilitada: account.habilitada,
          senhaNuncaExpira: account.senhaNuncaExpira,
        }))}
        metrics={metrics.map((sample) => ({
          collectedAt: sample.collectedAt.toISOString(),
          cpuPercent: sample.cpuPercent,
          ramUsadaGb: sample.ramUsadaGb,
          ramTotalGb: sample.ramTotalGb,
          discoUsadoGb: sample.discoUsadoGb,
          discoLivreGb: sample.discoLivreGb,
          uptimeSegundos: sample.uptimeSegundos,
        }))}
        metricsRetentionDays={client?.metricsRetentionDays ?? 90}
        deviceHealth={deviceHealth}
        monitors={device.monitors.map((monitor) => ({
          id: monitor.id,
          fabricante: monitor.fabricante,
          modelo: monitor.modelo,
          serial: monitor.serial,
          polegadas: monitor.polegadas,
          conexao: monitor.conexao,
          ano: monitor.ano,
        }))}
        printers={device.printers.map((printer) => ({
          id: printer.id,
          nome: printer.nome,
          porta: printer.porta,
          driver: printer.driver,
          padrao: printer.padrao,
          deRede: printer.deRede,
        }))}
        usbDevices={device.usbDevices.map((usb) => ({
          id: usb.id,
          nome: usb.nome,
          vendorId: usb.vendorId,
          productId: usb.productId,
          serial: usb.serial,
        }))}
        assetRecord={
          device.assetRecord
            ? {
                etiqueta: device.assetRecord.etiqueta,
                dataCompra: device.assetRecord.dataCompra?.toISOString() ?? null,
                notaFiscal: device.assetRecord.notaFiscal,
                fornecedor: device.assetRecord.fornecedor,
                valor: device.assetRecord.valor,
                garantiaAte: device.assetRecord.garantiaAte?.toISOString() ?? null,
                centroCusto: device.assetRecord.centroCusto,
                localizacao: device.assetRecord.localizacao,
                responsavel: device.assetRecord.responsavel,
                observacoes: device.assetRecord.observacoes,
              }
            : null
        }
        tenantSlug={null}
        canManageAssetRecord={false}
      />
    </div>
  )
}
