'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import type { PieSectorDataItem } from 'recharts/types/polar/Pie'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'

interface ChartData {
  name: string
  value: number
  fill?: string
}

interface OsChartProps {
  data: ChartData[]
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

/** Tooltip tematizado (dark) do donut — mesmos tokens
 * de var(--popover)/var(--border) ja usados no Tooltip do BarChart abaixo. */
function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: ChartData }> }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border border-surface-line bg-popover px-3 py-2 text-sm text-popover-foreground shadow-xl">
      <p className="font-medium">{entry.name}</p>
      <p className="text-muted-foreground">
        {entry.value} máquina{entry.value === 1 ? '' : 's'}
      </p>
    </div>
  )
}

/** Fatia ativa (hover) desenhada ~8px maior que o raio normal, com stroke
 * destacado — o unico jeito de dar feedback visual direto na fatia em vez de
 * so na legenda lateral (que ja tinha hover: bg-muted/50). */
function ActivePieSector(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius = 0, startAngle, endAngle, fill } = props
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--background)"
      strokeWidth={2}
    />
  )
}

/**
 * Quantos SOs a legenda mostra antes de agrupar o resto em "+ N outros".
 *
 * A area do donut e' fixa em 180px, mas a legenda era uma lista sem limite: num
 * parque com muitos sistemas o card de SO crescia e o vizinho da mesma fileira
 * esticava com vazio no fundo. 4 linhas + a linha de agrupamento cabem nos
 * 180px do grafico, entao a altura do card nao depende mais do parque
 * (Sprint V19).
 */
export const OS_LEGEND_MAX_ITEMS = 4

/** Cor das fatias agrupadas em "outros" — a mesma do marcador da linha. */
const OTHERS_COLOR = 'var(--muted-foreground)'

/** Separa os itens visiveis da legenda do resto agrupado. `data` ja chega
 * ordenado por quantidade (buildDeviceReportSummary), entao os primeiros sao
 * os maiores. Com ate `max + 1` itens nao agrupa: trocar um item por uma linha
 * "+ 1 outro" so esconderia informacao sem economizar espaco. */
export function splitLegendItems(data: ChartData[], max = OS_LEGEND_MAX_ITEMS) {
  if (data.length <= max + 1) return { visible: data, hiddenCount: 0, hiddenValue: 0 }
  const hidden = data.slice(max)
  return {
    visible: data.slice(0, max),
    hiddenCount: hidden.length,
    hiddenValue: hidden.reduce((acc, item) => acc + item.value, 0),
  }
}

function getSliceColor(entry: ChartData, index: number, visibleCount: number) {
  if (index >= visibleCount) return OTHERS_COLOR
  return entry.fill || COLORS[index % COLORS.length]
}

interface OsDistributionChartProps extends OsChartProps {
  /** Caminho da listagem de maquinas do tenant (ex: getTenantPath(slug, 'computers')).
   * Sem essa prop o grafico fica so informativo, sem navegacao — mantem o
   * componente reutilizavel fora de um contexto de tenant. */
  computersPath?: string
}

export function OsDistributionChart({ data, computersPath }: OsDistributionChartProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0)
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const legend = splitLegendItems(data)

  function goToFilteredComputers(osName: string) {
    if (!computersPath) return
    router.push(`${computersPath}?os=${encodeURIComponent(osName)}`)
  }

  return (
    <Panel>
      <PanelHeader title="Distribuição por Sistema" description="Sistemas operacionais instalados" />
      <PanelBody>
        <div className="flex items-center gap-6">
          <div className="h-[180px] w-[180px] outline-none [&_.recharts-surface]:outline-none [&_*]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                  cursor={computersPath ? 'pointer' : 'default'}
                  activeIndex={activeIndex}
                  activeShape={ActivePieSector}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(undefined)}
                  onClick={computersPath ? (entry) => goToFilteredComputers(entry.name) : undefined}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getSliceColor(entry, index, legend.visible.length)} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            {legend.visible.map((item, index) => (
              <div
                key={item.name}
                role={computersPath ? 'button' : undefined}
                tabIndex={computersPath ? 0 : undefined}
                onClick={computersPath ? () => goToFilteredComputers(item.name) : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
                onKeyDown={
                  computersPath
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          goToFilteredComputers(item.name)
                        }
                      }
                    : undefined
                }
                className={`flex items-center justify-between rounded-md px-1.5 py-1 -mx-1.5 transition-colors ${
                  computersPath ? 'cursor-pointer hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring' : ''
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: getSliceColor(item, index, legend.visible.length) }}
                  />
                  <span className="truncate text-sm text-muted-foreground" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-card-foreground">{item.value}</span>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round((item.value / total) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
            {legend.hiddenCount > 0 ? (
              <div
                data-slot="legend-others"
                className="flex items-center justify-between px-1.5 py-1 -mx-1.5"
              >
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: OTHERS_COLOR }} />
                  {/* Sem link: "outros" nao e' um valor de ?os= — cada SO
                      escondido continua clicavel na propria fatia do donut. */}
                  <span className="text-sm text-muted-foreground">
                    + {legend.hiddenCount} outros
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-card-foreground">{legend.hiddenValue}</span>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round((legend.hiddenValue / total) * 100)}%)
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PanelBody>
    </Panel>
  )
}

interface RamChartProps {
  data: { name: string; value: number }[]
  title?: string
  description?: string
}

/**
 * Apesar do nome, generico o bastante pra qualquer distribuicao "quantidade
 * de maquinas por faixa" — usado tambem para uso de disco. A alternativa
 * (somar RAM/disco de todas as maquinas num unico numero) nao representa
 * nenhuma maquina real quando o parque tem hardware heterogeneo.
 */
export function RamDistributionChart({
  data,
  title = 'Distribuição de Memória',
  description = 'Quantidade de RAM por máquina',
}: RamChartProps) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      <PanelBody>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke="var(--muted-foreground)" 
                fontSize={12}
                width={80}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }}
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--card-foreground)'
                }}
                labelStyle={{ color: 'var(--card-foreground)' }}
                formatter={(value: number) => [`${value} máquina${value === 1 ? '' : 's'}`, 'Quantidade']}
              />
              <Bar 
                dataKey="value" 
                fill="var(--chart-1)" 
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PanelBody>
    </Panel>
  )
}
