import Link from 'next/link'
import { ArrowRight, Radar, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DISCOVERED_DEVICE_TYPES, type DiscoveredDeviceType } from '@/lib/schemas/agent-discovery'
import { Panel, PanelHeader } from '@/components/ui/panel'

/**
 * Painel direito do bloco duplo do dashboard (Overhaul visual — Fase 4): o que
 * aconteceu por aqui ultimamente. Dois blocos numa superficie so — card
 * aninhado dentro de card seria elevacao declarada duas vezes (DESIGN.md §4).
 *
 * Todo texto de data chega PRONTO do Server Component. O componente nao chama
 * `new Date()` nem `Intl` — assim ele e' puro, testavel sem congelar relogio, e
 * a pagina nao arrasta chamada impura para o corpo do render.
 *
 * -----------------------------------------------------------------------------
 * Descoberta de rede: "desligada" nao e' "zero"
 * -----------------------------------------------------------------------------
 *
 * `Client.discoveryEnabled` e' opt-in por tenant e nasce `false` (Sprint 14).
 * Num tenant com a varredura desligada, "0 dispositivos descobertos" seria uma
 * afirmacao FALSA sobre a rede do cliente: ninguem olhou. Por isso o estado
 * vazio distingue os dois casos, e o caso desligado diz onde ligar.
 */

export type NetworkDiscoveryItem = {
  id: string
  ip: string
  /** Hostname, ou o fabricante quando o dispositivo nao resolveu nome. */
  label: string | null
  deviceType: DiscoveredDeviceType
  /** Ja formatado ("há 2h") pelo Server Component. */
  lastSeenLabel: string
}

export type AuditActivityItem = {
  id: string
  /** Acao ja traduzida para o vocabulario do produto. */
  actionLabel: string
  /** Quem fez — e-mail do ator, ou "sistema" quando o evento nao tem ator. */
  actorLabel: string
  /** Alvo legivel (hostname, slug do cliente), quando o evento carrega um. */
  targetLabel: string | null
  /** Ja formatado ("há 12 min") pelo Server Component. */
  whenLabel: string
}

const DISCOVERED_TYPE_LABEL: Record<DiscoveredDeviceType, string> = {
  PRINTER: 'Impressora',
  SWITCH: 'Switch',
  ROUTER: 'Roteador',
  NAS: 'NAS',
  ACCESS_POINT: 'Access point',
  UNKNOWN: 'Não identificado',
}

/**
 * Rotulo das acoes auditadas. Espelha o catalogo real de `recordAuditLog` na
 * base; qualquer acao fora dele cai no proprio identificador, que continua
 * legivel ("webhook.update") em vez de sumir. Fica aqui, e nao em
 * `components/audit-log-table.tsx`, porque aquele arquivo esta fora do escopo
 * desta fase.
 */
const AUDIT_ACTION_LABEL: Record<string, string> = {
  login: 'Login',
  'credentials.view': 'Visualização de credenciais',
  'credentials.rotate': 'Rotação de chave de inscrição',
  'device.delete': 'Exclusão de máquina',
  'client.create': 'Criação de cliente',
  'agent_auth.revoke': 'Revogação de agente',
  'agent_auth.register': 'Registro de agente',
  'alert_rule.create': 'Criação de regra de alerta',
  'alert_rule.delete': 'Exclusão de regra de alerta',
  'command.enqueue': 'Comando remoto enfileirado',
  'command.bulk_enqueue': 'Comandos remotos em lote',
  'command.result': 'Resultado de comando remoto',
  'webhook.create': 'Criação de webhook',
  'webhook.update': 'Atualização de webhook',
  'webhook.toggle': 'Webhook ativado/desativado',
  'tenant.discovery_enabled': 'Varredura de rede ativada',
  'tenant.discovery_disabled': 'Varredura de rede desativada',
}

export function formatAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action
}

/**
 * `DiscoveredDevice.deviceType` e' `String` livre no banco (RNF012 — nenhum
 * enum existe no schema), entao a leitura nao confia no valor armazenado:
 * qualquer coisa fora do catalogo fechado vira 'UNKNOWN' na exibicao, em vez
 * de quebrar o `Record` de rotulo acima. Mesmo parse defensivo que
 * `app/app/[clientSlug]/network/page.tsx` ja faz para a tabela completa.
 */
