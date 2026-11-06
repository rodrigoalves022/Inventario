'use client'

import * as React from 'react'
import {
  Activity,
  BookOpen,
  Bot,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  HardDrive,
  HelpCircle,
  Layers,
  LayoutGrid,
  Monitor,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Users,
  Wrench,
} from 'lucide-react'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      return
    }
  }

  return (
    <div className="rounded-lg border border-surface-line bg-secondary/30 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{title}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label={`Copiar comando de ${title}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
      <pre className="data-mono mt-2 overflow-x-auto rounded bg-background p-2.5 text-xs text-foreground">
        <code>{command}</code>
      </pre>
      {description && <p className="mt-2 text-xs text-muted-foreground">{description}</p>}
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
  // MANUAL DO USUÁRIO (TENANT / OPERADOR)
  { value: 'user_overview', label: '1. Visão Geral & Dashboard', icon: LayoutGrid, group: 'Manual do Usuário' },
  { value: 'user_inventory', label: '2. Computadores & Servidores', icon: Monitor, group: 'Manual do Usuário' },
  { value: 'user_software', label: '3. Softwares & Licenças (SAM)', icon: Package, group: 'Manual do Usuário' },
  { value: 'user_itam', label: '4. Patrimônio & Depreciação (ITAM)', icon: Tag, group: 'Manual do Usuário' },
  { value: 'user_reports', label: '5. Relatórios, Exportações & Atalhos', icon: FileSpreadsheet, group: 'Manual do Usuário' },
  { value: 'user_portal', label: '6. Portal do Cliente (Consulta)', icon: Users, group: 'Manual do Usuário' },

  // GUIA DO ADMINISTRADOR
  { value: 'admin_clients', label: '7. Gestão de Clientes & Tenants', icon: Layers, group: 'Guia do Administrador' },
  { value: 'admin_rbac', label: '8. Usuários, Papéis & Permissões', icon: ShieldCheck, group: 'Guia do Administrador' },
  { value: 'admin_deploy', label: '9. Implantação de Agentes na Rede', icon: Download, group: 'Guia do Administrador' },
  { value: 'admin_actions', label: '10. Ações Remotas & Diagnósticos', icon: RefreshCw, group: 'Guia do Administrador' },
] as const

const TENANT_EXPORTS = [
  ['Relatórios analíticos', '/api/tenant/[slug]/reports/csv', 'Uma linha por máquina: status, IP, AnyDesk ID, SO, hardware, antivírus/firewall e patrimônio (delimitador vírgula). É também o "Baixar CSV" de Todos os dispositivos (/assets).'],
  ['Relatório executivo PDF', '/api/tenant/[slug]/reports/pdf', 'PDF analítico com governança do parque, agentes, AnyDesk, patrimônio/garantias e famílias de processadores.'],
  ['Computadores', '/api/tenant/[slug]/computers/csv', 'Estações de trabalho do tenant.'],
  ['Servidores', '/api/tenant/[slug]/servers/csv', 'Servidores monitorados do tenant.'],
  ['Dossiê da máquina', '/api/tenant/[slug]/devices/[id]/export', 'Ficha completa de uma máquina, por seção: identificação, hardware, discos, rede, segurança, softwares, periféricos, contas locais e patrimônio.'],
  ['Softwares', '/api/tenant/[slug]/software/csv', 'Catálogo no padrão Programas e Recursos (appwiz.cpl), com conformidade e máquinas por software.'],
  ['Licenças de software (SAM)', '/api/tenant/[slug]/software/licenses/csv', 'Licenças adquiridas x instalações reais apuradas pelo agente, status de conformidade (CONFORME, EXCEDIDO, ATENCAO, OCIOSO, EXPIRADO), chave de ativação, assentos e custo total.'],
  ['Periféricos e USB', '/api/tenant/[slug]/peripherals/csv', 'Periféricos e dispositivos USB detectados.'],
  ['Contas locais', '/api/tenant/[slug]/local-accounts/csv', 'Contas locais e privilégios por máquina.'],
  ['Armazenamento', '/api/tenant/[slug]/storage/csv', 'Unidades por máquina: tipo, modelo, capacidade, uso e BitLocker.'],
  ['Processadores', '/api/tenant/[slug]/processors/csv', 'Processadores por modelo e fabricante, com quantidade e lista de máquinas.'],
  ['Endereços IP', '/api/tenant/[slug]/network/ips/csv', 'Uma linha por interface: IP, MAC, gateway, DNS, DHCP/estático, primária e status da máquina.'],
  ['Dispositivos descobertos', '/api/tenant/[slug]/network/discovered/csv', 'Ativos sem agente encontrados pela descoberta de rede: IP, MAC, hostname, fabricante, tipo, portas abertas, descrição SNMP e primeira/última detecção, ordenados por tipo e IP (delimitador vírgula). É o "Baixar CSV (Descobertos)" de /network, ao lado de "Baixar CSV (IPs)"; exporta todos os tipos, independente da aba ativa.'],
  ['Alertas', '/api/tenant/[slug]/alerts/csv', 'Disparos de alerta do tenant. O "Baixar CSV" de /alerts repassa o ?state= e o ?severity= ativos, então exporta o mesmo recorte da tela.'],
  ['Auditoria do tenant', '/api/tenant/[slug]/audit/csv', 'Trilha de auditoria do tenant.'],
] as const

