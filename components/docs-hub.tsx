'use client'

import * as React from 'react'
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  Download,
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

const REMOTE_COMMANDS = [
  ['collect_now', 'Força um ciclo completo de inventário.'],
  ['collect_metrics_now', 'Força uma coleta imediata de métricas (CPU, RAM, disco, uptime).'],
  ['update_agent', 'Atualiza o agente para a versão publicada (SHA-256 + rollback).'],
  ['restart_service', 'Reinicia um serviço da allowlist: Spooler, wuauserv, BITS ou Dnscache.'],
  ['run_script', 'Executa um script fechado: flush_dns, clear_temp_files, restart_explorer ou flush_print_spooler.'],
  ['restart_computer', 'Reinicia a máquina.'],
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
                    /opt/inventario-agent/ e /etc/systemd/system/inventario-agent.service
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
                    defasado, o agente baixa o binário em <Code>C:\ProgramData\InventarioAgent\updates</Code>, valida
                    estritamente o hash SHA-256, guarda um backup <Code>.bak</Code> e faz rollback automático se o novo
                    serviço falhar ao iniciar.
                  </Row>
                  <Row term="2. Sob Demanda pelo Painel">
                    O botão <strong className="text-foreground">Atualizar agente agora</strong> (<Code>update_agent</Code>)
                    pode ser disparado na aba Comandos de uma máquina ou em lote, nas máquinas selecionadas das tabelas de
                    Máquinas e Servidores. A execução ocorre em até 90 segundos.
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
                  <Row term="Busca">A tabela de computadores aceita o AnyDesk ID diretamente no campo de busca.</Row>
                  <Row term="Conexão">
                    O badge abre o protocolo <Code>anydesk:&lt;id&gt;</Code> com um clique e permite copiar o ID.
                  </Row>
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
