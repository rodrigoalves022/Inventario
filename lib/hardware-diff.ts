export type HardwareComponentType = 'RAM' | 'CPU' | 'DISK' | 'MOTHERBOARD' | 'SERIAL'

export type HardwareActionType = 'CHANGED' | 'ADDED' | 'REMOVED'

export type HardwareChangeItem = {
  component: HardwareComponentType
  action: HardwareActionType
  description: string
  previousVal: string | null
  currentVal: string | null
}

export type ExistingHardwareSnapshot = {
  processador: string | null
  ramTotalGb: number | null
  slot1: string | null
  slot2: string | null
  slot3: string | null
  slot4: string | null
  placaMae: string | null
} | null

export type ExistingDiskSnapshot = {
  unidade: string | null
  modelo: string | null
  capacidadeGb: number | null
}

export type IncomingCheckinData = {
  serial?: string | null
  processador?: string | null
  ramTotalGb?: number | null
  slot1?: string | null
  slot2?: string | null
  slot3?: string | null
  slot4?: string | null
  placaMae?: string | null
  discos?: Array<{
    unidade?: string | null
    modelo?: string | null
    capacidadeGb?: number | null
  }>
}

/**
 * Calcula a diferenca entre o hardware previamente registrado e o novo payload
 * recebido pelo check-in do agente.
 *
 * Se nao havia hardware anterior cadastrado (primeira coleta do dispositivo),
 * nao gera mudancas historicas (baseline inicial).
 */
