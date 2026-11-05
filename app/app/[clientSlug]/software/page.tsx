import { Building2, Download, Package, ShieldAlert, Layers, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { requireTenantContext } from '@/lib/tenant-context'
import { canOperateTenant, getSessionPermissionUser } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildSoftwareCatalog } from '@/lib/software-catalog'
import { getTenantReconciledLicenses } from '@/lib/licenses'
import { TenantSoftwareTable } from '@/components/tenant-software-table'
import { TenantLicensesTable } from '@/components/tenant-licenses-table'

const parseTab = (value: string | string[] | undefined): 'all' | 'blacklisted' | 'widespread' => {
  const tab = Array.isArray(value) ? value[0] : value
  return tab === 'blacklisted' || tab === 'widespread' ? tab : 'all'
}

const norm = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

export default async function TenantSoftwarePage({ params, searchParams }: PageProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const resolvedSearchParams = await searchParams
  const initialTab = parseTab(resolvedSearchParams.tab)
  const currentView = resolvedSearchParams.view === 'licenses' ? 'licenses' : 'catalog'

  const session = await auth()
  const user = getSessionPermissionUser(session)
  const canManageLicenses = canOperateTenant(user, tenant)

  // Escopo sempre por `tenant.id` vindo de requireTenantContext (RNF004).
  const [devices, blacklistRules, reconciledLicenses] = await Promise.all([
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
    getTenantReconciledLicenses(tenant.slug, tenant.id),
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
          <h1 className="text-2xl font-bold text-foreground">Softwares & Licenciamento</h1>
          <p className="text-muted-foreground">
            Inventário consolidado de aplicações instaladas, conformidade com a blacklist e conciliação de licenças adquiridas.
          </p>
        </div>
        {currentView === 'catalog' && (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/api/tenant/${tenant.slug}/software/csv`}>
              <Download className="h-4 w-4" />
              Baixar CSV (Catálogo)
            </a>
          </Button>
        )}
      </div>

      <Tabs value={currentView} className="space-y-6">
        <TabsList>
          <TabsTrigger value="catalog" asChild>
            <Link href="?view=catalog" className="flex items-center gap-1.5">
              <Package className="h-4 w-4" />
              Catálogo Instalado
            </Link>
          </TabsTrigger>
          <TabsTrigger value="licenses" asChild>
            <Link href="?view=licenses" className="flex items-center gap-1.5">
              <KeyRound className="h-4 w-4" />
              Gestão de Licenças (SAM)
              {reconciledLicenses.items.length > 0 && (
                <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                  {reconciledLicenses.items.length}
                </span>
              )}
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              href="?view=catalog&tab=all"
              label="Softwares distintos"
              active={initialTab === 'all'}
              value={catalogItems.length}
              subtitle="Aplicações únicas"
              icon={<Package className="h-4 w-4" />}
              tone="primary"
            />
            <KpiCard
              href="?view=catalog&tab=widespread"
              label="Instalações totais"
              active={initialTab === 'widespread'}
              value={totalInstallations}
              subtitle="Registros em todas as máquinas"
              icon={<Layers className="h-4 w-4" />}
              tone="neutral"
            />
            <KpiCard
              href="?view=catalog&tab=all"
              label="Editores / Fabricantes"
              value={editors.size}
              subtitle="Fabricantes distintos"
              icon={<Building2 className="h-4 w-4" />}
              tone="info"
            />
            <KpiCard
              href="?view=catalog&tab=blacklisted"
              label="Softwares restritos"
              active={initialTab === 'blacklisted'}
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
        </TabsContent>

        <TabsContent value="licenses" className="space-y-6">
          <TenantLicensesTable
            tenantSlug={tenant.slug}
            reconciledData={reconciledLicenses}
            canManageLicenses={canManageLicenses}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
