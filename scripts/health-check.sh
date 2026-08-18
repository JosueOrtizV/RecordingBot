#!/bin/bash
# ============================================
# RecordingBot - Health Check Script
# ============================================

TELEGRAM_SCRIPT="/root/scripts/telegram_alert.sh"

send_alert() {
    local msg="$1"
    if [ -f "$TELEGRAM_SCRIPT" ]; then
        "$TELEGRAM_SCRIPT" "$msg"
    else
        echo "$msg"
    fi
}

# 1. Check disk space (< 5GB free)
FREE_DISK_MB=$(df -m / | awk 'NR==2 {print $4}')
if [ "$FREE_DISK_MB" -lt 5000 ]; then
    send_alert "🚨 *Alerta VPS*: Espacio en disco bajo (${FREE_DISK_MB} MB disponibles en /)."
fi

# 2. Check docker containers
cd /var/www/RecordingBot 2>/dev/null || cd /opt/recording-bot 2>/dev/null || exit 0

FAILED_CONTAINERS=$(docker compose ps --filter "status=exited" --format "{{.Service}}")
if [ -n "$FAILED_CONTAINERS" ]; then
    send_alert "⚠️ *Alerta RecordingBot*: Contenedor(es) caídos: $FAILED_CONTAINERS. Autoheal intentará reiniciar."
fi
