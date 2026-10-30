import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Monitor } from 'lucide-react'
import { auth } from '@/auth'
import { DeleteAssetButton } from '@/components/delete-asset-button'
import { DeviceDetailTabs } from '@/components/device-detail-tabs-lazy'
import { EnqueueCollectNowButton } from '@/components/enqueue-command-button'
import { Button } from '@/components/ui/button'
import { canDeleteTenantAsset, canManageAssetRecord, canOperateTenant, getSessionPermissionUser } from '@/lib/permissions'
import { Panel, PanelBody } from '@/components/ui/panel'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
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

export default async function TenantAssetDetailsPage({ params }: PageProps<'/app/[clientSlug]/assets/[id]'>) {
  const { clientSlug, id } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug
  const session = await auth()

  const asset = await prisma.device.findFirst({
    where: {
      id,
      ...getTenantDeviceWhere(tenantSlug),
    },
    include: {
      hardware: true,
      disks: { orderBy: { unidade: 'asc' } },
      networks: { orderBy: [{ isPrimary: 'desc' }, { ip: 'asc' }] },
      software: { orderBy: { nome: 'asc' } },
      logs: { orderBy: { coletadoEm: 'desc' }, take: 1 },
      security: true,
      localAccounts: { orderBy: [{ isAdmin: 'desc' }, { usuario: 'asc' }] },
      monitors: true,
      printers: { orderBy: [{ padrao: 'desc' }, { nome: 'asc' }] },
      usbDevices: { orderBy: { nome: 'asc' } },
      assetRecord: true,
    },
  })

  if (!asset) {
    notFound()
  }

  // Busca as amostras mais recentes em ordem decrescente (usa o indice
  // deviceId+collectedAt) e inverte para o grafico, que espera ordem
  // cronologica. 500 amostras a ~10 min cobre ~3,5 dias.
  const [recentMetrics, clientRetention, alertSettings] = await Promise.all([
    prisma.metricSample.findMany({
      where: { deviceId: asset.id },
      orderBy: { collectedAt: 'desc' },
      take: 500,
    }),
    prisma.client.findUnique({
      where: { id: tenant.id },
      select: { metricsRetentionDays: true },
    }),
    getTenantAlertSettingsByClientId(tenant.id),
  ])
  const metrics = recentMetrics.reverse()

  // Snapshot inicial (SSR) de saude do dispositivo — mesmo calculo usado por
  // GET /api/tenant/[clientSlug]/devices/[deviceId]/metrics (Sprint 9, A.3),
  // que reassume esse valor a cada ciclo de polling client-side.
  const lastCollectedAt = asset.logs[0]?.coletadoEm ?? asset.updatedAt
  const deviceIssues = alertSettings?.alertsEnabled
    ? deriveInventoryIssues(
        {
          updatedAt: asset.updatedAt,
          lastCollectionAt: lastCollectedAt,
          hardware: asset.hardware,
          disks: asset.disks,
        },
        alertSettings
      )
    : []
  const deviceHealth = {
    status: asset.status,
    effectiveStatus: getEffectiveDeviceStatus(asset.status, deviceIssues) as 'online' | 'warning' | 'offline',
    lastCollectedAt: lastCollectedAt?.toISOString() ?? null,
    checkinLatencyMinutes: computeCheckinLatencyMinutes(lastCollectedAt),
    agentVersion: asset.agentVersion,
  }

  const permissionUser = getSessionPermissionUser(session)
  const canDeleteAsset = canDeleteTenantAsset(permissionUser, tenant)
  const canRunCommands = canOperateTenant(permissionUser, tenant)
  const canManageAsset = canManageAssetRecord(permissionUser, tenant)

  const commands = canRunCommands
    ? await prisma.agentCommand.findMany({
        where: { agentAuthId: asset.agentAuthId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : []

  const latestLog = asset.logs[0]
  const primaryNetwork = asset.networks[0]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2 text-muted-foreground hover:text-foreground">
            <Link href={getTenantPath(tenantSlug, 'computers')}>
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
                    {asset.hostname}
                  </h1>
                  <StatusPill tone={getStatusTone(asset.status)} label={formatStatus(asset.status)} />
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="data-mono">{primaryNetwork?.ip ?? 'IP não informado'}</span>
                  {asset.hardware?.sistema ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{asset.hardware.sistema}</span>
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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canRunCommands && <EnqueueCollectNowButton assetId={asset.id} tenantSlug={tenantSlug} />}
              {canDeleteAsset && (
                <DeleteAssetButton assetId={asset.id} assetName={asset.hostname} tenantSlug={tenantSlug} />
              )}
            </div>
          </PanelBody>
        </Panel>
      </div>

      <DeviceDetailTabs
        deviceId={asset.id}
        device={{
          hostname: asset.hostname,
          serial: asset.serial,
          fabricante: asset.fabricante,
          modelo: asset.modelo,
          dominio: asset.dominio,
          usuario: asset.usuario,
          status: asset.status,
          lastCollectedAt: latestLog?.coletadoEm?.toISOString() ?? null,
        }}
        hardware={
          asset.hardware
            ? {
                sistema: asset.hardware.sistema,
                versaoSO: asset.hardware.versaoSO,
                processador: asset.hardware.processador,
                ramTotalGb: asset.hardware.ramTotalGb,
                placaMae: asset.hardware.placaMae,
                tipoArmazenamento: asset.hardware.tipoArmazenamento,
                slots: [
                  { slot: 'Slot 1', value: asset.hardware.slot1 },
                  { slot: 'Slot 2', value: asset.hardware.slot2 },
                  { slot: 'Slot 3', value: asset.hardware.slot3 },
                  { slot: 'Slot 4', value: asset.hardware.slot4 },
                ],
              }
            : null
        }
        disks={asset.disks.map((disk) => ({
          id: disk.id,
          unidade: disk.unidade,
          modelo: disk.modelo,
          tipo: disk.tipo,
          capacidadeGb: disk.capacidadeGb,
          espacoLivreGb: disk.espacoLivreGb,
          criptografia: disk.criptografia,
        }))}
        networks={asset.networks.map((network) => ({
          id: network.id,
          ip: network.ip,
          mac: network.mac,
          gateway: network.gateway,
          dns: network.dns,
          dhcp: network.dhcp,
          isPrimary: network.isPrimary,
        }))}
        software={asset.software.map((item) => ({
          id: item.id,
          nome: item.nome,
          versao: item.versao,
          editor: item.editor,
          installadoEm: item.installadoEm?.toISOString() ?? null,
        }))}
        commands={commands.map((command) => ({
          id: command.id,
          type: command.type,
          status: command.status,
          createdAt: command.createdAt.toISOString(),
          resultJson: command.resultJson,
        }))}
        canRunCommands={canRunCommands}
        security={
          asset.security
            ? {
                antivirusNome: asset.security.antivirusNome,
                antivirusAtivo: asset.security.antivirusAtivo,
                antivirusAtualizado: asset.security.antivirusAtualizado,
                firewallAtivo: asset.security.firewallAtivo,
                secureBootAtivo: asset.security.secureBootAtivo,
                tpmPresente: asset.security.tpmPresente,
                uacAtivo: asset.security.uacAtivo,
                observacao: asset.security.observacao,
                coletadoEm: asset.security.coletadoEm.toISOString(),
              }
            : null
        }
        localAccounts={asset.localAccounts.map((account) => ({
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
        metricsRetentionDays={clientRetention?.metricsRetentionDays ?? 90}
        deviceHealth={deviceHealth}
        monitors={asset.monitors.map((monitor) => ({
          id: monitor.id,
          fabricante: monitor.fabricante,
          modelo: monitor.modelo,
          serial: monitor.serial,
          polegadas: monitor.polegadas,
          conexao: monitor.conexao,
          ano: monitor.ano,
        }))}
        printers={asset.printers.map((printer) => ({
          id: printer.id,
          nome: printer.nome,
          porta: printer.porta,
          driver: printer.driver,
          padrao: printer.padrao,
          deRede: printer.deRede,
        }))}
        usbDevices={asset.usbDevices.map((usb) => ({
          id: usb.id,
          nome: usb.nome,
          vendorId: usb.vendorId,
          productId: usb.productId,
          serial: usb.serial,
        }))}
        assetRecord={
          asset.assetRecord
            ? {
                etiqueta: asset.assetRecord.etiqueta,
                dataCompra: asset.assetRecord.dataCompra?.toISOString() ?? null,
                notaFiscal: asset.assetRecord.notaFiscal,
                fornecedor: asset.assetRecord.fornecedor,
                valor: asset.assetRecord.valor,
                garantiaAte: asset.assetRecord.garantiaAte?.toISOString() ?? null,
                centroCusto: asset.assetRecord.centroCusto,
                localizacao: asset.assetRecord.localizacao,
                responsavel: asset.assetRecord.responsavel,
                observacoes: asset.assetRecord.observacoes,
              }
            : null
        }
        tenantSlug={tenantSlug}
        canManageAssetRecord={canManageAsset}
      />
    </div>
  )
}