export function toDiscoveredDeviceType(value: string): DiscoveredDeviceType {
  return (DISCOVERED_DEVICE_TYPES as readonly string[]).includes(value)
    ? (value as DiscoveredDeviceType)
    : 'UNKNOWN'
}

function BlockHeader({
  title,
  description,
  href,
  linkLabel,
  className,
}: {
  title: string
  description: string
  href: string
  linkLabel: string
  className?: string
}) {
  // `PanelHeader` no lugar do padding solto: este bloco usava `pb-3` enquanto o
  // painel de alerta critico ao lado usava `pb-4`, entao os dois titulos
  // ficavam a distancias diferentes da primeira linha da lista, lado a lado na
  // mesma fileira. Agora o recuo vem de um lugar so.
  return (
    <PanelHeader className={cn('flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        {/* `h2` e nao `h3`: os dois blocos deste painel sao irmaos do titulo do
            painel de alerta critico ao lado, e o `h1` da tela e' o da propria
            pagina. Pular para h3 aqui abriria um buraco na arvore de titulos
            que leitor de tela navega. */}
        <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {linkLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </PanelHeader>
  )
}

function EmptyBlock({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 border-t border-surface-line px-5 py-6 text-sm text-muted-foreground',
        className
      )}
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <p className="max-w-sm">{children}</p>
    </div>
  )
}

export function RecentActivityPanel({
  discovery,
  audit,
}: {
  discovery: {
    enabled: boolean
    items: NetworkDiscoveryItem[]
    href: string
  }
  /** `null` quando o papel do usuario nao pode ver auditoria do tenant
   * (`canViewTenantAudit`). O bloco some inteiro em vez de mostrar uma lista
   * vazia — lista vazia sugeriria "nao houve atividade", que e' outra coisa. */
  audit: {
    items: AuditActivityItem[]
    href: string
  } | null
}) {
  // Quem "estica" para o painel acompanhar a altura do vizinho e' sempre o
  // ULTIMO bloco renderizado — sem isso, um tenant sem auditoria visivel
  // deixaria uma faixa vazia de card ao lado do painel de alerta critico.
  const discoveryGrows = audit === null

  return (
    <Panel aria-label="Atividade recente do tenant" className="flex h-full flex-col">
      <BlockHeader
        title="Descobertas de rede"
        description="Dispositivos sem agente vistos pela varredura SNMP/ARP."
        href={discovery.href}
        linkLabel="Ver rede"
      />

      {!discovery.enabled ? (
        <EmptyBlock icon={<Radar className="h-4 w-4" />} className={discoveryGrows ? 'flex-1' : undefined}>
          Varredura de rede desligada para este tenant — nada foi procurado. Habilite em Computadores →
          Configurações de Alerta → Descoberta de Rede.
        </EmptyBlock>
      ) : discovery.items.length === 0 ? (
        <EmptyBlock icon={<Radar className="h-4 w-4" />} className={discoveryGrows ? 'flex-1' : undefined}>
          Nenhum dispositivo descoberto ainda. A varredura roda a cada 6 horas em cada agente.
        </EmptyBlock>
      ) : (
        <ul
          className={cn(
            'divide-y divide-surface-line border-t border-surface-line',
            discoveryGrows && 'flex-1'
          )}
        >
          {discovery.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="data-mono truncate text-sm font-medium text-foreground">{item.ip}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {DISCOVERED_TYPE_LABEL[item.deviceType]}
                  {item.label ? ` · ${item.label}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.lastSeenLabel}</span>
            </li>
          ))}
        </ul>
      )}

      {audit ? (
        <>
          <BlockHeader
            title="Atividade de auditoria"
            description="Eventos sensíveis registrados neste tenant."
            href={audit.href}
            linkLabel="Ver auditoria"
            className="border-t border-surface-line"
          />

          {audit.items.length === 0 ? (
            <EmptyBlock icon={<ScrollText className="h-4 w-4" />} className="flex-1">
              Nenhum evento sensível registrado ainda. Login, visualização de credenciais, exclusão de máquina
              e comandos remotos aparecem aqui.
            </EmptyBlock>
          ) : (
            <ul className="flex-1 divide-y divide-surface-line border-t border-surface-line">
              {audit.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{item.actionLabel}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.actorLabel}
                      {item.targetLabel ? ` · ${item.targetLabel}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.whenLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Panel>
  )
}