const SOFTWARE_TABS = [
  ['Todos', 'all', 'Todo o catálogo consolidado do cliente.', 'Softwares distintos e Editores / Fabricantes'],
  ['Restritos / Blacklist', 'blacklisted', 'Softwares que casam com uma regra de blacklist ativa (software_blacklisted).', 'Softwares restritos'],
  ['Em múltiplas máquinas', 'widespread', 'Softwares instalados em mais de uma máquina.', 'Instalações totais'],
] as const

const SOFTWARE_CATALOG_URL = [
  ['Onde', 'A mesma tabela atende /app/[clientSlug]/software e o Portal (/portal/software), com as mesmas abas, busca e paginação.'],
  ['Aba na URL (?tab=)', 'Trocar de aba direto na tabela grava ?tab=blacklisted ou ?tab=widespread sem recarregar a página e preservando os demais parâmetros; Todos remove o ?tab=. O recorte sobrevive a recarregar e compartilhar o link, e ?tab= desconhecido cai em Todos. Os cards abrem a aba correspondente; Softwares distintos, Instalações totais e Softwares restritos ficam destacados enquanto a aba deles está ativa.'],
  ['Paginação', '25 softwares por página; "Itens por página" oferece 10, 25, 50 ou 100. O rodapé "Exibindo 1–25 de N softwares" conta o que a aba e a busca deixaram, e os cards contam o catálogo inteiro, nunca só a página.'],
  ['?page= e ?limit=', 'Não entram na URL do catálogo: a página e os itens por página ficam só na tela, então recarregar ou compartilhar o link volta para a página 1 com 25 itens, mantendo a aba. Diferente de /computers, /servers, /storage, /processors, /network e /audit, que gravam ?page= e ?limit=.'],
  ['Volta à página 1', 'Trocar de aba (na tabela ou pelos cards), digitar na busca ou mudar os itens por página volta para a página 1.'],
  ['Exportação', '"Baixar CSV" usa /api/tenant/[slug]/software/csv e exporta o catálogo inteiro, sem o recorte da aba, da busca nem da página.'],
] as const

const PALETTE_QUICK_ACTIONS = [
  ['Baixar Relatório em PDF', '/api/tenant/[slug]/reports/pdf', 'Relatório executivo do cliente atual. Só aparece dentro de um cliente.'],
  ['Baixar Relatório em CSV', '/api/tenant/[slug]/reports/csv', 'Relatório analítico, uma linha por máquina. Só aparece dentro de um cliente.'],
  ['Ver Documentação da Plataforma', '/docs', 'Abre esta Central de Documentação. Aparece também fora de um cliente, para quem tem Documentação no menu.'],
] as const

