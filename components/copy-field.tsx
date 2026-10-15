'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

type CopyStatus = 'idle' | 'copied' | 'failed'

/**
 * Campo de valor tecnico com botao de copiar.
 *
 * - A confirmacao vai para uma regiao `aria-live` (nao `role="status"`: o
 *   passo 3 do assistente e o painel de clientes ja tem uma regiao status
 *   cada, e os testes deles contam com ela ser unica).
 * - Falha de copia aparece na tela. Fora de contexto seguro (HTTP fora de
 *   localhost) `navigator.clipboard` nao existe, e antes o clique falhava em
 *   silencio.
 */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<CopyStatus>('idle')

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard indisponivel')
      await navigator.clipboard.writeText(value)
      setStatus('copied')
      setTimeout(() => setStatus((current) => (current === 'copied' ? 'idle' : current)), 1800)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className="space-y-1.5">
      {/* <p> e nao <Label>: nao ha controle de formulario associado, e o
          `text-sm font-medium` do Label (utilitario) venceria o
          `.section-label` (@layer components). */}
      <p className="section-label">{label}</p>
      <div className="flex gap-2">
        <code className="data-mono flex-1 overflow-x-auto rounded-md border border-surface-line bg-muted/40 px-3 py-2 text-xs leading-relaxed">
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={handleCopy}>
          {status === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="sr-only">Copiar {label}</span>
        </Button>
      </div>
      <p aria-live="polite" className={status === 'failed' ? 'text-xs text-destructive' : 'sr-only'}>
        {status === 'copied'
          ? `Copiado para a área de transferência: ${label}.`
          : status === 'failed'
            ? 'Não foi possível copiar. Selecione o texto e copie manualmente.'
            : ''}
      </p>
    </div>
  )
}
