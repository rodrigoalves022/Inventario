import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')

function pass(name, details) {
  return { name, status: 'PASS', details }
}

function fail(name, details) {
  return { name, status: 'FAIL', details }
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8')
}

async function verifyTenantRoutes() {
  const expected = [
    'app/tenant/[clientSlug]/layout.tsx',
    'app/tenant/[clientSlug]/page.tsx',
    'app/tenant/[clientSlug]/computers/page.tsx',
    'app/tenant/[clientSlug]/servers/page.tsx',
    'app/tenant/[clientSlug]/storage/page.tsx',
    'app/tenant/[clientSlug]/processors/page.tsx',
    'app/tenant/[clientSlug]/network/page.tsx',
    'app/tenant/[clientSlug]/reports/page.tsx',
    'app/tenant/[clientSlug]/assets/[id]/page.tsx',
  ]

  const missing = []
  for (const file of expected) {
    try {
      await fs.access(path.join(root, file))
    } catch {
      missing.push(file)
    }
  }

  if (missing.length) {
    return fail('tenant-route-files', `Missing: ${missing.join(', ')}`)
  }

  return pass('tenant-route-files', `Found ${expected.length} tenant-scoped route files`)
}

async function verifyLegacyRedirects() {
  const legacyPages = [
    'app/page.tsx',
    'app/computers/page.tsx',
    'app/servers/page.tsx',
    'app/storage/page.tsx',
    'app/processors/page.tsx',
    'app/network/page.tsx',
    'app/reports/page.tsx',
    'app/assets/[id]/page.tsx',
  ]

  const bad = []
  for (const file of legacyPages) {
    const source = await read(file)
    if (!source.includes("redirect('/clients')")) {
      bad.push(file)
    }
  }

  if (bad.length) {
    return fail('legacy-inventory-fail-closed', `Expected redirect('/clients') in: ${bad.join(', ')}`)
  }

  return pass('legacy-inventory-fail-closed', `All ${legacyPages.length} legacy inventory pages redirect to /clients`)
}

async function verifyNoMockAssetsInMainFlow() {
  const detailSource = await read('app/tenant/[clientSlug]/assets/[id]/page.tsx')
  const legacySource = await read('app/assets/[id]/page.tsx')

  if (detailSource.includes('mockAssets')) {
    return fail('real-asset-detail', 'Tenant asset detail still references mockAssets')
  }

  if (!legacySource.includes("redirect('/clients')")) {
    return fail('real-asset-detail', 'Legacy asset route is not fail-closed')
  }

  return pass('real-asset-detail', 'Tenant asset detail uses real Prisma data and legacy route is fail-closed')
}

async function verifyApiContractSources() {
  const dashboard = await read('app/api/dashboard/stats/route.ts')
  const computers = await read('app/api/inventory/computers/route.ts')
  const collectWindows = await read('app/api/collect/windows/route.ts')

  const issues = []
  if (!dashboard.includes("clientSlug é obrigatório")) issues.push('dashboard stats route missing clientSlug guard')
  if (!computers.includes("clientSlug é obrigatório")) issues.push('inventory computers route missing clientSlug guard')
  if (!collectWindows.includes('410')) issues.push('legacy collect/windows route is not explicitly gone (410)')

  if (issues.length) {
    return fail('api-source-guards', issues.join('; '))
  }

  return pass('api-source-guards', 'Dashboard/computers APIs guard clientSlug and legacy collect/windows route returns 410')
}

async function verifyLiveTenantScope() {
  const clientSlug = 'core-ti-expert'
  const tenant = await prisma.client.findUnique({
    where: { slug: clientSlug },
    select: { name: true, slug: true, isActive: true },
  })

  if (!tenant?.isActive) {
    return fail('live-tenant-scope', `Active tenant ${clientSlug} not found in current database`)
  }

  const tenantDevices = await prisma.device.findMany({
    where: {
      agentAuth: {
        is: {
          client: { is: { slug: clientSlug, isActive: true } },
          isActive: true,
        },
      },
    },
    select: {
      hostname: true,
      agentAuth: { select: { client: { select: { slug: true } } } },
    },
  })

  const mismatched = tenantDevices.filter((device) => device.agentAuth.client?.slug !== clientSlug)
  const missingTenantCount = await prisma.device.count({
    where: {
      agentAuth: {
        is: {
          client: { is: { slug: 'missing-tenant', isActive: true } },
          isActive: true,
        },
      },
    },
  })

  if (mismatched.length || missingTenantCount !== 0) {
    return fail(
      'live-tenant-scope',
      `mismatched=${mismatched.length}, missingTenantCount=${missingTenantCount}`
    )
  }

  return pass(
    'live-tenant-scope',
    `tenant=${tenant.slug}, devices=${tenantDevices.length}, hosts=${tenantDevices.map((d) => d.hostname).join(', ') || 'none'}`
  )
}

async function verifySidebarTenantLinks() {
  const sidebar = await read('components/sidebar.tsx')
  const clientsPanel = await read('app/clients/clients-panel.tsx')

  const issues = []
  if (!sidebar.includes('Tenant atual')) issues.push('sidebar does not render tenant banner')
  if (!sidebar.includes('getTenantBasePath') && !sidebar.includes('getTenantPath')) issues.push('sidebar does not generate tenant-prefixed links')
  if (!clientsPanel.includes('Abrir painel')) issues.push('clients panel missing entry-point button to tenant panel')

  if (issues.length) {
    return fail('tenant-navigation', issues.join('; '))
  }

  return pass('tenant-navigation', 'Sidebar renders tenant scope and clients panel exposes tenant entry point')
}

const checks = [
  verifyTenantRoutes,
  verifyLegacyRedirects,
  verifyNoMockAssetsInMainFlow,
  verifyApiContractSources,
  verifyLiveTenantScope,
  verifySidebarTenantLinks,
]

try {
  const results = []
  for (const check of checks) {
    results.push(await check())
  }

  const failed = results.filter((result) => result.status === 'FAIL')
  console.log(JSON.stringify({
    ok: failed.length === 0,
    checkCount: results.length,
    failedCount: failed.length,
    results,
  }, null, 2))

  process.exitCode = failed.length === 0 ? 0 : 1
} finally {
  await prisma.$disconnect()
}
