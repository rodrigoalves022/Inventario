import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { auth } from '@/auth'
import { DeleteAssetButton } from '@/components/delete-asset-button'
import { DeviceDetailTabs } from '@/components/device-detail-tabs'
import { EnqueueCollectNowButton } from '@/components/enqueue-command-button'
import { Button } from '@/components/ui/button'
import { canDeleteTenantAsset, canOperateTenant, getSessionPermissionUser } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'

function getStatusIcon(status: string) {
  switch (status) {
    case 'online':
      return <Wifi className="h-4 w-4 text-success" />
    case 'offline':
      return <WifiOff className="h-4 w-4 text-destructive" />
    default:
      return <AlertCircle className="h-4 w-4 text-warning" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return 'border-success/30 bg-success/10 text-success'
    case 'offline':
      return 'border-destructive/30 bg-destructive/10 text-destructive'
    default:
      return 'border-warning/30 bg-warning/10 text-warning'
  }
}

function formatStatus(status: string) {
  if (status === 'online') return 'Online'
  if (status === 'offline') return 'Offline'
  return 'Atenção'
}

export default async function TenantAssetDetailsPage({ params }: PageProps<'/tenant/[clientSlug]/assets/[id]'>) {
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
    },
  })

  if (!asset) {
    notFound()
  }

  // Busca as amostras mais recentes em ordem decrescente (usa o indice
  // deviceId+collectedAt) e inverte para o grafico, que espera ordem
  // cronologica. 500 amostras a ~10 min cobre ~3,5 dias.
  const [recentMetrics, clientRetention] = await Promise.all([
    prisma.metricSample.findMany({
      where: { deviceId: asset.id },
      orderBy: { collectedAt: 'desc' },
      take: 500,
    }),
    prisma.client.findUnique({
      where: { id: tenant.id },
      select: { metricsRetentionDays: true },
    }),
  ])
  const metrics = recentMetrics.reverse()

  const permissionUser = getSessionPermissionUser(session)
  const canDeleteAsset = canDeleteTenantAsset(permissionUser, tenant)
  const canRunCommands = canOperateTenant(permissionUser, tenant)

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
      <div className="space-y-4 border-b pb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
          <Link href={getTenantPath(tenantSlug, 'computers')}>
            <ArrowLeft className="h-4 w-4" />
            Máquinas
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{asset.hostname}</h1>
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                  getStatusColor(asset.status)
                )}
              >
                {getStatusIcon(asset.status)}
                {formatStatus(asset.status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {primaryNetwork?.ip ?? 'IP não informado'}
              {' · '}
              Última coleta:{' '}
              {latestLog?.coletadoEm
                ? new Date(latestLog.coletadoEm).toLocaleString('pt-BR')
                : 'sem coletas'}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            {canRunCommands && <EnqueueCollectNowButton assetId={asset.id} tenantSlug={tenantSlug} />}
            {canDeleteAsset && (
              <DeleteAssetButton assetId={asset.id} assetName={asset.hostname} tenantSlug={tenantSlug} />
            )}
          </div>
        </div>
      </div>

      <DeviceDetailTabs
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
      />
    </div>
  )
}
