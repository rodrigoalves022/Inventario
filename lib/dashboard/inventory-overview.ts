import { computeDiskUsagePercent, getDiskUsageTier } from '@/lib/disk-usage'
import { getTenantPath } from '@/lib/tenant-links'

/**
 * Helpers puros do dashboard do tenant (Overhaul visual — Fase 4).
 *
 * Vivem aqui, fora do Server Component, por dois motivos: para serem testados
 * sem montar a pagina inteira (que puxa `auth()` e Prisma), e para a pagina
 * nao precisar de `Date.now()` no corpo do componente — a regra
 * `react-hooks/purity` do lint trata chamada impura durante o render como
 * erro (mesmo padrao de `computeCheckinLatencyMinutes` em
 * app/portal/devices/[id]/page.tsx).
 */

/**
 * Idade legivel da coleta. Nao precisa de precisao de segundo: e' so pra bater
 * o olho e entender a idade do dado. Movida de `app/app/[clientSlug]/page.tsx`
 * na Fase 4, quando os paineis de descoberta de rede e de auditoria passaram a
 * precisar do mesmo formato — dois formatos de "ha quanto tempo" na mesma tela
 * seriam dois vocabularios para a mesma pergunta.
 */
export function formatRelativeAge(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000))
  if (minutes < 1) return 'agora mesmo'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `há ${days} dia${days === 1 ? '' : 's'}`
  const months = Math.round(days / 30)
  return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
}

export type DeviceDiskFootprint = {
  disks: Array<{ capacidadeGb: number | null; espacoLivreGb: number | null }>
}

/**
 * Quantas MAQUINAS estao na faixa critica de uso de disco.
 *
 * Reproduz, deliberadamente linha a linha, o criterio de
 * `components/tenant-storage-table.tsx`: descarta disco sem capacidade
 * apurada, classifica o device pelo PIOR disco (maior % usado, nunca uma
 * media entre discos heterogeneos) e chama `getDiskUsageTier` — a MESMA fonte
 * de verdade dos limiares (`lib/disk-usage.ts`).
 *
 * Isso importa porque o card de KPI do dashboard navega para
 * `/storage?faixa=critical`: se a contagem viesse dos buckets de
 * `buildDeviceReportSummary` (que somam a capacidade de todos os discos do
 * device antes de calcular a %), o numero do card divergiria da lista que o
 * clique abre — o card mentiria sobre o proprio destino.
 */
export function countCriticalDiskDevices(devices: DeviceDiskFootprint[]): number {
  let count = 0

  for (const device of devices) {
    const usable = device.disks.filter((disk) => (disk.capacidadeGb ?? 0) > 0)
    if (usable.length === 0) continue

    const worstUsagePercent = usable.reduce((worst, disk) => {
      const capacidadeGb = disk.capacidadeGb ?? 0
      const usedGb = Math.max(capacidadeGb - (disk.espacoLivreGb ?? 0), 0)
      return Math.max(worst, computeDiskUsagePercent(capacidadeGb, usedGb))
    }, 0)

    if (getDiskUsageTier(worstUsagePercent) === 'critical') count += 1
  }

  return count
}

/**
 * Resolve o link de um dispositivo a partir do HOSTNAME.
 *
 * `DeviceReportRow` (lib/reports/device-report.ts) nao carrega o `id` do
 * device, e o painel de alerta critico precisa levar a algum lugar. Em vez de
 * um segundo `findMany` com todas as relacoes, a pagina busca so
 * `{ id, hostname }` e monta este resolvedor.
 *
 * Hostname NAO e' unico no schema: quando dois devices do tenant repetem o
 * mesmo hostname, o link vira a listagem unificada ja filtrada por busca em
 * vez de apontar para um dos dois arbitrariamente. Errar o alvo de navegacao
 * silenciosamente seria pior do que exigir um clique a mais.
 */
export function createDeviceHrefResolver(
  devices: Array<{ id: string; hostname: string }>,
  tenantSlug: string
): (hostname: string) => string {
  const uniqueIdByHostname = new Map<string, string | null>()

  for (const device of devices) {
    uniqueIdByHostname.set(device.hostname, uniqueIdByHostname.has(device.hostname) ? null : device.id)
  }

  return (hostname: string) => {
    const id = uniqueIdByHostname.get(hostname)
    if (id) return getTenantPath(tenantSlug, `assets/${id}`)
    return `${getTenantPath(tenantSlug, 'assets')}?search=${encodeURIComponent(hostname)}`
  }
}
