// Impressoras de software do Windows (PDF, XPS, Fax, OneNote...) nao sao ativos
// fisicos e poluem o inventario — filtradas na coleta, na ingestao e na exibicao.
const VIRTUAL_NAME_PATTERNS = [
  /microsoft print to pdf/i,
  /microsoft xps document writer/i,
  /openxps/i,
  /\bfax\b/i,
  /onenote/i,
  /send to onenote/i,
  /remote desktop easy print/i,
  /root print queue/i,
]

const VIRTUAL_PORT_PATTERNS = [/^portprompt:?/i, /^nul:?$/i, /^file:?$/i, /^shrfax:?/i]

export type PrinterLike = {
  nome?: string | null
  driver?: string | null
  porta?: string | null
}

export function isVirtualPrinter(printer: PrinterLike): boolean {
  const nome = (printer.nome ?? '').trim()
  const driver = (printer.driver ?? '').trim()
  const porta = (printer.porta ?? '').trim()
  if (VIRTUAL_NAME_PATTERNS.some((re) => re.test(nome) || re.test(driver))) return true
  return VIRTUAL_PORT_PATTERNS.some((re) => re.test(porta))
}

export function filterPhysicalPrinters<T extends PrinterLike>(printers: T[]): T[] {
  return printers.filter((p) => !isVirtualPrinter(p))
}
