<#
.SYNOPSIS
    Agente de Inventário de TI — Nível Enterprise
    Coleta dados de hardware e software via WMI/CIM e envia para o servidor central.

.PARAMETER ServerUrl
    URL base do servidor. Ex: "https://inventario.empresa.com"

.PARAMETER ApiKey
    Chave de autenticação gerada pelo servidor (via /api/agent/register).

.EXAMPLE
    .\agent.ps1 -ServerUrl "http://10.62.102.119:3000" -ApiKey "abc123..."
#>

param (
    [Parameter(Mandatory=$true)] [string]$ServerUrl,
    [Parameter(Mandatory=$true)] [string]$ApiKey
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [$Level] $Message"
}

function Get-SlotInfo {
    param([array]$MemModules, [int]$SlotIndex)
    if ($SlotIndex -lt $MemModules.Count) {
        $cap = [math]::Round($MemModules[$SlotIndex].Capacity / 1GB, 0)
        return "${cap}GB"
    }
    return "Vazio"
}

function Get-StorageType {
    try {
        $physDisk = Get-PhysicalDisk | Select-Object -First 1
        if ($physDisk) { return $physDisk.MediaType } # SSD, HDD, Unspecified
    } catch { }
    return "Desconhecido"
}

# ── Coleta Principal ─────────────────────────────────────────────────────────
Write-Log "Iniciando coleta de inventário para: $env:COMPUTERNAME"

try {
    # Informações Gerais
    $csInfo   = Get-CimInstance Win32_ComputerSystem
    $osInfo   = Get-CimInstance Win32_OperatingSystem
    $cpuInfo  = Get-CimInstance Win32_Processor | Select-Object -First 1
    $biosInfo = Get-CimInstance Win32_BIOS | Select-Object -First 1
    $board    = Get-CimInstance Win32_BaseBoard | Select-Object -First 1

    # Memória RAM (slots individuais)
    $memModules = @(Get-CimInstance Win32_PhysicalMemory)

    # Interfaces de Rede (apenas as com IP atribuído)
    $netAdapters = Get-CimInstance Win32_NetworkAdapterConfiguration |
        Where-Object { $_.IPAddress -ne $null } |
        ForEach-Object {
            @{
                ip        = $_.IPAddress[0]
                mac       = $_.MACAddress
                gateway   = if ($_.DefaultIPGateway) { $_.DefaultIPGateway[0] } else { $null }
                dns       = if ($_.DNSServerSearchOrder) { ($_.DNSServerSearchOrder -join ",") } else { $null }
                dhcp      = $_.DHCPEnabled
                isPrimary = ($_.Index -eq ($_.Index | Select-Object -First 1))
            }
        }

    # Discos Lógicos
    $diskDrives = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } |
        ForEach-Object {
            $drive = $_
            $physModel = (Get-CimInstance -Query "ASSOCIATORS OF {Win32_LogicalDisk.DeviceID='$($drive.DeviceID)'} WHERE AssocClass=Win32_LogicalDiskToPartition" |
                ForEach-Object { Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($_.Name)'} WHERE AssocClass=Win32_DiskDriveToDiskPartition" } |
                Select-Object -First 1 -ExpandProperty Model 2>$null)
            @{
                unidade       = $drive.DeviceID
                modelo        = $physModel
                tipo          = Get-StorageType
                capacidadeGb  = [math]::Round($drive.Size / 1GB, 0)
                espacoLivreGb = [math]::Round($drive.FreeSpace / 1GB, 0)
            }
        }

    # Softwares Instalados (registro 32 e 64-bit)
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    $softwareList = $regPaths | ForEach-Object {
        Get-ItemProperty $_ -ErrorAction SilentlyContinue
    } | Where-Object { $_.DisplayName } |
        Select-Object DisplayName, DisplayVersion, Publisher, InstallDate -Unique |
        ForEach-Object {
            @{
                nome     = $_.DisplayName
                versao   = $_.DisplayVersion
                editor   = $_.Publisher
                installadoEm = if ($_.InstallDate) {
                    try { [datetime]::ParseExact($_.InstallDate, "yyyyMMdd", $null).ToString("o") }
                    catch { $null }
                } else { $null }
            }
        }

    # ── Montar Payload ─────────────────────────────────────────────────────────
    $payload = @{
        hostname          = $csInfo.Name
        serial            = $biosInfo.SerialNumber
        fabricante        = $csInfo.Manufacturer
        modelo            = $csInfo.Model
        dominio           = $csInfo.Domain
        usuario           = $env:USERNAME

        sistema           = $osInfo.Caption
        versaoSO          = $osInfo.Version
        processador       = $cpuInfo.Name.Trim()
        ramTotalGb        = [math]::Round($csInfo.TotalPhysicalMemory / 1GB, 0)
        slot1             = Get-SlotInfo $memModules 0
        slot2             = Get-SlotInfo $memModules 1
        slot3             = Get-SlotInfo $memModules 2
        slot4             = Get-SlotInfo $memModules 3
        placaMae          = $board.Product
        tipoArmazenamento = Get-StorageType

        redes    = @($netAdapters)
        discos   = @($diskDrives)
        software = @($softwareList)
    }

    $jsonBody = $payload | ConvertTo-Json -Depth 5 -Compress

    # ── Enviar para o Servidor ─────────────────────────────────────────────────
    $headers = @{
        "Content-Type" = "application/json"
        "X-API-Key"    = $ApiKey
    }

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $maxRetries = 3
    $attempt = 0
    $success = $false

    while ($attempt -lt $maxRetries -and -not $success) {
        $attempt++
        try {
            Write-Log "Tentativa $attempt/$maxRetries de envio para $ServerUrl/api/agent/checkin"

            $response = Invoke-RestMethod `
                -Uri "$ServerUrl/api/agent/checkin" `
                -Method POST `
                -Body $jsonBody `
                -Headers $headers `
                -TimeoutSec 30

            Write-Log "Coleta enviada com sucesso. DeviceId: $($response.deviceId)" "SUCCESS"
            $success = $true

        } catch {
            $statusCode = $_.Exception.Response.StatusCode.Value__
            if ($statusCode -eq 401 -or $statusCode -eq 403) {
                Write-Log "Falha de autenticacao (HTTP $statusCode). Verifique a API Key." "ERROR"
                break # Não faz retry em erros de auth
            }
            Write-Log "Tentativa $attempt falhou: $_" "WARN"
            if ($attempt -lt $maxRetries) { Start-Sleep -Seconds (5 * $attempt) }
        }
    }

    if (-not $success) {
        Write-Log "Todas as tentativas falharam. Verifique conectividade com $ServerUrl" "ERROR"
        exit 1
    }

} catch {
    Write-Log "Erro inesperado durante a coleta: $_" "ERROR"
    exit 1
}
