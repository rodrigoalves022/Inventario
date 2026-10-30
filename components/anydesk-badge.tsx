'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

const ANYDESK_ID_PATTERN = /^\d{9,10}$/

/** Formata `123456789` como `123 456 789` e `1234567890` como `123 456 7890`. */
export function formatAnydeskId(id: string): string {
  if (!ANYDESK_ID_PATTERN.test(id)) return id
  return id.replace(/(\d{3})(\d{3})(\d{3,4})/, '$1 $2 $3')
}

type AnydeskBadgeProps = {
  anydeskId: string | null | undefined
  compact?: boolean
  showEmpty?: boolean
}

export function AnydeskBadge({ anydeskId, compact = false, showEmpty = false }: AnydeskBadgeProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  if (!anydeskId || !ANYDESK_ID_PATTERN.test(anydeskId)) {
    return showEmpty ? <span className="text-xs text-muted-foreground">—</span> : null
  }

  const formatted = formatAnydeskId(anydeskId)

  if (compact) {
    return (
      <span className="text-xs text-muted-foreground">
        AnyDesk: <span className="data-mono text-foreground">{formatted}</span>
      </span>
    )
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(anydeskId as string)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard indisponivel (contexto inseguro/permissao negada): sem feedback.
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-surface-line bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
      <span>AnyDesk:</span>
      <span className="data-mono font-semibold text-foreground">{formatted}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar ID do AnyDesk"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? <span role="status">Copiado</span> : null}
      </button>
      <a
        href={`anydesk:${anydeskId}`}
        title="Abrir no AnyDesk"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-primary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Conectar
      </a>
    </span>
  )
}
