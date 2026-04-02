'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ChartData {
  name: string
  value: number
  fill?: string
}

interface OsChartProps {
  data: ChartData[]
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export function OsDistributionChart({ data }: OsChartProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0)

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-card-foreground">
          Distribuição por Sistema
        </CardTitle>
        <CardDescription>
          Sistemas operacionais instalados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="h-[180px] w-[180px]">
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
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-3">
            {data.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: item.fill || COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-card-foreground">{item.value}</span>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round((item.value / total) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatusChart({ data }: OsChartProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0)

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-card-foreground">
          Status dos Dispositivos
        </CardTitle>
        <CardDescription>
          Estado atual da rede
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="h-[180px] w-[180px]">
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
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-3">
            {data.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="h-3 w-3 rounded-full" 
                    style={{ backgroundColor: item.fill || COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-card-foreground">{item.value}</span>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round((item.value / total) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface RamChartProps {
  data: { name: string; value: number }[]
}

export function RamDistributionChart({ data }: RamChartProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-card-foreground">
          Distribuição de Memória
        </CardTitle>
        <CardDescription>
          Quantidade de RAM por máquina
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
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
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--card-foreground)'
                }}
                labelStyle={{ color: 'var(--card-foreground)' }}
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
      </CardContent>
    </Card>
  )
}