const METRICS_TIMEFRAME_DOCS = [
  ['Filtros de período', 'Na aba Métricas da ficha da máquina (/assets/[id]), botões permitem alternar entre 24 horas, 3 dias, 7 dias e Todas as amostras. O corte é calculado em relação ao carimbo da amostra mais recente coletada, preservando a pureza de render e evitando telas em branco caso o dispositivo esteja temporariamente offline.'],
  ['Cores calmas e semânticas', 'Os gráficos de métricas usam paleta semântica descansada: CPU em tom suave (--info), RAM em --chart-2 e Disco em --chart-3, sem saturação excessiva.'],
  ['Latência de check-in semântica', 'No cabeçalho de saúde, a idade da última coleta adota cor semântica: verde para até 15 min, amarelo para atenção (15 a 60 min) e neutro para acima de 60 min.'],
  ['Cabeçalho unificado e responsivo', 'O campo de busca rápida do cabeçalho adapta sua largura e rótulo dinamicamente (no tablet usa rótulo compacto "Buscar...", no desktop usa o rótulo completo "Buscar página ou máquina..."), garantindo espaçamento generoso e impedindo sobreposição com o menu de perfil.'],
] as const

const PORTAL_FLEET_SUMMARY = [
  ['Escopo', 'Tudo no Portal é do próprio cliente do CLIENT_VIEWER e só das máquinas com agente ativo (credencial não revogada).'],
  ['Memória RAM total', 'Soma da RAM de todas as máquinas, em GB. Se só parte delas informou a memória, passar o mouse sobre o valor mostra "Soma de N de M máquina(s) com memória informada"; se nenhuma informou, aparece "Memória RAM não informada".'],
  ['Sistemas operacionais', 'Uma pílula por família com ao menos uma máquina: Windows, Linux, outros sistemas e sem sistema informado. Linux inclui as distros cujo nome não traz a palavra "Linux", como Ubuntu, Debian, Rocky e Alma.'],
  ['Sem filtro', 'O resumo conta o parque inteiro: a busca ?q= e os cards ?status= mudam a lista de máquinas, não o resumo. Parque sem máquinas não mostra a faixa.'],
  ['Detalhe', 'A distribuição por versão de sistema, por processador e por quantidade de RAM fica em /portal/reports.'],
] as const

const LOCAL_ACCOUNTS_RISK_TABS = [
  ['Todas as contas', 'all', 'Todas as contas locais reportadas nas máquinas do cliente.', 'Contas locais mapeadas'],
  ['Admins ativos', 'admin_enabled', 'Contas habilitadas com privilégio de administrador.', 'Admins locais ativos'],
  ['Senha sem expiração', 'never_expires', 'Contas habilitadas cuja senha nunca expira.', 'Senha nunca expira (ativas)'],
  ['Risco crítico', 'critical', 'Contas habilitadas, administradoras e com senha que nunca expira.', 'Risco crítico (Admin + Sem expiração)'],
] as const

const REMOTE_DIAGNOSTICS = [
  [
    'defender_quick_scan',
    'Varredura rápida do Windows Defender: atualiza as assinaturas (Update-MpSignature), executa Start-MpScan -ScanType QuickScan e devolve o estado do antivírus (proteção em tempo real, versão das assinaturas e conclusão). Em Linux, reporta o estado do ClamAV se instalado.',
  ],
  [
    'windows_update_check',
    'Verificação de atualizações pendentes no Windows Update via COM Microsoft.Update.Session: reporta o total de patches pendentes e até 15 títulos com severidade MSRC. Em Linux, lista pacotes atualizáveis via apt ou dnf.',
  ],
  [
    'network_diag',
    'Diagnóstico de rede completo: lista interfaces ativas, endereços IP, máscara, gateway padrão, servidores DNS e tabela de rotas.',
  ],
] as const

