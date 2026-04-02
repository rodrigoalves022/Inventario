export interface Asset {
  id: string
  hostname: string
  serial: string
  usuario: string
  modelo: string
  sistema: string
  ip: string
  mac: string
  dominio: string
  dataColeta: string
  processador: string
  ramTotal: number
  slots: string[]
  placaMae: string
  discos: string
  capacidadeGb: number
  espacoLivreGb: number
  status: 'online' | 'offline' | 'warning'
}

export const mockAssets: Asset[] = [
  {
    id: '1',
    hostname: 'WKS-TI-001',
    serial: 'ABC123456',
    usuario: 'joao.silva',
    modelo: 'Dell OptiPlex 7090',
    sistema: 'Windows 11 Pro',
    ip: '192.168.1.101',
    mac: '00:1A:2B:3C:4D:5E',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 09:30:00',
    processador: 'Intel Core i7-11700 @ 2.50GHz',
    ramTotal: 32,
    slots: ['16GB DDR4', '16GB DDR4', 'Vazio', 'Vazio'],
    placaMae: 'Dell Inc. 0KWVT8',
    discos: 'NVMe Samsung 980 PRO',
    capacidadeGb: 512,
    espacoLivreGb: 245,
    status: 'online'
  },
  {
    id: '2',
    hostname: 'WKS-FIN-002',
    serial: 'DEF789012',
    usuario: 'maria.santos',
    modelo: 'Lenovo ThinkCentre M920',
    sistema: 'Windows 10 Pro',
    ip: '192.168.1.102',
    mac: '00:2B:3C:4D:5E:6F',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 08:45:00',
    processador: 'Intel Core i5-9500 @ 3.00GHz',
    ramTotal: 16,
    slots: ['8GB DDR4', '8GB DDR4', 'Vazio', 'Vazio'],
    placaMae: 'Lenovo 312D',
    discos: 'WD Blue SN570',
    capacidadeGb: 256,
    espacoLivreGb: 89,
    status: 'online'
  },
  {
    id: '3',
    hostname: 'SRV-DC01',
    serial: 'SRV001234',
    usuario: 'admin',
    modelo: 'Dell PowerEdge R740',
    sistema: 'Windows Server 2022',
    ip: '192.168.1.10',
    mac: '00:3C:4D:5E:6F:70',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 10:00:00',
    processador: 'Intel Xeon Gold 6248R @ 3.00GHz',
    ramTotal: 128,
    slots: ['32GB DDR4', '32GB DDR4', '32GB DDR4', '32GB DDR4'],
    placaMae: 'Dell Inc. 08D89F',
    discos: 'RAID 10 - 4x SAS 1.2TB',
    capacidadeGb: 2400,
    espacoLivreGb: 1890,
    status: 'online'
  },
  {
    id: '4',
    hostname: 'WKS-RH-003',
    serial: 'GHI345678',
    usuario: 'ana.costa',
    modelo: 'HP ProDesk 400 G7',
    sistema: 'Windows 10 Pro',
    ip: '192.168.1.103',
    mac: '00:4D:5E:6F:70:81',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-17 14:20:00',
    processador: 'Intel Core i5-10500 @ 3.10GHz',
    ramTotal: 8,
    slots: ['8GB DDR4', 'Vazio', 'Vazio', 'Vazio'],
    placaMae: 'HP 8767',
    discos: 'Seagate Barracuda',
    capacidadeGb: 500,
    espacoLivreGb: 120,
    status: 'warning'
  },
  {
    id: '5',
    hostname: 'WKS-MKT-004',
    serial: 'JKL901234',
    usuario: 'pedro.lima',
    modelo: 'Dell OptiPlex 5090',
    sistema: 'Windows 11 Pro',
    ip: '192.168.1.104',
    mac: '00:5E:6F:70:81:92',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 07:15:00',
    processador: 'Intel Core i5-11500 @ 2.70GHz',
    ramTotal: 16,
    slots: ['16GB DDR4', 'Vazio', 'Vazio', 'Vazio'],
    placaMae: 'Dell Inc. 0XHGV1',
    discos: 'Kingston A2000',
    capacidadeGb: 512,
    espacoLivreGb: 380,
    status: 'online'
  },
  {
    id: '6',
    hostname: 'SRV-FILE01',
    serial: 'SRV002345',
    usuario: 'admin',
    modelo: 'HP ProLiant DL380 Gen10',
    sistema: 'Windows Server 2019',
    ip: '192.168.1.11',
    mac: '00:6F:70:81:92:A3',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 10:00:00',
    processador: 'Intel Xeon Silver 4214R @ 2.40GHz',
    ramTotal: 64,
    slots: ['16GB DDR4', '16GB DDR4', '16GB DDR4', '16GB DDR4'],
    placaMae: 'HP ProLiant',
    discos: 'RAID 5 - 8x SAS 2TB',
    capacidadeGb: 14000,
    espacoLivreGb: 4200,
    status: 'online'
  },
  {
    id: '7',
    hostname: 'WKS-DEV-005',
    serial: 'MNO567890',
    usuario: 'lucas.tech',
    modelo: 'Lenovo ThinkStation P340',
    sistema: 'Windows 11 Pro',
    ip: '192.168.1.105',
    mac: '00:70:81:92:A3:B4',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 09:00:00',
    processador: 'Intel Core i9-10900K @ 3.70GHz',
    ramTotal: 64,
    slots: ['32GB DDR4', '32GB DDR4', 'Vazio', 'Vazio'],
    placaMae: 'Lenovo 1048',
    discos: 'Samsung 970 EVO Plus',
    capacidadeGb: 1000,
    espacoLivreGb: 650,
    status: 'online'
  },
  {
    id: '8',
    hostname: 'WKS-ADM-006',
    serial: 'PQR234567',
    usuario: 'carla.admin',
    modelo: 'Dell Vostro 3681',
    sistema: 'Windows 10 Pro',
    ip: '192.168.1.106',
    mac: '00:81:92:A3:B4:C5',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-15 16:30:00',
    processador: 'Intel Core i3-10100 @ 3.60GHz',
    ramTotal: 8,
    slots: ['4GB DDR4', '4GB DDR4', 'Vazio', 'Vazio'],
    placaMae: 'Dell Inc. 0T1D10',
    discos: 'WD Blue 1TB',
    capacidadeGb: 1000,
    espacoLivreGb: 450,
    status: 'offline'
  },
  {
    id: '9',
    hostname: 'WKS-SUP-007',
    serial: 'STU890123',
    usuario: 'bruno.suporte',
    modelo: 'HP EliteDesk 800 G6',
    sistema: 'Windows 11 Pro',
    ip: '192.168.1.107',
    mac: '00:92:A3:B4:C5:D6',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 08:00:00',
    processador: 'Intel Core i7-10700 @ 2.90GHz',
    ramTotal: 32,
    slots: ['16GB DDR4', '16GB DDR4', 'Vazio', 'Vazio'],
    placaMae: 'HP 8719',
    discos: 'Intel SSD 660p',
    capacidadeGb: 512,
    espacoLivreGb: 290,
    status: 'online'
  },
  {
    id: '10',
    hostname: 'SRV-APP01',
    serial: 'SRV003456',
    usuario: 'admin',
    modelo: 'Dell PowerEdge R640',
    sistema: 'Windows Server 2022',
    ip: '192.168.1.12',
    mac: '00:A3:B4:C5:D6:E7',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 10:00:00',
    processador: 'Intel Xeon Gold 6230R @ 2.10GHz',
    ramTotal: 256,
    slots: ['64GB DDR4', '64GB DDR4', '64GB DDR4', '64GB DDR4'],
    placaMae: 'Dell Inc. 0W23H8',
    discos: 'RAID 10 - 8x NVMe 1.6TB',
    capacidadeGb: 6400,
    espacoLivreGb: 4100,
    status: 'online'
  },
  {
    id: '11',
    hostname: 'WKS-COM-008',
    serial: 'VWX456789',
    usuario: 'fernanda.vendas',
    modelo: 'Lenovo IdeaCentre 3',
    sistema: 'Windows 10 Pro',
    ip: '192.168.1.108',
    mac: '00:B4:C5:D6:E7:F8',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 07:45:00',
    processador: 'Intel Core i5-10400 @ 2.90GHz',
    ramTotal: 16,
    slots: ['8GB DDR4', '8GB DDR4', 'Vazio', 'Vazio'],
    placaMae: 'Lenovo 3140',
    discos: 'Crucial MX500',
    capacidadeGb: 500,
    espacoLivreGb: 180,
    status: 'online'
  },
  {
    id: '12',
    hostname: 'WKS-DIR-009',
    serial: 'YZA012345',
    usuario: 'roberto.dir',
    modelo: 'Dell OptiPlex 7090 Ultra',
    sistema: 'Windows 11 Pro',
    ip: '192.168.1.109',
    mac: '00:C5:D6:E7:F8:09',
    dominio: 'CORP.LOCAL',
    dataColeta: '2025-03-18 09:15:00',
    processador: 'Intel Core i7-11700T @ 1.40GHz',
    ramTotal: 32,
    slots: ['16GB DDR4', '16GB DDR4', 'Vazio', 'Vazio'],
    placaMae: 'Dell Inc. 0YDNKC',
    discos: 'Samsung 980 PRO',
    capacidadeGb: 1000,
    espacoLivreGb: 720,
    status: 'online'
  }
]

