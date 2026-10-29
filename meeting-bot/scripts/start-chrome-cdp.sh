#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
export CHROME_WINDOW_SIZE="${CHROME_WINDOW_SIZE:-1280,800}"
export CHROME_URL="${CHROME_URL:-about:blank}"
CHROME_WINDOW_SIZE_FOR_CHROME="${CHROME_WINDOW_SIZE/x/,}"
XVFB_SCREEN_SIZE="${CHROME_WINDOW_SIZE/,/x}"

NUM_SLOTS="${NUM_CHROME_SLOTS:-2}"
BASE_CDP_PORT=9222
BASE_PROXY_PORT=9223

rm -rf /tmp/.X*-lock /tmp/.X11-unix/X* /tmp/nginx.pid || true
mkdir -p /tmp/.X11-unix

# Start PulseAudio with TCP module enabled and dedicated null-sinks for each slot
if command -v pulseaudio >/dev/null 2>&1; then
  pulseaudio --kill >/dev/null 2>&1 || true
  rm -rf /tmp/pulse-* /run/user/1001/pulse || true
  pulseaudio -D --exit-idle-time=-1 || true

  # Enable native TCP protocol for remote ffmpeg capture across containers
  pactl load-module module-native-protocol-tcp auth-anonymous=1 port=4713 >/dev/null 2>&1 || true

  # Virtual default output for backwards compatibility
  pactl load-module module-null-sink sink_name=virtual_output rate=48000 channels=2 sink_properties=device.description="Virtual_Output" >/dev/null 2>&1 || true
  pactl set-default-sink virtual_output >/dev/null 2>&1 || true

  # Dedicated isolated sinks for each slot
  for ((i=0; i<NUM_SLOTS; i++)); do
    pactl load-module module-null-sink sink_name="sink_$i" rate=48000 channels=2 sink_properties=device.description="Slot_${i}_Output" >/dev/null 2>&1 || true
  done
fi

Xvfb "$DISPLAY" -screen 0 "${XVFB_SCREEN_SIZE}x24" -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
xvfb_pid="$!"
sleep 1

# Generate Nginx configuration for all slots
cat >/tmp/chrome-cdp-nginx.conf <<EOF
pid /tmp/nginx.pid;
error_log /dev/stderr warn;

events {}

http {
  access_log off;
  client_body_temp_path /tmp/nginx-client-body;
  proxy_temp_path /tmp/nginx-proxy;
  fastcgi_temp_path /tmp/nginx-fastcgi;
  uwsgi_temp_path /tmp/nginx-uwsgi;
  scgi_temp_path /tmp/nginx-scgi;
EOF

for ((i=0; i<NUM_SLOTS; i++)); do
  cdp_port=$(( BASE_CDP_PORT + i * 2 ))
  proxy_port=$(( BASE_PROXY_PORT + i * 2 ))

  cat >>/tmp/chrome-cdp-nginx.conf <<EOF
  server {
    listen 0.0.0.0:${proxy_port};

    location / {
      proxy_http_version 1.1;
      proxy_set_header Host 127.0.0.1:${cdp_port};
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Accept-Encoding "";
      sub_filter_types application/json;
      sub_filter_once off;
      sub_filter "127.0.0.1:${cdp_port}" "\$http_host";
      proxy_pass http://127.0.0.1:${cdp_port};
    }
  }
EOF
done

echo "}" >> /tmp/chrome-cdp-nginx.conf

nginx -c /tmp/chrome-cdp-nginx.conf -g 'daemon off;' &
nginx_pid="$!"

chrome_pids=()

cleanup() {
  kill "$nginx_pid" >/dev/null 2>&1 || true
  for pid in "${chrome_pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  kill "$xvfb_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Start Chrome instances for each slot
for ((i=0; i<NUM_SLOTS; i++)); do
  cdp_port=$(( BASE_CDP_PORT + i * 2 ))
  profile_dir="/tmp/chrome-profile-$i"
  sink_name="sink_$i"

  rm -rf "$profile_dir"/Singleton* || true
  mkdir -p "$profile_dir"

  PULSE_SINK="$sink_name" google-chrome-stable \
    --remote-debugging-address="127.0.0.1" \
    --remote-debugging-port="$cdp_port" \
    --remote-allow-origins='*' \
    --user-data-dir="$profile_dir" \
    --window-size="$CHROME_WINDOW_SIZE_FOR_CHROME" \
    --window-position=0,0 \
    --force-device-scale-factor=1 \
    --auto-accept-this-tab-capture \
    --autoplay-policy=no-user-gesture-required \
    --no-first-run \
    --no-default-browser-check \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --no-sandbox \
    "$CHROME_URL" &
  chrome_pids+=("$!")
done

wait -n "$nginx_pid" "${chrome_pids[@]}"
