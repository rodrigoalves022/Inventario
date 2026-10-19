'use client'

import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Download, ShieldAlert, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyField } from '@/components/copy-field'
import type { ProvisioningPackage } from '@/app/admin/clients/types'
import { cn } from '@/lib/utils'

type Platform = 'windows' | 'linux'

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
]

/**
 * SHA-256 do binario publicado (Sprint A4, ressalva 1). E o hash do arquivo
 * servido sem configuracao, o mesmo que o script de uma linha confere; o
 * arquivo do botao leva a configuracao do cliente anexada e por isso tem outro.
 */
function PublishedBinaryHash({ sha256 }: { sha256: string }) {
  return (
    <div className="space-y-1.5 rounded-md border border-surface-line px-3 py-2">
      <p className="section-label">SHA-256 do binário publicado (sem configuração)</p>
      <p className="data-mono truncate text-xs" title={sha256}>
        {sha256}
      </p>
      <p className="text-xs text-muted-foreground">
        O arquivo do botão inclui a configuração deste cliente e por isso tem outro hash. O script de uma linha
        confere este hash automaticamente antes de instalar.
      </p>
    </div>
  )
}

/**
 * Uma acao primaria em destaque, chave em caixa de aviso, e os caminhos de
 * instalacao em massa (GPO/Intune/script) recolhidos atras de "outras formas
 * de instalar". Usado no assistente /clients/novo, no painel inline
 * "Credenciais ativas" de /clients e no estado vazio do dashboard do tenant — mesmo
 * pacote de instalacao, tres pontos de entrada.
 *
 * Sprint A4 (RF032): seletor Windows | Linux (tablist). Cada aba mostra so os
 * seus comandos e o SHA-256 do binario publicado; sem binario publicado, a
 * plataforma nao oferece download nem comando de uma linha.
 */
export function AgentInstallPackage({
  pkg,
  keyIsFresh,
}: {
  pkg: ProvisioningPackage
  keyIsFresh: boolean
}) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [platform, setPlatform] = useState<Platform>('windows')
  const tabRefs = useRef<Record<Platform, HTMLButtonElement | null>>({ windows: null, linux: null })
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const tabId = (id: Platform) => `${baseId}-tab-${id}`

  // Ativacao automatica (padrao WAI-ARIA de abas): setas, Home e End movem o
  // foco e a selecao juntos; so a aba selecionada fica no tab order.
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = PLATFORMS.findIndex((item) => item.id === platform)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % PLATFORMS.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + PLATFORMS.length) % PLATFORMS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = PLATFORMS.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const next = PLATFORMS[nextIndex].id
    setPlatform(next)
    tabRefs.current[next]?.focus()
  }

  const isWindows = platform === 'windows'
  const platformLabel = isWindows ? 'Windows' : 'Linux'
  const sha256 = isWindows ? pkg.windowsSha256 : pkg.linuxSha256
  const query = `client=${pkg.clientSlug}&key=${pkg.enrollmentKey}`

  return (
    // min-w-0: dentro de um DialogContent (grid) o item herda min-width:auto e
    // as strings longas (hash, chave, comandos) alargavam o dialogo alem da tela.
    <div className="min-w-0 space-y-5">
      <div role="tablist" aria-label="Sistema operacional" className="inline-flex gap-1 rounded-lg border border-surface-line p-1">
        {PLATFORMS.map((item) => {
          const selected = item.id === platform
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[item.id] = node
              }}
              type="button"
              role="tab"
              id={tabId(item.id)}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setPlatform(item.id)}
              onKeyDown={handleTabKeyDown}
              className={cn(
                'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground active:bg-secondary'
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={tabId(platform)} className="space-y-5">
        {sha256 ? (
          <div className="space-y-3">
            <Button asChild size="lg" className="gap-2">
              <a href={isWindows ? `/api/agent/download-exe?${query}` : `/api/agent/download-linux?${query}`} download>
                <Download className="h-4 w-4" />
                {isWindows ? 'Baixar instalador para Windows (.exe)' : 'Baixar binário para Linux (amd64)'}
              </a>
            </Button>
            <PublishedBinaryHash sha256={sha256} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Binário não publicado para {platformLabel} neste servidor. O download e o comando de uma linha ficam
            indisponíveis até um build do agente ser publicado.
          </p>
        )}

        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium">
                  {keyIsFresh ? 'Chave de instalação: trate como senha' : 'Chave ativa deste cliente'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {keyIsFresh
                    ? 'É uma credencial sensível: quem a tiver registra máquinas neste cliente. Ela fica guardada cifrada e pode ser consultada em "Ver credenciais" por quem administra este cliente. Só é necessária para instalar em mais máquinas manualmente.'
                    : 'Continua válida até você emitir um novo pacote — quem acessa esta tela pode vê-la novamente a qualquer momento.'}
                </p>
              </div>
              <CopyField value={pkg.enrollmentKey} label="Chave de instalação" />
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAlternatives((value) => !value)}
            aria-expanded={showAlternatives}
            aria-controls={`${baseId}-alternatives`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {showAlternatives ? 'Ocultar' : 'Outras formas de instalar'}
          </button>

          {showAlternatives && (
            <div id={`${baseId}-alternatives`} className="mt-4 space-y-4 border-t border-surface-line pt-4">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {isWindows
                    ? 'Para instalação em massa via GPO, Intune ou script remoto.'
                    : 'Para instalação por SSH, script remoto ou ferramenta de automação.'}
                </span>
              </div>
              {isWindows ? (
                <>
                  {sha256 ? <CopyField value={pkg.bootstrapCommand} label="PowerShell (uma linha)" /> : null}
                  <CopyField value={pkg.installCommand} label="Instalação manual" />
                </>
              ) : (
                <>
                  {sha256 ? <CopyField value={pkg.linuxBootstrapCommand} label="Bash (uma linha, como root)" /> : null}
                  <CopyField value={pkg.linuxInstallCommand} label="Instalação manual" />
                  <p className="text-xs text-muted-foreground">
                    Rode na pasta onde baixou o binário: o comando copia o arquivo para /usr/local/bin já com
                    permissão de execução e instala o serviço com sudo. Para executar o arquivo baixado direto
                    (instalação automática), mova-o antes para a pasta definitiva e rode chmod +x e depois sudo
                    com o arquivo, porque o serviço registra o caminho atual dele.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
