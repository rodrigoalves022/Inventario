'use client'

import * as React from 'react'
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * Sprint A9: Central de Documentação in-app. Master-Detail Bento Grid, a mesma
 * linguagem de /account: indice de topicos a esquerda, conteudo a direita.
 */

function CopyableCodeBlock({
  title,
  command,
  description,
}: {
  title: string
  command: string
  description?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-surface-line bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copiar comando: ${title}`}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-surface-line bg-surface-1 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="data-mono mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs text-foreground">
        {command}
      </pre>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="data-mono rounded bg-surface-2 px-1.5 py-0.5 text-xs text-foreground">{children}</code>
}

function Row({ term, children }: { term: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-medium text-foreground">{term}</dt>
      <dd className="text-sm text-muted-foreground">{children}</dd>
    </div>
  )
}

const TOPICS = [
  { value: 'overview', label: 'Visão Geral & Ciclos', icon: Layers },
  { value: 'install', label: 'Instalação do Agente', icon: Download },
  { value: 'poweruser', label: 'Console PowerUser & CLI', icon: Terminal },
  { value: 'remote', label: 'Auto-Update & Comandos', icon: RefreshCw },
  { value: 'anydesk', label: 'Integração AnyDesk', icon: Monitor },
  { value: 'exports', label: 'Relatórios, Exportações & Governança', icon: FileSpreadsheet },
  { value: 'security', label: 'Segurança & Webhooks', icon: ShieldCheck },
] as const

const EXE = 'C:\\Program Files\\InventarioAgent\\inventario-agent.exe'

const LOCAL_COMMANDS = [
  { title: 'manage', command: `${EXE} manage`, description: 'Abre o console interativo de PowerUser.' },
  {
    title: 'status',
    command: `${EXE} status`,
    description: 'Exibe estado do serviço, servidor vinculado, AnyDesk ID e últimas 10 linhas do log.',
  },
  {
    title: 'checkin',
    command: `${EXE} checkin`,
    description: 'Força coleta completa e envia ao servidor imediatamente.',
  },
  {
    title: 'collect',
    command: `${EXE} collect`,
    description: 'Imprime no terminal o JSON completo coletado da máquina (modo inspeção, sem envio).',
  },
  { title: 'stop', command: `${EXE} stop`, description: 'Para o serviço InventarioAgent localmente.' },
  {
    title: 'start / restart',
    command: `${EXE} start\n${EXE} restart`,
    description: 'Inicia ou reinicia o serviço localmente.',
  },
  {
    title: 'unlink',
    command: `${EXE} unlink`,
    description:
      'Para o serviço e exclui as credenciais/servidor vinculado (config.json / DPAPI), mantendo o binário instalado.',
  },
  {
    title: 'purge',
    command: `${EXE} purge -yes`,
    description:
      'Para e remove o serviço, apaga C:\\ProgramData\\InventarioAgent, remove do Painel de Controle e auto-exclui C:\\Program Files\\InventarioAgent.',
  },
]

const CONSOLE_OPTIONS = [
  ['[1]', 'Status e logs'],
  ['[2]', 'Forçar check-in'],
  ['[3]', 'Parar serviço'],
  ['[4]', 'Iniciar/Reiniciar serviço'],
  ['[5]', 'Excluir/Desvincular servidor'],
  ['[6]', 'Vincular novo servidor manualmente'],
  ['[7]', 'Desinstalar e excluir aplicação completa (Purge)'],
] as const

// Espelha `agentCommandInputSchema` (lib/agent-commands.ts) e `allowedScripts` (agente Go).
const REMOTE_COMMANDS = [
  ['collect_now', 'Força um ciclo completo de inventário.'],
  ['collect_metrics_now', 'Força uma coleta imediata de métricas (CPU, RAM, disco, uptime).'],
  ['update_agent', 'Atualiza o agente para a versão publicada (SHA-256 + rollback).'],
  ['restart_service', 'Reinicia um serviço da allowlist: Spooler, wuauserv, BITS ou Dnscache.'],
  ['run_script', 'Executa um dos 9 scripts fechados listados abaixo; nenhum texto de script trafega pela rede.'],
  ['restart_computer', 'Reinicia a máquina.'],
  ['uninstall_agent', 'Desinstala o agente remotamente e revoga a credencial (Sprint A16).'],
] as const

const SCRIPT_COMMANDS = [
  ['flush_dns', 'Limpa o cache DNS (ipconfig /flushdns).'],
  ['clear_temp_files', 'Remove arquivos temporários do sistema.'],
  ['restart_explorer', 'Reinicia o processo explorer.exe.'],
  ['flush_print_spooler', 'Para o Spooler, limpa a fila de impressão e reinicia o serviço.'],
  ['gpupdate_force', 'Reaplica as políticas de grupo (gpupdate /force).'],
  ['network_diag', 'Diagnóstico de rede: IPs, rotas e portas em escuta. Também roda em Linux.'],
  ['system_health_summary', 'Top processos por consumo de RAM/CPU. Também roda em Linux.'],
  [
    'defender_quick_scan',
    'Varredura rápida do Windows Defender: atualiza as assinaturas (Update-MpSignature), roda Start-MpScan -ScanType QuickScan e devolve o estado do antivírus (proteção em tempo real, versão das assinaturas, fim da última varredura). Em Linux, informa se há ClamAV instalado.',
  ],
  [
    'windows_update_check',
    'Verificação de atualizações pendentes no Windows Update via COM Microsoft.Update.Session (busca IsInstalled=0): devolve o total pendente e até 15 títulos com a severidade MSRC. Em Linux, lista pacotes atualizáveis via apt ou dnf.',
  ],
] as const

const TENANT_EXPORTS = [
  ['Relatórios analíticos', '/api/tenant/[slug]/reports/csv', 'Uma linha por máquina: status, IP, AnyDesk ID, SO, hardware, antivírus/firewall e patrimônio (delimitador vírgula). É também o "Baixar CSV" de Todos os dispositivos (/assets).'],
  ['Relatório executivo PDF', '/api/tenant/[slug]/reports/pdf', 'PDF analítico com governança do parque, agentes, AnyDesk, patrimônio/garantias e famílias de processadores.'],
  ['Computadores', '/api/tenant/[slug]/computers/csv', 'Estações de trabalho do tenant.'],
  ['Servidores', '/api/tenant/[slug]/servers/csv', 'Servidores monitorados do tenant.'],
  ['Dossiê da máquina', '/api/tenant/[slug]/devices/[id]/export', 'Ficha completa de uma máquina, por seção: identificação, hardware, discos, rede, segurança, softwares, periféricos, contas locais e patrimônio.'],
  ['Softwares', '/api/tenant/[slug]/software/csv', 'Catálogo no padrão Programas e Recursos (appwiz.cpl), com conformidade e máquinas por software.'],
  ['Periféricos e USB', '/api/tenant/[slug]/peripherals/csv', 'Periféricos e dispositivos USB detectados.'],
  ['Contas locais', '/api/tenant/[slug]/local-accounts/csv', 'Contas locais e privilégios por máquina.'],
  ['Armazenamento', '/api/tenant/[slug]/storage/csv', 'Unidades por máquina: tipo, modelo, capacidade, uso e BitLocker.'],
  ['Processadores', '/api/tenant/[slug]/processors/csv', 'Processadores por modelo e fabricante, com quantidade e lista de máquinas.'],
  ['Endereços IP', '/api/tenant/[slug]/network/ips/csv', 'Uma linha por interface: IP, MAC, gateway, DNS, DHCP/estático, primária e status da máquina.'],
  ['Dispositivos descobertos', '/api/tenant/[slug]/network/discovered/csv', 'Ativos encontrados pela descoberta de rede: IP, MAC, fabricante, tipo, portas abertas e descrição SNMP (delimitador vírgula).'],
  ['Alertas', '/api/tenant/[slug]/alerts/csv', 'Disparos de alerta do tenant.'],
  ['Auditoria do tenant', '/api/tenant/[slug]/audit/csv', 'Trilha de auditoria do tenant.'],
] as const

const PLATFORM_EXPORTS = [
  ['Portal: relatório CSV', '/api/portal/reports/csv', 'Relatório do próprio cliente no Portal (CLIENT_VIEWER).'],
  ['Portal: relatório PDF', '/api/portal/reports/pdf', 'Versão PDF do relatório do Portal.'],
  ['Admin: clientes', '/api/admin/clients/csv', 'Clientes com slug, status, dispositivos e agentes ativos. PLATFORM_ADMIN, ou ORG_ADMIN restrito à própria organização.'],
  ['Admin: auditoria global', '/api/admin/audit/csv', 'Trilha de auditoria da administração global (PLATFORM_ADMIN).'],
  ['Usuários', '/api/users/csv', 'Nome, e-mail, papel, escopo e status. PLATFORM_ADMIN vê todos; ORG_ADMIN, só a própria organização.'],
  ['Segurança', '/api/security/csv', 'Postura por máquina: antivírus e assinaturas, firewall, BitLocker, Secure Boot, UAC, TPM e contas admin habilitadas (PLATFORM_ADMIN).'],
] as const

const KPI_FILTERS = [
  ['Visão Geral do tenant', 'Cards de status levam a /assets?status=online, offline ou warning.'],
  ['Computadores, Servidores, Armazenamento, Processadores', 'Os cards filtram a tabela na própria página; Servidores inclui "Agente desatualizado" (versão diferente de LATEST_AGENT_VERSION). Clicar de novo no card ativo limpa o filtro.'],
  ['Alertas', 'Regras ativas, Disparos em aberto (?state=open), Críticos abertos (?severity=critical) e Resolvidos (?state=resolved).'],
  ['Portal', '/portal?status=online, warning ou offline filtra a lista de máquinas do cliente.'],
  ['Admin: clientes', 'Total de clientes, Clientes ativos, Agentes ativos (clientes com agente) e Sem agentes filtram a lista de clientes.'],
  ['Admin: agentes do cliente', 'Total de credenciais, Agentes ativos, Agentes desatualizados e Revogados filtram a tabela de /admin/clients/[id]/agents.'],
  ['Usuários', '/users?filter=active, admins ou operators.'],
] as const

export function DocsHub() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Versão do Agente"
          value="v1.1.0"
          subtitle="Windows x64 & Linux amd64"
          icon={<Bot className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          label="Ciclos do Agente"
          value={4}
          subtitle="Inventário 1h · Métricas 10m · Comandos 90s · Rede 6h"
          icon={<RefreshCw className="h-4 w-4" />}
          tone="info"
        />
        <KpiCard
          label="Comandos PowerUser"
          value={8}
          subtitle="manage, status, checkin, stop, start, unlink, purge"
          icon={<Terminal className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Criptografia & Update"
          value="DPAPI + SHA-256"
          subtitle="Credenciais locais protegidas e rollback atômico"
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="neutral"
        />
      </div>

      <Tabs defaultValue="overview" className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-4 lg:sticky lg:top-20">
          <Panel>
            <PanelHeader
              icon={<BookOpen className="h-4 w-4" />}
              title="Tópicos do Guia"
              description="Navegue pelos módulos técnicos"
            />
            <PanelBody className="p-2">
              <TabsList className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
                {TOPICS.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} variant="nav">
                    <Icon className="h-4 w-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Caminhos Padrão no Sistema Operacional" />
            <PanelBody>
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="font-medium text-foreground">Windows Binário</dt>
                  <dd className="data-mono mt-1 break-all text-muted-foreground">
                    C:\Program Files\InventarioAgent\inventario-agent.exe
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Windows Dados/Logs</dt>
                  <dd className="data-mono mt-1 break-all text-muted-foreground">C:\ProgramData\InventarioAgent\</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Linux Binário</dt>
                  <dd className="data-mono mt-1 break-all text-muted-foreground">/usr/local/bin/inventario-agent</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Linux Dados/Unit</dt>
                  <dd className="data-mono mt-1 break-all text-muted-foreground">
                    /opt/inventario-agent/, /var/lib/inventario-agent/updates e
                    /etc/systemd/system/inventario-agent.service
                  </dd>
                </div>
              </dl>
            </PanelBody>
          </Panel>
        </div>

        <div className="min-w-0">
          <TabsContent value="overview" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Layers className="h-4 w-4" />}
                title="Arquitetura Multi-Tenant & Escopo Fail-Closed"
                description="Todo dado pertence a uma hierarquia e toda consulta é filtrada por ela."
              />
              <PanelBody className="space-y-4">
                <p className="data-mono text-sm text-foreground">Organization -&gt; Client -&gt; AgentAuth -&gt; Device</p>
                <p className="text-sm text-muted-foreground">
                  O escopo é fail-closed: papel desconhecido ou cliente fora do escopo não enxerga nada. Cada chave de
                  agente (<Code>AgentAuth</Code>) é presa a um cliente e só grava dispositivos dele.
                </p>
                <dl className="divide-y divide-surface-line">
                  <Row term={<Code>PLATFORM_ADMIN</Code>}>Administra a plataforma inteira: todas as organizações, usuários e segurança.</Row>
                  <Row term={<Code>ORG_ADMIN</Code>}>Administra os clientes e usuários da própria organização.</Row>
                  <Row term={<Code>ORG_OPERATOR</Code>}>Opera inventário, alertas e comandos remotos nos clientes da organização.</Row>
                  <Row term={<Code>CLIENT_VIEWER</Code>}>Somente leitura, restrito ao próprio cliente.</Row>
                </dl>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<RefreshCw className="h-4 w-4" />}
                title="Os 4 Ciclos Operacionais do Agente"
                description="Cada ciclo roda de forma independente dentro do serviço."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  <Row term="Coleta de Inventário · 1 hora">
                    Hardware, software, sistema operacional e rede completos enviados no check-in.
                  </Row>
                  <Row term="Métricas · 10 minutos">CPU, RAM, disco e uptime, gravados como amostras de métrica.</Row>
                  <Row term="Comandos Remotos · 90 segundos">
                    Polling da fila de comandos pendentes; cada comando tem TTL de 15 minutos e expira se não for executado.
                  </Row>
                  <Row term="Descoberta de Rede · 6 horas">ARP, SNMP e varredura TCP. É opt-in por cliente.</Row>
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          <TabsContent value="install" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Download className="h-4 w-4" />}
                title="1. Instalador Zero-Touch por Duplo-Clique (.exe pré-configurado)"
                description="O caminho mais simples para uma máquina isolada."
              />
              <PanelBody>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>
                    Na tela do cliente, abra <strong className="text-foreground">Ver credenciais</strong> e clique em{' '}
                    <strong className="text-foreground">Baixar instalador .exe</strong>.
                  </li>
                  <li>Dê duplo-clique no arquivo: a elevação UAC é solicitada automaticamente.</li>
                  <li>
                    O agente se copia limpo para <Code>{EXE}</Code>, removendo o trailer <Code>&lt;&lt;INV_CONFIG&gt;&gt;</Code>{' '}
                    com a configuração embutida.
                  </li>
                  <li>O serviço é registrado com Auto-Recovery no SCM e aparece em Aplicativos Instalados do Windows.</li>
                </ol>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<Terminal className="h-4 w-4" />}
                title="2. One-Liner PowerShell (Windows) e Bash (Linux) com verificação SHA-256"
                description="O script baixa o binário e só instala se o hash conferir."
              />
              <PanelBody className="space-y-3">
                <CopyableCodeBlock
                  title="Windows (terminal como Administrador)"
                  command={`powershell -ExecutionPolicy Bypass -NoProfile -Command "irm 'https://SEU-SERVIDOR/api/agent/bootstrap?client=SEU-CLIENTE&key=SUA-CHAVE' | iex"`}
                  description="Substitua servidor, cliente e chave pelos valores de Ver credenciais."
                />
                <CopyableCodeBlock
                  title="Linux (Bash como root)"
                  command={"curl -fsSL 'https://SEU-SERVIDOR/api/agent/bootstrap-linux?client=SEU-CLIENTE&key=SUA-CHAVE' | sudo bash"}
                  description="Instala em /usr/local/bin e cria a unit do systemd."
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<Layers className="h-4 w-4" />}
                title="3. Instalação via Linha de Comando / GPO / Intune / RMM"
                description="Para implantação em massa, sem interação."
              />
              <PanelBody className="space-y-3">
                <CopyableCodeBlock
                  title="Windows"
                  command={'inventario-agent.exe install -server "https://SEU-SERVIDOR" -client "SEU-CLIENTE" -key "SUA-CHAVE" -name "%COMPUTERNAME%"'}
                />
                <CopyableCodeBlock
                  title="Linux"
                  command={'sudo ./inventario-agent install -server "https://SEU-SERVIDOR" -client "SEU-CLIENTE" -key "SUA-CHAVE" -name "$(hostname)"'}
                />
              </PanelBody>
            </Panel>
          </TabsContent>

          <TabsContent value="poweruser" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Terminal className="h-4 w-4" />}
                title="Console Interativo de PowerUser (Opções 1 a 7)"
                description="Para suporte local, sem precisar do painel."
              />
              <PanelBody className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Dê duplo-clique em <Code>{EXE}</Code> ou execute <Code>inventario-agent.exe manage</Code> para abrir o
                  menu interativo com as 7 operações locais:
                </p>
                <dl className="divide-y divide-surface-line">
                  {CONSOLE_OPTIONS.map(([key, label]) => (
                    <Row key={key} term={<span className="data-mono">{key}</span>}>
                      {label}
                    </Row>
                  ))}
                </dl>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<Terminal className="h-4 w-4" />}
                title="Referência Completa de Comandos Locais (CLI)"
                description="Execute em um terminal elevado (Administrador)."
              />
              <PanelBody className="space-y-3">
                {LOCAL_COMMANDS.map((item) => (
                  <CopyableCodeBlock key={item.title} {...item} />
                ))}
              </PanelBody>
            </Panel>
          </TabsContent>

          <TabsContent value="remote" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<RefreshCw className="h-4 w-4" />}
                title="Como funciona a Atualização Remota de Agentes (v1.1.0)"
                description="Dois modos, o mesmo mecanismo seguro."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  <Row term="1. Automático no Check-in">
                    O servidor compara o <Code>agentVersion</Code> reportado com <Code>LATEST_AGENT_VERSION</Code>. Se estiver
                    defasado, o agente baixa o binário, valida estritamente o hash SHA-256, guarda um backup{' '}
                    <Code>.bak</Code> e faz rollback automático se o novo serviço falhar ao iniciar.
                  </Row>
                  <Row term="Windows">
                    Atualizador via PowerShell em <Code>C:\ProgramData\InventarioAgent\updates</Code>.
                  </Row>
                  <Row term="Linux">
                    Atualizador via <Code>/bin/sh</Code> + <Code>systemctl</Code> em{' '}
                    <Code>/var/lib/inventario-agent/updates</Code>: para a unidade, troca o binário e, se o start falhar,
                    restaura o <Code>.bak</Code>.
                  </Row>
                  <Row term="2. Sob Demanda pelo Painel">
                    O comando <Code>update_agent</Code> pode ser disparado em 4 lugares; a execução ocorre em até 90
                    segundos.
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      <li>
                        No cabeçalho da máquina (<Code>/app/[clientSlug]/assets/[id]</Code>) pelo botão{' '}
                        <strong className="text-foreground">Atualizar agente</strong>, exibido automaticamente quando a
                        versão diverge de <Code>LATEST_AGENT_VERSION</Code>.
                      </li>
                      <li>
                        Na tela administrativa de agentes do cliente (<Code>/admin/clients/[id]/agents</Code>),
                        individualmente por linha ou em massa pelo botão{' '}
                        <strong className="text-foreground">Atualizar todos os agentes</strong>.
                      </li>
                      <li>
                        Na aba <strong className="text-foreground">Comandos</strong> da máquina (
                        <strong className="text-foreground">Atualizar agente agora</strong>).
                      </li>
                      <li>
                        Na barra de ações em lote (<Code>BulkCommandBar</Code>), selecionando múltiplas máquinas em
                        Computadores, Servidores ou Todos os dispositivos.
                      </li>
                    </ol>
                  </Row>
                </dl>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<Terminal className="h-4 w-4" />}
                title="Catálogo Fechado de Comandos Remotos"
                description="Só estes comandos existem; nada de shell arbitrário."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  {REMOTE_COMMANDS.map(([name, text]) => (
                    <Row key={name} term={<Code>{name}</Code>}>
                      {text}
                    </Row>
                  ))}
                </dl>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Scripts de Diagnóstico e Segurança (run_script)"
                description="Allowlist idêntica no servidor e no agente Go; a saída aparece em console expansível na aba Comandos."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  {SCRIPT_COMMANDS.map(([name, text]) => (
                    <Row key={name} term={<Code>{name}</Code>}>
                      {text}
                    </Row>
                  ))}
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          <TabsContent value="anydesk" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Monitor className="h-4 w-4" />}
                title="Detecção Automática do AnyDesk ID & Conexão em 1 Clique"
                description="Leitura passiva: o agente nunca altera a configuração do AnyDesk."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  <Row term="Origem">
                    Chave <Code>ad.anynet.id</Code> nos arquivos <Code>system.conf</Code> e <Code>service.conf</Code>.
                  </Row>
                  <Row term="Windows">
                    <Code>ProgramData\AnyDesk</Code> e perfis <Code>Users\*\AppData\Roaming\AnyDesk</Code>.
                  </Row>
                  <Row term="Linux">
                    <Code>/etc/anydesk</Code> e <Code>/home/*/.anydesk</Code>.
                  </Row>
                  <Row term="Validação">
                    O valor só é aceito se casar com <Code>{'/^\\d{9,10}$/'}</Code>; o ID é preservado entre check-ins.
                  </Row>
                  <Row term="Busca">
                    Busca global na paleta de comandos <Code>Ctrl+K</Code>, busca nas tabelas de Computadores, Servidores e
                    Ativos, e coluna <Code>AnyDesk ID</Code> nas exportações CSV de relatórios.
                  </Row>
                  <Row term="Conexão">
                    O badge abre o protocolo <Code>anydesk:&lt;id&gt;</Code> com um clique e permite copiar o ID.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<Monitor className="h-4 w-4" />}
                title="Usuário Interativo & Sessões RDP"
                description="O serviço roda como SYSTEM; o usuário logado vem da sessão, não do dono do processo."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  <Row term="Console (WMI)">
                    <Code>Win32_ComputerSystem.UserName</Code>, sem o prefixo de domínio; contas de sistema são ignoradas.
                  </Row>
                  <Row term="Sessão RDP (fallback)">
                    Sessões RDP/Terminal Services não preenchem o WMI. O agente cai para <Code>query user</Code> e{' '}
                    <Code>parseQueryUserOutput</Code> escolhe a sessão <Code>Ativo</Code>/<Code>Active</Code> (ou a primeira
                    sessão humana listada).
                  </Row>
                  <Row term="Sem ninguém logado">
                    O agente envia vazio e o servidor preserva o último usuário conhecido.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          <TabsContent value="exports" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title="Matriz de Exportações do Tenant"
                description="401 sem sessão, 403 fora do escopo. Salvo indicação, CSV com BOM UTF-8, delimitador ; e prefixo ' contra formula injection."
              />
              <PanelBody className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Exige acesso ao tenant (<Code>canAccessTenant</Code>). Softwares, Periféricos, Contas locais e o Dossiê
                  da máquina também aceitam <Code>CLIENT_VIEWER</Code> do próprio cliente (<Code>canReadTenantData</Code>).
                </p>
                <dl className="divide-y divide-surface-line">
                  {TENANT_EXPORTS.map(([name, route, text]) => (
                    <Row key={route} term={name}>
                      <Code>{route}</Code>
                      <span className="mt-1 block">{text}</span>
                    </Row>
                  ))}
                </dl>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title="Exportações do Portal e da Administração"
                description="Cada rota repete a verificação de papel no servidor."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  {PLATFORM_EXPORTS.map(([name, route, text]) => (
                    <Row key={route} term={name}>
                      <Code>{route}</Code>
                      <span className="mt-1 block">{text}</span>
                    </Row>
                  ))}
                </dl>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<Filter className="h-4 w-4" />}
                title="Filtros Interativos por KPI"
                description="Os cards de KPI são clicáveis e filtram a lista da própria tela."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  {KPI_FILTERS.map(([name, text]) => (
                    <Row key={name} term={name}>
                      {text}
                    </Row>
                  ))}
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Segurança do Agente e da Plataforma"
                description="Defesa em camadas, do binário ao webhook."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  <Row term="DPAPI no Windows">
                    As credenciais locais são protegidas com <Code>CryptProtectData</Code>; o arquivo copiado para outra
                    máquina não pode ser lido.
                  </Row>
                  <Row term="Chaves de agente">Armazenadas no banco apenas como hash SHA-256; o valor em claro é exibido uma única vez.</Row>
                  <Row term="Anti-oráculo multi-tenant">
                    Recursos fora do escopo respondem como inexistentes, sem revelar se pertencem a outro cliente.
                  </Row>
                  <Row term="Webhooks assinados">
                    Cada entrega leva o cabeçalho <Code>X-Inventario-Signature-256</Code> (HMAC-SHA256 do corpo) para o
                    receptor validar a origem.
                  </Row>
                  <Row term="Guarda anti-SSRF">
                    Destinos de webhook que resolvem para endereços internos ou privados são recusados.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