export function computeHardwareDiff({
  previousSerial,
  previousHardware,
  previousDisks,
  incoming,
}: {
  previousSerial?: string | null
  previousHardware: ExistingHardwareSnapshot
  previousDisks?: ExistingDiskSnapshot[] | null
  incoming: IncomingCheckinData
}): HardwareChangeItem[] {
  const prevDisks = previousDisks ?? []

  // Se e' a primeira coleta (sem hardware anterior), apenas estabelecemos o baseline
  if (!previousHardware && prevDisks.length === 0) {
    return []
  }

  const changes: HardwareChangeItem[] = []

  // 1. Serial do equipamento (chassi / BIOS)
  if (
    previousSerial &&
    incoming.serial &&
    previousSerial.trim() !== '' &&
    incoming.serial.trim() !== '' &&
    previousSerial.trim().toLowerCase() !== incoming.serial.trim().toLowerCase()
  ) {
    changes.push({
      component: 'SERIAL',
      action: 'CHANGED',
      description: `Número de série alterado de "${previousSerial.trim()}" para "${incoming.serial.trim()}"`,
      previousVal: previousSerial.trim(),
      currentVal: incoming.serial.trim(),
    })
  }

  // 2. Processador
  if (
    previousHardware?.processador &&
    incoming.processador &&
    previousHardware.processador.trim() !== '' &&
    incoming.processador.trim() !== '' &&
    previousHardware.processador.trim().toLowerCase() !== incoming.processador.trim().toLowerCase()
  ) {
    changes.push({
      component: 'CPU',
      action: 'CHANGED',
      description: `Processador alterado de "${previousHardware.processador.trim()}" para "${incoming.processador.trim()}"`,
      previousVal: previousHardware.processador.trim(),
      currentVal: incoming.processador.trim(),
    })
  }

  // 3. Placa-Mãe
  if (
    previousHardware?.placaMae &&
    incoming.placaMae &&
    previousHardware.placaMae.trim() !== '' &&
    incoming.placaMae.trim() !== '' &&
    previousHardware.placaMae.trim().toLowerCase() !== incoming.placaMae.trim().toLowerCase()
  ) {
    changes.push({
      component: 'MOTHERBOARD',
      action: 'CHANGED',
      description: `Placa-mãe alterada de "${previousHardware.placaMae.trim()}" para "${incoming.placaMae.trim()}"`,
      previousVal: previousHardware.placaMae.trim(),
      currentVal: incoming.placaMae.trim(),
    })
  }

  // 4. Memória RAM Total
  const prevRam = previousHardware?.ramTotalGb
  const nextRam = incoming.ramTotalGb
  if (prevRam != null && nextRam != null && prevRam > 0 && nextRam > 0 && prevRam !== nextRam) {
    if (nextRam < prevRam) {
      changes.push({
        component: 'RAM',
        action: 'REMOVED',
        description: `Memória RAM reduzida de ${prevRam} GB para ${nextRam} GB (possível remoção ou falha de pente)`,
        previousVal: `${prevRam} GB`,
        currentVal: `${nextRam} GB`,
      })
    } else {
      changes.push({
        component: 'RAM',
        action: 'ADDED',
        description: `Memória RAM aumentada de ${prevRam} GB para ${nextRam} GB (upgrade de memória)`,
        previousVal: `${prevRam} GB`,
        currentVal: `${nextRam} GB`,
      })
    }
  }

  // 5. Slots de Memória RAM (slot1..slot4)
  const slotKeys = ['slot1', 'slot2', 'slot3', 'slot4'] as const
  for (const slotKey of slotKeys) {
    const prevSlot = previousHardware?.[slotKey]?.trim() || null
    const nextSlot = incoming[slotKey]?.trim() || null

    if (prevSlot && !nextSlot) {
      changes.push({
        component: 'RAM',
        action: 'REMOVED',
        description: `Pente de memória removido do ${slotKey.toUpperCase()}: ${prevSlot}`,
        previousVal: prevSlot,
        currentVal: null,
      })
    } else if (!prevSlot && nextSlot) {
      changes.push({
        component: 'RAM',
        action: 'ADDED',
        description: `Pente de memória instalado no ${slotKey.toUpperCase()}: ${nextSlot}`,
        previousVal: null,
        currentVal: nextSlot,
      })
    } else if (prevSlot && nextSlot && prevSlot.toLowerCase() !== nextSlot.toLowerCase()) {
      changes.push({
        component: 'RAM',
        action: 'CHANGED',
        description: `Pente de memória no ${slotKey.toUpperCase()} alterado de "${prevSlot}" para "${nextSlot}"`,
        previousVal: prevSlot,
        currentVal: nextSlot,
      })
    }
  }

  // 6. Discos (comparados por letra/unidade)
  if (incoming.discos && incoming.discos.length > 0) {
    const prevDiskMap = new Map<string, ExistingDiskSnapshot>()
    for (const disk of prevDisks) {
      if (disk.unidade) {
        prevDiskMap.set(disk.unidade.trim().toUpperCase(), disk)
      }
    }

    const nextDiskMap = new Map<string, { unidade: string; modelo?: string | null; capacidadeGb?: number | null }>()
    for (const disk of incoming.discos) {
      if (disk.unidade) {
        nextDiskMap.set(disk.unidade.trim().toUpperCase(), {
          unidade: disk.unidade.trim(),
          modelo: disk.modelo?.trim() || null,
          capacidadeGb: disk.capacidadeGb ?? null,
        })
      }
    }

    // Verificar discos adicionados ou modificados
    for (const [key, nextDisk] of nextDiskMap.entries()) {
      const prevDisk = prevDiskMap.get(key)
      if (!prevDisk) {
        changes.push({
          component: 'DISK',
          action: 'ADDED',
          description: `Novo disco ${nextDisk.unidade} adicionado (${nextDisk.modelo || 'Disco'}, ${nextDisk.capacidadeGb != null ? `${nextDisk.capacidadeGb} GB` : 'capacidade não informada'})`,
          previousVal: null,
          currentVal: `${nextDisk.modelo || 'Disco'} (${nextDisk.capacidadeGb ?? 0} GB)`,
        })
      } else {
        const capChanged =
          prevDisk.capacidadeGb != null &&
          nextDisk.capacidadeGb != null &&
          prevDisk.capacidadeGb > 0 &&
          nextDisk.capacidadeGb > 0 &&
          Math.abs(prevDisk.capacidadeGb - nextDisk.capacidadeGb) >= 5 // tolera margem de arredondamento

        const modelChanged =
          prevDisk.modelo &&
          nextDisk.modelo &&
          prevDisk.modelo.toLowerCase() !== nextDisk.modelo.toLowerCase()

        if (capChanged || modelChanged) {
          const prevDesc = `${prevDisk.modelo || 'Disco'} (${prevDisk.capacidadeGb ?? 0} GB)`
          const nextDesc = `${nextDisk.modelo || 'Disco'} (${nextDisk.capacidadeGb ?? 0} GB)`
          changes.push({
            component: 'DISK',
            action: 'CHANGED',
            description: `Disco ${nextDisk.unidade} substituído ou alterado: de ${prevDesc} para ${nextDesc}`,
            previousVal: prevDesc,
            currentVal: nextDesc,
          })
        }
      }
    }

    // Verificar discos removidos
    for (const [key, prevDisk] of prevDiskMap.entries()) {
      if (!nextDiskMap.has(key)) {
        changes.push({
          component: 'DISK',
          action: 'REMOVED',
          description: `Disco ${prevDisk.unidade} removido (${prevDisk.modelo || 'Disco'}, ${prevDisk.capacidadeGb != null ? `${prevDisk.capacidadeGb} GB` : 'capacidade não informada'})`,
          previousVal: `${prevDisk.modelo || 'Disco'} (${prevDisk.capacidadeGb ?? 0} GB)`,
          currentVal: null,
        })
      }
    }
  }

  return changes
}
