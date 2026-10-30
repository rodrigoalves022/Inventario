import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateAgentApiKey, authErrorResponse } from '@/lib/auth'
import { getCurrentServerUrl } from '@/lib/server-url'
import { getAgentBinarySha256 } from '@/lib/agent-binary'
import { deriveInventoryIssues, getWarningTransitionIssues } from '@/lib/inventory-alerts'
import { getTenantAlertSettingsByClientId } from '@/lib/tenant-alert-settings'
import { reconcileAlertEvents } from '@/lib/alert-rules'
import { reconcileAvailabilityEvents } from '@/lib/availability-alerts'
import { sendAlertWebhook } from '@/lib/alert-webhook'
import { dispatchClientWebhookEndpoints, type WebhookEvent } from '@/lib/webhook-endpoints'
import { agentCheckinSchema } from '@/lib/schemas/agent-checkin'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const checkinSchema = agentCheckinSchema

export async function POST(req: NextRequest) {
  const auth = await validateAgentApiKey(req)
  if (!auth.ok) return authErrorResponse(auth)

  // Ciclo normal e' 1x/hora + coletas forcadas ocasionais (collect_now); um
  // agente comprometido ou com bug em loop nao deve conseguir inundar a
  // ingestao. Limite por agente, nao por IP — agentes legitimos atras do
  // mesmo NAT nao devem se afetar.
  const limit = rateLimit(`checkin:${auth.agentAuth.id}`, { limit: 10, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  const ipOrigem = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'desconhecido'

  try {
    const rawBody = await req.json().catch(() => null)

    if (!rawBody) {
      void prisma.agentCheckLog
        .create({
          data: {
            agentAuthId: auth.agentAuth.id,
            deviceId: null,
            ipOrigem,
            status: 'invalid_json',
            detailsJson: null,
          },
        })
        .catch(() => null)

      return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    }
    const parsed = checkinSchema.safeParse(rawBody)

    if (!parsed.success) {
      void prisma.agentCheckLog
        .create({
          data: {
            agentAuthId: auth.agentAuth.id,
            deviceId: null,
            ipOrigem,
            status: 'invalid_payload',
            detailsJson: JSON.stringify(parsed.error.format()).slice(0, 20_000),
          },
        })
        .catch(() => null)

      return NextResponse.json(
        { error: 'Payload inválido ou excede o limite de recursos.', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const body = parsed.data
    const { hostname } = body
    const previousDevice = await prisma.device.findUnique({
      where: { agentAuthId: auth.agentAuth.id },
      select: { id: true, status: true },
    })
    const alertSettings = await getTenantAlertSettingsByClientId(auth.agentAuth.clientId)
    const warningIssues = alertSettings?.alertsEnabled
      ? getWarningTransitionIssues(
          deriveInventoryIssues(
            {
              hardware: { ramTotalGb: body.ramTotalGb },
              disks: body.discos,
            },
            alertSettings
          )
        )
      : []
    const nextStatus = warningIssues.length > 0 ? 'warning' : 'online'

    const device = await prisma.device.upsert({
      where: { agentAuthId: auth.agentAuth.id },
      create: {
        hostname,
        agentAuthId: auth.agentAuth.id,
        clientId: auth.agentAuth.clientId,
        serial: body.serial,
        fabricante: body.fabricante,
        modelo: body.modelo,
        dominio: body.dominio,
        usuario: body.usuario,
        anydeskId: body.anydeskId ?? null,
        status: nextStatus,
        // Sprint 11 (B): mesmo campo que ja alimentava a mensagem do
        // CollectionLog abaixo e a decisao de updateAvailable — agora tambem
        // persistido por dispositivo, pra exibir no card de saude.
        agentVersion: body.agentVersion ?? null,
      },
      update: {
        hostname,
        // Reafirma o vinculo desnormalizado: se o agente for movido de cliente,
        // o Device acompanha em vez de ficar com o tenant antigo.
        clientId: auth.agentAuth.clientId,
        serial: body.serial,
        fabricante: body.fabricante,
        modelo: body.modelo,
        dominio: body.dominio,
        usuario: body.usuario,
        // Check-in parcial (sem AnyDesk) nao apaga um ID ja conhecido.
        ...(body.anydeskId ? { anydeskId: body.anydeskId } : {}),
        status: nextStatus,
        agentVersion: body.agentVersion ?? null,
        updatedAt: new Date(),
      },
    })

    if (body.sistema || body.processador || body.ramTotalGb) {
      await prisma.hardware.upsert({
        where: { deviceId: device.id },
        create: {
          deviceId: device.id,
          sistema: body.sistema,
          versaoSO: body.versaoSO,
          processador: body.processador,
          ramTotalGb: body.ramTotalGb,
          slot1: body.slot1,
          slot2: body.slot2,
          slot3: body.slot3,
          slot4: body.slot4,
          placaMae: body.placaMae,
          tipoArmazenamento: body.tipoArmazenamento,
        },
        update: {
          sistema: body.sistema,
          versaoSO: body.versaoSO,
          processador: body.processador,
          ramTotalGb: body.ramTotalGb,
          slot1: body.slot1,
          slot2: body.slot2,
          slot3: body.slot3,
          slot4: body.slot4,
          placaMae: body.placaMae,
          tipoArmazenamento: body.tipoArmazenamento,
        },
      })
    }

    if (body.redes && body.redes.length > 0) {
      await prisma.network.deleteMany({ where: { deviceId: device.id } })
      await prisma.network.createMany({
        data: body.redes.map((network) => ({
          deviceId: device.id,
          ip: network.ip,
          mac: network.mac,
          gateway: network.gateway,
          dns: network.dns,
          dhcp: network.dhcp ?? true,
          isPrimary: network.isPrimary ?? false,
        })),
      })
    }

    if (body.discos && body.discos.length > 0) {
      await prisma.disk.deleteMany({ where: { deviceId: device.id } })
      await prisma.disk.createMany({
        data: body.discos.map((disk) => ({
          deviceId: device.id,
          unidade: disk.unidade,
          modelo: disk.modelo,
          tipo: disk.tipo,
          capacidadeGb: disk.capacidadeGb,
          espacoLivreGb: disk.espacoLivreGb,
          criptografia: disk.criptografia,
        })),
      })
    }

    if (body.software && body.software.length > 0) {
      await prisma.software.deleteMany({ where: { deviceId: device.id } })
      await prisma.software.createMany({
        data: body.software.map((software) => ({
          deviceId: device.id,
          nome: software.nome,
          versao: software.versao,
          editor: software.editor,
          installadoEm: software.installadoEm ? new Date(software.installadoEm) : null,
        })),
      })
    }

    if (body.seguranca) {
      const security = body.seguranca
      const securityData = {
        antivirusNome: security.antivirusNome ?? null,
        antivirusAtivo: security.antivirusAtivo ?? null,
        antivirusAtualizado: security.antivirusAtualizado ?? null,
        firewallAtivo: security.firewallAtivo ?? null,
        secureBootAtivo: security.secureBootAtivo ?? null,
        tpmPresente: security.tpmPresente ?? null,
        uacAtivo: security.uacAtivo ?? null,
        observacao: security.observacao ?? null,
        coletadoEm: new Date(),
      }

      await prisma.securityPosture.upsert({
        where: { deviceId: device.id },
        create: { deviceId: device.id, ...securityData },
        update: securityData,
      })
    }

    // Reconcilia as regras de alerta do cliente contra a postura de
    // seguranca deste check-in. Sem clientId (agente legado sem tenant) nao
    // ha regra pra avaliar.
    if (auth.agentAuth.clientId) {
      const newlyOpenedAlertEvents = await reconcileAlertEvents({
        clientId: auth.agentAuth.clientId,
        deviceId: device.id,
        security: body.seguranca
          ? {
              antivirusAtivo: body.seguranca.antivirusAtivo ?? null,
              firewallAtivo: body.seguranca.firewallAtivo ?? null,
              uacAtivo: body.seguranca.uacAtivo ?? null,
            }
          : null,
        disks: (body.discos ?? []).map((disk) => ({ criptografia: disk.criptografia ?? null })),
        // Sprint 12: alimenta a regra 'software_blacklisted'. Sprint 13:
        // editor tambem repassado, pra exibicao destacada no alerta/relatorio.
        software: (body.software ?? []).map((software) => ({
          nome: software.nome,
          versao: software.versao ?? null,
          editor: software.editor ?? null,
        })),
      }).catch((error) => {
        console.error('[agent/checkin] Falha ao reconciliar alertas:', error)
        return []
      })

      // Sprint 12: dispara webhook 'device.warning' SO na abertura de um
      // AlertEvent baseado em AlertRule (hoje so 'software_blacklisted' pode
      // chegar aqui recem-aberto) — caminho INDEPENDENTE do bloco
      // `statusTransitioned` mais abaixo, que cobre so warningIssues
      // derivados de disco/RAM/coleta (RF016), nunca AlertRule. Uma maquina
      // pode continuar 'online' (nextStatus) e ainda assim abrir um alerta de
      // software proibido — os dois mecanismos nao se sobrepoem.
      for (const opened of newlyOpenedAlertEvents) {
        const alertPayload = {
          event: 'device.warning' as WebhookEvent,
          tenant: {
            id: auth.agentAuth.clientId,
            name: auth.agentAuth.clientName,
            slug: auth.agentAuth.clientSlug,
          },
          device: { id: device.id, hostname: device.hostname, status: nextStatus },
          alert: {
            metric: opened.metric,
            severity: opened.severity,
            message: opened.message,
            metadata: opened.metadata,
          },
          collectedAt: new Date().toISOString(),
        }
        void dispatchClientWebhookEndpoints(auth.agentAuth.clientId, 'device.warning', alertPayload)
      }
    }

    if (body.monitores && body.monitores.length > 0) {
      await prisma.monitor.deleteMany({ where: { deviceId: device.id } })
      await prisma.monitor.createMany({
        data: body.monitores.map((monitor) => ({
          deviceId: device.id,
          fabricante: monitor.fabricante,
          modelo: monitor.modelo,
          serial: monitor.serial,
          polegadas: monitor.polegadas,
          conexao: monitor.conexao,
          ano: monitor.ano,
        })),
      })
    }

    if (body.impressoras && body.impressoras.length > 0) {
      await prisma.printer.deleteMany({ where: { deviceId: device.id } })
      await prisma.printer.createMany({
        data: body.impressoras.map((printer) => ({
          deviceId: device.id,
          nome: printer.nome,
          porta: printer.porta,
          driver: printer.driver,
          padrao: printer.padrao ?? false,
          deRede: printer.deRede ?? false,
        })),
      })
    }

    if (body.dispositivosUsb && body.dispositivosUsb.length > 0) {
      await prisma.usbDevice.deleteMany({ where: { deviceId: device.id } })
      await prisma.usbDevice.createMany({
        data: body.dispositivosUsb.map((usb) => ({
          deviceId: device.id,
          nome: usb.nome,
          vendorId: usb.vendorId,
          productId: usb.productId,
          serial: usb.serial,
        })),
      })
    }

    // Reconciliacao total: uma conta removida na maquina precisa sumir aqui,
    // senao o painel mostraria administrador que ja nao existe.
    if (body.contasLocais && body.contasLocais.length > 0) {
      await prisma.localAccount.deleteMany({ where: { deviceId: device.id } })
      await prisma.localAccount.createMany({
        data: body.contasLocais.map((account) => ({
          deviceId: device.id,
          usuario: account.usuario,
          isAdmin: account.isAdmin,
          habilitada: account.habilitada,
          senhaNuncaExpira: account.senhaNuncaExpira,
        })),
      })
    }

    const clientLabel = auth.agentAuth.clientName ? ` do cliente "${auth.agentAuth.clientName}"` : ''
    await prisma.collectionLog.create({
      data: {
        deviceId: device.id,
        ipOrigem,
        status: 'success',
        mensagem: `Checkin via agente v${body.agentVersion || '?'} "${auth.agentAuth.name}"${clientLabel}`,
      },
    })

    // Sprint 9 (A.1): fecha o gap do caminho reativo abaixo, que so reage ao
    // PROPRIO dispositivo que fez check-in — uma maquina que para de
    // reportar nunca dispararia nada sozinha. Varre TODOS os dispositivos do
    // cliente (piggyback, sem cron externo — RNF007) a cada check-in de
    // QUALQUER UM deles.
    if (auth.agentAuth.clientId && alertSettings) {
      await reconcileAvailabilityEvents({
        clientId: auth.agentAuth.clientId,
        clientName: auth.agentAuth.clientName ?? null,
        clientSlug: auth.agentAuth.clientSlug ?? null,
        settings: alertSettings,
        checkedInDeviceId: device.id,
      }).catch((error) => console.error('[agent/checkin] Falha ao reconciliar disponibilidade:', error))
    }

    // Caminho reativo original (RF016): dispara so quando o PROPRIO
    // dispositivo que fez este check-in transiciona de/para 'warning' —
    // continua dependendo apenas de previousDevice.status !== nextStatus,
    // sem relacao com a varredura acima (que so cobre device_offline/low_disk
    // sinteticos dos DEMAIS dispositivos do cliente). Condicao de transicao
    // extraida (statusTransitioned) para ser compartilhada pelos dois
    // mecanismos de webhook (legado + WebhookEndpoint, Sprint 11) sem
    // duplicar logica nem alterar o comportamento ja existente do legado.
    const statusTransitioned =
      alertSettings?.alertsEnabled &&
      previousDevice &&
      previousDevice.status !== nextStatus &&
      (previousDevice.status === 'warning' || nextStatus === 'warning')

    if (statusTransitioned && alertSettings) {
      const eventName: WebhookEvent = nextStatus === 'warning' ? 'device.warning' : 'device.recovered'
      const payload = {
        event: eventName,
        tenant: {
          id: auth.agentAuth.clientId,
          name: auth.agentAuth.clientName,
          slug: auth.agentAuth.clientSlug,
        },
        device: {
          id: device.id,
          hostname: device.hostname,
          status: nextStatus,
        },
        issues: warningIssues,
        collectedAt: new Date().toISOString(),
      }

      // Mecanismo antigo (Client.alertWebhookUrl): inalterado, mesmo gate de
      // sempre (alertWebhookEnabled + alertWebhookUrl configurados).
      if (alertSettings.alertWebhookEnabled && alertSettings.alertWebhookUrl) {
        sendAlertWebhook(alertSettings.alertWebhookUrl, payload)
      }
      // Mecanismo adicional (Sprint 11): WebhookEndpoint, com seu proprio
      // filtro por evento/isActive, independente do gate acima.
      if (auth.agentAuth.clientId) {
        void dispatchClientWebhookEndpoints(auth.agentAuth.clientId, eventName, payload)
      }
    }

    const LATEST_AGENT_VERSION = "1.0.0"
    const isOutdated = body.agentVersion && body.agentVersion !== LATEST_AGENT_VERSION
    const serverUrl = await getCurrentServerUrl()
    const binarySha256 = isOutdated ? await getAgentBinarySha256() : null

    return NextResponse.json(
      {
        ok: true,
        deviceId: device.id,
        updateAvailable: isOutdated,
        updateMetadata: isOutdated ? {
            version: LATEST_AGENT_VERSION,
            url: `${serverUrl}/inventario-agent.exe`,
            sha256: binarySha256,
        } : null,
        client: auth.agentAuth.clientSlug
          ? {
              id: auth.agentAuth.clientId,
              name: auth.agentAuth.clientName,
              slug: auth.agentAuth.clientSlug,
            }
          : null,
        // Sprint 14 (RN017). Diz ao agente se ele deve rodar a varredura de
        // descoberta no proximo ciclo de 6h. E' OTIMIZACAO, nao autorizacao:
        // evita que um agente gaste centenas de conexoes TCP numa LAN para
        // enviar um payload que a rota `POST /api/agent/discovery` vai
        // descartar de qualquer forma. O gate real e' server-side e fail-closed
        // naquela rota. `alertSettings` nulo (agente legado sem tenant, ou
        // cliente nao encontrado) => false, mesma postura.
        discoveryEnabled: alertSettings?.discoveryEnabled ?? false,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[agent/checkin] Erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
