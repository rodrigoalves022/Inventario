import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateAgentApiKey, authErrorResponse } from '@/lib/auth'
import { agentMetricsSchema } from '@/lib/schemas/agent-metrics'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const DEFAULT_METRICS_RETENTION_DAYS = 90

export async function POST(req: NextRequest) {
  const auth = await validateAgentApiKey(req)
  if (!auth.ok) return authErrorResponse(auth)

  // Ciclo normal e' 1x/10min + coletas forcadas ocasionais (collect_metrics_now).
  const limit = rateLimit(`metrics:${auth.agentAuth.id}`, { limit: 20, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  const rawBody = await req.json().catch(() => null)
  if (!rawBody) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const parsed = agentMetricsSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido.', details: parsed.error.format() },
      { status: 400 }
    )
  }

  const body = parsed.data

  try {
    // O ciclo de metricas roda independente do checkin completo; se o
    // agente ainda nao concluiu a primeira coleta, o Device nao existe.
    // Nao ha o que registrar — nao e erro, e' apenas cedo demais.
    const device = await prisma.device.findUnique({
      where: { agentAuthId: auth.agentAuth.id },
      select: { id: true, clientId: true },
    })

    if (!device) {
      return NextResponse.json(
        { ok: false, reason: 'device_not_registered' },
        { status: 202 }
      )
    }

    let retentionDays = DEFAULT_METRICS_RETENTION_DAYS
    if (device.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: device.clientId },
        select: { metricsRetentionDays: true },
      })
      if (client?.metricsRetentionDays) {
        retentionDays = client.metricsRetentionDays
      }
    }

    await prisma.metricSample.create({
      data: {
        deviceId: device.id,
        clientId: device.clientId,
        cpuPercent: body.cpuPercent ?? null,
        ramUsadaGb: body.ramUsadaGb ?? null,
        ramTotalGb: body.ramTotalGb ?? null,
        discoUsadoGb: body.discoUsadoGb ?? null,
        discoLivreGb: body.discoLivreGb ?? null,
        uptimeSegundos: body.uptimeSegundos ?? null,
      },
    })

    // Expurgo a cada ingestao, nao em job separado (este projeto ainda nao
    // tem onde rodar um cron): apoiado no indice (deviceId, collectedAt),
    // o corte por dispositivo e' uma varredura de faixa, nao uma varredura
    // de tabela — barato mesmo rodando em toda amostra.
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    await prisma.metricSample.deleteMany({
      where: { deviceId: device.id, collectedAt: { lt: cutoff } },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('[agent/metrics] Erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
