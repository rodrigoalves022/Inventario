import { describe, expect, it } from 'vitest'
import { agentCheckinSchema } from '@/lib/schemas/agent-checkin'
import { agentMetricsSchema } from '@/lib/schemas/agent-metrics'

// Sprint 10, item 6 (RF005-RF010, RF012). Valida os schemas Zod de coleta
// DIRETAMENTE via .parse()/.safeParse() — sem rota HTTP, sem Prisma (isso e'
// o item 5, em tests/agent-checkin-route.test.ts e
// tests/agent-metrics-route.test.ts). Nunca mockar o schema sob teste: aqui
// o schema real e' chamado, ponto final.

function minimalValidPayload() {
  return {
    hostname: 'PC-TESTE-01',
    agentVersion: '1.0.0',
  }
}

describe('agentCheckinSchema — payload minimo valido', () => {
  it('aceita o payload minimo (so hostname obrigatorio) com defaults de array vazio', () => {
    const parsed = agentCheckinSchema.parse(minimalValidPayload())
    expect(parsed.hostname).toBe('PC-TESTE-01')
    expect(parsed.software).toEqual([])
    expect(parsed.redes).toEqual([])
    expect(parsed.discos).toEqual([])
    expect(parsed.dispositivosUsb).toEqual([])
  })

  it('rejeita payload sem hostname', () => {
    const result = agentCheckinSchema.safeParse({ agentVersion: '1.0.0' })
    expect(result.success).toBe(false)
  })

  it('rejeita hostname vazio', () => {
    const result = agentCheckinSchema.safeParse({ hostname: '' })
    expect(result.success).toBe(false)
  })
})

describe('agentCheckinSchema — limite de itens de software (RF008)', () => {
  // O schema real usa z.array(softwareSchema).max(2000) — confirmado lendo
  // lib/schemas/agent-checkin.ts:109 nesta implementacao, nao presumido.
  function buildSoftwareList(count: number) {
    return Array.from({ length: count }, (_, i) => ({ nome: `App ${i}` }))
  }

  it('aceita exatamente 2000 itens de software (limite, inclusive)', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-SOFTWARE',
      software: buildSoftwareList(2000),
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.software).toHaveLength(2000)
    }
  })

  it('rejeita 2001 itens de software (excede o limite em 1)', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-SOFTWARE',
      software: buildSoftwareList(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe('agentCheckinSchema — hardware (RF005)', () => {
  it('aceita payload de hardware completo', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-HW',
      sistema: 'Windows 11 Pro',
      versaoSO: '23H2',
      processador: 'Intel i7-12700',
      ramTotalGb: 32,
      placaMae: 'ASUS Z690',
    })
    expect(result.success).toBe(true)
  })

  it('rejeita ramTotalGb nao-inteiro', () => {
    const result = agentCheckinSchema.safeParse({ hostname: 'PC-HW', ramTotalGb: 16.5 })
    expect(result.success).toBe(false)
  })
})

describe('agentCheckinSchema — rede (RF006)', () => {
  it('aceita interface de rede sem dhcp/isPrimary (schema nao aplica default nesses campos — o `?? true`/`?? false` acontece na rota, na escrita do Prisma, nao aqui)', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-NET',
      redes: [{ ip: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:FF' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // networkSchema so tem .optional().nullable() em dhcp/isPrimary, sem
      // .default() — confirmado lendo lib/schemas/agent-checkin.ts:8-9.
      // Ausente no payload permanece `undefined` apos o parse; o default
      // real (`network.dhcp ?? true`) so acontece em
      // app/api/agent/checkin/route.ts:156-157.
      expect(result.data.redes[0].dhcp).toBeUndefined()
      expect(result.data.redes[0].isPrimary).toBeUndefined()
    }
  })

  it('rejeita mais de 20 interfaces de rede', () => {
    const redes = Array.from({ length: 21 }, (_, i) => ({ ip: `10.0.0.${i}` }))
    const result = agentCheckinSchema.safeParse({ hostname: 'PC-NET', redes })
    expect(result.success).toBe(false)
  })
})

describe('agentCheckinSchema — disco (RF007)', () => {
  it('aceita disco com criptografia em um dos 3 valores validos', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-DISK',
      discos: [{ unidade: 'C:', capacidadeGb: 500, espacoLivreGb: 120, criptografia: 'on' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejeita valor de criptografia fora do enum (on/off/unknown)', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-DISK',
      discos: [{ unidade: 'C:', criptografia: 'yes' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('agentCheckinSchema — postura de seguranca (RF009)', () => {
  it('aceita booleanos nulos (nao apurado nunca vira "desativado")', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-SEC',
      seguranca: { antivirusAtivo: null, firewallAtivo: null, uacAtivo: null },
    })
    expect(result.success).toBe(true)
  })

  it('rejeita tipo errado em campo booleano de seguranca', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-SEC',
      seguranca: { antivirusAtivo: 'sim' },
    })
    expect(result.success).toBe(false)
  })
})

describe('agentCheckinSchema — contas locais (RF010)', () => {
  it('aceita conta local valida com defaults', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-ACC',
      contasLocais: [{ usuario: 'admin-local' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.contasLocais[0]).toMatchObject({
        isAdmin: false,
        habilitada: true,
        senhaNuncaExpira: false,
      })
    }
  })

  it('rejeita conta local sem "usuario" (obrigatorio)', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-ACC',
      contasLocais: [{ isAdmin: true }],
    })
    expect(result.success).toBe(false)
  })
})

