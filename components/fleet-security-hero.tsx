import Link from 'next/link'
import { ArrowRight, BrickWall, Lock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeviceReportRow, DeviceReportSummary } from '@/lib/reports/device-report'
import { Panel, PanelHeader } from '@/components/ui/panel'

/**
 * Hero de POSTURA DE SEGURANCA da frota (Overhaul visual — Fase 4).
 *
 * ---------------------------------------------------------------------------
 * De onde vem cada numero
 * ---------------------------------------------------------------------------
 *
 * Nada aqui e' recalculado a partir do banco. O componente COMPOE por cima de
 * `buildDeviceReportSummary` (lib/reports/device-report.ts, Sprint 13), que ja
 * e' a fonte de verdade dos agregados de frota e ja e' testada:
 *
 * - BitLocker  -> `securityCompliance.bitlockerActivePercent` / `bitlockerKnownCount`.
 *                 A agregacao por maquina ("pior caso": so conta como ativo se
 *                 TODOS os discos com dado conhecido estiverem 'on') vive em
 *                 `computeRowBitlockerStatus`, nao aqui.
 * - Firewall   -> `securityCompliance.firewallActivePercent` / `firewallKnownCount`.
 * - Antivirus  -> o escopo pediu "Antivirus ATIVO %", e esse agregado nao
 *                 existe em `securityCompliance` (que expoe
 *                 `antivirusUpdatedPercent`, "atualizado", que e' OUTRA
 *                 medida). Entao o percentual de "ativo" e' calculado aqui a
 *                 partir de `DeviceReportRow.antivirusAtivo` — pela MESMA
 *                 regra de denominador (so valores apurados) — e o percentual
 *                 de "atualizado", esse sim, e' lido do summary e exibido como
 *                 nota do mesmo bloco. Antivirus ligado e desatualizado nao e'
 *                 conformidade; mostrar so um dos dois esconderia isso.
 *
 * ---------------------------------------------------------------------------
 * A regra que o hero existe para nao violar (RN013 e correlatas)
 * ---------------------------------------------------------------------------
 *
 * Conformidade e' percentual sobre as maquinas com dado APURADO, nunca sobre a
 * frota inteira: "nao apurado" nao e' "desativado". Por isso todo indicador
 * carrega a base de calculo visivel ("42 de 51 maquinas com dado apurado") —
 * um percentual de conformidade sem denominador e' um numero que o operador
 * nao consegue auditar.
 *
 * E o caso limite: `computeBooleanCompliance` devolve a string '0.0' quando
 * NENHUMA maquina tem o dado apurado, porque um `.toFixed(1)` precisa devolver
 * alguma coisa. Renderizar isso como "0%" seria afirmar que a frota inteira
 * esta sem BitLocker quando a verdade e' que ninguem reportou. `knownCount`
 * existe exatamente para desfazer essa ambiguidade, e e' o que
 * `buildFleetSecurityIndicators` usa para transformar o percentual em `null` —
 * o estado "sem dado", que nao e' 0% nem NaN.
 */

export type FleetSecurityIndicatorKey = 'bitlocker' | 'antivirus' | 'firewall'

export type FleetSecurityIndicator = {
  key: FleetSecurityIndicatorKey
  label: string
  /** Percentual numerico, para a barra e para o tom. `null` = nenhuma maquina
   * com dado apurado (NUNCA 0 nesse caso). */
  percent: number | null
  /** Exatamente a string produzida pelo relatorio ('78.3'), para o hero e o PDF
   * nao divergirem por arredondamento. `null` acompanha `percent: null`. */
  percentLabel: string | null
  /** Denominador: maquinas com o dado apurado. */
  knownCount: number
  /** Frota inteira — o contraste entre os dois e' a base de calculo. */
  totalDevices: number
  /** Segunda leitura do mesmo bloco, quando existe (hoje so o antivirus tem). */
  note: string | null
}

/**
 * Limiares de TOM do medidor. Sao de exibicao, nao de dominio: nao alteram,
 * arredondam nem reclassificam nenhum numero — decidem apenas se a barra e'
 * verde, ambar ou vermelha. Ficam nomeados aqui, uma vez, em vez de espalhados
 * como numeros magicos dentro do JSX.
 */
