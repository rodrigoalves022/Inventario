'use client'

import { useMemo, useState } from 'react'
import { Printer, Router, HardDrive, Search, HelpCircle, Radar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { STATIC_ROW_HOVER_CLASS, TABLE_CELL_CLASS, TABLE_HEAD_CLASS, TABLE_HEAD_ROW_CLASS } from '@/lib/table-styles'
import type { DiscoveredDeviceType } from '@/lib/schemas/agent-discovery'

/**
 * Sprint 14 (RF028). Linha ja serializada pelo Server Component
 * (`app/app/[clientSlug]/network/page.tsx`): datas em ISO string, nunca
 * `Date` — Server Component nao passa `Date` para Client Component sem
 * serializar, e a formatacao localizada acontece aqui, no cliente, para nao
 * introduzir chamada impura no corpo do Server Component.
 */
export type DiscoveredDeviceRow = {
  id: string
  ip: string
  mac: string | null
  hostname: string | null
  vendor: string | null
  deviceType: DiscoveredDeviceType
  snmpSysDescr: string | null
  openPorts: string | null
  firstSeenAt: string
  lastSeenAt: string
}

/**
 * As 4 abas pedidas no escopo. `ACCESS_POINT` fica agrupado com
 * roteadores/switches (e' equipamento de rede, e um filtro proprio para uma
 * categoria que raramente aparece so faria a barra crescer); `UNKNOWN` so
 * aparece em "Todos" — nao existe aba "Outros" de proposito, senao a barra
 * viraria uma lista de tipos em vez de um filtro util.
 */
const TYPE_FILTERS: Record<'all' | 'printers' | 'network' | 'nas', readonly DiscoveredDeviceType[] | null> = {
  all: null,
  printers: ['PRINTER'],
  network: ['ROUTER', 'SWITCH', 'ACCESS_POINT'],
  nas: ['NAS'],
}

type TypeFilter = keyof typeof TYPE_FILTERS

const TYPE_LABEL: Record<DiscoveredDeviceType, string> = {
  PRINTER: 'Impressora',
  SWITCH: 'Switch',
  ROUTER: 'Roteador',
  NAS: 'NAS',
  ACCESS_POINT: 'Access Point',
  UNKNOWN: 'Não identificado',
}

/**
 * Uma cor por familia de equipamento, todas em tokens do tema (nunca hex
 * cru): impressora em `info`, equipamento de rede em `primary`, NAS em
 * `warning`, nao identificado em `muted`.
 */
const TYPE_BADGE_CLASS: Record<DiscoveredDeviceType, string> = {
  PRINTER: 'border-info/40 bg-info/5 text-info',
  SWITCH: 'border-primary/40 bg-primary/5 text-primary',
  ROUTER: 'border-primary/40 bg-primary/5 text-primary',
  ACCESS_POINT: 'border-primary/40 bg-primary/5 text-primary',
  NAS: 'border-warning/40 bg-warning/5 text-warning',
  UNKNOWN: 'border-border bg-muted/40 text-muted-foreground',
}

function TypeIcon({ deviceType }: { deviceType: DiscoveredDeviceType }) {
  if (deviceType === 'PRINTER') return <Printer className="h-3 w-3" />
  if (deviceType === 'NAS') return <HardDrive className="h-3 w-3" />
  if (deviceType === 'UNKNOWN') return <HelpCircle className="h-3 w-3" />
  return <Router className="h-3 w-3" />
}

function formatLastSeen(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}

export function DiscoveredDevicesTable({
  devices,
  discoveryEnabled,
}: {
  devices: DiscoveredDeviceRow[]
  /** Muda apenas o texto de estado vazio: sem a varredura habilitada, "nenhum
   * dispositivo" nao e' um dado sobre a rede, e' a feature desligada. */
  discoveryEnabled: boolean
}) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const filtered = useMemo(() => {
    const allowedTypes = TYPE_FILTERS[typeFilter]
    const term = search.trim().toLowerCase()

    return devices.filter((device) => {
      if (allowedTypes && !allowedTypes.includes(device.deviceType)) {
        return false
      }
      if (!term) return true
      // Busca por IP/Hostname/MAC (o escopo pede exatamente estes tres) —
      // `vendor`/`snmpSysDescr` ficam de fora para a busca continuar previsivel:
      // digitar "hp" nao deve trazer todo switch cujo banner de firmware
      // menciona HP.
      return (
        device.ip.toLowerCase().includes(term) ||
        (device.hostname?.toLowerCase().includes(term) ?? false) ||
        (device.mac?.toLowerCase().includes(term) ?? false)
      )
    })
  }, [devices, search, typeFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="printers">Impressoras</TabsTrigger>
            <TabsTrigger value="network">Roteadores/Switches</TabsTrigger>
            <TabsTrigger value="nas">NAS</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar por IP, hostname ou MAC"
            placeholder="Buscar por IP, hostname ou MAC..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              <th className={TABLE_HEAD_CLASS}>IP</th>
              <th className={TABLE_HEAD_CLASS}>MAC</th>
              <th className={TABLE_HEAD_CLASS}>Hostname</th>
              <th className={TABLE_HEAD_CLASS}>Tipo</th>
              <th className={TABLE_HEAD_CLASS}>Fabricante / Descrição SNMP</th>
              <th className={TABLE_HEAD_CLASS}>Portas</th>
              <th className={TABLE_HEAD_CLASS}>Última Coleta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {!discoveryEnabled ? (
                    <span className="inline-flex items-center gap-2">
                      <Radar className="h-4 w-4" />
                      Varredura de rede desabilitada para este tenant. Habilite em Computadores → Configurações de
                      Alerta → Descoberta de Rede.
                    </span>
                  ) : devices.length === 0 ? (
                    'Nenhum dispositivo descoberto ainda. A varredura roda a cada 6 horas em cada agente.'
                  ) : (
                    'Nenhum dispositivo descoberto corresponde ao filtro.'
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((device) => (
                <tr key={device.id} className={STATIC_ROW_HOVER_CLASS}>
                  <td className={cn(TABLE_CELL_CLASS, 'font-mono font-medium')}>{device.ip}</td>
                  <td className={cn(TABLE_CELL_CLASS, 'font-mono text-muted-foreground')}>{device.mac ?? '-'}</td>
                  <td className={TABLE_CELL_CLASS}>{device.hostname ?? '-'}</td>
                  <td className={TABLE_CELL_CLASS}>
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide',
                        TYPE_BADGE_CLASS[device.deviceType]
                      )}
                    >
                      <TypeIcon deviceType={device.deviceType} />
                      {TYPE_LABEL[device.deviceType]}
                    </Badge>
                  </td>
                  <td className={cn(TABLE_CELL_CLASS, 'max-w-xs text-muted-foreground')}>
                    {device.vendor ? <div className="font-medium text-foreground">{device.vendor}</div> : null}
                    {device.snmpSysDescr ? (
                      <div className="truncate text-xs" title={device.snmpSysDescr}>
                        {device.snmpSysDescr}
                      </div>
                    ) : null}
                    {!device.vendor && !device.snmpSysDescr ? '-' : null}
                  </td>
                  <td className={cn(TABLE_CELL_CLASS, 'font-mono text-xs text-muted-foreground')}>
                    {device.openPorts ?? '-'}
                  </td>
                  <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>{formatLastSeen(device.lastSeenAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
