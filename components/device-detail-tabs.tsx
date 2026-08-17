'use client'

import { useMemo, useState } from 'react'
import { Search, Cpu, Network, Package, Terminal, LayoutGrid, ShieldCheck, Info, Activity } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type DeviceDisk = {
  id: string
  unidade: string | null
  modelo: string | null
  tipo: string | null
  capacidadeGb: number | null
  espacoLivreGb: number | null
  criptografia: string | null
}

export type DeviceNetwork = {
  id: string
  ip: string | null
  mac: string | null
  gateway: string | null
  dns: string | null
  dhcp: boolean
  isPrimary: boolean
}

export type DeviceSoftware = {
  id: string
  nome: string
  versao: string | null
  editor: string | null
  installadoEm: string | null
}

export type DeviceHardware = {
  sistema: string | null
  versaoSO: string | null
  processador: string | null
  ramTotalGb: number | null
  placaMae: string | null
  tipoArmazenamento: string | null
  slots: Array<{ slot: string; value: string | null }>
}

export type DeviceCommand = {
  id: string
  type: string
  status: string
  createdAt: string
  resultJson: string | null
}

export type DeviceSecurity = {
  antivirusNome: string | null
  antivirusAtivo: boolean | null
  antivirusAtualizado: boolean | null
  firewallAtivo: boolean | null
  secureBootAtivo: boolean | null
  tpmPresente: boolean | null
  uacAtivo: boolean | null
  observacao: string | null
  coletadoEm: string
}

export type DeviceLocalAccount = {
  id: string
  usuario: string
  isAdmin: boolean
  habilitada: boolean
  senhaNuncaExpira: boolean
}

export type DeviceMetricSample = {
  collectedAt: string
  cpuPercent: number | null
  ramUsadaGb: number | null
  ramTotalGb: number | null
  discoUsadoGb: number | null
  discoLivreGb: number | null
  uptimeSegundos: number | null
}

type Props = {
  device: {
    hostname: string
    serial: string | null
    fabricante: string | null
    modelo: string | null
    dominio: string | null
    usuario: string | null
    status: string
    lastCollectedAt: string | null
  }
  hardware: DeviceHardware | null
  disks: DeviceDisk[]
  networks: DeviceNetwork[]
  software: DeviceSoftware[]
  commands: DeviceCommand[]
  canRunCommands: boolean
  security: DeviceSecurity | null
  localAccounts: DeviceLocalAccount[]
  metrics: DeviceMetricSample[]
  metricsRetentionDays: number
}

const COMMAND_TYPE_LABELS: Record<string, string> = {
  collect_now: 'Forçar coleta',
  restart_service: 'Reiniciar serviço',
  run_script: 'Rodar script',
}

const COMMAND_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  running: 'Em execução',
  done: 'Concluído',
  failed: 'Falhou',
  expired: 'Expirado',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || 'Não informado'}</p>
    </div>
  )
}

/**
 * Indicador de tres estados. `null` significa "nao apurado" e NUNCA pode ser
 * pintado como problema: o agente deixa nulo quando nao consegue consultar
 * (Windows Server sem SecurityCenter2, BitLocker ausente, falta de privilegio).
 * Mostrar isso como "desativado" geraria alarme falso de compliance.
 */
function SecurityIndicator({
  label,
  value,
  detail,
  goodWhen = true,
}: {
  label: string
  value: boolean | null
  detail?: string | null
  goodWhen?: boolean
}) {
  const unknown = value === null || value === undefined
  const isGood = !unknown && value === goodWhen

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-1',
        unknown && 'border-dashed bg-muted/20',
        !unknown && isGood && 'border-success/30 bg-success/5',
        !unknown && !isGood && 'border-destructive/30 bg-destructive/5'
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-lg font-semibold',
          unknown && 'text-muted-foreground',
          !unknown && isGood && 'text-success',
          !unknown && !isGood && 'text-destructive'
        )}
      >
        {unknown ? 'Não apurado' : value ? 'Ativo' : 'Inativo'}
      </p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
      {children}
    </div>
  )
}

