import { cn } from '@/lib/utils'

/**
 * Pilula de estado das listagens.
 *
 * O que este componente unifica e SO A FORMA: o mesmo raio, o mesmo padding,
 * a mesma escala tipografica e o mesmo indicador, para que a coluna
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
 * continua traduzindo o SEU enum para (tom, rotulo) e passando o resultado
 * para ca.
 *
 * --- Overhaul visual, Fase 1 -------------------------------------------------
 *
 * 1. O indicador virou um PONTO de estado (`status-dot`, app/globals.css) no
 *    lugar do icone (Wifi / WifiOff / Clock). O ponto herda a cor do tom por
 *    `currentColor` e traz um halo de 3px na mesma cor. Motivo: numa coluna de
 *    tabela, tres icones de linha diferentes ao lado de tres rotulos ja
 *    explicitos era redundancia — o rotulo ja diz "online", "ausente",
 *    "offline". O ponto e' o vocabulario da categoria (Datadog, Vercel,
 *    SentinelOne) e le mais rapido em varredura vertical.
 * 2. O ponto e' ESTATICO. Uma listagem de 142 maquinas com `animate-ping`
 *    renderizaria 142 animacoes simultaneas — custo de render real e ruido
 *    visual numa tabela densa. O ping animado fica reservado para indicador
 *    unico por tela.
 * 3. Saiu o `shadow-sm`. A pilula ja declara superficie pela borda; borda de
 *    1px sob sombra e' elevacao declarada duas vezes.
 */
const STATUS_PILL_TONE = {
  /** Online / dentro do esperado. */
  success: 'border-success/35 bg-success/10 text-success',
  /** Ausente (presenca) / warning (status efetivo) — atencao, nao falha. */
  warning: 'border-warning/35 bg-warning/10 text-warning',
  /** Informativo (ex.: versao do agente em dia) — sem juizo de saude. */
  info: 'border-info/35 bg-info/10 text-info',
  /** Offline como falha ativa (status efetivo de /computers e /servers). */
  destructive: 'border-destructive/35 bg-destructive/10 text-destructive',
  /**
   * Offline como ausencia de sinal, nao como incidente — usado pela PRESENCA
   * (/storage, dashboard), onde "offline" quer dizer apenas "nao ha coleta
   * recente" e nao deve gritar em vermelho na mesma tela em que barras de uso
   * de disco ja usam vermelho para "critico".
   */
  neutral: 'border-surface-line bg-muted/60 text-muted-foreground',
} as const

export type StatusPillTone = keyof typeof STATUS_PILL_TONE

export function StatusPill({
  tone,
  label,
  dot = true,
  className,
}: {
  tone: StatusPillTone
  label: string
  /**
   * Ponto de estado a esquerda do rotulo. Ligado por padrao. Desligar so faz
   * sentido quando a pilula ja esta ao lado de outro indicador do mesmo dado.
   */
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
        STATUS_PILL_TONE[tone],
        className
      )}
    >
      {dot && <span aria-hidden className="status-dot" />}
      {label}
    </span>
  )
}
