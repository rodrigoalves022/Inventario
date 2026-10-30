import prisma from '@/lib/prisma'
import { requirePortalContext } from '@/lib/portal-context'
import { Download, KeyRound, ShieldAlert, ShieldCheck, UserCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { TenantLocalAccountsTable, type TenantLocalAccountRow } from '@/components/tenant-local-accounts-table'

const TABS = ['all', 'admin_enabled', 'never_expires', 'critical'] as const

export default async function PortalLocalAccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const context = await requirePortalContext()
  const { tab } = (await searchParams) ?? {}
  const initialTab = TABS.find((t) => t === tab) ?? 'all'

  const devices = await prisma.device.findMany({
    where: { clientId: context.clientId, agentAuth: { is: { isActive: true } } },
    select: {
      id: true,
      hostname: true,
      localAccounts: {
        select: { id: true, usuario: true, isAdmin: true, habilitada: true, senhaNuncaExpira: true },
        orderBy: { usuario: 'asc' },
      },
    },
    orderBy: { hostname: 'asc' },
  })

  const rows: TenantLocalAccountRow[] = devices.flatMap((device) =>
    device.localAccounts.map((account) => {
      const riskLevel: TenantLocalAccountRow['riskLevel'] =
        account.habilitada && account.isAdmin && account.senhaNuncaExpira
          ? 'critical'
          : account.habilitada && (account.isAdmin || account.senhaNuncaExpira)
            ? 'warning'
            : 'ok'
      return {
        id: account.id,
        deviceId: device.id,
        hostname: device.hostname,
        usuario: account.usuario,
        isAdmin: account.isAdmin,
        habilitada: account.habilitada,
        senhaNuncaExpira: account.senhaNuncaExpira,
        riskLevel,
      }
    })
  )

  const enabledAdminsCount = rows.filter((r) => r.habilitada && r.isAdmin).length
  const neverExpiresCount = rows.filter((r) => r.habilitada && r.senhaNuncaExpira).length
  const criticalCount = rows.filter((r) => r.riskLevel === 'critical').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas Locais e Privilégios</h1>
          <p className="text-muted-foreground">
            Auditoria de contas locais, administradores habilitados e políticas de expiração de senha nas máquinas de{' '}
            {context.clientName}.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a href={`/api/tenant/${context.clientSlug}/local-accounts/csv`}>
            <Download className="h-4 w-4" />
            Baixar CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de contas locais"
          value={rows.length}
          icon={<Users className="h-4 w-4" />}
          tone="primary"
          href="?tab=all"
        />
        <KpiCard
          label="Admins locais ativos"
          value={enabledAdminsCount}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone={enabledAdminsCount > 0 ? 'warning' : 'success'}
          href="?tab=admin_enabled"
        />
        <KpiCard
          label="Senha nunca expira (ativas)"
          value={neverExpiresCount}
          icon={<KeyRound className="h-4 w-4" />}
          tone={neverExpiresCount > 0 ? 'warning' : 'neutral'}
          href="?tab=never_expires"
        />
        <KpiCard
          label="Risco crítico (Admin + Sem expiração)"
          value={criticalCount}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={criticalCount > 0 ? 'destructive' : 'success'}
          emphasizeValue={criticalCount > 0}
          href="?tab=critical"
        />
      </div>

      <Panel>
        <PanelHeader
          icon={<UserCheck className="h-4 w-4" />}
          title="Contas locais por máquina"
          description="Contas locais reportadas pelos agentes deste tenant."
        />
        <PanelBody flush>
          <TenantLocalAccountsTable
            rows={rows}
            tenantSlug={context.clientSlug}
            initialTab={initialTab}
            deviceBasePath="/portal/devices"
          />
        </PanelBody>
      </Panel>
    </div>
  )
}