export const FLEET_COMPLIANCE_TONE_THRESHOLDS = {
  /** >= 90% conforme: saudavel. */
  success: 90,
  /** >= 70% conforme: atencao. Abaixo disso, falha. */
  warning: 70,
} as const

export type FleetComplianceTone = 'success' | 'warning' | 'destructive' | 'neutral'

export function getFleetComplianceTone(percent: number | null): FleetComplianceTone {
  if (percent === null) return 'neutral'
  if (percent >= FLEET_COMPLIANCE_TONE_THRESHOLDS.success) return 'success'
  if (percent >= FLEET_COMPLIANCE_TONE_THRESHOLDS.warning) return 'warning'
  return 'destructive'
}

/** Percentual sobre o denominador de valores APURADOS — mesma regra de
 * `computeBooleanCompliance` (lib/reports/device-report.ts), aplicada aqui a
 * `antivirusAtivo`, que o summary nao agrega. Devolve `knownCount: 0` quando
 * nao ha dado, e quem consome decide o que fazer com isso. */
function computeKnownCompliance(values: Array<boolean | null>) {
  const known = values.filter((value): value is boolean => value !== null)
  const activeCount = known.filter(Boolean).length
  return {
    knownCount: known.length,
    percent: known.length > 0 ? ((activeCount / known.length) * 100).toFixed(1) : null,
  }
}

/** `'78.3'` + `knownCount` -> indicador de exibicao. `knownCount === 0` vira
 * `percent: null` (estado "sem dado"), nunca 0% e nunca NaN. */
function toIndicator(
  key: FleetSecurityIndicatorKey,
  label: string,
  percentLabel: string | null,
  knownCount: number,
  totalDevices: number,
  note: string | null
): FleetSecurityIndicator {
  const hasData = knownCount > 0 && percentLabel !== null
  const parsed = hasData ? Number.parseFloat(percentLabel) : Number.NaN

  return {
    key,
    label,
    percent: Number.isFinite(parsed) ? parsed : null,
    percentLabel: Number.isFinite(parsed) ? percentLabel : null,
    knownCount,
    totalDevices,
    note,
  }
}

export function buildFleetSecurityIndicators(
  summary: Pick<DeviceReportSummary, 'securityCompliance' | 'totalDevices'>,
  rows: Array<Pick<DeviceReportRow, 'antivirusAtivo'>>
): FleetSecurityIndicator[] {
  const { securityCompliance: compliance, totalDevices } = summary
  const antivirusActive = computeKnownCompliance(rows.map((row) => row.antivirusAtivo))

  const antivirusNote =
    compliance.antivirusUpdatedKnownCount > 0
      ? `Atualizado em ${compliance.antivirusUpdatedPercent}% das ${compliance.antivirusUpdatedKnownCount} com essa verificação apurada`
      : 'Nenhuma máquina reportou se a assinatura está atualizada'

  return [
    toIndicator(
      'bitlocker',
      'BitLocker habilitado',
      compliance.bitlockerActivePercent,
      compliance.bitlockerKnownCount,
      totalDevices,
      'Conta como habilitado só quando todos os discos apurados da máquina estão criptografados'
    ),
    toIndicator(
      'antivirus',
      'Antivírus ativo',
      antivirusActive.percent,
      antivirusActive.knownCount,
      totalDevices,
      antivirusNote
    ),
    toIndicator(
      'firewall',
      'Firewall ativo',
      compliance.firewallActivePercent,
      compliance.firewallKnownCount,
      totalDevices,
      null
    ),
  ]
}

const TONE_ICON_CLASS: Record<FleetComplianceTone, string> = {
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  destructive: 'bg-destructive/12 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}

const TONE_VALUE_CLASS: Record<FleetComplianceTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  neutral: 'text-muted-foreground',
}

const TONE_METER_CLASS: Record<FleetComplianceTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  neutral: 'bg-transparent',
}

