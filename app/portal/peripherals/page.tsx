import prisma from '@/lib/prisma'
import { requirePortalContext } from '@/lib/portal-context'
import { Cable, Download, Monitor, Printer, Usb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { TenantPeripheralsTable, type TenantPeripheralRow } from '@/components/tenant-peripherals-table'

const CATEGORIES = ['all', 'monitor', 'printer', 'usb'] as const

export default async function PortalPeripheralsPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>
}) {
  const context = await requirePortalContext()
  const { category } = (await searchParams) ?? {}
  const initialCategory = CATEGORIES.find((c) => c === category) ?? 'all'

  const devices = await prisma.device.findMany({
    where: { clientId: context.clientId, agentAuth: { is: { isActive: true } } },
    select: {
      id: true,
      hostname: true,
      monitors: {
        select: { id: true, fabricante: true, modelo: true, serial: true, polegadas: true, conexao: true, ano: true },
      },
      printers: {
        select: { id: true, nome: true, porta: true, driver: true, padrao: true, deRede: true },
      },
      usbDevices: {
        select: { id: true, nome: true, vendorId: true, productId: true, serial: true },
      },
    },
    orderBy: { hostname: 'asc' },
  })

  const rows: TenantPeripheralRow[] = []
  for (const device of devices) {
    const hostname = device.hostname
    const base = { deviceId: device.id, hostname }

    for (const m of device.monitors) {
      const detail = `${m.polegadas ? `${m.polegadas}"` : ''}${m.conexao ? ` · ${m.conexao}` : ''}${m.ano ? ` (${m.ano})` : ''}`.trim()
      rows.push({
        ...base,
        id: m.id,
        category: 'monitor',
        name: m.modelo || m.fabricante || 'Monitor genérico',
        vendorOrDriver: m.fabricante,
        serialOrPort: m.serial,
        detail: detail || '—',
        isNetworkPrinter: false,
      })
    }
    for (const p of device.printers) {
      rows.push({
        ...base,
        id: p.id,
        category: 'printer',
        name: p.nome,
        vendorOrDriver: p.driver,
        serialOrPort: p.porta,
        detail: p.deRede ? (p.padrao ? 'Rede · Padrão' : 'Impressora de rede') : p.padrao ? 'Local · Padrão' : 'Local',
        isNetworkPrinter: Boolean(p.deRede),
      })
    }
    for (const u of device.usbDevices) {
      rows.push({
        ...base,
        id: u.id,
        category: 'usb',
        name: u.nome,
        vendorOrDriver: u.vendorId ? `VID:${u.vendorId} PID:${u.productId ?? '—'}` : null,
        serialOrPort: u.serial,
        detail: 'Dispositivo USB',
        isNetworkPrinter: false,
      })
    }
  }

  const monitorsCount = rows.filter((r) => r.category === 'monitor').length
  const printersCount = rows.filter((r) => r.category === 'printer').length
  const usbCount = rows.filter((r) => r.category === 'usb').length
  const networkPrintersCount = rows.filter((r) => r.isNetworkPrinter).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Periféricos e Dispositivos USB</h1>
          <p className="text-muted-foreground">
            Monitores, impressoras e dispositivos USB conectados às máquinas de {context.clientName}.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href={`/api/tenant/${context.clientSlug}/peripherals/csv`}>
            <Download className="h-4 w-4" />
            Baixar CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de periféricos"
          value={rows.length}
          icon={<Cable className="h-4 w-4" />}
          tone="primary"
          href="?category=all"
        />
        <KpiCard
          label="Monitores"
          value={monitorsCount}
          icon={<Monitor className="h-4 w-4" />}
          tone="info"
          href="?category=monitor"
        />
        <KpiCard
          label="Impressoras"
          value={printersCount}
          subtitle={`${networkPrintersCount} em rede`}
          icon={<Printer className="h-4 w-4" />}
          tone="neutral"
          href="?category=printer"
        />
        <KpiCard
          label="Dispositivos USB"
          value={usbCount}
          subtitle="conectados nos endpoints"
          icon={<Usb className="h-4 w-4" />}
          tone="warning"
          href="?category=usb"
        />
      </div>

      <Panel>
        <PanelHeader
          icon={<Cable className="h-4 w-4" />}
          title="Inventário de periféricos"
          description="Periféricos reportados pelos agentes deste tenant."
        />
        <PanelBody flush>
          <TenantPeripheralsTable
            rows={rows}
            tenantSlug={context.clientSlug}
            initialCategory={initialCategory}
            deviceBasePath="/portal/devices"
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
