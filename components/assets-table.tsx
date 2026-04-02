'use client'

import { Fragment, useState, useMemo } from 'react'
import { ChevronDown, Search, Filter, MoreVertical, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Asset } from '@/lib/mock-data'

interface AssetsTableProps {
  assets: Asset[]
}

export function AssetsTable({ assets }: AssetsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterOS, setFilterOS] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [sortField, setSortField] = useState<keyof Asset>('hostname')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredAndSortedAssets = useMemo(() => {
    let filtered = assets.filter((asset) => {
      const matchesSearch =
        asset.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.usuario.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesOS = !filterOS || asset.sistema === filterOS
      const matchesStatus = !filterStatus || asset.status === filterStatus

      return matchesSearch && matchesOS && matchesStatus
    })

    filtered.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.toLowerCase().localeCompare(bVal.toLowerCase())
          : bVal.toLowerCase().localeCompare(aVal.toLowerCase())
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })

    return filtered
  }, [assets, searchTerm, filterOS, filterStatus, sortField, sortOrder])

  const uniqueOS = Array.from(new Set(assets.map((a) => a.sistema)))
  const uniqueStatuses = Array.from(new Set(assets.map((a) => a.status)))

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Wifi className="h-4 w-4 text-green-500" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500/10 text-green-500'
      case 'offline':
        return 'bg-red-500/10 text-red-500'
      case 'warning':
        return 'bg-yellow-500/10 text-yellow-500'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const handleSort = (field: keyof Asset) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por hostname, IP ou usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Sistema {filterOS && `(${filterOS})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setFilterOS('')}>Todos os sistemas</DropdownMenuItem>
            {uniqueOS.map((os) => (
              <DropdownMenuItem key={os} onClick={() => setFilterOS(os)} className={filterOS === os ? 'bg-accent' : ''}>
                {os}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Status {filterStatus && `(${filterStatus})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setFilterStatus('')}>Todos os status</DropdownMenuItem>
            {uniqueStatuses.map((status) => (
              <DropdownMenuItem key={status} onClick={() => setFilterStatus(status)} className={filterStatus === status ? 'bg-accent' : ''}>
                {status}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(filterOS || filterStatus || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('')
              setFilterOS('')
              setFilterStatus('')
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-foreground w-10" />
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                <button onClick={() => handleSort('hostname')} className="flex items-center gap-2 hover:text-primary">
                  Hostname
                  <ChevronDown className={cn('h-4 w-4 transition-transform', sortField === 'hostname' && sortOrder === 'desc' && 'rotate-180')} />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                <button onClick={() => handleSort('ip')} className="flex items-center gap-2 hover:text-primary">
                  IP Address
                  <ChevronDown className={cn('h-4 w-4 transition-transform', sortField === 'ip' && sortOrder === 'desc' && 'rotate-180')} />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                <button onClick={() => handleSort('sistema')} className="flex items-center gap-2 hover:text-primary">
                  SO
                  <ChevronDown className={cn('h-4 w-4 transition-transform', sortField === 'sistema' && sortOrder === 'desc' && 'rotate-180')} />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                <button onClick={() => handleSort('ramTotal')} className="flex items-center gap-2 hover:text-primary">
                  RAM
                  <ChevronDown className={cn('h-4 w-4 transition-transform', sortField === 'ramTotal' && sortOrder === 'desc' && 'rotate-180')} />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredAndSortedAssets.map((asset) => (
              <Fragment key={asset.id}>
                <tr className={cn('hover:bg-secondary/30 transition-colors cursor-pointer', expandedId === asset.id && 'bg-secondary/50')}>
                  <td className="px-4 py-3">
                    <button onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)} className="text-muted-foreground hover:text-foreground">
                      <ChevronDown className={cn('h-4 w-4 transition-transform', expandedId === asset.id && 'rotate-180')} />
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{asset.hostname}</td>
                  <td className="px-4 py-3 text-muted-foreground">{asset.ip}</td>
                  <td className="px-4 py-3 text-muted-foreground">{asset.sistema}</td>
                  <td className="px-4 py-3 text-muted-foreground">{asset.ramTotal} GB</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(asset.status)}
                      <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', getStatusColor(asset.status))}>
                        {asset.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem>Ping</DropdownMenuItem>
                        <DropdownMenuItem>Acesso remoto</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
                {expandedId === asset.id && (
                  <tr className="bg-secondary/30">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Usuário</p>
                          <p className="text-sm text-foreground">{asset.usuario}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Processador</p>
                          <p className="text-sm text-foreground">{asset.processador}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Disco</p>
                          <p className="text-sm text-foreground">{asset.capacidadeGb} GB</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Última verificação</p>
                          <p className="text-sm text-foreground">{asset.dataColeta}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Memória RAM</p>
                        <div className="flex flex-wrap gap-2">
                          {asset.slots.map((slot, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                'px-2 py-1 rounded text-xs',
                                slot === 'Vazio' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                              )}
                            >
                              Slot {idx + 1}: {slot}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Armazenamento</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{asset.discos}</span>
                            <span className="text-foreground font-medium">
                              {asset.capacidadeGb - asset.espacoLivreGb} GB de {asset.capacidadeGb} GB
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${((asset.capacidadeGb - asset.espacoLivreGb) / asset.capacidadeGb) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedAssets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/10 py-12">
          <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum ativo encontrado</p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Total: {filteredAndSortedAssets.length} de {assets.length} ativos</span>
        <span>Página 1 de 1</span>
      </div>
    </div>
  )
}
