/**
 * Filtro "Programas e Recursos" (appwiz.cpl) e agregador de catalogo de software.
 * Remove subcomponentes MSI/SDK/runtime que agentes antigos ainda possam ter enviado.
 */

const NOISE_PATTERNS: RegExp[] = [
  /^(vs_|vcpp_crt\.|icecap_|ClickOnce Bootstrapper)/i,
  /^(Application Verifier |Windows SDK for Windows Store |Windows Team Extension SDK|Windows IoT Extension SDK|Windows Mobile Extension SDK|Windows Desktop Extension SDK|Universal CRT |WinRT Intellisense |Kits Configuration Installer)/i,
  /^(Microsoft \.NET (Host|Runtime|AppHost|Standard)|Microsoft ASP\.NET Core .* Shared Framework|Microsoft Windows Desktop Runtime - )/i,
  /^Definition Update for /i,
  /\bKB\d{5,}\b/i,
  /Microsoft Visual C\+\+ .* (Minimum|Additional) Runtime/i,
]

export function isControlPanelSoftware(item: { nome: string; editor?: string | null }): boolean {
  const nome = (item.nome ?? '').trim()
  if (!nome) return false
  return !NOISE_PATTERNS.some((pattern) => pattern.test(nome))
}

const normName = (value: string) => value.trim().toLowerCase()

const compareVersions = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').localeCompare(b ?? '', undefined, { numeric: true })

export function deduplicateDeviceSoftware<
  T extends { nome: string; versao?: string | null; editor?: string | null },
>(items: T[]): T[] {
  const byName = new Map<string, T>()
  for (const item of items) {
    if (!isControlPanelSoftware(item)) continue
    const key = normName(item.nome)
    const current = byName.get(key)
    if (!current || compareVersions(item.versao, current.versao) > 0) {
      byName.set(key, item)
    }
  }
  return Array.from(byName.values())
}

export type SoftwareCatalogEntry = {
  key: string
  nome: string
  versao: string | null
  editor: string | null
  installationsCount: number
  machines: Array<{ id: string; hostname: string }>
  isBlacklisted: boolean
}

export function buildSoftwareCatalog(
  devices: Array<{
    id: string
    hostname: string
    software: Array<{ nome: string; versao: string | null; editor: string | null }>
  }>,
  blacklistPatterns: string[]
): SoftwareCatalogEntry[] {
  const catalog = new Map<string, SoftwareCatalogEntry & { versions: Set<string> }>()

  for (const device of devices) {
    for (const entry of deduplicateDeviceSoftware(device.software)) {
      const key = normName(entry.nome)
      let item = catalog.get(key)
      if (!item) {
        const lower = entry.nome.toLowerCase()
        item = {
          key,
          nome: entry.nome.trim(),
          versao: null,
          editor: entry.editor?.trim() || null,
          installationsCount: 0,
          machines: [],
          isBlacklisted: blacklistPatterns.some((pattern) => pattern && lower.includes(pattern)),
          versions: new Set<string>(),
        }
        catalog.set(key, item)
      }
      if (!item.editor && entry.editor?.trim()) item.editor = entry.editor.trim()
      const version = entry.versao?.trim()
      if (version) item.versions.add(version)
      if (!item.machines.some((machine) => machine.id === device.id)) {
        item.machines.push({ id: device.id, hostname: device.hostname })
        item.installationsCount += 1
      }
    }
  }

  return Array.from(catalog.values())
    .map(({ versions, ...item }) => ({
      ...item,
      versao: versions.size > 0 ? Array.from(versions).sort(compareVersions).join(', ') : null,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