function DiskBar({ disk }: { disk: DeviceDisk }) {
  const total = disk.capacidadeGb ?? 0
  const free = disk.espacoLivreGb ?? 0
  const used = Math.max(total - free, 0)
  const usage = total > 0 ? Math.round((used / total) * 100) : 0
  // Acima de 90% de uso o disco vira problema operacional, nao so informacao.
  const critical = usage >= 90

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {disk.unidade ?? 'Disco'} <span className="text-muted-foreground">({disk.tipo ?? 'N/A'})</span>
        </span>
        <span className={cn('text-xs', critical ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {used} GB de {total} GB
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full rounded-full', critical ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${usage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{free} GB livres · {usage}% usado</p>
    </div>
  )
}

function formatUptime(seconds: number | null) {
  if (seconds === null || seconds === undefined) return 'Não apurado'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}min`
}

function formatChartTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MetricChart({
  title,
  unit,
  data,
  dataKey,
  color,
  domain,
}: {
  title: string
  unit: string
  data: DeviceMetricSample[]
  dataKey: keyof DeviceMetricSample
  color: string
  domain?: [number, number]
}) {
  return (
    <Panel title={title}>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <XAxis
              dataKey="collectedAt"
              tickFormatter={formatChartTime}
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={domain ?? ['auto', 'auto']}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--card-foreground)',
              }}
              labelFormatter={(value) => formatChartTime(String(value))}
              formatter={(value: number) => [`${value.toFixed(1)} ${unit}`, title]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

export function DeviceDetailTabs({
  device,
  hardware,
  disks,
  networks,
  software,
  commands,
  canRunCommands,
  security,
  localAccounts,
  metrics,
  metricsRetentionDays,
}: Props) {
  const [query, setQuery] = useState('')

  const filteredSoftware = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return software
    return software.filter(
      (item) =>
        item.nome.toLowerCase().includes(term) ||
        (item.editor ?? '').toLowerCase().includes(term) ||
        (item.versao ?? '').toLowerCase().includes(term)
    )
  }, [query, software])

  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null
  const diskUsagePercent =
    latestMetric?.discoUsadoGb != null && latestMetric?.discoLivreGb != null
      ? Math.round(
          (latestMetric.discoUsadoGb / (latestMetric.discoUsadoGb + latestMetric.discoLivreGb)) * 100
        )
      : null

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="overview" className="gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5" /> Visão geral
        </TabsTrigger>
        <TabsTrigger value="hardware" className="gap-1.5">
          <Cpu className="h-3.5 w-3.5" /> Hardware
        </TabsTrigger>
        <TabsTrigger value="software" className="gap-1.5">
          <Package className="h-3.5 w-3.5" /> Software
          <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{software.length}</span>
        </TabsTrigger>
        <TabsTrigger value="security" className="gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Segurança
        </TabsTrigger>
        <TabsTrigger value="metrics" className="gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Métricas
        </TabsTrigger>
        <TabsTrigger value="network" className="gap-1.5">
          <Network className="h-3.5 w-3.5" /> Rede
        </TabsTrigger>
        {canRunCommands && (
          <TabsTrigger value="commands" className="gap-1.5">
            <Terminal className="h-3.5 w-3.5" /> Comandos
          </TabsTrigger>
        )}
      </TabsList>

      {/* ---------- Visão geral ---------- */}
      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Identificação">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fabricante" value={device.fabricante} />
              <Field label="Modelo" value={device.modelo} />
              <Field label="Número de série" value={device.serial} />
              <Field label="Domínio" value={device.dominio} />
              <Field label="Usuário" value={device.usuario} />
              <Field label="Sistema" value={hardware?.sistema} />
            </div>
          </Panel>

          <Panel title="Resumo">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Processador" value={hardware?.processador} />
              <Field label="Memória" value={hardware?.ramTotalGb ? `${hardware.ramTotalGb} GB` : null} />
              <Field label="Programas instalados" value={`${software.length}`} />
              <Field label="Interfaces de rede" value={`${networks.length}`} />
            </div>
          </Panel>
        </div>

        <Panel title="Armazenamento">
          {disks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum disco reportado.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {disks.map((disk) => (
                <DiskBar key={disk.id} disk={disk} />
              ))}
            </div>
          )}
        </Panel>
      </TabsContent>

      {/* ---------- Hardware ---------- */}
      <TabsContent value="hardware" className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Processamento e memória">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Processador" value={hardware?.processador} />
              <Field label="RAM total" value={hardware?.ramTotalGb ? `${hardware.ramTotalGb} GB` : null} />
              <Field label="Placa-mãe" value={hardware?.placaMae} />
              <Field label="Armazenamento" value={hardware?.tipoArmazenamento} />
            </div>
          </Panel>

          <Panel title="Sistema operacional">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sistema" value={hardware?.sistema} />
              <Field label="Versão" value={hardware?.versaoSO} />
            </div>
          </Panel>
        </div>

        <Panel title="Slots de memória">
          <div className="grid gap-3 sm:grid-cols-4">
            {(hardware?.slots ?? []).map((slot) => {
              const occupied = Boolean(slot.value)
              return (
                <div
                  key={slot.slot}
                  className={cn(
                    'space-y-1 rounded-lg border p-3',
                    occupied ? 'border-primary/40 bg-primary/5' : 'bg-muted/30'
                  )}
                >
                  <p className="text-xs text-muted-foreground">{slot.slot}</p>
                  <p className={cn('text-sm font-semibold', !occupied && 'text-muted-foreground')}>
                    {slot.value ?? 'Vazio'}
                  </p>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel title="Discos">
          {disks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum disco reportado.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {disks.map((disk) => (
                <div key={disk.id} className="space-y-3 rounded-lg border p-4">
                  <Field label="Unidade" value={disk.unidade} />
                  <Field label="Modelo" value={disk.modelo} />
                  <DiskBar disk={disk} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </TabsContent>

      {/* ---------- Software ---------- */}
      <TabsContent value="software" className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, editor ou versão..."
            className="pl-9"
          />
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 text-xs font-medium text-muted-foreground">
            {filteredSoftware.length} de {software.length} programas
          </div>
          {filteredSoftware.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {software.length === 0
                ? 'Nenhum programa reportado por este agente.'
                : 'Nenhum programa corresponde à busca.'}
            </p>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Programa</th>
                    <th className="px-4 py-2 font-medium">Versão</th>
                    <th className="px-4 py-2 font-medium">Editor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSoftware.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2 font-medium">{item.nome}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {item.versao ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{item.editor ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>

      {/* ---------- Segurança ---------- */}
      <TabsContent value="security" className="space-y-6">
        {!security ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              Este agente ainda não enviou dados de segurança. Atualize o agente e aguarde a próxima
              coleta.
            </p>
          </Panel>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SecurityIndicator
                label="Antivírus"
                value={security.antivirusAtivo}
                detail={
                  security.antivirusNome ??
                  (security.antivirusAtualizado === false ? 'Assinaturas desatualizadas' : undefined)
                }
              />
              <SecurityIndicator label="Firewall" value={security.firewallAtivo} />
              <SecurityIndicator label="Secure Boot" value={security.secureBootAtivo} />
              <SecurityIndicator label="TPM" value={security.tpmPresente} detail="Módulo de plataforma confiável" />
              <SecurityIndicator label="UAC" value={security.uacAtivo} detail="Controle de conta de usuário" />
              <SecurityIndicator
                label="Assinaturas do antivírus"
                value={security.antivirusAtualizado}
                detail={security.antivirusAtualizado === null ? undefined : 'Atualizadas'}
              />
            </div>

            {security.observacao && (
              <div className="flex gap-3 rounded-xl border border-dashed p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">Por que há itens não apurados</p>
                  <p className="text-sm text-muted-foreground">{security.observacao}</p>
                </div>
              </div>
            )}

            <Panel title="Criptografia de disco">
              {disks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum disco reportado.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {disks.map((disk) => (
                    <div key={disk.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{disk.unidade ?? 'Disco'}</span>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          disk.criptografia === 'on' && 'border-success/30 bg-success/10 text-success',
                          disk.criptografia === 'off' &&
                            'border-destructive/30 bg-destructive/10 text-destructive',
                          (!disk.criptografia || disk.criptografia === 'unknown') &&
                            'border-dashed text-muted-foreground'
                        )}
                      >
                        {disk.criptografia === 'on'
                          ? 'Criptografado'
                          : disk.criptografia === 'off'
                            ? 'Sem criptografia'
                            : 'Não apurado'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title={`Contas locais (${localAccounts.length})`}>
              {localAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta local reportada. Em controladores de domínio isso é o esperado — todas
                  as contas são de domínio.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 font-medium">Usuário</th>
                      <th className="py-2 font-medium">Administrador</th>
                      <th className="py-2 font-medium">Situação</th>
                      <th className="py-2 font-medium">Senha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localAccounts.map((account) => (
                      <tr key={account.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{account.usuario}</td>
                        <td className="py-2">
                          {account.isAdmin ? (
                            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                              Sim
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Não</span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {account.habilitada ? 'Habilitada' : 'Desabilitada'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {account.senhaNuncaExpira ? 'Nunca expira' : 'Expira'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <p className="text-xs text-muted-foreground">
              Coletado em {new Date(security.coletadoEm).toLocaleString('pt-BR')}.
            </p>
          </>
        )}
      </TabsContent>

      {/* ---------- Métricas ---------- */}
      <TabsContent value="metrics" className="space-y-6">
        {metrics.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              Nenhuma métrica coletada ainda. O ciclo de métricas roda a cada ~10 minutos, separado
              da coleta completa — se o agente acabou de ser instalado, aguarde a próxima amostra.
            </p>
          </Panel>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Panel>
                <p className="text-xs text-muted-foreground">CPU agora</p>
                <p className="text-2xl font-semibold text-foreground">
                  {latestMetric?.cpuPercent != null ? `${latestMetric.cpuPercent.toFixed(0)}%` : 'Não apurado'}
                </p>
              </Panel>
              <Panel>
                <p className="text-xs text-muted-foreground">RAM em uso</p>
                <p className="text-2xl font-semibold text-foreground">
                  {latestMetric?.ramUsadaGb != null && latestMetric?.ramTotalGb != null
                    ? `${latestMetric.ramUsadaGb.toFixed(1)} / ${latestMetric.ramTotalGb.toFixed(1)} GB`
                    : 'Não apurado'}
                </p>
              </Panel>
              <Panel>
                <p className="text-xs text-muted-foreground">Disco (unidade do sistema)</p>
                <p className="text-2xl font-semibold text-foreground">
                  {diskUsagePercent != null ? `${diskUsagePercent}% usado` : 'Não apurado'}
                </p>
              </Panel>
              <Panel>
                <p className="text-xs text-muted-foreground">Uptime</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatUptime(latestMetric?.uptimeSegundos ?? null)}
                </p>
              </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <MetricChart
                title="CPU"
                unit="%"
                data={metrics}
                dataKey="cpuPercent"
                color="var(--chart-1)"
                domain={[0, 100]}
              />
              <MetricChart
                title="RAM usada"
                unit="GB"
                data={metrics}
                dataKey="ramUsadaGb"
                color="var(--chart-2)"
              />
              <MetricChart
                title="Disco usado (unidade do sistema)"
                unit="GB"
                data={metrics}
                dataKey="discoUsadoGb"
                color="var(--chart-3)"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {metrics.length} amostras · retenção de {metricsRetentionDays} dias configurada para
              este cliente · lacunas no gráfico indicam períodos sem coleta, não zero.
            </p>
          </>
        )}
      </TabsContent>

      {/* ---------- Rede ---------- */}
      <TabsContent value="network" className="space-y-4">
        {networks.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Nenhuma interface de rede reportada.</p>
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {networks.map((network) => (
              <div key={network.id} className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{network.ip ?? 'Sem IP'}</span>
                  {network.isPrimary && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Principal
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="MAC" value={network.mac} />
                  <Field label="Gateway" value={network.gateway} />
                  <Field label="DNS" value={network.dns} />
                  <Field label="Atribuição" value={network.dhcp ? 'DHCP' : 'Estático'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ---------- Comandos ---------- */}
      {canRunCommands && (
        <TabsContent value="commands" className="space-y-4">
          <div className="rounded-xl border bg-card">
            {commands.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Nenhum comando enviado a esta máquina ainda. Use “Forçar coleta” no topo da página.
              </p>
            ) : (
              <div className="divide-y">
                {commands.map((command) => {
                  let output: string | null = null
                  try {
                    const parsed = command.resultJson ? JSON.parse(command.resultJson) : null
                    output = parsed?.errorMessage || parsed?.output || null
                  } catch {
                    output = null
                  }

                  return (
                    <div key={command.id} className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">
                          {COMMAND_TYPE_LABELS[command.type] ?? command.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(command.createdAt).toLocaleString('pt-BR')}
                        </p>
                        {output && (
                          <p className="truncate font-mono text-xs text-muted-foreground" title={output}>
                            {output}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                          command.status === 'done' && 'border-success/30 bg-success/10 text-success',
                          command.status === 'failed' &&
                            'border-destructive/30 bg-destructive/10 text-destructive',
                          (command.status === 'pending' || command.status === 'running') &&
                            'border-warning/30 bg-warning/10 text-warning',
                          command.status === 'expired' && 'bg-muted/40 text-muted-foreground'
                        )}
                      >
                        {COMMAND_STATUS_LABELS[command.status] ?? command.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>
      )}
    </Tabs>
  )
}