describe('agentCheckinSchema — periféricos (RF012): monitores, impressoras, USB', () => {
  it('aceita monitores, impressoras e dispositivos USB validos', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-PERIF',
      monitores: [{ fabricante: 'Dell', modelo: 'U2720Q', polegadas: 27, ano: 2022 }],
      impressoras: [{ nome: 'HP LaserJet' }],
      dispositivosUsb: [{ nome: 'Mouse Logitech', vendorId: '046D', productId: 'C077', serial: 'SN123' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejeita ano de fabricacao de monitor fora do intervalo 1990-2100', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-PERIF',
      monitores: [{ ano: 1899 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejeita item USB sem "nome" (obrigatorio)', () => {
    const result = agentCheckinSchema.safeParse({
      hostname: 'PC-PERIF',
      dispositivosUsb: [{ vendorId: '046D', productId: 'C077' }],
    })
    expect(result.success).toBe(false)
  })

  // ACHADO (nao um bug — confirmado lendo o codigo, nao presumido): o dedupe
  // de UsbDevice por VID+PID+serial citado no achado original do
  // requirements-auditor NAO acontece no schema Zod — usbDeviceSchema
  // (lib/schemas/agent-checkin.ts) nao tem nenhuma logica de dedupe, so
  // validacao de forma. O dedupe real esta implementado do lado do AGENTE
  // (Go), em agent-go/internal/collectors/windows/peripherals.go:208-246
  // (funcao collectUsbDevices, chave `vendorId+productId+serial`, mapa
  // `seen`) — o agente ja envia a lista deduplicada, e o schema so valida a
  // FORMA do que chega. A rota app/api/agent/checkin/route.ts tambem nao
  // dedupe (usbDevice.createMany grava exatamente o array recebido). Este
  // teste documenta esse comportamento explicitamente: o schema aceita
  // duplicatas de VID+PID+serial sem filtrar, provando que a garantia de
  // unicidade e' responsabilidade do agente, nao do servidor.
  it('ACHADO: o schema NAO deduplica USB por VID+PID+serial — duplicatas passam intactas (dedupe real esta em agent-go, nao aqui)', () => {
    const duplicated = [
      { nome: 'Headset USB (audio)', vendorId: '1234', productId: 'ABCD', serial: 'SN-1' },
      { nome: 'Headset USB (hid)', vendorId: '1234', productId: 'ABCD', serial: 'SN-1' },
    ]
    const result = agentCheckinSchema.safeParse({ hostname: 'PC-USB-DUP', dispositivosUsb: duplicated })
    expect(result.success).toBe(true)
    if (result.success) {
      // As DUAS entradas com a mesma chave VID+PID+serial sobrevivem a
      // validacao — se o servidor algum dia precisar deduplicar de
      // verdade (ex.: um agente de terceiros que nao dedupe), este e' o
      // ponto onde a logica precisaria entrar, hoje inexistente.
      expect(result.data.dispositivosUsb).toHaveLength(2)
    }
  })

  it('rejeita mais de 200 dispositivos USB', () => {
    const dispositivosUsb = Array.from({ length: 201 }, (_, i) => ({ nome: `USB ${i}` }))
    const result = agentCheckinSchema.safeParse({ hostname: 'PC-USB-MANY', dispositivosUsb })
    expect(result.success).toBe(false)
  })
})

describe('agentMetricsSchema — payload de metricas (RF011)', () => {
  it('aceita payload minimo valido', () => {
    const result = agentMetricsSchema.safeParse({ hostname: 'PC-METRICS' })
    expect(result.success).toBe(true)
  })

  it('aceita payload completo de metricas', () => {
    const result = agentMetricsSchema.safeParse({
      hostname: 'PC-METRICS',
      agentVersion: '1.0.0',
      cpuPercent: 45.5,
      ramUsadaGb: 8,
      ramTotalGb: 16,
      discoUsadoGb: 200,
      discoLivreGb: 300,
      uptimeSegundos: 3600,
    })
    expect(result.success).toBe(true)
  })

  it('rejeita cpuPercent fora do intervalo 0-100', () => {
    const result = agentMetricsSchema.safeParse({ hostname: 'PC-METRICS', cpuPercent: 150 })
    expect(result.success).toBe(false)
  })

  it('rejeita uptimeSegundos negativo', () => {
    const result = agentMetricsSchema.safeParse({ hostname: 'PC-METRICS', uptimeSegundos: -1 })
    expect(result.success).toBe(false)
  })

  it('rejeita payload sem hostname', () => {
    const result = agentMetricsSchema.safeParse({ cpuPercent: 10 })
    expect(result.success).toBe(false)
  })
})
