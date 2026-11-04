'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/ui/status-pill'
import { TablePagination } from '@/components/ui/table-pagination'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  DEFAULT_PAGE_SIZE,
  getPageSlice,
  replaceListQueryParams,
  type PageSize,
} from '@/lib/table-pagination'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_DATA_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
  TABLE_SHELL_CLASS,
} from '@/lib/table-styles'

/** Item do catalogo consolidado, ja serializavel pelo Server Component. */
export type SoftwareCatalogItem = {
  key: string
  nome: string
  versao: string | null
  editor: string | null
  installationsCount: number
  machines: Array<{ id: string; hostname: string }>
  isBlacklisted: boolean
}

export type SoftwareFilter = 'all' | 'blacklisted' | 'widespread'

const MAX_VISIBLE_MACHINES = 3

export function TenantSoftwareTable({
  items,
  tenantSlug,
  initialTab = 'all',
  deviceBasePath,
}: {
  items: SoftwareCatalogItem[]
  tenantSlug: string
  initialTab?: SoftwareFilter
  deviceBasePath?: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<SoftwareFilter>(initialTab)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [lastInitialTab, setLastInitialTab] = useState(initialTab)
  if (lastInitialTab !== initialTab) {
    setLastInitialTab(initialTab)
    setFilter(initialTab)
    setPage(1)
  }
  const basePath = deviceBasePath ?? `/app/${tenantSlug}/assets`

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === 'blacklisted' && !item.isBlacklisted) return false
      if (filter === 'widespread' && item.installationsCount <= 1) return false
      if (!term) return true
      return (
        item.nome.toLowerCase().includes(term) ||
        (item.versao?.toLowerCase().includes(term) ?? false) ||
        (item.editor?.toLowerCase().includes(term) ?? false) ||
        item.machines.some((machine) => machine.hostname.toLowerCase().includes(term))
      )
    })
  }, [items, search, filter])

  /** Filtrar -> paginar: o rodape conta `filtered` (o que a aba e a busca
   * deixaram), nunca o catalogo inteiro que o Server Component carregou. */
  const slice = getPageSlice(filtered, page, pageSize)

  /** Trocar aba ou busca volta para a pagina 1 — caso contrario o usuario na
   * pagina 3 de "Todos" cai numa pagina vazia ao abrir "Restritos".
   *
   * A aba vai para `?tab=` via `history.replaceState` (sem round-trip de RSC,
   * ver lib/table-pagination.ts); "Todos" some da URL, como os defaults de
   * paginacao. A pagina em si fica so em estado local. */
  function changeFilter(nextFilter: SoftwareFilter) {
    setFilter(nextFilter)
    setPage(1)
    replaceListQueryParams({ tab: nextFilter !== 'all' ? nextFilter : null })
  }

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch)
    setPage(1)
  }

  function changePageSize(nextPageSize: PageSize) {
    setPageSize(nextPageSize)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => changeFilter(value as SoftwareFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="blacklisted">Restritos / Blacklist</TabsTrigger>
            <TabsTrigger value="widespread">Em múltiplas máquinas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar software"
            placeholder="Buscar software, versão, fabricante ou máquina..."
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className={cn(TABLE_SHELL_CLASS, 'overflow-hidden')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASS}>
                <th className={TABLE_HEAD_CLASS}>Software</th>
                <th className={TABLE_HEAD_CLASS}>Versão</th>
                <th className={TABLE_HEAD_CLASS}>Fabricante / Editor</th>
                <th className={TABLE_HEAD_CLASS}>Conformidade</th>
                <th className={TABLE_HEAD_CLASS}>Máquinas (Qtd)</th>
                <th className={TABLE_HEAD_CLASS}>Dispositivos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {items.length === 0
                      ? 'Nenhum software inventariado ainda para este tenant.'
                      : 'Nenhum software corresponde ao filtro.'}
                  </td>
                </tr>
              ) : (
                slice.items.map((item) => (
                  <tr key={item.key} className={STATIC_ROW_HOVER_CLASS}>
                    <td className={cn(TABLE_CELL_CLASS, 'font-medium')}>{item.nome}</td>
                    <td data-mono className={cn(TABLE_DATA_CELL_CLASS, 'text-muted-foreground')}>
                      {item.versao ?? '-'}
                    </td>
                    <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>{item.editor ?? '-'}</td>
                    <td className={TABLE_CELL_CLASS}>
                      {item.isBlacklisted ? (
                        <StatusPill tone="destructive" label="Restrito" />
                      ) : (
                        <StatusPill tone="success" label="Permitido" />
                      )}
                    </td>
                    <td data-mono className={cn(TABLE_DATA_CELL_CLASS, 'tabular-nums')}>
                      {item.installationsCount}
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.machines.slice(0, MAX_VISIBLE_MACHINES).map((machine) => (
                          <Link
                            key={machine.id}
                            href={`${basePath}/${machine.id}`}
                            className="text-primary hover:underline focus-visible:underline"
                          >
                            {machine.hostname}
                          </Link>
                        ))}
                        {item.machines.length > MAX_VISIBLE_MACHINES ? (
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                            +{item.machines.length - MAX_VISIBLE_MACHINES}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          slice={slice}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
          itemNoun={{ one: 'software', other: 'softwares' }}
          navLabel="Paginação do catálogo de softwares"
        />
      </div>
    </div>
  )
}