export function getStats() {
  const total = mockAssets.length
  const win10 = mockAssets.filter(a => a.sistema.includes('Windows 10')).length
  const win11 = mockAssets.filter(a => a.sistema.includes('Windows 11')).length
  const server = mockAssets.filter(a => a.sistema.includes('Server')).length
  const online = mockAssets.filter(a => a.status === 'online').length
  const offline = mockAssets.filter(a => a.status === 'offline').length
  const warning = mockAssets.filter(a => a.status === 'warning').length
  const totalRam = mockAssets.reduce((acc, a) => acc + a.ramTotal, 0)
  const totalStorage = mockAssets.reduce((acc, a) => acc + a.capacidadeGb, 0)

  return {
    total,
    win10,
    win11,
    server,
    online,
    offline,
    warning,
    totalRam,
    totalStorage,
    dominios: [...new Set(mockAssets.map(a => a.dominio))]
  }
}

export function getOsDistribution() {
  return [
    { name: 'Windows 11', value: mockAssets.filter(a => a.sistema.includes('Windows 11')).length, fill: 'var(--chart-1)' },
    { name: 'Windows 10', value: mockAssets.filter(a => a.sistema.includes('Windows 10')).length, fill: 'var(--chart-2)' },
    { name: 'Windows Server', value: mockAssets.filter(a => a.sistema.includes('Server')).length, fill: 'var(--chart-3)' },
  ]
}

export function getStatusDistribution() {
  return [
    { name: 'Online', value: mockAssets.filter(a => a.status === 'online').length, fill: 'var(--chart-2)' },
    { name: 'Offline', value: mockAssets.filter(a => a.status === 'offline').length, fill: 'var(--chart-4)' },
    { name: 'Alerta', value: mockAssets.filter(a => a.status === 'warning').length, fill: 'var(--chart-3)' },
  ]
}

export function getRamDistribution() {
  return [
    { name: '8GB ou menos', value: mockAssets.filter(a => a.ramTotal <= 8).length },
    { name: '16GB', value: mockAssets.filter(a => a.ramTotal === 16).length },
    { name: '32GB', value: mockAssets.filter(a => a.ramTotal === 32).length },
    { name: '64GB+', value: mockAssets.filter(a => a.ramTotal >= 64).length },
  ]
}
