'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Botao de copiar discreto para dado tecnico dentro de uma linha clicavel
 * (hostname, IP) — Sprint A64.
 *
 * - `stopPropagation` no clique E no keydown: a linha (`CLICKABLE_ROW_CLASS`,
 *   role="button") navega no clique e tambem no Enter/Espaco via `onKeyDown`,
 *   que chama `preventDefault`. Sem barrar o keydown, Enter com foco no botao
 *   subiria ate o <tr>, cancelaria a ativacao do botao e navegaria em vez de
 *   copiar.
 * - Feedback em dois canais: o icone vira um check por alguns instantes e um
 *   toast (sonner, ja montado em app/layout.tsx, que tem regiao aria-live
 *   propria) confirma o valor copiado. Falha de copia tambem vira toast: fora
 *   de contexto seguro `navigator.clipboard` nao existe.
 */
export function CopyInlineButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard indisponivel')
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
      toast.success(`${label} copiado: ${value}`)
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.')
    }
  }

  return (
    <button
      type="button"
      aria-label={copied ? `${label} copiado` : `Copiar ${label} ${value}`}
      title={`Copiar ${label}`}
      onClick={(event) => {
        event.stopPropagation()
        void copy()
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors',
        'text-muted-foreground/50 hover:bg-surface-hover hover:text-foreground group-hover:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        copied && 'text-primary group-hover:text-primary'
      )}
    >
      {copied ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Copy className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  )
}
