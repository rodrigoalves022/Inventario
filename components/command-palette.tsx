'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { CornerDownLeft, Monitor, Search, Server } from 'lucide-react'

import type { ShellNavSection } from '@/lib/shell-navigation'
import { getTenantPath } from '@/lib/tenant-links'
import { formatAnydeskId } from '@/components/anydesk-badge'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Paleta de comando do shell (Ctrl+K / Cmd+K).
 *
 * ESCOPO: a paleta busca DUAS coisas.
 *
 * 1. ROTAS do tenant — exatamente as mesmas que a sidebar monta, filtradas
 *    pelo mesmo predicado de papel (`buildShellNavigation`). Estao em memoria,
 *    filtram instantaneamente, sem rede.
 * 2. DISPOSITIVOS por hostname, IP, usuario, serial, etiqueta ou responsavel, via
 *    `GET /api/tenant/[clientSlug]/devices/search` (Backlog item 13). Consulta
 *    de rede, com debounce, escopo por tenant e rate limit na rota.
 *
 * As duas fontes convivem sem se atrapalhar porque o filtro local do `cmdk`
 * casa o termo digitado contra o `value` de cada item, e o `value` dos
 * dispositivos carrega hostname e IP — que sao exatamente os campos pelos
 * quais o servidor ja casou. Um resultado que veio do servidor nunca some por
 * causa do filtro local.
 *
 * Por que o atalho e real e nao so um `⌘K` desenhado ao lado do campo: um
 * enfeite que anuncia um atalho inexistente e pior que nao ter enfeite nenhum
 * — promete e nao cumpre.
 */

/** Espera antes de consultar a rota. Abaixo disso a paleta dispararia uma
 * requisicao por tecla; acima, a lista pareceria travada. */
const SEARCH_DEBOUNCE_MS = 250

/** Mesmo minimo que o Zod da rota exige. Checado aqui tambem para nem sair
 * requisicao que a rota ja devolveria vazia. */
const MIN_SEARCH_LENGTH = 2

type DeviceHit = {
  id: string
  hostname: string
  ip: string | null
  anydeskId?: string | null
  usuario?: string | null
  serial?: string | null
  etiqueta?: string | null
  responsavel?: string | null
  isServer: boolean
}

/**
 * Faixa Unicode "Combining Diacritical Marks" (U+0300-U+036F), montada a
 * partir dos code points em vez de escrita como literal no fonte: sao
 * caracteres combinantes, que num editor grudam no caractere anterior e
 * viram ruido ilegivel (e frageis a round-trip de encoding).
 */
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g'
)

/**
 * Remove acento para a busca casar "relatorios" com "Relatórios" — UI em
 * portugues, e ninguem digita acento numa paleta de comando.
 */
function normalize(value: string) {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

/**
 * O alvo do evento e um campo de digitacao? Sem esta checagem, o listener
 * global sequestraria o Ctrl+K de quem esta digitando num filtro de tabela ou
 * num formulario — inclusive dentro da propria paleta.
 */
const TYPING_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  // Duas checagens porque nenhuma sozinha cobre tudo: `isContentEditable`
  // enxerga elementos ANINHADOS dentro de uma regiao editavel (o alvo do
  // evento costuma ser um filho, nao o container com o atributo), e o
  // seletor por atributo cobre campos comuns e ambientes onde a propriedade
  // nao e implementada.
  if (target.isContentEditable) return true
  return target.closest(TYPING_SELECTOR) !== null
}

/**
 * Estado + listener global do atalho. Fica aqui (e nao dentro da paleta)
 * porque o campo de busca do header tambem precisa abrir a mesma paleta.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'k' && event.key !== 'K') return
      if (!event.metaKey && !event.ctrlKey) return
      if (event.altKey) return
      if (isTypingTarget(event.target)) return
      event.preventDefault()
      setOpen((current) => !current)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { open, setOpen }
}

/** `navigator` so existe no browser; no SSR a resposta e sempre "nao e Mac". */
const MAC_PLATFORM = /mac|iphone|ipad|ipod/i

/** Valor imutavel: nao existe "trocar de sistema operacional" pra assinar. */
const subscribeToNothing = () => () => {}

function readIsMac() {
  return MAC_PLATFORM.test(navigator.platform || navigator.userAgent)
}

