import { describe, expect, it } from 'vitest'
import { SCRIPT_CATALOG_DETAILS, SCRIPT_CATALOG_IDS, SCRIPT_CATALOG_LABELS } from '@/lib/agent-commands'

describe('catalogo de scripts aprovados', () => {
  it.each(['defender_quick_scan', 'windows_update_check'] as const)('inclui %s com rotulo', (id) => {
    expect(SCRIPT_CATALOG_IDS).toContain(id)
    expect(SCRIPT_CATALOG_LABELS[id]).toBeTruthy()
  })

  it('tem rotulo para todos os ids', () => {
    for (const id of SCRIPT_CATALOG_IDS) expect(SCRIPT_CATALOG_LABELS[id]).toBeTruthy()
  })

  it('tem descricao e comando exibido para todos os ids', () => {
    for (const id of SCRIPT_CATALOG_IDS) {
      expect(SCRIPT_CATALOG_DETAILS[id].description).toBeTruthy()
      expect(SCRIPT_CATALOG_DETAILS[id].command).toBeTruthy()
    }
  })

  it('descreve o comando real dos scripts de diagnostico e seguranca', () => {
    expect(SCRIPT_CATALOG_DETAILS.defender_quick_scan.command).toContain('Start-MpScan -ScanType QuickScan')
    expect(SCRIPT_CATALOG_DETAILS.windows_update_check.command).toContain("IsInstalled=0")
    expect(SCRIPT_CATALOG_DETAILS.network_diag.command).toContain('ipconfig /all')
  })
})