const INDICATOR_ICON: Record<FleetSecurityIndicatorKey, React.ComponentType<{ className?: string }>> = {
  bitlocker: Lock,
  antivirus: ShieldCheck,
  firewall: BrickWall,
}

/**
 * Medidor de conformidade.
 *
 * Preenchimento CHAPADO no tom, e nao a escala em gradiente da barra de disco
 * (`disk-usage-scale`): la a cor por posicao significa sempre a mesma coisa
 * porque "mais" e' pior; aqui a semantica e' invertida (100% e' o alvo), entao
 * uma escala verde->vermelha da esquerda para a direita leria ao contrario.
 *
 * `role="img"` + `aria-label` porque cor nunca e' o unico canal (DESIGN.md §9).
 */
function ComplianceMeter({
  percent,
  tone,
  label,
  knownCount,
}: {
  percent: number | null
  tone: FleetComplianceTone
  label: string
  knownCount: number
}) {
  return (
    <div
      role="img"
      aria-label={
        percent === null
          ? `${label}: sem dado apurado`
          : `${label}: ${percent}% das ${knownCount} máquinas com dado apurado`
      }
      className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
    >
      {percent === null ? null : (
        <div
          className={cn('h-full rounded-full', TONE_METER_CLASS[tone])}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      )}
    </div>
  )
}

function IndicatorBlock({ indicator }: { indicator: FleetSecurityIndicator }) {
  const tone = getFleetComplianceTone(indicator.percent)
  const Icon = INDICATOR_ICON[indicator.key]

  return (
    <div className="px-5 py-5">
      <div className="flex items-center gap-3">
        <span className={cn('rounded-lg p-2', TONE_ICON_CLASS[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="section-label">{indicator.label}</p>
      </div>

      {indicator.percentLabel === null ? (
        <p className={cn('mt-4 text-3xl font-bold tracking-tight', TONE_VALUE_CLASS[tone])}>Sem dado</p>
      ) : (
        <p className={cn('mt-4 text-4xl font-bold tabular-nums tracking-tight', TONE_VALUE_CLASS[tone])}>
          {indicator.percentLabel}
          <span className="ml-0.5 text-2xl">%</span>
        </p>
      )}

      <ComplianceMeter
        percent={indicator.percent}
        tone={tone}
        label={indicator.label}
        knownCount={indicator.knownCount}
      />

      <p className="mt-2.5 text-xs text-muted-foreground">
        {indicator.knownCount === 0
          ? `Nenhuma das ${indicator.totalDevices} máquinas reportou este dado`
          : `${indicator.knownCount} de ${indicator.totalDevices} máquinas com dado apurado`}
      </p>

      {indicator.note ? <p className="mt-1 text-xs text-muted-foreground/80">{indicator.note}</p> : null}
    </div>
  )
}

export function FleetSecurityHero({
  indicators,
  totalDevices,
  reportsHref,
}: {
  indicators: FleetSecurityIndicator[]
  totalDevices: number
  reportsHref: string
}) {
  return (
    <Panel aria-labelledby="fleet-security-hero-title">
      {/* Recuo de 20px, nao 24px. O hero ficava imediatamente acima dos dois
          paineis do bloco duplo, na mesma largura, e comecava o texto 4px mais
          a direita que eles — desalinhamento visivel entre superficies
          verticalmente adjacentes. Agora os tres saem do mesmo PanelHeader. */}
      <PanelHeader className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 id="fleet-security-hero-title" className="text-base font-semibold text-card-foreground">
            Postura de segurança da frota
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            {totalDevices} máquina{totalDevices === 1 ? '' : 's'} no inventário. Cada percentual é calculado
            sobre as máquinas que reportaram o dado — &ldquo;não apurado&rdquo; nunca entra como
            &ldquo;desativado&rdquo;.
          </p>
        </div>
        <Link
          href={reportsHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Relatório completo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </PanelHeader>

      <div className="grid grid-cols-1 divide-y divide-surface-line border-t border-surface-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {indicators.map((indicator) => (
          <IndicatorBlock key={indicator.key} indicator={indicator} />
        ))}
      </div>
    </Panel>
  )
}