/**
 * `true` em macOS, para escolher entre `⌘K` e `Ctrl+K`.
 *
 * Via `useSyncExternalStore` e nao via `useState` + `useEffect`: ler
 * `navigator` durante o render produziria HTML de servidor com "Ctrl" e HTML
 * de cliente com "⌘" (hydration mismatch), e corrigir isso com um
 * `setState` dentro de efeito e exatamente o padrao de renders em cascata que
 * o lint do React Compiler barra neste repositorio. `useSyncExternalStore`
 * existe para este caso: o terceiro argumento e o snapshot do SERVIDOR, o
 * segundo e o do cliente, e o React reconcilia a diferenca depois de hidratar
 * sem passar por um setState nosso.
 */
export function useIsMacPlatform() {
  return useSyncExternalStore(subscribeToNothing, readIsMac, () => false)
}

/**
 * Campo de busca do header. E um BOTAO, nao um `<input>`: se fosse input, o
 * usuario digitaria nele e o listener global (que ignora campos de texto,
 * como tem que ignorar) nunca abriria a paleta — teriamos dois campos de
 * busca com comportamentos diferentes na mesma tela. O botao tambem mantem o
 * atalho honesto: a tecla anunciada ao lado e a tecla que funciona.
 */
export function CommandPaletteTrigger({
  onOpen,
  canSearchDevices = false,
}: {
  onOpen: () => void
  /** Dentro de um tenant a paleta tambem busca dispositivos — o rotulo precisa
   * dizer isso, senao anuncia menos do que entrega. */
  canSearchDevices?: boolean
}) {
  const isMac = useIsMacPlatform()
  const label = canSearchDevices ? 'Buscar página ou máquina' : 'Buscar página'

  // A largura cresce por breakpoint em vez de ficar fixa: no `lg` o header
  // ainda divide 768px com a trilha, o seletor de cliente e o perfil — um
  // campo de 240px ali espremeria o breadcrumb a ponto de truncar o nome da
  // pagina atual.
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      className="flex h-9 items-center gap-2 rounded-lg border border-surface-line bg-secondary/50 px-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none overflow-hidden md:w-56 md:justify-between xl:w-64"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate md:inline">{label}...</span>
      </span>
      <KbdGroup className="hidden shrink-0 md:inline-flex" aria-hidden>
        <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </button>
  )
}

