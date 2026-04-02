param (
    [string]$ApiUrl = "http://localhost:3000/api/collect/windows"
)

try {
    # 1. Obter informações básicas do SO
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $csInfo = Get-CimInstance Win32_ComputerSystem

    # 2. Processador
    $cpuInfo = Get-CimInstance Win32_Processor | Select-Object -First 1

    # 3. Rede e IP
    $netInfo = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPAddress -ne $null } | Select-Object -First 1

    # 4. Slots de Memória RAM
    $memInfo = Get-CimInstance Win32_PhysicalMemory
    $slots = @()
    foreach ($mem in $memInfo) {
        $slots += "$([math]::Round($mem.Capacity / 1GB, 0))GB"
    }
    # Preencher até 4 slots se vazio
    while ($slots.Count -lt 4) { $slots += "Vazio" }

    # 5. Placa-Mãe (BaseBoard)
    $boardInfo = Get-CimInstance Win32_BaseBoard | Select-Object -First 1

    # 6. Discos
    $diskInfo = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | Select-Object -First 1 # Apenas o disco primário C:
    $totalDisk = [math]::Round($diskInfo.Size / 1GB, 0)
    $freeDisk = [math]::Round($diskInfo.FreeSpace / 1GB, 0)
    $diskModel = (Get-CimInstance Win32_DiskDrive | Select-Object -First 1).Model

    # Opcional: Serial
    $biosInfo = Get-CimInstance Win32_BIOS | Select-Object -First 1

    # Montar o Payload
    $payload = @{
        hostname = $csInfo.Name
        serial = $biosInfo.SerialNumber
        usuario = $csInfo.PrimaryOwnerName -replace '^.*?\\', '' # Pode estar atado ao AD ou null
        modelo = $csInfo.Model
        sistema = $osInfo.Caption
        ip = $netInfo.IPAddress[0]
        mac = $netInfo.MACAddress
        dominio = $csInfo.Domain
        processador = $cpuInfo.Name.Trim()
        ramTotal = [math]::Round($csInfo.TotalPhysicalMemory / 1GB, 0)
        slots = $slots
        placaMae = $boardInfo.Product
        discos = $diskModel
        capacidadeGb = $totalDisk
        espacoLivreGb = $freeDisk
    }

    $jsonPayload = $payload | ConvertTo-Json

    # Evita erros de SSL caso a API seja HTTPS autofuncionado
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    # Enviar para a API
    Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $jsonPayload -ContentType "application/json"
    Write-Host "Coleta enviada com sucesso para $ApiUrl"
}
catch {
    Write-Error "Falha na coleta de dados: $_"
}
