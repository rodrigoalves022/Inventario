'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
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

export type TenantPeripheralRow = {
  id: string
  category: 'monitor' | 'printer' | 'usb'
  deviceId: string
  hostname: string
  name: string
  vendorOrDriver: string | null
  serialOrPort: string | null
  detail: string
  isNetworkPrinter: boolean
}

type CategoryFilter = 'all' | TenantPeripheralRow['category']

const CATEGORY_LABEL: Record<TenantPeripheralRow['category'], string> = {
  monitor: 'Monitor',
  printer: 'Impressora',
  usb: 'USB',
}

const CATEGORY_TONE: Record<TenantPeripheralRow['category'], StatusPillTone> = {
  monitor: 'info',
  printer: 'neutral',
  usb: 'warning',
}

export function TenantPeripheralsTable({
  rows,
  tenantSlug,
  initialCategory = 'all',
  deviceBasePath = `/app/${tenantSlug}/assets`,
}: {
  rows: TenantPeripheralRow[]
  tenantSlug: string
  initialCategory?: CategoryFilter
  deviceBasePath?: string
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>(initialCategory)
  const [prevInitialCategory, setPrevInitialCategory] = useState(initialCategory)
  if (prevInitialCategory !== initialCategory) {
    setPrevInitialCategory(initialCategory)
    setCategory(initialCategory)
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (category !== 'all' && row.category !== category) return false
      if (!term) return true
      return [row.name, row.hostname, row.vendorOrDriver, row.serialOrPort, row.detail].some((value) =>
        value?.toLowerCase().includes(term)
      )
    })
  }, [rows, search, category])

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="monitor">Monitores</TabsTrigger>
            <TabsTrigger value="printer">Impressoras</TabsTrigger>
            <TabsTrigger value="usb">USB</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar periféricos"
            placeholder="Buscar periférico, máquina, série..."
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
                <th className={TABLE_HEAD_CLASS}>Categoria</th>
                <th className={TABLE_HEAD_CLASS}>Periférico</th>
                <th className={TABLE_HEAD_CLASS}>Fabricante / Driver / VID:PID</th>
                <th className={TABLE_HEAD_CLASS}>Série / Porta</th>
                <th className={TABLE_HEAD_CLASS}>Detalhes</th>
                <th className={TABLE_HEAD_CLASS}>Máquina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {rows.length === 0
                      ? 'Nenhum periférico reportado pelos agentes deste tenant.'
                      : 'Nenhum periférico corresponde ao filtro.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={`${row.category}-${row.id}`} className={STATIC_ROW_HOVER_CLASS}>
                    <td className={TABLE_CELL_CLASS}>
                      <StatusPill tone={CATEGORY_TONE[row.category]} label={CATEGORY_LABEL[row.category]} />
                    </td>
                    <td className={cn(TABLE_CELL_CLASS, 'font-medium')}>{row.name}</td>
                    <td className={cn(TABLE_DATA_CELL_CLASS, 'data-mono text-muted-foreground')}>
                      {row.vendorOrDriver ?? '—'}
                    </td>
                    <td className={cn(TABLE_DATA_CELL_CLASS, 'data-mono text-muted-foreground')}>
                      {row.serialOrPort ?? '—'}
                    </td>
                    <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>{row.detail}</td>
                    <td className={TABLE_CELL_CLASS}>
                      <Link
                        href={`${deviceBasePath}/${row.deviceId}`}
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
