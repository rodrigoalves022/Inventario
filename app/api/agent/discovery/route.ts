import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateAgentApiKey, authErrorResponse } from '@/lib/auth'
import { agentDiscoverySchema } from '@/lib/schemas/agent-discovery'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Sprint 14 (RF028) — ingestao da varredura de descoberta de rede do agente.
 * Modelada linha a linha sobre `app/api/agent/metrics/route.ts`:
 * validateAgentApiKey -> rateLimit -> parse JSON -> Zod -> try/catch com log e
 * 500 generico.
 *
 * DOIS gates fail-closed antes de qualquer escrita, nesta ordem:
 *
 * 1. `auth.agentAuth.clientId` nulo (agente legado registrado sem tenant, o
 *    mesmo caso que `app/api/agent/checkin/route.ts` ja trata) -> 202 sem
 *    gravar. `DiscoveredDevice.clientId` e' NOT NULL de proposito: linha orfa
 *    de descoberta nao teria como ser exibida nem escopada por tenant depois.
 *
 * 2. `Client.discoveryEnabled === false` -> 202 sem gravar. Esse e' O gate que
 *    importa (RN017): o agente tambem recebe o flag na resposta do check-in e
 *    evita varrer a toa, mas isso e' otimizacao, nao seguranca — um agente
 *    adulterado/desatualizado que varra e envie mesmo assim nao consegue
 *    persistir nada.
 *
 * 202 (nao 4xx) nos dois casos, pelo mesmo motivo do `device_not_registered`
 * da rota de metricas: nao e' erro do agente, e' uma condicao esperada do
 * ciclo — responder 4xx faria o agente logar falha e tentar de novo.
 */
export async function POST(req: NextRequest) {
  const auth = await validateAgentApiKey(req)
  if (!auth.ok) return authErrorResponse(auth)

  // Ciclo normal e' 1x a cada 6h — a varredura e' o ciclo mais CARO do agente
  // (centenas de conexoes TCP + SNMP na LAN do cliente). Limite bem mais
  // restritivo que o de checkin/metrics: 5 por hora ja cobre reinstalacao do
  // agente, teste manual via subcomando `discovery` e alguma folga de relogio,
  // sem permitir que um agente em loop transforme a rota num amplificador de
  // varredura.
  const limit = rateLimit(`discovery:${auth.agentAuth.id}`, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  const rawBody = await req.json().catch(() => null)
  if (!rawBody) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const parsed = agentDiscoverySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido.', details: parsed.error.format() },
      { status: 400 }
    )
  }

  const body = parsed.data
  const clientId = auth.agentAuth.clientId

  if (!clientId) {
    return NextResponse.json({ ok: false, reason: 'agent_without_client' }, { status: 202 })
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { discoveryEnabled: true },
    })

    // Cliente inexistente cai no mesmo ramo que cliente com a varredura
    // desligada: fail-closed, sem distinguir os dois casos para o agente.
    if (!client?.discoveryEnabled) {
      return NextResponse.json({ ok: false, reason: 'discovery_disabled' }, { status: 202 })
    }

    // Um upsert por IP, sequencial. Uma /24 rende no maximo ~254 linhas a cada
    // 6 HORAS por agente — nao vale a complexidade (nem o custo de lock) de
    // uma transacao unica de centenas de statements, e o upsert por
    // `(clientId, ip)` e' idempotente: reenviar o mesmo ciclo nao duplica nada.
    //
    // `firstSeenAt` NAO aparece no `update` de proposito: e' a data em que
    // aquele IP apareceu pela primeira vez na rede do cliente, e precisa
    // sobreviver a toda varredura seguinte. So o `create` a define (default
    // now()).
    const seenAt = new Date()
    let upserted = 0

    for (const device of body.devices) {
      await prisma.discoveredDevice.upsert({
        where: { clientId_ip: { clientId, ip: device.ip } },
        create: {
          clientId,
          ip: device.ip,
          mac: device.mac ?? null,
          hostname: device.hostname ?? null,
          vendor: device.vendor ?? null,
          deviceType: device.deviceType,
          snmpSysDescr: device.snmpSysDescr ?? null,
          openPorts: device.openPorts ?? null,
          firstSeenAt: seenAt,
          lastSeenAt: seenAt,
        },
        update: {
          mac: device.mac ?? null,
          hostname: device.hostname ?? null,
          vendor: device.vendor ?? null,
          deviceType: device.deviceType,
          snmpSysDescr: device.snmpSysDescr ?? null,
          openPorts: device.openPorts ?? null,
          lastSeenAt: seenAt,
        },
      })
      upserted += 1
    }

    return NextResponse.json({ ok: true, upserted }, { status: 200 })
  } catch (error) {
    console.error('[agent/discovery] Erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
