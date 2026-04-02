import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'

type AssetParams = Promise<{ clientSlug: string; id: string }> | { clientSlug: string; id: string }

function getStatusIcon(status: string) {
  switch (status) {
    case 'online':
      return <Wifi className="h-5 w-5 text-success" />
    case 'offline':
      return <WifiOff className="h-5 w-5 text-destructive" />
    default:
      return <AlertCircle className="h-5 w-5 text-warning" />
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'online':
      return 'bg-success/10 text-success border-success/30'
    case 'offline':
      return 'bg-destructive/10 text-destructive border-destructive/30'
    default:
      return 'bg-warning/10 text-warning border-warning/30'
  }
}

function formatStatus(status: string) {
  if (status === 'online') return 'Online'
  if (status === 'offline') return 'Offline'
  return 'Warning'
}

export default async function TenantAssetDetailsPage({ params }: { params: AssetParams }) {
  const { clientSlug, id } = await Promise.resolve(params)
  await requireTenantContext(clientSlug)

  const asset = await prisma.device.findFirst({
    where: {
      id,
      ...getTenantDeviceWhere(clientSlug),
    },
    include: {
      hardware: true,
      disks: { orderBy: { unidade: 'asc' } },
      networks: { orderBy: [{ isPrimary: 'desc' }, { ip: 'asc' }] },
      logs: { orderBy: { coletadoEm: 'desc' }, take: 1 },
    },
  })

  if (!asset) {
    notFound()
  }

  const latestLog = asset.logs[0]
  const primaryNetwork = asset.networks[0]
  const memorySlots = [
    { slot: 'Slot 1', value: asset.hardware?.slot1 },
    { slot: 'Slot 2', value: asset.hardware?.slot2 },
    { slot: 'Slot 3', value: asset.hardware?.slot3 },
    { slot: 'Slot 4', value: asset.hardware?.slot4 },
  ]

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <Button asChild variant="ghost" className="mb-4 gap-2">
          <Link href={getTenantPath(clientSlug, 'computers')}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{asset.hostname}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{primaryNetwork?.ip ?? 'IP não informado'}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className={cn('rounded-lg border-2 p-6 space-y-4', getStatusColor(asset.status))}>
          <div className="flex items-center gap-3">
            {getStatusIcon(asset.status)}
            <h3 className="text-lg font-semibold">Status</h3>
          </div>
          <div className="space-y-2">
            <p className="text-sm opacity-75">Status atual</p>
            <p className="text-2xl font-bold">{formatStatus(asset.status)}</p>
            <p className="text-xs opacity-60">
              Última verificação: {latestLog?.coletadoEm ? new Date(latestLog.coletadoEm).toLocaleString('pt-BR') : 'Sem coletas'}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Hardware</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Processador</p>
              <p className="text-sm font-medium text-foreground">{asset.hardware?.processador ?? 'Não informado'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RAM</p>
              <p className="text-sm font-medium text-foreground">{asset.hardware?.ramTotalGb ? `${asset.hardware.ramTotalGb} GB` : 'Não informado'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Placa-mãe</p>
              <p className="text-sm font-medium text-foreground">{asset.hardware?.placaMae ?? 'Não informada'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Sistema</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Sistema Operacional</p>
              <p className="text-sm font-medium text-foreground">{asset.hardware?.sistema ?? 'Não informado'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Usuário</p>
              <p className="text-sm font-medium text-foreground">{asset.usuario ?? 'Não informado'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Domínio</p>
              <p className="text-sm font-medium text-foreground">{asset.dominio ?? 'Não informado'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Detalhes de armazenamento</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {asset.disks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum disco reportado.</p>
          ) : (
            asset.disks.map((disk) => {
              const total = disk.capacidadeGb ?? 0
              const free = disk.espacoLivreGb ?? 0
              const used = Math.max(total - free, 0)
              const usage = total > 0 ? Math.round((used / total) * 100) : 0
              return (
                <div key={disk.id} className="space-y-2 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{disk.unidade ?? 'Disco'} ({disk.tipo ?? 'N/A'})</span>
                    <span className="text-xs text-muted-foreground">{used} GB de {total} GB</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${usage}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{free} GB livres</p>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Slots de memória</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {memorySlots.map((slot) => {
            const occupied = Boolean(slot.value)
            return (
              <div
                key={slot.slot}
                className={cn(
                  'rounded-lg border p-3 space-y-2',
                  occupied ? 'border-success bg-success/5' : 'border-border bg-secondary/30'
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">{slot.slot}</p>
                <p className={cn('text-sm font-semibold', occupied ? 'text-success' : 'text-muted-foreground')}>
                  {slot.value ?? 'Vazio'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Informações de rede</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {asset.networks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma interface de rede reportada.</p>
          ) : (
            asset.networks.map((network) => (
              <div key={network.id} className="rounded-lg border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Endereço IP</p>
                    <p className="text-sm font-medium text-foreground">{network.ip ?? 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">MAC Address</p>
                    <p className="text-sm font-medium text-foreground font-mono">{network.mac ?? 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gateway</p>
                    <p className="text-sm font-medium text-foreground">{network.gateway ?? 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">DNS</p>
                    <p className="text-sm font-medium text-foreground">{network.dns ?? 'Não informado'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
