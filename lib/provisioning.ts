type ProvisioningArtifacts = {
  bootstrapUrl: string
  bootstrapCommand: string
  installCommand: string
}

function escapePowerShellSingleQuoted(value: string) {
  return value.replace(/'/g, "''")
}

export function buildBootstrapUrl(serverUrl: string, clientSlug: string, enrollmentKey: string) {
  const base = `${serverUrl.replace(/\/+$/, '')}/api/agent/bootstrap`
  const params = new URLSearchParams({
    client: clientSlug,
    key: enrollmentKey,
  })

  return `${base}?${params.toString()}`
}

export function buildProvisioningArtifacts(
  serverUrl: string,
  clientSlug: string,
  enrollmentKey: string
): ProvisioningArtifacts {
  const normalizedServerUrl = serverUrl.replace(/\/+$/, '')
  const bootstrapUrl = buildBootstrapUrl(normalizedServerUrl, clientSlug, enrollmentKey)
  const escapedBootstrapUrl = escapePowerShellSingleQuoted(bootstrapUrl)

  return {
    bootstrapUrl,
    bootstrapCommand: `powershell -ExecutionPolicy Bypass -NoProfile -Command "irm '${escapedBootstrapUrl}' | iex"`,
    installCommand: `inventario-agent.exe install -server "${normalizedServerUrl}" -client "${clientSlug}" -key "${enrollmentKey}" -name "%COMPUTERNAME%"`,
  }
}

export function buildBootstrapScript(serverUrl: string, clientSlug: string, enrollmentKey: string) {
  const normalizedServerUrl = serverUrl.replace(/\/+$/, '')
  const escapedServerUrl = escapePowerShellSingleQuoted(normalizedServerUrl)
  const escapedClientSlug = escapePowerShellSingleQuoted(clientSlug)
  const escapedEnrollmentKey = escapePowerShellSingleQuoted(enrollmentKey)

  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    '',
    '$identity = [Security.Principal.WindowsIdentity]::GetCurrent()',
    '$principal = New-Object Security.Principal.WindowsPrincipal($identity)',
    'if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {',
    "  throw 'Execute este script em um PowerShell aberto como Administrador.'",
    '}',
    '',
    `$server = '${escapedServerUrl}'`,
    `$client = '${escapedClientSlug}'`,
    `$key = '${escapedEnrollmentKey}'`,
    "$name = $env:COMPUTERNAME",
    "$downloadDir = Join-Path $env:TEMP 'InventarioAgent'",
    "$downloadPath = Join-Path $downloadDir 'inventario-agent.exe'",
    '',
    'New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null',
    "Invoke-WebRequest -UseBasicParsing -Uri ($server + '/api/agent/download') -OutFile $downloadPath",
    "& $downloadPath install -server $server -client $client -key $key -name $name",
  ].join('\r\n')
}
