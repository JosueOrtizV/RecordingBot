#!/bin/bash
# ============================================
#  ThreatHunterVPS Bot - Panel de Control
#  Telegram Bot para monitoreo del VPS y Grabador
# ============================================

TOKEN="8934973067:AAF2bQnHUtGyPA_6BLTyhQv5PMQf5F6vvu8"
CHAT_ID="6859555639"
API="https://api.telegram.org/bot${TOKEN}"
OFFSET=0

escape_html() {
    echo "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'
}

send_msg() {
    local text="$1"
    # Reemplazar '\n' literal por salto de linea real
    text="${text//\\n/$'\n'}"
    
    local json=$(jq -n --arg chat_id "${CHAT_ID}" --arg text "$text" --arg pm "HTML" '{chat_id: $chat_id, text: $text, parse_mode: $pm}')
    
    # Send request and capture error if any
    local resp=$(curl -s -X POST "${API}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "$json")
    
    # Log error if not ok
    if ! echo "$resp" | grep -q '"ok":true'; then
        echo "Error sending message: $resp" >> /var/log/telegram_bot.log
    fi
}

cmd_grabar() {
    local input="$1"
    local meet_url=$(echo "$input" | grep -oE 'https://meet\.google\.com/[a-zA-Z0-9_-]+')

    if [ -z "$meet_url" ]; then
        send_msg "❌ No se detectó un enlace válido de Google Meet.\n\n<b>Uso:</b>\n<code>/grabar https://meet.google.com/xxx-yyyy-zzz</code>\no simplemente pega el enlace directo."
        return
    fi

    # Check if redis container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^recordingbot-redis-1$"; then
        send_msg "⚠️ Error: El contenedor de Redis (<code>recordingbot-redis-1</code>) no está activo."
        return
    fi

    local bot_uuid=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$RANDOM-$RANDOM-$RANDOM")
    local event_id="telegram_${bot_uuid}"
    
    local payload=$(jq -nc \
        --arg url "$meet_url" \
        --arg name "Josue's Notetaker" \
        --arg botId "$bot_uuid" \
        --arg eventId "$event_id" \
        --arg userId "josue" \
        --arg teamId "recording-bot" \
        --arg timezone "America/Mexico_City" \
        --arg title "Reunión On-Demand (Telegram)" \
        '{
            provider: "google",
            url: $url,
            name: $name,
            botId: $botId,
            eventId: $eventId,
            userId: $userId,
            teamId: $teamId,
            timezone: $timezone,
            meetingTitle: $title
        }')

    docker exec recordingbot-redis-1 redis-cli lpush "jobs:meetbot:list" "$payload" > /dev/null 2>&1

    send_msg "🚀 <b>¡Orden Recibida!</b>\n\nDespachando a <b>Josue's Notetaker</b> hacia la reunión:\n🔗 <code>${meet_url}</code>\n\n<i>Te notificaré por aquí cuando concluya la reunión y el video esté listo en Drive.</i>"
}

cmd_status() {
    local result="📊 <b>Estado de Contenedores</b>\n\n"
    while IFS= read -r line; do
        local name=$(echo "$line" | awk '{print $1}')
        local status=$(echo "$line" | cut -d' ' -f2-)
        if echo "$status" | grep -q "healthy"; then
            result+="🟢 <code>${name}</code> → ${status}\n"
        elif echo "$status" | grep -q "Up"; then
            result+="🟡 <code>${name}</code> → ${status}\n"
        else
            result+="🔴 <code>${name}</code> → ${status}\n"
        fi
    done < <(docker ps -a --format '{{.Names}} {{.Status}}')
    send_msg "$result"
}

cmd_cpu() {
    local result="🖥️ <b>Recursos del Sistema</b>\n\n"

    local cpu_host=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local mem_info=$(free -m | awk 'NR==2{printf "%s/%sMB (%.1f%%)", $3,$2,$3*100/$2}')
    local uptime_str=$(uptime -p | sed 's/up //')
    result+="<b>Host:</b>\n"
    result+="  CPU: ${cpu_host}%\n"
    result+="  RAM: ${mem_info}\n"
    result+="  Uptime: ${uptime_str}\n\n"

    result+="<b>Contenedores:</b>\n"
    while IFS= read -r line; do
        local name=$(echo "$line" | awk '{print $1}')
        local cpu=$(echo "$line" | awk '{print $2}')
        local mem=$(echo "$line" | awk '{print $3}')
        result+="  <code>${name}</code>\n"
        result+="    CPU: ${cpu} | RAM: ${mem}\n"
    done < <(docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}')
    send_msg "$result"
}

cmd_disco() {
    local result="💾 <b>Uso de Disco</b>\n\n"

    local disk=$(df -h / | awk 'NR==2{printf "%s/%s (%s usado)", $3, $2, $5}')
    result+="<b>Disco Principal:</b> ${disk}\n\n"

    result+="<b>Docker:</b>\n"
    local docker_info=$(docker system df --format 'table {{.Type}} {{.Size}} {{.Reclaimable}}' 2>/dev/null)
    while IFS= read -r line; do
        result+="  ${line}\n"
    done <<< "$docker_info"
    send_msg "$result"
}

cmd_backup() {
    local result="🗄️ <b>Estado del Backup</b>\n\n"

    if [ -f /var/log/db_backup.log ]; then
        local last_lines=$(tail -20 /var/log/db_backup.log)
        if echo "$last_lines" | grep -qi "error\|fail\|fallo"; then
            result+="🔴 <b>Último backup con errores</b>\n\n"
        else
            result+="🟢 <b>Último backup exitoso</b>\n\n"
        fi
        result+="<b>Últimas líneas del log:</b>\n"
        local esc_logs=$(escape_html "$(tail -10 /var/log/db_backup.log)")
        result+="<code>${esc_logs}</code>\n"
    else
        result+="⚠️ No se encontró el archivo de log de backups"
    fi

    local next_cron=$(crontab -l 2>/dev/null | grep db_backup)
    local esc_cron=$(escape_html "${next_cron}")
    result+="\n<b>Programado:</b> <code>${esc_cron}</code>"
    send_msg "$result"
}

cmd_baneados() {
    local result="🛡️ <b>IPs Baneadas (fail2ban)</b>\n\n"

    local jails=$(fail2ban-client status 2>/dev/null | grep "Jail list" | sed 's/.*://;s/,//g' | xargs)
    for jail in $jails; do
        local jail_info=$(fail2ban-client status "$jail" 2>/dev/null)
        local banned=$(echo "$jail_info" | grep "Currently banned" | awk '{print $NF}')
        local total=$(echo "$jail_info" | grep "Total banned" | awk '{print $NF}')
        local ip_list=$(echo "$jail_info" | grep "Banned IP list" | sed 's/.*://')

        if [ "$banned" -gt 0 ] 2>/dev/null; then
            result+="🔴 <b>${jail}</b>: ${banned} activas (${total} total)\n"
            result+="   IPs: <code>${ip_list}</code>\n\n"
        else
            result+="🟢 <b>${jail}</b>: 0 activas (${total} total)\n\n"
        fi
    done
    send_msg "$result"
}

cmd_logs() {
    local result="📋 <b>Actividad Reciente (últimas 2h)</b>\n\n"

    if [ -f /var/log/caddy/access.log ]; then
        local total=$(wc -l < /var/log/caddy/access.log)
        local recent=$(awk -v d="$(date -d '2 hours ago' '+%Y-%m-%dT%H' 2>/dev/null || echo '.')" '$0 ~ d' /var/log/caddy/access.log | wc -l)
        local errors=$(grep -c '"status":4' /var/log/caddy/access.log 2>/dev/null || echo 0)
        result+="<b>Caddy Access Log:</b>\n"
        result+="  Total registros: ${total}\n"
        result+="  Errores 4xx: ${errors}\n\n"
    else
        result+="⚠️ Log de Caddy no encontrado\n\n"
    fi

    if [ -f /var/log/watchdog.log ]; then
        result+="<b>Último Watchdog:</b>\n"
        local w_logs=$(escape_html "$(tail -5 /var/log/watchdog.log)")
        result+="<code>${w_logs}</code>\n"
    fi

    send_msg "$result"
}

cmd_reiniciar() {
    local container="$1"
    if [ -z "$container" ]; then
        send_msg "⚠️ Uso: /reiniciar nombre_contenedor\n\nContenedores disponibles:\n$(docker ps --format '<code>{{.Names}}</code>' | tr '\n' '\n')"
        return
    fi

    if ! docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        send_msg "❌ Contenedor <code>${container}</code> no encontrado."
        return
    fi

    send_msg "🔄 Reiniciando <code>${container}</code>..."
    docker restart "$container" 2>&1
    sleep 3
    local new_status=$(docker ps --filter "name=^${container}$" --format '{{.Status}}')
    send_msg "✅ <code>${container}</code> reiniciado.\nEstado: ${new_status}"
}

cmd_seguridad() {
    local result="🔒 <b>Resumen de Seguridad</b>\n\n"

    local ufw_status=$(ufw status | head -1)
    result+="<b>Firewall (UFW):</b> ${ufw_status}\n\n"

    local f2b_jails=$(fail2ban-client status 2>/dev/null | grep "Number of jail" | awk '{print $NF}')
    local f2b_total_bans=0
    local jails=$(fail2ban-client status 2>/dev/null | grep "Jail list" | sed 's/.*://;s/,//g' | xargs)
    for jail in $jails; do
        local banned=$(fail2ban-client status "$jail" 2>/dev/null | grep "Currently banned" | awk '{print $NF}')
        f2b_total_bans=$((f2b_total_bans + banned))
    done
    result+="<b>Fail2ban:</b> ${f2b_jails} jails, ${f2b_total_bans} IPs baneadas\n\n"

    result+="<b>Contenedores read-only:</b>\n"
    for c in $(docker ps --format '{{.Names}}'); do
        local ro=$(docker inspect "$c" --format '{{.HostConfig.ReadonlyRootfs}}' 2>/dev/null)
        if [ "$ro" = "true" ]; then
            result+="  🟢 <code>${c}</code>\n"
        else
            result+="  🟡 <code>${c}</code> (lectura/escritura)\n"
        fi
    done

    result+="\n<b>Puertos abiertos (UFW):</b>\n"
    local p_abiertos=$(ufw status | grep ALLOW | awk '{print $1}' | tr '\n' ',' | sed 's/,$//')
    result+="<code>${p_abiertos}</code>\n"

    send_msg "$result"
}

cmd_ayuda() {
    send_msg "🤖 <b>ThreatHunterVPS Bot - Comandos</b>\n\n🎙️ <b>Grabador de Reuniones:</b>\n• /grabar <i>enlace</i> → Enviar bot a la reunión\n• O pega directamente el enlace de Meet\n\n📊 <b>Monitoreo del Servidor:</b>\n📊 /status → Estado de contenedores\n🖥️ /cpu → CPU, RAM y uptime\n💾 /disco → Espacio en disco\n🗄️ /backup → Estado del backup\n🛡️ /baneados → IPs bloqueadas\n📋 /logs → Actividad reciente\n🔒 /seguridad → Resumen seguridad\n🔄 /reiniciar <i>nombre</i> → Reiniciar contenedor\n❓ /ayuda → Este menú"
}

# ============================================
#  Main Loop
# ============================================

while true; do
    RESPONSE=$(curl -s "${API}/getUpdates?offset=${OFFSET}&timeout=60" 2>/dev/null)

    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | grep -q '"ok":true'; then
        sleep 5
        continue
    fi

    UPDATES=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for u in data.get('result', []):
        uid = u['update_id']
        msg = u.get('message', {})
        chat_id = msg.get('chat', {}).get('id', '')
        text = msg.get('text', '')
        print(f'{uid}|{chat_id}|{text}')
except Exception as e:
    pass
" 2>/dev/null)

    while IFS= read -r update; do
        [ -z "$update" ] && continue

        UPDATE_ID=$(echo "$update" | cut -d'|' -f1)
        MSG_CHAT_ID=$(echo "$update" | cut -d'|' -f2)
        TEXT=$(echo "$update" | cut -d'|' -f3-)

        OFFSET=$((UPDATE_ID + 1))

        if [ "$MSG_CHAT_ID" != "$CHAT_ID" ]; then
            continue
        fi

        CMD=$(echo "$TEXT" | awk '{print tolower($1)}')
        ARG=$(echo "$TEXT" | awk '{print $2}')

        case "$CMD" in
            /grabar|/record|/meet) cmd_grabar "$TEXT" ;;
            https://meet.google.com/*) cmd_grabar "$TEXT" ;;
            /status|/estado)    cmd_status ;;
            /cpu|/recursos)     cmd_cpu ;;
            /disco|/disk)       cmd_disco ;;
            /backup|/respaldo)  cmd_backup ;;
            /baneados|/banned)  cmd_baneados ;;
            /logs)              cmd_logs ;;
            /seguridad|/security) cmd_seguridad ;;
            /reiniciar|/restart)  cmd_reiniciar "$ARG" ;;
            /ayuda|/help|/start) cmd_ayuda ;;
        esac
    done <<< "$UPDATES"
done