export function CommandPalette({
  open,
  onOpenChange,
  sections,
  tenantSlug,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sections: ShellNavSection[]
  /** Ausente fora do contexto de um tenant — sem ele a paleta so busca rotas. */
  tenantSlug?: string | null
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  /**
   * O resultado carrega o TERMO a que pertence, e nao so a lista.
   *
   * Isso e' o que permite derivar tudo o mais sem um unico `setState` no corpo
   * do efeito — `react-hooks/set-state-in-effect` barra esse padrao neste
   * repositorio, e com razao: limpar a lista por efeito a cada tecla e' uma
   * renderizacao em cascata. Com o termo embutido, "estou buscando" e' apenas
   * "o resultado que tenho nao e' o do termo atual", e "nao tenho resultado"
   * e' a mesma comparacao. Nenhum estado extra, nenhuma cascata, e a lista
   * nunca mostra o resultado de um termo que o usuario ja abandonou.
   */
  const [deviceResult, setDeviceResult] = useState<{ term: string; items: DeviceHit[] }>({
    term: '',
    items: [],
  })

  const term = search.trim()
  const shouldSearchDevices = open && Boolean(tenantSlug) && term.length >= MIN_SEARCH_LENGTH
  const devices = shouldSearchDevices && deviceResult.term === term ? deviceResult.items : []
  const searchingDevices = shouldSearchDevices && deviceResult.term !== term

  /**
   * Busca com debounce e cancelamento.
   *
   * O `AbortController` nao e' enfeite: sem ele, digitar "SRV-01" dispara seis
   * requisicoes e a ULTIMA a chegar vence, que nem sempre e' a mais recente —
   * a lista pisca com o resultado de um termo que o usuario ja abandonou.
   * Abortar a anterior a cada tecla elimina a corrida.
   */
  useEffect(() => {
    if (!shouldSearchDevices || !tenantSlug) return

    const controller = new AbortController()

    const timer = setTimeout(() => {
      fetch(
        `/api/tenant/${encodeURIComponent(tenantSlug)}/devices/search?q=${encodeURIComponent(term)}`,
        { signal: controller.signal }
      )
        .then((response) => (response.ok ? response.json() : { devices: [] }))
        .then((data: { devices?: DeviceHit[] }) => {
          setDeviceResult({ term, items: Array.isArray(data.devices) ? data.devices : [] })
        })
        .catch(() => {
          // Abort e' fluxo normal (o usuario digitou de novo), nao falha a
          // reportar. Falha real de rede tambem nao vira alarme numa paleta de
          // busca: registra-se o termo com lista vazia, o indicador de busca
          // sai, e a paleta segue servindo as rotas.
          if (!controller.signal.aborted) {
            setDeviceResult({ term, items: [] })
          }
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [shouldSearchDevices, term, tenantSlug])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSearch('')
        setDeviceResult({ term: '', items: [] })
      }
      onOpenChange(next)
    },
    [onOpenChange]
  )

  function handleSelect(href: string) {
    handleOpenChange(false)
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* `top-[12vh] translate-y-0` desfaz a centralizacao vertical do
          DialogContent: paleta ancorada no alto e o padrao da categoria e
          nao "pula" de posicao conforme a lista filtra. */}
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Busca rápida</DialogTitle>
        <DialogDescription className="sr-only">
          Digite para filtrar as páginas deste cliente. Use as setas para navegar e Enter para abrir.
        </DialogDescription>

        <Command
          className="bg-transparent"
          filter={(value, term) => (normalize(value).includes(normalize(term)) ? 1 : 0)}
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={tenantSlug ? 'Buscar página, hostname, IP, usuário, etiqueta ou AnyDesk...' : 'Buscar página...'}
            className="text-[0.9375rem]"
          />
          <CommandList className="max-h-[min(24rem,60vh)] p-1">
            <CommandEmpty className="px-3 py-8 text-center text-sm text-muted-foreground">
              {searchingDevices
                ? 'Buscando dispositivos...'
                : tenantSlug
                  ? 'Nenhuma página nem dispositivo com esse nome. Busque por hostname ou IP.'
                  : 'Nenhuma página com esse nome. Tente “máquinas”, “alertas” ou “relatórios”.'}
            </CommandEmpty>
            {sections.map((section) => (
              <CommandGroup key={section.title} heading={section.title}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={`${section.title} ${item.name}`}
                    onSelect={() => handleSelect(item.href)}
                    className="group cursor-pointer gap-3 rounded-lg px-3 py-2.5 data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="font-medium">{item.name}</span>
                    {/* Confirma qual linha o Enter vai abrir — a cor sozinha
                        nao diz que a selecao e acionavel por teclado. */}
                    <CornerDownLeft
                      aria-hidden
                      className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-data-[selected=true]:opacity-100"
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

            {/* Dispositivos DEPOIS das rotas: navegar e' o uso dominante da
                paleta, e as rotas respondem sem rede. O grupo so aparece quando
                ha resultado, para nao criar um cabecalho vazio piscando a cada
                tecla enquanto o debounce corre. */}
            {tenantSlug && devices.length > 0 && (
              <CommandGroup heading="Dispositivos">
                {devices.map((device) => {
                  const DeviceIcon = device.isServer ? Server : Monitor
                  return (
                    <CommandItem
                      key={device.id}
                      // `value` carrega hostname e IP — os mesmos campos pelos
                      // quais o servidor casou —, entao o filtro local do cmdk
                      // nunca esconde um resultado que a rota ja devolveu.
                      value={`${device.hostname} ${device.ip ?? ''} ${device.anydeskId ?? ''} ${device.anydeskId ? formatAnydeskId(device.anydeskId) : ''} ${device.usuario ?? ''} ${device.serial ?? ''} ${device.etiqueta ?? ''} ${device.responsavel ?? ''}`}
                      onSelect={() => handleSelect(getTenantPath(tenantSlug, `assets/${device.id}`))}
                      className="group cursor-pointer gap-3 rounded-lg px-3 py-2.5 data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                    >
                      <DeviceIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate font-medium">{device.hostname}</span>
                      {device.ip && (
                        <span className="data-mono shrink-0 text-xs text-muted-foreground">{device.ip}</span>
                      )}
                      {(device.etiqueta || device.usuario) && (
                        <span className="truncate text-xs text-muted-foreground">
                          {device.etiqueta ?? device.usuario}
                        </span>
                      )}
                      {device.anydeskId && (
                        <span className="data-mono shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                          AD {formatAnydeskId(device.anydeskId)}
                        </span>
                      )}
                      <CornerDownLeft
                        aria-hidden
                        className="ml-auto h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-data-[selected=true]:opacity-100"
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        <div className="flex items-center gap-4 border-t border-surface-line px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navegar
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd>
            abrir
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            fechar
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
