'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/ui/status-pill'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_DATA_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_SHELL_CLASS,
} from '@/lib/table-styles'

export type TenantLocalAccountRow = {
  id: string
  deviceId: string
  hostname: string
  usuario: string
  isAdmin: boolean
  habilitada: boolean
  senhaNuncaExpira: boolean
  riskLevel: 'critical' | 'warning' | 'ok'
}

type AccountFilter = 'all' | 'admin_enabled' | 'never_expires' | 'critical'

const FILTERS: Record<AccountFilter, (row: TenantLocalAccountRow) => boolean> = {
  all: () => true,
  admin_enabled: (row) => row.habilitada && row.isAdmin,
  never_expires: (row) => row.habilitada && row.senhaNuncaExpira,
  critical: (row) => row.riskLevel === 'critical',
}

export function TenantLocalAccountsTable({ rows, tenantSlug }: { rows: TenantLocalAccountRow[]; tenantSlug: string }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AccountFilter>('all')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (!FILTERS[filter](row)) return false
      if (!term) return true
      return [row.usuario, row.hostname].some((value) => value.toLowerCase().includes(term))
    })
  }, [rows, search, filter])

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as AccountFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="admin_enabled">Admins ativos</TabsTrigger>
            <TabsTrigger value="never_expires">Senha sem expiração</TabsTrigger>
            <TabsTrigger value="critical">Risco crítico</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar contas locais"
            placeholder="Buscar conta ou máquina..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className={cn(TABLE_SHELL_CLASS, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th className={TABLE_HEAD_CLASS}>Conta Local</th>
                <th className={TABLE_HEAD_CLASS}>Privilégio</th>
                <th className={TABLE_HEAD_CLASS}>Estado</th>
                <th className={TABLE_HEAD_CLASS}>Expiração de Senha</th>
                <th className={TABLE_HEAD_CLASS}>Risco de Compliance</th>
                <th className={TABLE_HEAD_CLASS}>Máquina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {rows.length === 0
                      ? 'Nenhuma conta local reportada pelos agentes deste tenant.'
                      : 'Nenhuma conta corresponde ao filtro.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className={STATIC_ROW_HOVER_CLASS}>
                    <td className={cn(TABLE_DATA_CELL_CLASS, 'data-mono font-medium')}>{row.usuario}</td>
                    <td className={TABLE_CELL_CLASS}>
                      {row.isAdmin ? (
                        <StatusPill
                          tone={row.riskLevel === 'critical' ? 'destructive' : 'warning'}
                          label="Administrador"
                        />
                      ) : (
                        <StatusPill tone="neutral" label="Padrão" />
                      )}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {row.habilitada ? (
                        <StatusPill tone="success" label="Habilitada" />
                      ) : (
                        <StatusPill tone="neutral" label="Desabilitada" />
                      )}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {row.senhaNuncaExpira ? (
                        <StatusPill tone="warning" label="Nunca expira" />
                      ) : (
                        <StatusPill tone="success" label="Expira normalmente" />
                      )}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {row.riskLevel === 'critical' ? (
                        <StatusPill tone="destructive" label="Crítico" />
                      ) : row.riskLevel === 'warning' ? (
                        <StatusPill tone="warning" label="Atenção" />
                      ) : (
                        <StatusPill tone="success" label="Conforme" />
                      )}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <Link
                        href={`/app/${tenantSlug}/assets/${row.deviceId}`}
                        className="text-primary hover:underline focus-visible:underline"
                      >
                        {row.hostname}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
