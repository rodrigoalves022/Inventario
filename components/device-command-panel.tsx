'use client'

import { useActionState, useEffect, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import {
  Activity,
  Download,
  Network,
  PackageSearch,
  Power,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  enqueueDeviceCommandAction,
  type EnqueueCommandActionState,
} from '@/app/app/[clientSlug]/assets/[id]/actions'
import {
  RESTARTABLE_SERVICES,
  RESTARTABLE_SERVICE_LABELS,
  SCRIPT_CATALOG_DETAILS,
  SCRIPT_CATALOG_IDS,
  SCRIPT_CATALOG_LABELS,
} from '@/lib/agent-commands'

type ScriptId = (typeof SCRIPT_CATALOG_IDS)[number]

/** Scripts de diagnostico e seguranca com atalho proprio: os que o operador
 * roda para investigar um chamado, sem abrir o seletor do catalogo. */
const QUICK_SCRIPTS: { scriptId: ScriptId; label: string; icon: LucideIcon }[] = [
  { scriptId: 'defender_quick_scan', label: 'Defender: Varredura Rápida', icon: ShieldCheck },
  { scriptId: 'windows_update_check', label: 'Windows Update: Verificar', icon: PackageSearch },
  { scriptId: 'network_diag', label: 'Diagnóstico de Rede', icon: Network },
]

// Objeto simples, nao pode viver no arquivo "use server" de actions.ts: esse
// tipo de arquivo so pode exportar funcoes async, nunca valores.
const idleState: EnqueueCommandActionState = { status: 'idle', message: null }

function SubmitButton({
  children,
  variant = 'outline',
  ariaLabel,
}: {
  children: React.ReactNode
  variant?: 'outline' | 'destructive'
  /** Nome acessivel quando o texto visivel e' so o verbo ("Executar") e se
   * repete entre linhas. Sempre comeca pelo texto visivel (WCAG 2.5.3). */
  ariaLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size="sm" className="gap-2" disabled={pending} aria-label={pending ? undefined : ariaLabel}>
      {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
      {pending ? 'Enfileirando...' : children}
    </Button>
  )
}

/** Feedback de comando via toast — confirma a acao e some sozinho, em vez de
 * um texto fixo que fica ocupando layout ate o proximo envio. */
function useCommandFeedback(state: EnqueueCommandActionState) {
  useEffect(() => {
    if (!state.message) return
    if (state.status === 'error') toast.error(state.message)
    else toast.success(state.message)
  }, [state])
}

function DeviceFields({ tenantSlug, deviceId, type }: { tenantSlug: string; deviceId: string; type: string }) {
  return (
    <>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="assetId" value={deviceId} />
      <input type="hidden" name="type" value={type} />
    </>
  )
}

/** Linha de comando: o que faz a esquerda, o controle a direita. Linhas dentro
 * do Panel usam `divide-y`, nunca cartao proprio (regra dura do Panel). */
function CommandRow({
  title,
  description,
  descriptionId,
  command,
  children,
}: {
  title: string
  description: string
  descriptionId?: string
  /** O que o agente roda de fato. Dado tecnico, por isso `.data-mono`. */
  command?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
      <div className="min-w-0 flex-1 basis-64 space-y-0.5">
        <p className="text-sm font-medium text-card-foreground">{title}</p>
        <div id={descriptionId} className="space-y-0.5">
          <p className="text-xs text-muted-foreground">{description}</p>
          {command && <p className="data-mono break-all text-xs text-muted-foreground">{command}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function CommandSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="group/section">
      <div className="px-5 pt-4 pb-1 group-first/section:pt-0">
        <h3 id={headingId} className="section-label">
          {title}
        </h3>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="divide-y divide-surface-line">{children}</div>
    </section>
  )
}

function QuickScriptForm({
  tenantSlug,
  deviceId,
  scriptId,
  label,
  icon: Icon,
}: {
  tenantSlug: string
  deviceId: string
  scriptId: ScriptId
  label: string
  icon: LucideIcon
}) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  useCommandFeedback(state)
  const details = SCRIPT_CATALOG_DETAILS[scriptId]

  return (
    <form action={formAction}>
      <DeviceFields tenantSlug={tenantSlug} deviceId={deviceId} type="run_script" />
      <input type="hidden" name="scriptId" value={scriptId} />
      <CommandRow title={label} description={details.description} command={details.command}>
        <SubmitButton ariaLabel={`Executar ${label}`}>
          <Icon className="h-4 w-4" />
          Executar
        </SubmitButton>
      </CommandRow>
    </form>
  )
}

function RunScriptForm({ tenantSlug, deviceId }: { tenantSlug: string; deviceId: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  useCommandFeedback(state)
  // Controlado para a descricao acompanhar o script escolhido antes do envio.
  const [scriptId, setScriptId] = useState<ScriptId>(SCRIPT_CATALOG_IDS[0])
  const descriptionId = useId()
  const details = SCRIPT_CATALOG_DETAILS[scriptId]

  return (
    <form action={formAction}>
      <DeviceFields tenantSlug={tenantSlug} deviceId={deviceId} type="run_script" />
      <CommandRow
        title="Script do catálogo"
        description={details.description}
        descriptionId={descriptionId}
        command={details.command}
      >
        <Select name="scriptId" value={scriptId} onValueChange={(value) => setScriptId(value as ScriptId)}>
          <SelectTrigger size="sm" className="h-9" aria-label="Script do catálogo" aria-describedby={descriptionId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCRIPT_CATALOG_IDS.map((script) => (
              <SelectItem key={script} value={script}>
                {SCRIPT_CATALOG_LABELS[script]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SubmitButton>
          <Terminal className="h-4 w-4" />
          Rodar script
        </SubmitButton>
      </CommandRow>
    </form>
  )
}

function CollectMetricsNowForm({ tenantSlug, deviceId }: { tenantSlug: string; deviceId: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  useCommandFeedback(state)

  return (
    <form action={formAction}>
      <DeviceFields tenantSlug={tenantSlug} deviceId={deviceId} type="collect_metrics_now" />
      <CommandRow
        title="Coletar métricas agora"
        description="Envia uma amostra de métricas sem esperar o próximo intervalo de coleta."
      >
        <SubmitButton ariaLabel="Coletar métricas agora">
          <Activity className="h-4 w-4" />
          Coletar
        </SubmitButton>
      </CommandRow>
    </form>
  )
}

function UpdateAgentNowForm({ tenantSlug, deviceId }: { tenantSlug: string; deviceId: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  useCommandFeedback(state)

  return (
    <form action={formAction}>
      <DeviceFields tenantSlug={tenantSlug} deviceId={deviceId} type="update_agent" />
      <CommandRow
        title="Atualizar agente agora"
        description="Procura uma versão nova do agente e instala sem esperar a checagem periódica."
      >
        <SubmitButton ariaLabel="Atualizar agente agora">
          <Download className="h-4 w-4" />
          Atualizar
        </SubmitButton>
      </CommandRow>
    </form>
  )
}

function RestartServiceForm({ tenantSlug, deviceId }: { tenantSlug: string; deviceId: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  useCommandFeedback(state)

  return (
    <form action={formAction}>
      <DeviceFields tenantSlug={tenantSlug} deviceId={deviceId} type="restart_service" />
      <CommandRow title="Reiniciar serviço" description="Para e inicia de novo o serviço do Windows escolhido.">
        <Select name="serviceName" defaultValue={RESTARTABLE_SERVICES[0]}>
          <SelectTrigger size="sm" className="h-9" aria-label="Serviço">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESTARTABLE_SERVICES.map((service) => (
              <SelectItem key={service} value={service}>
                {RESTARTABLE_SERVICE_LABELS[service]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SubmitButton>
          <Wrench className="h-4 w-4" />
          Reiniciar serviço
        </SubmitButton>
      </CommandRow>
    </form>
  )
}

function RestartComputerForm({ tenantSlug, deviceId, hostname }: { tenantSlug: string; deviceId: string; hostname: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  useCommandFeedback(state)

  return (
    <CommandRow
      title="Reiniciar máquina"
      description="Reinicia em ~10s após o agente receber o comando. Trabalho não salvo do usuário logado é perdido."
    >
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-fit gap-2">
            <Power className="h-4 w-4" />
            Reiniciar máquina
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar {hostname}?</AlertDialogTitle>
            <AlertDialogDescription>
              A máquina reinicia em ~10s após o agente receber o comando (até ~90s de fila). Qualquer
              trabalho não salvo do usuário logado será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={formAction}>
            <DeviceFields tenantSlug={tenantSlug} deviceId={deviceId} type="restart_computer" />
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </AlertDialogCancel>
              <SubmitButton variant="destructive">Confirmar reinício</SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </CommandRow>
  )
}

function UninstallAgentForm({ tenantSlug, deviceId, hostname }: { tenantSlug: string; deviceId: string; hostname: string }) {
  const [state, formAction] = useActionState(enqueueDeviceCommandAction, idleState)
  useCommandFeedback(state)

  return (
    <CommandRow
      title="Desinstalar agente"
      description="Remove serviço, credenciais locais e binário, e revoga a credencial do agente. Não pode ser desfeito."
    >
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-fit gap-2">
            <Trash2 className="h-4 w-4" />
            Desinstalar agente
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desinstalar agente de {hostname}?</AlertDialogTitle>
            <AlertDialogDescription>
              O serviço, as credenciais locais e o binário do agente serão removidos da máquina remota, e a
              credencial do agente será revogada automaticamente ao concluir. A máquina deixa de reportar ao
              inventário e só volta com uma nova instalação. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={formAction}>
            <DeviceFields tenantSlug={tenantSlug} deviceId={deviceId} type="uninstall_agent" />
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </AlertDialogCancel>
              <SubmitButton variant="destructive">Confirmar desinstalação</SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </CommandRow>
  )
}

export function DeviceCommandPanel({
  tenantSlug,
  deviceId,
  hostname,
}: {
  tenantSlug: string
  deviceId: string
  hostname: string
}) {
  return (
    <Panel>
      <PanelHeader
        icon={<Terminal className="h-4 w-4" />}
        title="Comandos remotos"
        description="Executados pelo agente no próximo ciclo (~90s)"
      />
      <PanelBody flush className="divide-y divide-surface-line pb-2">
        <CommandSection
          title="Diagnóstico e segurança"
          description="A saída de cada script aparece no histórico de comandos deste dispositivo."
        >
          {QUICK_SCRIPTS.map((script) => (
            <QuickScriptForm key={script.scriptId} tenantSlug={tenantSlug} deviceId={deviceId} {...script} />
          ))}
          <RunScriptForm tenantSlug={tenantSlug} deviceId={deviceId} />
        </CommandSection>
        <CommandSection title="Operações gerais">
          <CollectMetricsNowForm tenantSlug={tenantSlug} deviceId={deviceId} />
          <UpdateAgentNowForm tenantSlug={tenantSlug} deviceId={deviceId} />
          <RestartServiceForm tenantSlug={tenantSlug} deviceId={deviceId} />
        </CommandSection>
        <CommandSection
          title="Operações destrutivas"
          description="Tiram a máquina ou o agente do ar. Cada uma pede confirmação antes de enfileirar."
        >
          <RestartComputerForm tenantSlug={tenantSlug} deviceId={deviceId} hostname={hostname} />
          <UninstallAgentForm tenantSlug={tenantSlug} deviceId={deviceId} hostname={hostname} />
        </CommandSection>
      </PanelBody>
    </Panel>
  )
}
