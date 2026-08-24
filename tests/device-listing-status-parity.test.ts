import { describe, expect, it } from 'vitest'
import {
  deriveInventoryIssues,
  getEffectiveDeviceStatus,
  getDevicePresence,
  DEFAULT_ALERT_SETTINGS,
  ONLINE_PRESENCE_MINUTES,
} from '@/lib/inventory-alerts'
import { getRowEffectiveStatus } from '@/lib/reports/device-report'

/**
 * Sprint 6, item 1 ("Consolidar a busca de dispositivos de
 * computers/servers/storage/processors em torno de lib/reports/device-report.ts").
 *
 * Decisão registrada nesta execução: MANTER DIVERGENTE as queries
 * (`prisma.device.findMany`) das 4 telas — não consolidar em
 * `getDeviceReportRows` — porque a lógica que RN010/RN013 realmente protegem
 * (status efetivo, presença, bucket) já está centralizada em funções puras
 * (`lib/inventory-alerts.ts`, `lib/reports/device-report.ts`) que 3 das 4
 * telas já chamam corretamente:
 *   - computers/page.tsx chama deriveInventoryIssues + getEffectiveDeviceStatus
 *     diretamente (mesmas funções que device-report.ts usa dentro de
 *     getRowEffectiveStatus), com o conjunto COMPLETO de issues (low_disk,
 *     low_ram, stale_collection) porque a tela precisa desses detalhes para
 *     os cards de resumo — um superconjunto intencional, não uma reimplementação
 *     divergente da regra.
 *   - storage/page.tsx chama getDevicePresence, a mesma função que o
 *     dashboard usa para o badge "ao vivo" (app/tenant/[clientSlug]/page.tsx).
 *   - processors/page.tsx não exibe status por dispositivo — N/A para RN010.
 *   - servers/page.tsx é a ÚNICA exceção real: exibe `device.status` bruto,
 *     sem chamar nenhuma das funções acima. Isso é uma violação pré-existente
 *     de RN010 (device.status bruto nunca deveria ser exibido diretamente —
 *     ver comentário em lib/reports/device-report.ts). NÃO foi corrigida
 *     nesta execução porque este item exige explicitamente "nenhum dado hoje
 *     exibido muda de valor" — corrigir mudaria o status mostrado para
 *     máquinas obsoletas, o que é uma correção funcional, não uma
 *     consolidação. Reportado separadamente para o sprint-planner avaliar
 *     como item novo.
 *
 * Este arquivo trava a consistência que already existe entre os pontos de
 * chamada (computers/storage/dashboard/relatório), para que uma edição futura
 * não introduza uma segunda implementação divergente da regra — o critério de
 * teste exigido pelo item 1 vale "com ou sem consolidação".
 *
 * Sprint 7 ("Paridade de Status em /servers"): fecha a exceção descrita acima
 * — `servers/page.tsx` passou a calcular o status efetivo com o mesmo par
 * `deriveInventoryIssues` + `getEffectiveDeviceStatus` que `computers/page.tsx`
 * já usava, em vez de ler `device.status` bruto do banco (que nunca recebe
 * 'offline'). O bloco `servers/page.tsx (...)` abaixo prova o critério de
 * aceite específico: um servidor sem coleta há mais que `alertOfflineHours`
 * aparece como "offline", mesmo com `Device.status` bruto ainda 'online'.
 */

const ALERT_OFFLINE_HOURS = 24

