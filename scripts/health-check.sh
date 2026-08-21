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
    send_alert "🚨 <b>Alerta VPS</b>: Espacio en disco bajo (<code>${FREE_DISK_MB} MB</code> disponibles en /)."
fi

# 2. Check docker containers
cd /var/www/RecordingBot 2>/dev/null || cd /opt/recording-bot 2>/dev/null || exit 0

FAILED_CONTAINERS=$(docker compose ps --filter "status=exited" --format "{{.Service}}")
if [ -n "$FAILED_CONTAINERS" ]; then
    send_alert "⚠️ <b>Alerta RecordingBot</b>: Contenedor(es) caídos: <code>$FAILED_CONTAINERS</code>. Autoheal intentará reiniciar."
fi

# 3. Check Redis connectivity
REDIS_PING=$(docker exec recordingbot-redis-1 redis-cli ping 2>/dev/null)
if [ "$REDIS_PING" != "PONG" ]; then
    send_alert "⚠️ <b>Alerta RecordingBot</b>: Redis no responde (Ping fallido). La cola de trabajos podría estar atascada."
fi
