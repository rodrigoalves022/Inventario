'use client'

import { cn } from '@/lib/utils'

const SUMMARY_TONE = {
  primary: { icon: 'bg-primary/10 text-primary', value: 'text-foreground', ring: 'ring-primary' },
  warning: { icon: 'bg-warning/10 text-warning', value: 'text-warning', ring: 'ring-warning' },
  destructive: { icon: 'bg-destructive/10 text-destructive', value: 'text-destructive', ring: 'ring-destructive' },
} as const

/**
 * Card de resumo compacto (label + valor + ícone), usado em grids de KPI
 * clicáveis do tenant (ex: TenantComputersTable, reusado por /computers,
 * /servers e /assets). Quando `onClick` é passado, o card é o próprio
 * controle de filtro (substitui um dropdown de criticidade — o número que o
 * usuário já olha é o botão que ele aperta, em vez de duas UIs mostrando o
 * mesmo dado).
 *
 * Extraído de components/tenant-computers-table.tsx para components/ui/ por
 * ser reusado fora do arquivo onde nasceu — correção de hover feita aqui uma
 * vez só, não em cada instância avulsa.
 */
export function SummaryCard({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: keyof typeof SUMMARY_TONE
  active?: boolean
  onClick?: () => void
}) {
  const tones = SUMMARY_TONE[tone]
  const Comp = onClick ? 'button' : 'div'

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        'rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md hover:bg-accent/30 hover:border-accent/50',
        onClick && 'cursor-pointer hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && `ring-2 ${tones.ring}`
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('rounded-lg p-2', tones.icon)}>{icon}</div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn('text-2xl font-bold', tones.value)}>{value}</p>
    </Comp>
  )
}
