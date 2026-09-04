import { cn } from '@/lib/utils'

/**
 * Pilula de estado das listagens (ajuste pos-Sprint 15).
 *
 * O que este componente unifica e SO A FORMA: o mesmo raio, o mesmo padding,
 * a mesma escala tipografica e o mesmo tamanho de icone, para que a coluna
 * "Status" de /computers, /servers, /storage e do dashboard pareca a mesma
 * coisa ao alternar entre as telas.
 *
 * O que este componente deliberadamente NAO unifica e o VOCABULARIO. As telas
 * medem duas coisas diferentes e nao intercambiaveis:
 *
 * - PRESENCA (`DevicePresence`: online | ausente | offline) — derivada da
 *   ultima coleta por `getDevicePresence`, nunca do `Device.status` bruto do
 *   banco (RN010). Usada em /storage e no dashboard.
 * - STATUS EFETIVO (`online | warning | offline`) — de
 *   `getEffectiveDeviceStatus`, que combina presenca com alertas de
 *   disco/RAM. Usado em /computers e /servers.
 *
 * "ausente" NAO e "warning": um e uma afirmacao sobre contato com o agente, o
 * outro sobre saude da maquina. Colapsar os dois num enum unico seria mudar
 * regra de dominio disfarcada de padronizacao visual, entao cada chamador
 * continua traduzindo o SEU enum para (tom, icone, rotulo) e passando o
 * resultado para ca.
 */
const STATUS_PILL_TONE = {
  /** Online / dentro do esperado. */
  success: 'border-success/30 bg-success/10 text-success',
  /** Ausente (presenca) / warning (status efetivo) — atencao, nao falha. */
  warning: 'border-warning/30 bg-warning/10 text-warning',
  /** Offline como falha ativa (status efetivo de /computers e /servers). */
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
  /**
   * Offline como ausencia de sinal, nao como incidente — usado pela PRESENCA
   * (/storage, dashboard), onde "offline" quer dizer apenas "nao ha coleta
   * recente" e nao deve gritar em vermelho na mesma tela em que barras de uso
   * de disco ja usam vermelho para "critico".
   */
  neutral: 'border-border bg-muted text-muted-foreground',
} as const

export type StatusPillTone = keyof typeof STATUS_PILL_TONE

/** Classe do icone esperada pelos chamadores (`<Wifi className={STATUS_PILL_ICON_CLASS} />`). */
export const STATUS_PILL_ICON_CLASS = 'h-3 w-3'

export function StatusPill({
  tone,
  icon,
  label,
  className,
}: {
  tone: StatusPillTone
  /** Icone ja dimensionado com `STATUS_PILL_ICON_CLASS`. Opcional. */
  icon?: React.ReactNode
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm',
        STATUS_PILL_TONE[tone],
        className
      )}
    >
      {icon}
      {label}
    </span>
  )
}
