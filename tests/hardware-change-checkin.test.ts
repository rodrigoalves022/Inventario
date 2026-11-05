import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/agent/checkin/route'
import { NextRequest } from 'next/server'

// Mock de prisma
const hardwareChanges: Array<any> = []
const alertEvents: Array<any> = []
const alertRules: Array<any> = []
let existingDevice: any = null

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: vi.fn(async () => []),
    agentCheckLog: { create: vi.fn(async () => ({})) },
    device: {
      findUnique: vi.fn(async () => existingDevice),
      upsert: vi.fn(async () => ({
        id: 'dev-1',
        hostname: 'SRV-TEST',
        status: 'online',
      })),
      update: vi.fn(async () => ({})),
    },
    hardware: {
      findUnique: vi.fn(async () => existingDevice?.hardware ?? null),
      upsert: vi.fn(async () => ({})),
    },
    network: {
      deleteMany: vi.fn(async () => ({})),
      createMany: vi.fn(async () => ({})),
    },
    disk: {
      findMany: vi.fn(async () => existingDevice?.disks ?? []),
      deleteMany: vi.fn(async () => ({})),
      createMany: vi.fn(async () => ({})),
    },
    software: {
      deleteMany: vi.fn(async () => ({})),
      createMany: vi.fn(async () => ({})),
    },
    securityPosture: {
      upsert: vi.fn(async () => ({})),
    },
    collectionLog: {
      create: vi.fn(async () => ({})),
    },
    hardwareChange: {
      createMany: vi.fn(async ({ data }: { data: any[] }) => {
        hardwareChanges.push(...data)
        return { count: data.length }
      }),
    },
    alertRule: {
      findMany: vi.fn(async () => alertRules),
    },
    alertEvent: {
      findMany: vi.fn(async () => alertEvents.filter((e) => !e.resolvedAt)),
      create: vi.fn(async ({ data }: { data: any }) => {
        const row = { id: `evt-${alertEvents.length + 1}`, ...data, resolvedAt: null }
        alertEvents.push(row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const item = alertEvents.find((e) => e.id === where.id)
        if (item) Object.assign(item, data)
        return item
      }),
    },
    tenantAlertSettings: {
      findUnique: vi.fn(async () => null),
    },
    webhookEndpoint: {
      findMany: vi.fn(async () => []),
    },
  },
}))

vi.mock('@/lib/server-url', () => ({
  getCurrentServerUrl: vi.fn(async () => 'https://inventario.example.com'),
}))

vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => ({
    ok: true,
    agentAuth: { id: 'auth-1', clientId: 'client-1', revokedAt: null },
  })),
  authErrorResponse: vi.fn(),
}))

vi.mock('@/lib/agent-binary', () => ({
  getAgentBinarySha256: vi.fn(async () => null),
  LATEST_AGENT_VERSION: '1.1.0',
}))

vi.mock('@/lib/webhook-endpoints', () => ({
  dispatchClientWebhookEndpoints: vi.fn(async () => {}),
}))

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/agent/checkin', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'valid-key',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/agent/checkin — Hardware Change Detection (Wave W21 / Sprint A78)', () => {
  beforeEach(() => {
    hardwareChanges.length = 0
    alertEvents.length = 0
    alertRules.length = 0
    existingDevice = null
  })

  it('detecta alteracao de hardware (RAM reduzida) e persiste em HardwareChange', async () => {
    // Configura dispositivo existente com 16 GB de RAM
    existingDevice = {
      id: 'dev-1',
      hostname: 'SRV-TEST',
      serial: 'SN12345',
      status: 'online',
      usuario: 'admin',
      hardware: {
        processador: 'Intel Xeon',
        ramTotalGb: 16,
        slot1: '8GB',
        slot2: '8GB',
        slot3: null,
        slot4: null,
        placaMae: 'Supermicro',
      },
      disks: [{ unidade: 'C:', modelo: 'NVMe 1TB', capacidadeGb: 1000 }],
    }

    // Checkin reportando apenas 8 GB (pente removido do slot2)
    const payload = {
      hostname: 'SRV-TEST',
      serial: 'SN12345',
      processador: 'Intel Xeon',
      ramTotalGb: 8,
      slot1: '8GB',
      slot2: null,
      placaMae: 'Supermicro',
      discos: [{ unidade: 'C:', modelo: 'NVMe 1TB', capacidadeGb: 1000 }],
    }

    const res = await POST(buildRequest(payload))
    expect(res.status).toBe(200)

    expect(hardwareChanges).toHaveLength(2)
    const ramChange = hardwareChanges.find((c) => c.component === 'RAM' && c.action === 'REMOVED' && c.description.includes('Memória RAM reduzida'))
    expect(ramChange).toBeDefined()
    expect(ramChange.previousVal).toBe('16 GB')
    expect(ramChange.currentVal).toBe('8 GB')
  })

  it('abre AlertEvent quando ha regra de alerta para hardware_changed', async () => {
    existingDevice = {
      id: 'dev-1',
      hostname: 'SRV-TEST',
      serial: 'SN12345',
      status: 'online',
      hardware: {
        processador: 'Intel Xeon',
        ramTotalGb: 16,
        placaMae: 'Supermicro',
      },
      disks: [],
    }

    alertRules.push({
      id: 'rule-hw',
      clientId: 'client-1',
      name: 'Alerta de Mudança de Hardware',
      metric: 'hardware_changed',
      severity: 'warning',
      enabled: true,
      pattern: null,
    })

    const payload = {
      hostname: 'SRV-TEST',
      processador: 'AMD EPYC', // Troca de processador!
      ramTotalGb: 16,
      placaMae: 'Supermicro',
    }

    const res = await POST(buildRequest(payload))
    expect(res.status).toBe(200)

    expect(hardwareChanges).toHaveLength(1)
    expect(hardwareChanges[0].component).toBe('CPU')

    expect(alertEvents).toHaveLength(1)
    expect(alertEvents[0].metric).toBe('hardware_changed')
    expect(alertEvents[0].message).toContain('Mudança de hardware detectada')
    expect(alertEvents[0].message).toContain('Processador alterado')
  })
})
