#!/usr/bin/env bash
# =============================================================================
# Agente de Inventario Enterprise - Linux/macOS
# Coleta dados de hardware e software e envia ao servidor central
# =============================================================================

set -euo pipefail

# ── Parametros ─────────────────────────────────────────────────────────────────
SERVER_URL="${1:-}"
API_KEY="${2:-}"

if [ -z "$SERVER_URL" ] || [ -z "$API_KEY" ]; then
    echo "[!] Uso: $0 <SERVER_URL> <API_KEY>"
    echo "    Exemplo: $0 https://inventario.empresa.com abc123..."
    exit 1
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] $2"; }

# ── Coleta de Dados ────────────────────────────────────────────────────────────
log "INFO" "Iniciando coleta em: $(hostname)"

HOSTNAME=$(hostname -f 2>/dev/null || hostname)
DOMINIO=$(dnsdomainname 2>/dev/null || echo "")
USUARIO=$(whoami)

# Sistema Operacional
SISTEMA=$(grep -oP '^PRETTY_NAME="\K[^"]+' /etc/os-release 2>/dev/null || uname -s)
VERSAO_SO=$(uname -r)

# Processador
PROCESSADOR=$(grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo "Desconhecido")

# RAM total em GB
RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
RAM_GB=$(echo "scale=0; ($RAM_KB + 1048575) / 1048576" | bc 2>/dev/null || echo 0)

# Fabricante e modelo (DMI)
FABRICANTE=""
MODELO=""
if command -v dmidecode &> /dev/null && [ "$(id -u)" -eq 0 ]; then
    FABRICANTE=$(dmidecode -s system-manufacturer 2>/dev/null | head -1 | tr -d '\n' || echo "")
    MODELO=$(dmidecode -s system-product-name 2>/dev/null | head -1 | tr -d '\n' || echo "")
    SERIAL=$(dmidecode -s system-serial-number 2>/dev/null | head -1 | tr -d '\n' || echo "")
else
    FABRICANTE=$(cat /sys/class/dmi/id/sys_vendor 2>/dev/null || echo "")
    MODELO=$(cat /sys/class/dmi/id/product_name 2>/dev/null || echo "")
    SERIAL=$(cat /sys/class/dmi/id/product_serial 2>/dev/null || echo "")
fi

# Placa-Mae
PLACA_MAE=$(cat /sys/class/dmi/id/board_name 2>/dev/null || echo "")

# Interface de rede principal
PRIMARY_IP=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1 || hostname -I | awk '{print $1}')
PRIMARY_MAC=$(ip link show 2>/dev/null | grep -A1 "$(ip route get 1 2>/dev/null | grep -oP 'dev \K\S+')" | grep -oP '([0-9a-f]{2}:){5}[0-9a-f]{2}' | head -1 || echo "")
GATEWAY=$(ip route 2>/dev/null | grep default | awk '{print $3}' | head -1 || echo "")

# Discos
DISCOS_JSON="["
FIRST=true
while read -r MOUNT SIZE USED AVAIL; do
    [ "$FIRST" = true ] || DISCOS_JSON+=","
    FIRST=false
    CAP=$(echo "$SIZE" | numfmt --from=auto 2>/dev/null | awk '{printf "%d", $1/1073741824}' || echo 0)
    FREE=$(echo "$AVAIL" | numfmt --from=auto 2>/dev/null | awk '{printf "%d", $1/1073741824}' || echo 0)
    DISCOS_JSON+="{\"unidade\":\"$MOUNT\",\"tipo\":\"SSD\",\"capacidadeGb\":$CAP,\"espacoLivreGb\":$FREE}"
done < <(df -h --output=target,size,used,avail 2>/dev/null | grep -E '^/' | head -5)
DISCOS_JSON+="]"

# ── Montar Payload JSON ─────────────────────────────────────────────────────────
PAYLOAD=$(cat <<EOF
{
  "hostname":    "$HOSTNAME",
  "serial":      "$SERIAL",
  "fabricante":  "$FABRICANTE",
  "modelo":      "$MODELO",
  "dominio":     "$DOMINIO",
  "usuario":     "$USUARIO",
  "sistema":     "$SISTEMA",
  "versaoSO":    "$VERSAO_SO",
  "processador": "$PROCESSADOR",
  "ramTotalGb":  $RAM_GB,
  "placaMae":    "$PLACA_MAE",
  "redes": [{
    "ip":       "$PRIMARY_IP",
    "mac":      "$PRIMARY_MAC",
    "gateway":  "$GATEWAY",
    "dhcp":     true,
    "isPrimary":true
  }],
  "discos": $DISCOS_JSON,
  "software": []
}
EOF
)

# ── Enviar ao Servidor (com retry) ─────────────────────────────────────────────
MAX_RETRIES=3
ATTEMPT=0
SUCCESS=false

while [ $ATTEMPT -lt $MAX_RETRIES ] && [ "$SUCCESS" = false ]; do
    ATTEMPT=$((ATTEMPT + 1))
    log "INFO" "Tentativa $ATTEMPT/$MAX_RETRIES -> $SERVER_URL/api/agent/checkin"

    HTTP_CODE=$(curl -s -o /tmp/inv_response.json -w "%{http_code}" \
        --max-time 30 \
        -X POST "$SERVER_URL/api/agent/checkin" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $API_KEY" \
        -d "$PAYLOAD" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        log "INFO" "[+] Coleta enviada com sucesso."
        SUCCESS=true
    elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
        log "ERROR" "[!] Falha de autenticacao (HTTP $HTTP_CODE). Verifique a API Key."
        exit 1
    else
        log "WARN" "[*] Tentativa $ATTEMPT falhou (HTTP $HTTP_CODE). Aguardando..."
        sleep $((5 * ATTEMPT))
    fi
done

if [ "$SUCCESS" = false ]; then
    log "ERROR" "[!] Todas as tentativas falharam."
    exit 1
fi
