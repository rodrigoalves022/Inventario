import { describe, it, expect } from 'vitest'
import { computeHardwareDiff } from '@/lib/hardware-diff'

describe('computeHardwareDiff', () => {
  it('retorna array vazio quando e a primeira coleta (baseline inicial)', () => {
    const diffs = computeHardwareDiff({
      previousSerial: null,
      previousHardware: null,
      previousDisks: [],
      incoming: {
        serial: 'XYZ123',
        processador: 'Intel Core i7',
        ramTotalGb: 16,
        slot1: '8GB DDR4',
        slot2: '8GB DDR4',
        discos: [{ unidade: 'C:', modelo: 'Samsung 980', capacidadeGb: 500 }],
      },
    })

    expect(diffs).toEqual([])
  })

  it('detecta reducao de memoria RAM (possivel remocao de pente)', () => {
    const diffs = computeHardwareDiff({
      previousSerial: 'XYZ123',
      previousHardware: {
        processador: 'Intel Core i7',
        ramTotalGb: 16,
        slot1: '8GB DDR4',
        slot2: '8GB DDR4',
        slot3: null,
        slot4: null,
        placaMae: 'ASUS Prime',
      },
      previousDisks: [{ unidade: 'C:', modelo: 'Samsung 980', capacidadeGb: 500 }],
      incoming: {
        serial: 'XYZ123',
        processador: 'Intel Core i7',
        ramTotalGb: 8,
        slot1: '8GB DDR4',
        slot2: null, // Pente removido!
        discos: [{ unidade: 'C:', modelo: 'Samsung 980', capacidadeGb: 500 }],
      },
    })

    expect(diffs).toHaveLength(2)
    const ramTotalChange = diffs.find((d) => d.action === 'REMOVED' && d.description.includes('Memória RAM reduzida'))
    const slotChange = diffs.find((d) => d.action === 'REMOVED' && d.description.includes('removido do SLOT2'))

    expect(ramTotalChange).toBeDefined()
    expect(ramTotalChange?.previousVal).toBe('16 GB')
    expect(ramTotalChange?.currentVal).toBe('8 GB')

    expect(slotChange).toBeDefined()
    expect(slotChange?.previousVal).toBe('8GB DDR4')
    expect(slotChange?.currentVal).toBeNull()
  })

  it('detecta troca de processador e troca de placa-mae', () => {
    const diffs = computeHardwareDiff({
      previousHardware: {
        processador: 'Intel Core i5-10400',
        ramTotalGb: 16,
        slot1: '16GB DDR4',
        slot2: null,
        slot3: null,
        slot4: null,
        placaMae: 'Gigabyte B460M',
      },
      previousDisks: [],
      incoming: {
        processador: 'Intel Core i7-11700',
        ramTotalGb: 16,
        slot1: '16GB DDR4',
        placaMae: 'Gigabyte B560M',
      },
    })

    expect(diffs).toHaveLength(2)
    expect(diffs.some((d) => d.component === 'CPU' && d.action === 'CHANGED')).toBe(true)
    expect(diffs.some((d) => d.component === 'MOTHERBOARD' && d.action === 'CHANGED')).toBe(true)
  })

  it('detecta adicao, remocao e substituicao de discos', () => {
    const diffs = computeHardwareDiff({
      previousHardware: {
        processador: 'Intel Core i5',
        ramTotalGb: 16,
        slot1: null,
        slot2: null,
        slot3: null,
        slot4: null,
        placaMae: 'Dell Inc.',
      },
      previousDisks: [
        { unidade: 'C:', modelo: 'Kingston 240GB', capacidadeGb: 240 },
        { unidade: 'D:', modelo: 'Seagate 1TB', capacidadeGb: 1000 },
      ],
      incoming: {
        processador: 'Intel Core i5',
        ramTotalGb: 16,
        discos: [
          // C: foi substituido por um NVMe de 500GB
          { unidade: 'C:', modelo: 'Kingston NV2 500GB', capacidadeGb: 500 },
          // D: foi removido
          // E: foi adicionado
          { unidade: 'E:', modelo: 'SanDisk 128GB', capacidadeGb: 128 },
        ],
      },
    })

    expect(diffs).toHaveLength(3)

    const diskChanged = diffs.find((d) => d.component === 'DISK' && d.action === 'CHANGED')
    expect(diskChanged).toBeDefined()
    expect(diskChanged?.description).toContain('Disco C: substituído ou alterado')

    const diskRemoved = diffs.find((d) => d.component === 'DISK' && d.action === 'REMOVED')
    expect(diskRemoved).toBeDefined()
    expect(diskRemoved?.description).toContain('Disco D: removido')

    const diskAdded = diffs.find((d) => d.component === 'DISK' && d.action === 'ADDED')
    expect(diskAdded).toBeDefined()
    expect(diskAdded?.description).toContain('Novo disco E: adicionado')
  })

  it('detecta alteracao de numero de serie do chassi/equipamento', () => {
    const diffs = computeHardwareDiff({
      previousSerial: 'BRG1234567',
      previousHardware: {
        processador: 'Intel Core i5',
        ramTotalGb: 16,
        slot1: null,
        slot2: null,
        slot3: null,
        slot4: null,
        placaMae: 'HP',
      },
      previousDisks: [],
      incoming: {
        serial: 'BRG9999999',
        processador: 'Intel Core i5',
        ramTotalGb: 16,
        placaMae: 'HP',
      },
    })

    expect(diffs).toHaveLength(1)
    expect(diffs[0].component).toBe('SERIAL')
    expect(diffs[0].action).toBe('CHANGED')
    expect(diffs[0].previousVal).toBe('BRG1234567')
    expect(diffs[0].currentVal).toBe('BRG9999999')
  })
})