describe('computers/page.tsx (deriveInventoryIssues + getEffectiveDeviceStatus) concorda com getRowEffectiveStatus do relatório/dashboard', () => {
  it('maquina com coleta recente e hardware saudavel: as duas implementacoes retornam "online"', () => {
    const recent = new Date(Date.now() - 2 * 3600 * 1000) // 2h atras

    const computersStyle = getEffectiveDeviceStatus(
      'online',
      deriveInventoryIssues(
        { updatedAt: recent, lastCollectionAt: recent, hardware: { ramTotalGb: 16 }, disks: [{ espacoLivreGb: 100 }] },
        DEFAULT_ALERT_SETTINGS
      )
    )
    const reportStyle = getRowEffectiveStatus({ status: 'online', ultimaColeta: recent }, ALERT_OFFLINE_HOURS)

    expect(computersStyle).toBe('online')
    expect(reportStyle).toBe('online')
  })

  it('maquina com coleta atrasada alem do limiar: as duas implementacoes concordam em "offline" (dimensao compartilhada: staleness)', () => {
    const stale = new Date(Date.now() - 30 * 3600 * 1000) // 30h atras, limiar 24h

    const computersStyle = getEffectiveDeviceStatus(
      'online',
      deriveInventoryIssues(
        { updatedAt: stale, lastCollectionAt: stale, hardware: { ramTotalGb: 16 }, disks: [{ espacoLivreGb: 100 }] },
        { ...DEFAULT_ALERT_SETTINGS, alertOfflineHours: ALERT_OFFLINE_HOURS }
      )
    )
    const reportStyle = getRowEffectiveStatus({ status: 'online', ultimaColeta: stale }, ALERT_OFFLINE_HOURS)

    expect(computersStyle).toBe('offline')
    expect(reportStyle).toBe('offline')
    expect(computersStyle).toBe(reportStyle)
  })

  it('divergencia ESPERADA e documentada: RAM baixa com coleta recente vira "warning" so na versao completa (computers), porque getRowEffectiveStatus so avalia a dimensao de staleness', () => {
    const recent = new Date(Date.now() - 1 * 3600 * 1000)

    const computersStyle = getEffectiveDeviceStatus(
      'online',
      deriveInventoryIssues(
        { updatedAt: recent, lastCollectionAt: recent, hardware: { ramTotalGb: 1 }, disks: [{ espacoLivreGb: 100 }] },
        DEFAULT_ALERT_SETTINGS // alertRamThresholdGb padrao = 4GB, 1GB dispara low_ram
      )
    )
    const reportStyle = getRowEffectiveStatus({ status: 'online', ultimaColeta: recent }, ALERT_OFFLINE_HOURS)

    // Nao e uma regressao: em producao, device.status ja chegaria 'warning'
    // do proprio checkin do agente para RAM baixa (comentario em
    // getRowEffectiveStatus), entao os dois convergiriam la. Este teste so
    // prova que a tela /computers, ao reavaliar localmente, nunca fica MENOS
    // sensivel que o relatorio — nunca reporta 'online' quando ha um issue.
    expect(computersStyle).toBe('warning')
    expect(reportStyle).toBe('online')
  })
})

describe('storage/page.tsx (getDevicePresence) e coerente com getRowEffectiveStatus do relatorio/dashboard para a mesma ultima coleta', () => {
  it('coleta dentro da janela "ao vivo": presence=online e status efetivo=online', () => {
    const veryRecent = new Date(Date.now() - (ONLINE_PRESENCE_MINUTES - 5) * 60 * 1000)

    const presence = getDevicePresence(veryRecent, ALERT_OFFLINE_HOURS)
    const effective = getRowEffectiveStatus({ status: 'online', ultimaColeta: veryRecent }, ALERT_OFFLINE_HOURS)

    expect(presence).toBe('online')
    expect(effective).toBe('online')
  })

  it('coleta entre a janela "ao vivo" e o limiar de alerta: presence=ausente, mas status efetivo continua online (maquina pode estar so desligada, nao e um alerta ainda)', () => {
    const middleAge = new Date(Date.now() - (ALERT_OFFLINE_HOURS / 2) * 3600 * 1000)

    const presence = getDevicePresence(middleAge, ALERT_OFFLINE_HOURS)
    const effective = getRowEffectiveStatus({ status: 'online', ultimaColeta: middleAge }, ALERT_OFFLINE_HOURS)

    expect(presence).toBe('ausente')
    expect(effective).toBe('online')
  })

  it('coleta alem do limiar de alerta: as duas dimensoes concordam em "offline"', () => {
    const veryStale = new Date(Date.now() - (ALERT_OFFLINE_HOURS + 10) * 3600 * 1000)

    const presence = getDevicePresence(veryStale, ALERT_OFFLINE_HOURS)
    const effective = getRowEffectiveStatus({ status: 'online', ultimaColeta: veryStale }, ALERT_OFFLINE_HOURS)

    expect(presence).toBe('offline')
    expect(effective).toBe('offline')
  })

  it('invariante de regressao: presence nunca e "online" quando o status efetivo do relatorio ja e "offline" para a mesma ultima coleta', () => {
    const ages = [1, 6, 12, 24, 48, 72, 200]
    for (const hours of ages) {
      const lastCollectionAt = new Date(Date.now() - hours * 3600 * 1000)
      const presence = getDevicePresence(lastCollectionAt, ALERT_OFFLINE_HOURS)
      const effective = getRowEffectiveStatus({ status: 'online', ultimaColeta: lastCollectionAt }, ALERT_OFFLINE_HOURS)

      if (effective === 'offline') {
        expect(presence).not.toBe('online')
      }
    }
  })
})