export function DocsHub() {
  return (
    <div className="space-y-6">
      {/* Cards de Resumo da Plataforma */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Versão da Plataforma"
          value="v1.1.0"
          subtitle="Painel Web & Agentes de Coleta"
          icon={<Bot className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          label="Ciclos de Monitoramento"
          value={4}
          subtitle="Inventário 1h · Métricas 10m · Comandos 90s · Rede 6h"
          icon={<RefreshCw className="h-4 w-4" />}
          tone="info"
        />
        <KpiCard
          label="Módulos de Gestão"
          value={6}
          subtitle="Inventário, SAM, ITAM, Rede, Alertas e Relatórios"
          icon={<LayoutGrid className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Governança & Segurança"
          value="Multi-Tenant"
          subtitle="Isolamento fail-closed e controle de acesso RBAC"
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="neutral"
        />
      </div>

      <Tabs defaultValue="user_overview" className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Barra Lateral: Índice de Tópicos do Manual */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <Panel>
            <PanelHeader
              icon={<BookOpen className="h-4 w-4" />}
              title="Manual do Sistema"
              description="Selecione o módulo de consulta"
            />
            <PanelBody className="p-2 space-y-4">
              <div>
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Manual do Usuário (Tenant)
                </p>
                <TabsList className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
                  {TOPICS.filter((t) => t.group === 'Manual do Usuário').map(({ value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value} variant="nav">
                      <Icon className="h-4 w-4" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="border-t border-surface-line pt-2">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Guia do Administrador
                </p>
                <TabsList className="h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
                  {TOPICS.filter((t) => t.group === 'Guia do Administrador').map(({ value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value} variant="nav">
                      <Icon className="h-4 w-4" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              icon={<HelpCircle className="h-4 w-4 text-primary" />}
              title="Suporte Operacional"
              description="Ajuda e governança do parque"
            />
            <PanelBody>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Utilize o menu de usuário no canto superior direito para alternar entre clientes atribuídos à sua conta ou
                exportar relatórios executivos em PDF e planilhas CSV.
              </p>
            </PanelBody>
          </Panel>
        </div>

        {/* Conteúdo Principal */}
        <div className="min-w-0">
          {/* 1. Visão Geral & Dashboard */}
          <TabsContent value="user_overview" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<LayoutGrid className="h-4 w-4" />}
                title="1. Visão Geral do Sistema & Dashboard Operacional"
                description="Como acompanhar a saúde e os indicadores em tempo real de cada cliente."
              />
              <PanelBody className="space-y-4">
                <dl className="divide-y divide-surface-line">
                  <Row term="Indicadores de Saúde">
                    O dashboard resume a proporção de máquinas online recentemente, máquinas sem comunicação recente
                    (offline) e alertas de espaço em disco ou indisponibilidade ativos.
                  </Row>
                  <Row term="Latência Semântica de Check-in">
                    O tempo desde a última sincronização de cada máquina adota cor semântica para facilitar a triagem:
                    verde para até 15 minutos, amarelo para atenção (15 a 60 minutos) e cinza para acima de 1 hora.
                  </Row>
                  <Row term="Busca Global com Ctrl+K">
                    Pressione <Code>Ctrl + K</Code> (ou <Code>⌘ + K</Code> no macOS) em qualquer tela para abrir a paleta de
                    busca rápida, permitindo navegar diretamente para computadores, servidores, relatórios ou licenças.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader
                icon={<RefreshCw className="h-4 w-4" />}
                title="Os 4 Ciclos Operacionais de Coleta"
                description="Como as informações do parque de TI são mantidas atualizadas automaticamente."
              />
              <PanelBody>
                <dl className="divide-y divide-surface-line">
                  <Row term="Coleta de Inventário · 1 hora">
                    Hardware completo, softwares instalados, periféricos, contas locais e interfaces de rede.
                  </Row>
                  <Row term="Métricas de Desempenho · 10 minutos">
                    Uso de CPU, memória RAM, capacidade de armazenamento livre e uptime da máquina.
                  </Row>
                  <Row term="Comandos Remotos · 90 segundos">
                    Fila de comandos de diagnóstico solicitados pelos operadores pelo painel web.
                  </Row>
                  <Row term="Descoberta de Rede · 6 horas">
                    Mapeamento automático de impressoras, switches, roteadores e dispositivos não monitorados na sub-rede.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 2. Computadores & Servidores */}
          <TabsContent value="user_inventory" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Monitor className="h-4 w-4" />}
                title="2. Gestão de Computadores e Servidores"
                description="Consulta detalhada de especificações, armazenamento, segurança e acesso remoto."
              />
              <PanelBody className="space-y-4">
                <dl className="divide-y divide-surface-line">
                  <Row term="Ficha Completa do Dispositivo">
                    Ao clicar em qualquer máquina, visualize a ficha técnica completa dividida em abas:
                    Identificação, Hardware, Discos, Rede, Softwares, Periféricos, Contas Locais e Patrimônio.
                  </Row>
                  <Row term="Histórico de Mudanças de Hardware">
                    Detecta e registra automaticamente qualquer alteração física de componentes entre check-ins do agente:
                    pentes de memória RAM adicionados ou removidos, substituição de processador, discos e placa-mãe.
                  </Row>
                  <Row term="Cópia Rápida de AnyDesk & IP">
                    Tanto nas tabelas de listagem quanto na ficha do dispositivo, clique no ícone de cópia ao lado do IP
                    ou do AnyDesk ID para copiar instantaneamente para a área de transferência.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 3. Softwares & Licenças (SAM) */}
          <TabsContent value="user_software" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Package className="h-4 w-4" />}
                title="3. Catálogo de Softwares & Gestão de Licenças (SAM)"
                description="Controle de softwares instalados, restrições e conformidade de licenças corporativas."
              />
              <PanelBody className="space-y-6">
                <section className="space-y-2">
                  <h3 className="section-label">Catálogo de Softwares: Abas, Paginação e URL</h3>
                  <dl className="divide-y divide-surface-line">
                    {SOFTWARE_CATALOG_URL.map(([name, text]) => (
                      <Row key={name} term={name}>
                        {text}
                      </Row>
                    ))}
                  </dl>
                </section>

                <section className="space-y-2">
                  <h3 className="section-label">Matriz das abas do catálogo</h3>
                  <dl className="divide-y divide-surface-line">
                    {SOFTWARE_TABS.map(([tab, value, rule, cards]) => (
                      <Row
                        key={value}
                        term={
                          <>
                            {tab} <Code>/software?tab={value}</Code>
                          </>
                        }
                      >
                        {rule}
                        <span className="mt-1 block">Cards: {cards}.</span>
                      </Row>
                    ))}
                  </dl>
                </section>

                <section className="space-y-2">
                  <h3 className="section-label">Gestão de Licenças (SAM) e Conciliação</h3>
                  <dl className="divide-y divide-surface-line">
                    <Row term="Conciliação de assentos">
                      O motor de reconciliação cruza as licenças cadastradas com as instalações apuradas pelo agente em computadores e servidores. Múltiplas instalações do mesmo software no mesmo dispositivo contam como 1 assento consumido.
                    </Row>
                    <Row term="Status de conformidade">
                      Calculado automaticamente: Conforme, Excedido (instalações acima do contratado), Atenção (utilização &ge; 90%), Ocioso (menos de 50% em uso) e Expirado (validade ultrapassada).
                    </Row>
                    <Row term="Exportação">
                      &quot;Exportar CSV&quot; gera arquivo RFC 4180 através da rota <Code>/api/tenant/[slug]/software/licenses/csv</Code> com assentos adquiridos, em uso, saldo, status e custo.
                    </Row>
                  </dl>
                </section>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 4. Patrimônio & Depreciação (ITAM) */}
          <TabsContent value="user_itam" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Tag className="h-4 w-4" />}
                title="4. Gestão Patrimonial, Ciclo de Vida & Depreciação (ITAM)"
                description="Controle contábil, depreciação linear de hardware e histórico de intervenções técnicas."
              />
              <PanelBody className="space-y-4">
                <dl className="divide-y divide-surface-line">
                  <Row term="Ciclo de Vida do Ativo">
                    Cada dispositivo possui status explícito de ciclo de vida: Em Uso (ativo operacional), Em Estoque (reserva técnica),
                    Em Manutenção (laboratório ou reparo), Empréstimo (Home Office / temporário) ou Baixado / Descartado.
                  </Row>
                  <Row term="Depreciação Contábil Linear">
                    Cálculo de cotas constantes pelo método padrão da Receita Federal (IN RFB nº 1700/2017 para equipamentos de TI):
                    5 anos de vida útil (60 meses) com taxa de 20% ao ano. Apura a base depreciável, cotas mensais decorridas e valor
                    contábil líquido atual, travando automaticamente no valor residual ao final da vida útil.
                  </Row>
                  <Row term="Histórico de Manutenções & Upgrades">
                    Registro estruturado de intervenções técnicas (Preventivas, Corretivas e Upgrades de peças) com título, custo,
                    técnico ou fornecedor responsável, datas de início e conclusão e notas de serviço.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 5. Relatórios & Exportações */}
          <TabsContent value="user_reports" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title="5. Relatórios Executivos, Exportações & Atalhos Rápidos"
                description="Geração de dossiês em PDF para reuniões e planilhas analíticas em CSV."
              />
              <PanelBody className="space-y-6">
                <section className="space-y-2">
                  <h3 className="section-label">Métricas, Latência Semântica e Cabeçalho (Sprints A73–A75)</h3>
                  <dl className="divide-y divide-surface-line">
                    {METRICS_TIMEFRAME_DOCS.map(([name, text]) => (
                      <Row key={name} term={name}>
                        {text}
                      </Row>
                    ))}
                  </dl>
                </section>

                <section className="space-y-2">
                  <h3 className="section-label">Paleta de Comandos (Ctrl+K) e Ações Rápidas</h3>
                  <dl className="divide-y divide-surface-line">
                    <Row term="Atalho Global (Ctrl+K)">
                      Abra a paleta em qualquer tela para buscar rotas, dispositivos e ações rápidas. O atalho não dispara com o foco num campo de digitação.
                    </Row>
                    <Row term="Grupo Ações Rápidas">
                      Permite baixar instantaneamente o Relatório Executivo em PDF ou a planilha analítica em CSV sem precisar navegar até a tela de Relatórios.
                    </Row>
                    {PALETTE_QUICK_ACTIONS.map(([title, path, desc]) => (
                      <Row
                        key={title}
                        term={
                          <>
                            {title} <Code>{path}</Code>
                          </>
                        }
                      >
                        {desc}
                      </Row>
                    ))}
                  </dl>
                </section>

                <section className="space-y-2">
                  <h3 className="section-label">Cópia em 1 Clique: IP, Hostname e AnyDesk</h3>
                  <p className="text-sm text-muted-foreground">
                    Disponível ao lado do hostname e do IP de cada linha nas telas de computadores, servidores (/servers) e dispositivos do tenant.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="section-label">Matriz de Exportações Analíticas do Tenant</h3>
                  <dl className="divide-y divide-surface-line">
                    {TENANT_EXPORTS.map(([title, path, desc]) => (
                      <Row
                        key={title}
                        term={
                          <>
                            {title} <Code>{path}</Code>
                          </>
                        }
                      >
                        {desc}
                      </Row>
                    ))}
                  </dl>
                </section>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 6. Portal do Cliente */}
          <TabsContent value="user_portal" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Users className="h-4 w-4" />}
                title="6. Portal do Cliente (Modo de Consulta Seguro)"
                description="Visão executiva dedicada ao perfil CLIENT_VIEWER para acompanhamento seguro."
              />
              <PanelBody className="space-y-6">
                <section className="space-y-2">
                  <h3 className="section-label">Portal do Cliente</h3>
                  <p className="text-sm text-muted-foreground">
                    Na lista de /portal, o IP e o AnyDesk de cada máquina têm ícone de cópia fora do link da máquina, permitindo copiar com agilidade. Na ficha (/portal/devices/[id]), o CLIENT_VIEWER tem o mesmo badge do AnyDesk com o ícone de copiar e &quot;Conectar&quot;, sem enfileirar comando, não grava auditoria e sem privilégios de alteração.
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="section-label">Resumo do parque (/portal)</h3>
                  <dl className="divide-y divide-surface-line">
                    {PORTAL_FLEET_SUMMARY.map(([name, text]) => (
                      <Row key={name} term={name}>
                        {text}
                      </Row>
                    ))}
                  </dl>
                </section>

                <section className="space-y-2">
                  <h3 className="section-label">Matriz das abas de risco das contas locais (/portal/local-accounts)</h3>
                  <dl className="divide-y divide-surface-line">
                    {LOCAL_ACCOUNTS_RISK_TABS.map(([label, tab, desc, card]) => (
                      <Row
                        key={tab}
                        term={
                          <>
                            {label} <Code>?tab={tab}</Code>
                          </>
                        }
                      >
                        {desc}
                        <span className="mt-1 block">Card: {card}.</span>
                      </Row>
                    ))}
                    <Row term="Regra de Risco">
                      Crítico: conta habilitada, administradora e com senha que nunca expira. Atenção: habilitada com apenas um dos dois. Conforme: o restante, inclusive toda conta desabilitada.
                    </Row>
                  </dl>
                </section>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 7. Gestão de Clientes & Tenants */}
          <TabsContent value="admin_clients" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Layers className="h-4 w-4" />}
                title="7. Gestão de Clientes & Arquitetura Multi-Tenant"
                description="Segregação absoluta de dados e governança por cliente contratante."
              />
              <PanelBody className="space-y-4">
                <dl className="divide-y divide-surface-line">
                  <Row term="Hierarquia de Dados">
                    <p className="data-mono text-sm text-foreground">Organization &rarr; Client &rarr; AgentAuth &rarr; Device</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      O escopo é estritamente fail-closed: cada consulta no banco é vinculada ao cliente ativo.
                      Nenhum operador tem acesso a dados de clientes fora de sua atribuição.
                    </p>
                  </Row>
                  <Row term="Retenção de Métricas">
                    Cada cliente pode ter sua retenção de métricas de desempenho ajustada individualmente
                    (padrão de 30 a 365 dias), otimizando armazenamento e histórico.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 8. Usuários, Papéis & Permissões */}
          <TabsContent value="admin_rbac" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<ShieldCheck className="h-4 w-4" />}
                title="8. Usuários, Papéis & Matriz de Permissões (RBAC)"
                description="Controle de acesso granular baseado nas funções da equipe de TI."
              />
              <PanelBody className="space-y-4">
                <dl className="divide-y divide-surface-line">
                  <Row term={<Code>PLATFORM_ADMIN</Code>}>
                    Administra a plataforma inteira: cria organizações, gerencia usuários globais e configurações de infraestrutura.
                  </Row>
                  <Row term={<Code>ORG_ADMIN</Code>}>
                    Administra os clientes e usuários da própria organização, gerencia credenciais de agentes e configurações de alerta.
                  </Row>
                  <Row term={<Code>ORG_OPERATOR</Code>}>
                    Opera o inventário no dia a dia: consulta máquinas, cadastra patrimônio, gerencia licenças e executa diagnósticos.
                  </Row>
                  <Row term={<Code>CLIENT_VIEWER</Code>}>
                    Perfil restrito de leitura no Portal do Cliente, sem permissão para editar dados, cadastrar licenças ou disparar comandos.
                  </Row>
                </dl>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 9. Implantação de Agentes */}
          <TabsContent value="admin_deploy" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<Download className="h-4 w-4" />}
                title="9. Implantação de Agentes na Rede Corporativa"
                description="Métodos oficiais para instalação em massa e gerenciamento do serviço."
              />
              <PanelBody className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Para registrar novas máquinas em um cliente, gere a credencial de ativação na tela do cliente e utilize
                  um dos métodos de instalação padronizados abaixo.
                </p>

                <div className="space-y-4">
                  <section className="space-y-2">
                    <h3 className="section-label">Script de Inicialização via GPO (Active Directory)</h3>
                    <p className="text-xs text-muted-foreground">
                      Distribuição automatizada para computadores do domínio Windows. O script roda como SYSTEM na inicialização e só instala se o serviço ainda não estiver presente:
                    </p>
                    <CopyableCodeBlock
                      title="Script de Inicialização via GPO (.bat)"
                      command={`@echo off
sc query InventarioAgent >nul 2>&1
if %errorlevel% equ 0 exit /b 0

set "AGENT_SRC=\\\\SEU-DOMINIO\\NETLOGON\\inventario-agent.exe"
"%AGENT_SRC%" install -server "https://SEU-SERVIDOR" -client "SEU-CLIENTE" -key "SUA-CHAVE" -name "%COMPUTERNAME%"`}
                      description="Por que a guarda sc query: se o serviço já estiver instalado, o script encerra imediatamente sem atrasar o boot da máquina."
                    />
                  </section>

                  <section className="space-y-2 border-t border-surface-line pt-4">
                    <h3 className="section-label">Instalação e Monitoramento no Linux</h3>
                    <p className="text-xs text-muted-foreground">
                      Instalação do agente como serviço em distribuições Linux via script de bootstrap oficial:
                    </p>
                    <CopyableCodeBlock
                      title="Instalação e verificação de logs no Linux"
                      command={`curl -fsSL 'https://SEU-SERVIDOR/api/agent/bootstrap-linux?client=SEU-CLIENTE&key=SUA-CHAVE' | sudo bash
sudo journalctl -u inventario-agent -f`}
                    />
                  </section>
                </div>
              </PanelBody>
            </Panel>
          </TabsContent>

          {/* 10. Ações Remotas & Diagnósticos */}
          <TabsContent value="admin_actions" className="space-y-6">
            <Panel>
              <PanelHeader
                icon={<RefreshCw className="h-4 w-4" />}
                title="10. Ações Remotas, Diagnósticos e Atualização Automática"
                description="Diagnósticos sob demanda e governança da fila de comandos com auditoria."
              />
              <PanelBody className="space-y-6">
                <section className="space-y-2">
                  <h3 className="section-label">Diagnósticos Rápidos (1 clique)</h3>
                  <p className="text-sm text-muted-foreground">
                    Permitem coletar diagnósticos pontuais em máquinas com agente ativo direto pela interface do dispositivo:
                  </p>
                  <dl className="divide-y divide-surface-line">
                    {REMOTE_DIAGNOSTICS.map(([key, desc]) => (
                      <Row key={key} term={<Code>{key}</Code>}>
                        {desc}
                      </Row>
                    ))}
                  </dl>
                </section>

                <section className="space-y-2 border-t border-surface-line pt-4">
                  <h3 className="section-label">Governança dos Diagnósticos Rápidos</h3>
                  <p className="text-sm text-muted-foreground">
                    Cada disparo gera evento de auditoria <Code>command.enqueue</Code> com o usuário solicitante.
                    A fila de comandos utiliza tempo de vida (TTL) de 15 minutos: comandos não recolhidos pelo agente expiram
                    automaticamente, evitando execuções atrasadas em máquinas religadas dias depois.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    A ação <Code>update_agent</Code> (&quot;Atualizar agente agora&quot;) permite atualizar agentes defasados
                    remotamente com verificação de integridade SHA-256 e rollback automático se a nova versão não responder.
                  </p>
                </section>
              </PanelBody>
            </Panel>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
