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

# Start PulseAudio with native timer-based scheduling (auto_null, no fragment overrides)
if command -v pulseaudio >/dev/null 2>&1; then
  pulseaudio --kill >/dev/null 2>&1 || true
  rm -rf /tmp/pulse-* /run/user/1001/pulse "${HOME:-/home/chrome}/.config/pulse" || true
  pulseaudio --start --exit-idle-time=-1 || true
fi

xvfb_pids=()
for ((i=0; i<NUM_SLOTS; i++)); do
  slot_display=":$((99 + i))"
  Xvfb "$slot_display" -screen 0 "${XVFB_SCREEN_SIZE}x24" -ac +extension RANDR >/tmp/xvfb-$i.log 2>&1 &
  xvfb_pids+=("$!")
done
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
  for pid in "${xvfb_pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT INT TERM

# Start Chrome instances for each slot on its own Xvfb display (no fake media stream)
for ((i=0; i<NUM_SLOTS; i++)); do
  cdp_port=$(( BASE_CDP_PORT + i * 2 ))
  profile_dir="/tmp/chrome-profile-$i"
  slot_display=":$((99 + i))"

  rm -rf "$profile_dir"/Singleton* || true
  mkdir -p "$profile_dir"

  DISPLAY="$slot_display" google-chrome-stable \
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
    --disable-dev-shm-usage \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --no-sandbox \
    "$CHROME_URL" &
  chrome_pids+=("$!")
done

wait -n "$nginx_pid" "${chrome_pids[@]}"
