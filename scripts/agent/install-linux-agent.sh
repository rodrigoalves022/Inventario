#!/usr/bin/env bash
# =============================================================================
# Instalador do Agente de Inventario Enterprise - Linux
# =============================================================================

set -euo pipefail

SERVER_URL="${1:-}"
ADMIN_SECRET="${2:-}"
AGENT_NAME="${3:-$(hostname -f 2>/dev/null || hostname)}"

if [ -z "$SERVER_URL" ] || [ -z "$ADMIN_SECRET" ]; then
    echo "Uso: sudo $0 <SERVER_URL> <ADMIN_SECRET> [NOME_DO_AGENTE]"
    echo "Ex : sudo $0 https://inventario.empresa.com minha_chave_admin"
    exit 1
fi

[ "$(id -u)" -ne 0 ] && echo "[!] Execute como root (sudo)" && exit 1

INSTALL_DIR="/opt/inventario-agent"
AGENT_SCRIPT="$INSTALL_DIR/agent.sh"
CONFIG_FILE="$INSTALL_DIR/config.env"
SERVICE_NAME="inventario-agent"

echo "[INFO] Instalando agente em $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

# ── Copiar agente ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/linux-agent.sh" "$AGENT_SCRIPT"
chmod 750 "$AGENT_SCRIPT"

# ── Registrar no servidor ──────────────────────────────────────────────────
echo "[INFO] Registrando agente '$AGENT_NAME' no servidor..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$SERVER_URL/api/agent/register" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Secret: $ADMIN_SECRET" \
    -d "{\"name\": \"$AGENT_NAME\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" != "201" ]; then
    echo "[!] Falha ao registrar (HTTP $HTTP_CODE): $BODY"
    exit 1
fi

API_KEY=$(echo "$BODY" | grep -oP '"apiKey"\s*:\s*"\K[^"]+')

if [ -z "$API_KEY" ]; then
    echo "[!] Nao foi possivel extrair a API Key da resposta."
    exit 1
fi

echo "[+] Agente registrado com sucesso."

# ── Salvar configuracao (apenas root pode ler) ──────────────────────────────
cat > "$CONFIG_FILE" <<EOF
INVENTARIO_SERVER_URL=$SERVER_URL
INVENTARIO_API_KEY=$API_KEY
INVENTARIO_AGENT_NAME=$AGENT_NAME
EOF
chmod 600 "$CONFIG_FILE"
chown root:root "$CONFIG_FILE"
echo "[+] Configuracao salva em $CONFIG_FILE (permissoes 600)"

# ── Configurar systemd timer ───────────────────────────────────────────────
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Agente de Inventario Enterprise
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=$CONFIG_FILE
ExecStart=$AGENT_SCRIPT \${INVENTARIO_SERVER_URL} \${INVENTARIO_API_KEY}
StandardOutput=journal
StandardError=journal
EOF

cat > "/etc/systemd/system/${SERVICE_NAME}.timer" <<EOF
[Unit]
Description=Agente de Inventario - executa a cada hora
After=network-online.target

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
Unit=${SERVICE_NAME}.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.timer"

echo "[INFO] Executando primeira coleta..."
bash "$AGENT_SCRIPT" "$SERVER_URL" "$API_KEY" && echo "[+] Primeira coleta enviada." || true

echo ""
echo "=== Instalacao Concluida ==="
echo "   Agente : $AGENT_SCRIPT"
echo "   Config : $CONFIG_FILE"
echo "   Timer  : systemctl status ${SERVICE_NAME}.timer"
echo "   Logs   : journalctl -u ${SERVICE_NAME}.service -f"
echo "[OK] Esta maquina ja aparece no painel de inventario."
