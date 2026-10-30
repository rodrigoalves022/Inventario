import { Building2, Download, Package, ShieldAlert, Layers } from 'lucide-react'
import prisma from '@/lib/prisma'
import { requirePortalContext } from '@/lib/portal-context'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { TenantSoftwareTable, type SoftwareCatalogItem } from '@/components/tenant-software-table'

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

export default async function PortalSoftwarePage() {
  const context = await requirePortalContext()

  // Escopo sempre por `context.clientId` vindo de requirePortalContext (RNF004).
  const [devices, blacklistRules] = await Promise.all([
    prisma.device.findMany({
      where: { clientId: context.clientId },
      select: {
        id: true,
        hostname: true,
        software: { select: { nome: true, versao: true, editor: true, installadoEm: true } },
      },
      orderBy: { hostname: 'asc' },
    }),
    prisma.alertRule.findMany({
      where: { clientId: context.clientId, metric: 'software_blacklisted', enabled: true },
      select: { pattern: true },
    }),
  ])

  const patterns = blacklistRules
    .map((rule) => (rule.pattern ?? '').trim().toLowerCase())
    .filter((pattern) => pattern.length > 0)

  const catalog = new Map<string, SoftwareCatalogItem>()
  let totalInstallations = 0
  const editors = new Set<string>()

  for (const device of devices) {
    for (const entry of device.software) {
      totalInstallations += 1
      const editorKey = norm(entry.editor)
      if (editorKey) editors.add(editorKey)

      const key = `${norm(entry.nome)}|${norm(entry.versao)}|${editorKey}`
      let item = catalog.get(key)
      if (!item) {
        item = {
          key,
          nome: entry.nome,
          versao: entry.versao ?? null,
          editor: entry.editor ?? null,
          installationsCount: 0,
          machines: [],
          isBlacklisted: patterns.some((pattern) => entry.nome.toLowerCase().includes(pattern)),
        }
        catalog.set(key, item)
      }
      if (!item.machines.some((machine) => machine.id === device.id)) {
        item.machines.push({ id: device.id, hostname: device.hostname })
        item.installationsCount += 1
      }
    }
  }

  const catalogItems = Array.from(catalog.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  const blacklistedCount = catalogItems.filter((item) => item.isBlacklisted).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo de Softwares</h1>
          <p className="text-muted-foreground">
            Inventário consolidado de aplicações instaladas em {context.clientName}.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href={`/api/tenant/${context.clientSlug}/software/csv`}>
            <Download className="h-4 w-4" />
            Baixar CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Softwares distintos"
          value={catalogItems.length}
          subtitle="Combinações software + versão"
          icon={<Package className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          label="Instalações totais"
          value={totalInstallations}
          subtitle="Registros em todas as máquinas"
          icon={<Layers className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Editores / Fabricantes"
          value={editors.size}
          subtitle="Fabricantes distintos"
          icon={<Building2 className="h-4 w-4" />}
          tone="info"
        />
        <KpiCard
          label="Softwares restritos"
          value={blacklistedCount}
          subtitle={blacklistedCount > 0 ? 'Correspondem à blacklist ativa' : 'Nenhuma violação de blacklist'}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={blacklistedCount > 0 ? 'destructive' : 'success'}
          emphasizeValue={blacklistedCount > 0}
        />
      </div>

      <Panel>
        <PanelHeader
          icon={<Package className="h-4 w-4" />}
          title="Softwares instalados"
          description="Cada linha agrupa uma combinação de software, versão e fabricante."
        />
        <PanelBody flush>
          <TenantSoftwareTable items={catalogItems} tenantSlug={context.clientSlug} />
        </PanelBody>
      </Panel>
    </div>
  )
}
