import { describe, expect, it } from 'vitest'
import { SCRIPT_CATALOG_IDS, SCRIPT_CATALOG_LABELS } from '@/lib/agent-commands'

describe('catalogo de scripts aprovados', () => {
  it.each(['defender_quick_scan', 'windows_update_check'] as const)('inclui %s com rotulo', (id) => {
    expect(SCRIPT_CATALOG_IDS).toContain(id)
    expect(SCRIPT_CATALOG_LABELS[id]).toBeTruthy()
  })

  it('tem rotulo para todos os ids', () => {
    for (const id of SCRIPT_CATALOG_IDS) expect(SCRIPT_CATALOG_LABELS[id]).toBeTruthy()
  })
})
