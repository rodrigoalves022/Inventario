#!/bin/bash

API_URL="http://localhost:3000/api/collect/linux"

# Tenta coletar as informações via comandos padrão do Linux
HOSTNAME=$(hostname)
OS=$(grep -E '^(PRETTY_NAME)=' /etc/os-release | cut -d '=' -f 2 | tr -d '"')
if [ -z "$OS" ]; then
    OS=$(uname -srm)
fi

IP=$(hostname -I | awk '{print $1}')
MAC=$(cat /sys/class/net/$(ip route show default | awk '/default/ {print $5}')/address 2>/dev/null)
CPU=$(lscpu | grep "Model name:" | sed -r 's/Model name:\s{1,}//g')
RAM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
RAM_GB=$((RAM_TOTAL / 1024))

DISK_TOTAL=$(df -BG / | awk 'NR==2 {print $2}' | tr -d 'G')
DISK_FREE=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
# Fallback caso dê erro
if [ -z "$DISK_TOTAL" ]; then DISK_TOTAL=0; fi
if [ -z "$DISK_FREE" ]; then DISK_FREE=0; fi

PAYLOAD=$(cat <<EOF
{
  "hostname": "$HOSTNAME",
  "serial": "N/A",
  "usuario": "root",
  "modelo": "Servidor/VM Linux",
  "sistema": "$OS",
  "ip": "$IP",
  "mac": "$MAC",
  "dominio": "local",
  "processador": "$CPU",
  "ramTotal": $RAM_GB,
  "slots": ["1 virtual"],
  "placaMae": "N/A",
  "discos": "sda/vda",
  "capacidadeGb": $DISK_TOTAL,
  "espacoLivreGb": $DISK_FREE
}
EOF
)

curl -X POST -H "Content-Type: application/json" -d "$PAYLOAD" $API_URL
echo "Payload enviado para API."
