import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeviceDetailTabs } from '@/components/device-detail-tabs'
import prisma from '@/lib/prisma'
import { getPortalDeviceMetrics, requirePortalContext, requirePortalDevice } from '@/lib/portal-context'

export default async function PortalDeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const context = await requirePortalContext()
  const device = await requirePortalDevice(id, context.clientId)
  const [metrics, client] = await Promise.all([
    getPortalDeviceMetrics(device.id),
    prisma.client.findUnique({ where: { id: context.clientId }, select: { metricsRetentionDays: true } }),
  ])

  const latestLog = device.logs[0]
  const primaryNetwork = device.networks[0]

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b pb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
          <Link href="/portal">
            <ArrowLeft className="h-4 w-4" />
            Máquinas
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">{device.hostname}</h1>
          <p className="text-sm text-muted-foreground">
            {primaryNetwork?.ip ?? 'IP não informado'}
            {' · '}
            Última coleta:{' '}
            {latestLog?.coletadoEm
              ? new Date(latestLog.coletadoEm).toLocaleString('pt-BR')
              : 'sem coletas'}
          </p>
        </div>
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
