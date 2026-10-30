import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { isServerOperatingSystem } from '@/lib/device-classification'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'

type Params = { clientSlug: string }

/**
 * Busca de dispositivos por hostname ou IP, para a paleta de comando
 * (Ctrl+K / Cmd+K). Backlog item 13.
 *
 * ISOLAMENTO (RNF004). O `clientSlug` da URL NUNCA e' usado como credencial:
 * ele so nomeia o tenant que a sessao esta pedindo, e `canAccessTenant`
 * decide se aquela sessao pode ve-lo. O escopo da consulta sai de
 * `getTenantDeviceWhere(clientSlug)`, que filtra pela relacao `agentAuth ->
 * client`, e nunca de um id vindo do cliente.
 *
 * Resposta 404 unica para "tenant nao existe" e "tenant existe mas nao e'
 * acessivel" — mesmo padrao de `requireTenantContext` e das demais rotas de
 * `/api/tenant`. A diferenca 403 vs 404 revelaria a existencia de tenants de
 * outra organizacao.
 *
 * RATE LIMIT. A paleta dispara uma requisicao a cada pausa de digitacao, entao
 * esta rota recebe muito mais chamadas por sessao do que as demais. O teto e'
 * por IP. Vale registrar o que ele NAO e': `lib/rate-limit.ts` guarda os
 * baldes num `Map` em memoria, portanto o limite e' por PROCESSO — numa
 * implantacao com mais de uma instancia o teto efetivo se multiplica. E' o
 * mesmo controle que as rotas publicas do agente ja usam, e a limitacao esta
 * anotada em docs/SPRINTS.md como item de backlog.
 */

const searchSchema = z.object({
  // Minimo de 2 caracteres: com 1 caractere a consulta casaria com quase toda
  // a base e a paleta devolveria ruido, gastando uma varredura por tecla.
  q: z.string().trim().min(2).max(64),
})

/** Teto de resultados. A paleta mostra uma lista curta, nao uma listagem — quem
 * precisa de listagem tem /computers, /servers e /assets, que paginam. */
const SEARCH_LIMIT = 8

function notFound() {
  return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { clientSlug } = await params

  const session = await auth()
  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(clientSlug)

  // Leitura: mesmo escopo das demais rotas de leitura do tenant — qualquer
  // sessao que possa VER o tenant. A guarda vem antes do rate limit para que
  // uma sessao de fora nem consuma balde do tenant alvo.
  if (!session?.user || !tenant || !canAccessTenant(user, tenant)) {
    return notFound()
  }

  const limit = rateLimit(`device-search:${tenant.id}:${getClientIp(req)}`, {
    limit: 30,
    windowMs: 60 * 1000,
  })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  const parsed = searchSchema.safeParse({ q: req.nextUrl.searchParams.get('q') })
  if (!parsed.success) {
    // 200 com lista vazia, nao 400: a paleta consulta a cada tecla e um termo
    // ainda curto e' estado normal de digitacao, nao erro do chamador.
    return NextResponse.json({ devices: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const term = parsed.data.q
  // AnyDesk IDs sao guardados sem espacos; o usuario costuma digitar "123 456 789".
  const compactTerm = term.replace(/\s+/g, '')

  const devices = await prisma.device.findMany({
    where: {
      ...getTenantDeviceWhere(clientSlug),
      OR: [
        { hostname: { contains: term, mode: 'insensitive' } },
        { networks: { some: { ip: { contains: term } } } },
        ...(compactTerm.length >= 2 ? [{ anydeskId: { contains: compactTerm } }] : []),
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: SEARCH_LIMIT,
    select: {
      id: true,
      hostname: true,
      anydeskId: true,
      hardware: { select: { sistema: true } },
      networks: { where: { isPrimary: true }, select: { ip: true } },
    },
  })

  return NextResponse.json(
    {
      devices: devices.map((device) => ({
        id: device.id,
        hostname: device.hostname,
        ip: device.networks[0]?.ip ?? null,
        anydeskId: device.anydeskId ?? null,
        // O mesmo predicado que /computers e /servers usam para se dividir —
        // a paleta rotula o dispositivo com o mesmo vocabulario das listagens.
        isServer: isServerOperatingSystem(device.hardware?.sistema ?? null),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
