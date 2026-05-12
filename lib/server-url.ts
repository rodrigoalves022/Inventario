import { headers } from 'next/headers'

function inferProtocol(host: string) {
  const normalized = host.toLowerCase()
  if (
    normalized.startsWith('localhost') ||
    normalized.startsWith('127.0.0.1') ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    normalized.startsWith('172.16.') ||
    normalized.startsWith('172.17.') ||
    normalized.startsWith('172.18.') ||
    normalized.startsWith('172.19.') ||
    normalized.startsWith('172.20.') ||
    normalized.startsWith('172.21.') ||
    normalized.startsWith('172.22.') ||
    normalized.startsWith('172.23.') ||
    normalized.startsWith('172.24.') ||
    normalized.startsWith('172.25.') ||
    normalized.startsWith('172.26.') ||
    normalized.startsWith('172.27.') ||
    normalized.startsWith('172.28.') ||
    normalized.startsWith('172.29.') ||
    normalized.startsWith('172.30.') ||
    normalized.startsWith('172.31.')
  ) {
    return 'http'
  }

  return 'https'
}

export async function getCurrentServerUrl() {
  const configured =
    process.env.INVENTARIO_SERVER_URL ?? process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  if (!host) {
    return 'http://127.0.0.1:3000'
  }

  const protocol = requestHeaders.get('x-forwarded-proto') ?? inferProtocol(host)
  return `${protocol}://${host}`.replace(/\/+$/, '')
}
