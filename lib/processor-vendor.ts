/**
 * Vocabulario unico de fabricante de processador — usado pelo Server Component
 * de /processors (que rotula cada modelo) e pela tabela client-side (que conta
 * os cards de KPI e aplica o filtro `?fabricante=`). Ficam no mesmo arquivo de
 * proposito: card, filtro e badge da linha precisam falar exatamente a mesma
 * lingua, senao o numero do card deixa de bater com a lista que ele filtra.
 */
export const PROCESSOR_VENDORS = ['Intel', 'AMD', 'Nao identificado'] as const

export type ProcessorVendor = (typeof PROCESSOR_VENDORS)[number]

/**
 * Fabricante inferido do nome do processador reportado pelo agente.
 *
 * Sprint 15 — colapsado para 3 valores. A versao anterior tinha um quarto
 * valor, 'Intel Xeon', que era um fabricante fantasma: o `if` de 'intel' vinha
 * antes do de 'xeon', entao "Intel Xeon E5-2680" caia em 'Intel' e so uma
 * string com "xeon" SEM "intel" (ex.: "Xeon E5-2680", formato que algumas
 * maquinas realmente reportam via WMI) produzia 'Intel Xeon'. O mesmo silicio
 * ganhava dois rotulos conforme a formatacao da string. Agora "xeon" e' Intel,
 * ponto — e o card "Intel" do grid conta todos os Intel.
 */
export function inferVendor(processorName: string): ProcessorVendor {
  const normalized = processorName.toLowerCase()
  if (normalized.includes('intel') || normalized.includes('xeon')) return 'Intel'
  if (normalized.includes('amd')) return 'AMD'
  return 'Nao identificado'
}

/**
 * Agrupa um rotulo de fabricante qualquer nos 3 grupos dos cards. Diferente de
 * `inferVendor` (que recebe o NOME do processador), aqui a entrada e' o proprio
 * `vendor` ja gravado na linha — inclusive rotulos legados como 'Intel Xeon'
 * que possam chegar por URL antiga (`?fabricante=Intel%20Xeon`) ou por dado
 * montado fora do Server Component. Tudo que nao for Intel nem AMD cai em
 * 'Nao identificado', garantindo que Intel + AMD + Nao identificado seja
 * SEMPRE o total — a soma que o grid de 4 numeros convida o usuario a fazer.
 */
export function getVendorGroup(vendor: string): ProcessorVendor {
  return inferVendor(vendor)
}
