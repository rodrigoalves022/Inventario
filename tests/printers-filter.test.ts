import { describe, expect, it } from 'vitest'
import { filterPhysicalPrinters, isVirtualPrinter } from '@/lib/printers'

describe('isVirtualPrinter', () => {
  it.each([
    { nome: 'Microsoft Print to PDF', porta: 'PORTPROMPT:' },
    { nome: 'Microsoft XPS Document Writer', porta: 'PORTPROMPT:' },
    { nome: 'OpenXPS Document Writer' },
    { nome: 'Fax', porta: 'SHRFAX:' },
    { nome: 'OneNote (Desktop)' },
    { nome: 'Send To OneNote 2016' },
    { nome: 'Remote Desktop Easy Print' },
    { nome: 'Root Print Queue' },
    { nome: 'Qualquer', porta: 'nul:' },
    { nome: 'Qualquer', porta: 'FILE:' },
    { nome: 'Qualquer', porta: 'PORTPROMPT:' },
    { nome: 'Qualquer', porta: 'SHRFAX:' },
    { nome: 'Qualquer', driver: 'Microsoft Print To PDF' },
  ])('detecta virtual: %o', (p) => {
    expect(isVirtualPrinter(p)).toBe(true)
  })

  it.each([
    { nome: 'HP LaserJet Pro M404', porta: 'IP_10.0.0.5', driver: 'HP Universal Printing PCL 6' },
    { nome: 'Brother HL-L2350DW', porta: 'USB001' },
    { nome: 'Epson L3250', porta: 'WSD-1234' },
  ])('mantém física: %o', (p) => {
    expect(isVirtualPrinter(p)).toBe(false)
  })

  it('filterPhysicalPrinters remove virtuais', () => {
    const out = filterPhysicalPrinters([
      { nome: 'Microsoft Print to PDF', porta: 'PORTPROMPT:' },
      { nome: 'HP LaserJet', porta: 'IP_1' },
    ])
    expect(out.map((p) => p.nome)).toEqual(['HP LaserJet'])
  })
})
