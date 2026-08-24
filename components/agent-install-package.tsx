'use client'

import { useState } from 'react'
import { Download, ShieldAlert, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyField } from '@/components/copy-field'
import type { ProvisioningPackage } from '@/app/clients/types'

/**
 * Uma acao primaria em destaque, chave em caixa de aviso, e os caminhos de
 * instalacao em massa (GPO/Intune/script) recolhidos atras de "outras formas
 * de instalar". Usado no assistente /clients/novo, no dialogo "Credenciais
 * ativas" de /clients e no estado vazio do dashboard do tenant — mesmo
 * pacote de instalacao, tres pontos de entrada.
 */
export function AgentInstallPackage({
  pkg,
  keyIsFresh,
}: {
  pkg: ProvisioningPackage
  keyIsFresh: boolean
}) {
  const [showAlternatives, setShowAlternatives] = useState(false)

  return (
    <div className="space-y-5">
      <Button asChild size="lg" className="gap-2">
        <a href={`/api/agent/download-exe?client=${pkg.clientSlug}&key=${pkg.enrollmentKey}`} download>
          <Download className="h-4 w-4" />
          Baixar instalador para Windows
        </a>
      </Button>

      <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium">
                {keyIsFresh ? 'Guarde a chave de instalação agora' : 'Chave ativa deste cliente'}
              </p>
              <p className="text-xs text-muted-foreground">
                {keyIsFresh
                  ? 'Ela não será exibida novamente. Só é necessária para instalar em mais máquinas manualmente.'
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
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {showAlternatives ? 'Ocultar' : 'Outras formas de instalar'}
        </button>

        {showAlternatives && (
          <div className="mt-4 space-y-4 border-t pt-4">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Para instalação em massa via GPO, Intune ou script remoto.</span>
            </div>
            <CopyField value={pkg.bootstrapCommand} label="PowerShell (uma linha)" />
            <CopyField value={pkg.installCommand} label="Instalação manual" />
          </div>
        )}
      </div>
    </div>
  )
}