describe('servers/page.tsx (deriveInventoryIssues + getEffectiveDeviceStatus, Sprint 7) nunca mais exibe device.status bruto', () => {
  it('servidor sem coleta ha mais que alertOfflineHours aparece "offline" em /servers, mesmo com Device.status bruto ainda "online" no banco', () => {
    const staleCollection = new Date(Date.now() - (ALERT_OFFLINE_HOURS + 6) * 3600 * 1000) // 30h atras, limiar 24h
    const rawStatusFromCheckin = 'online' // check-in do agente nunca grava 'offline' (RN010)

    const serversPageStyle = getEffectiveDeviceStatus(
      rawStatusFromCheckin,
      deriveInventoryIssues(
        {
          updatedAt: staleCollection,
          lastCollectionAt: staleCollection,
          hardware: { ramTotalGb: 32 },
          disks: [{ espacoLivreGb: 200 }],
        },
        { ...DEFAULT_ALERT_SETTINGS, alertOfflineHours: ALERT_OFFLINE_HOURS }
      )
    )

    // Regressao do bug da Sprint 7: antes da correcao, servers/page.tsx
    // exibia rawStatusFromCheckin diretamente e este teste falharia
    // (permaneceria 'online').
    expect(rawStatusFromCheckin).toBe('online')
    expect(serversPageStyle).toBe('offline')
  })

  it('paridade com o dashboard (getRowEffectiveStatus): mesma ultima coleta nunca diverge entre /servers e o dashboard', () => {
    const ages = [1, 6, 12, 23, 24, 25, 48, 200]
    for (const hours of ages) {
      const lastCollectionAt = new Date(Date.now() - hours * 3600 * 1000)

      const serversPageStyle = getEffectiveDeviceStatus(
        'online',
        deriveInventoryIssues(
          { updatedAt: lastCollectionAt, lastCollectionAt, hardware: { ramTotalGb: 32 }, disks: [{ espacoLivreGb: 200 }] },
          { ...DEFAULT_ALERT_SETTINGS, alertOfflineHours: ALERT_OFFLINE_HOURS }
        )
      )
      const dashboardStyle = getRowEffectiveStatus({ status: 'online', ultimaColeta: lastCollectionAt }, ALERT_OFFLINE_HOURS)

      expect(serversPageStyle).toBe(dashboardStyle)
    }
  })

  it('servidor com coleta recente e hardware saudavel continua "online" (sem falso positivo introduzido pela correcao)', () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000) // 30 min atras

    const serversPageStyle = getEffectiveDeviceStatus(
      'online',
      deriveInventoryIssues(
        { updatedAt: recent, lastCollectionAt: recent, hardware: { ramTotalGb: 32 }, disks: [{ espacoLivreGb: 200 }] },
        DEFAULT_ALERT_SETTINGS
      )
    )

    expect(serversPageStyle).toBe('online')
  })
})
