import { Building2, Download, Package, ShieldAlert, Layers } from 'lucide-react'
import prisma from '@/lib/prisma'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { requireTenantContext } from '@/lib/tenant-context'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { buildSoftwareCatalog } from '@/lib/software-catalog'
import { TenantSoftwareTable } from '@/components/tenant-software-table'

const parseTab = (value: string | string[] | undefined): 'all' | 'blacklisted' | 'widespread' => {
  const tab = Array.isArray(value) ? value[0] : value
  return tab === 'blacklisted' || tab === 'widespread' ? tab : 'all'
}

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

export default async function TenantSoftwarePage({ params, searchParams }: PageProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const { tab } = await searchParams
  const initialTab = parseTab(tab)

  // Escopo sempre por `tenant.id` vindo de requireTenantContext (RNF004).
  const [devices, blacklistRules] = await Promise.all([
    prisma.device.findMany({
      where: getTenantDeviceWhere(tenant.slug),
      select: {
        id: true,
        hostname: true,
        software: { select: { nome: true, versao: true, editor: true, installadoEm: true } },
      },
      orderBy: { hostname: 'asc' },
    }),
    prisma.alertRule.findMany({
      where: { clientId: tenant.id, metric: 'software_blacklisted', enabled: true },
      select: { pattern: true },
    }),
  ])

  const patterns = blacklistRules
    .map((rule) => (rule.pattern ?? '').trim().toLowerCase())
    .filter((pattern) => pattern.length > 0)

  const catalogItems = buildSoftwareCatalog(devices, patterns)
  const totalInstallations = catalogItems.reduce((sum, item) => sum + item.installationsCount, 0)
  const editors = new Set(catalogItems.map((item) => norm(item.editor)).filter(Boolean))
  const blacklistedCount = catalogItems.filter((item) => item.isBlacklisted).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo de Softwares</h1>
          <p className="text-muted-foreground">
            Inventário consolidado de aplicações instaladas e conformidade de softwares no parque.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href={`/api/tenant/${tenant.slug}/software/csv`}>
            <Download className="h-4 w-4" />
            Baixar CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          href="?tab=all"
          label="Softwares distintos"
          value={catalogItems.length}
          subtitle="Aplicações únicas"
          icon={<Package className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          href="?tab=widespread"
          label="Instalações totais"
          value={totalInstallations}
          subtitle="Registros em todas as máquinas"
          icon={<Layers className="h-4 w-4" />}
          tone="neutral"
        />
        <KpiCard
          href="?tab=all"
          label="Editores / Fabricantes"
          value={editors.size}
          subtitle="Fabricantes distintos"
          icon={<Building2 className="h-4 w-4" />}
          tone="info"
        />
        <KpiCard
          href="?tab=blacklisted"
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
          description="Cada linha agrupa uma aplicação (versões distintas aparecem juntas)."
        />
        <PanelBody flush>
          <TenantSoftwareTable items={catalogItems} tenantSlug={tenant.slug} initialTab={initialTab} />
        </PanelBody>
      </Panel>
    </div>
  )
}
