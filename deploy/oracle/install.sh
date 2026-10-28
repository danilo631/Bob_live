#!/usr/bin/env bash
# Configura VM Ubuntu 24.04 (ARM64/x86_64), com TLS e servicos 24h.
set -euo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo "Execute com sudo"; exit 1; }
APP=/opt/bob-live
RUN_USER=boblive
DOMAIN="$(printenv BOB_DOMAIN 2>/dev/null || true)"
MODEL="$(printenv BOB_MODEL 2>/dev/null || true)"
TIKTOK="$(printenv BOB_TIKTOK_USERNAME 2>/dev/null || true)"
KEY="$(printenv BOB_SESSION_KEY 2>/dev/null || true)"
[[ -n "$MODEL" ]] || MODEL=qwen2.5:0.5b
[[ -n "$TIKTOK" ]] || TIKTOK=nexttec_1
[[ "$MODEL" == qwen2.5:0.5b || "$MODEL" == qwen2.5:1.5b ]] || exit 2
[[ "$TIKTOK" =~ ^[a-zA-Z0-9_.]{2,24}$ ]] || exit 2
if [[ -z "$DOMAIN" ]]; then
  IP=$(curl -4fsS --max-time 10 https://api.ipify.org)
  [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
  DOMAIN="$IP.sslip.io"
fi
[[ "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]{2,240}$ ]] || exit 2
if [[ -z "$KEY" && -s /etc/bob-live/bob.env ]]; then
  KEY="$(sed -n 's/^BOB_SESSION_KEY=//p' /etc/bob-live/bob.env | head -1)"
fi
[[ -n "$KEY" ]] || KEY="$(openssl rand -hex 32)"
[[ "$KEY" =~ ^[a-zA-Z0-9_-]{20,256}$ ]] || { echo "Senha invalida"; exit 2; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates git unzip openssl python3 python3-venv caddy
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource.sh
  bash /tmp/nodesource.sh
  apt-get install -y nodejs
fi
id "$RUN_USER" >/dev/null 2>&1 || useradd -m -s /usr/sbin/nologin "$RUN_USER"
if [[ -d "$APP/.git" ]]; then
  git -C "$APP" fetch origin main
  git -C "$APP" checkout main
  git -C "$APP" merge --ff-only origin/main
  git -C "$APP" submodule update --init --recursive
else
  git clone --recurse-submodules https://github.com/danilo631/Bob_live.git "$APP"
fi
chown -R "$RUN_USER:$RUN_USER" "$APP"
cd "$APP"
runuser -u "$RUN_USER" -- python3 scripts/prepare_web.py
runuser -u "$RUN_USER" -- npm ci --prefix .generated/server --no-audit --no-fund
node scripts/test_public_bridge.js
python3 scripts/test_web_adapter.py

if [[ ! -x "$APP/.venv/bin/python" ]]; then
  runuser -u "$RUN_USER" -- python3 -m venv "$APP/.venv"
fi
runuser -u "$RUN_USER" -- "$APP/.venv/bin/python" -m pip install --disable-pip-version-check piper-tts==1.7.0
mkdir -p "$APP/models"
chown "$RUN_USER:$RUN_USER" "$APP/models"
VOICE_BASE=https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/faber/medium
for f in pt_BR-faber-medium.onnx pt_BR-faber-medium.onnx.json; do
  if [[ ! -s "$APP/models/$f" ]]; then
    runuser -u "$RUN_USER" -- curl -fL --retry 3 "$VOICE_BASE/$f" -o "$APP/models/$f"
  fi
done
if ! command -v ollama >/dev/null; then
  curl -fsSL https://ollama.com/install.sh -o /tmp/install-ollama.sh
  sh /tmp/install-ollama.sh
fi
systemctl enable --now ollama
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:11434/api/tags >/dev/null || exit 3
ollama pull "$MODEL"

case "$(uname -m)" in
  aarch64|arm64) GARCH=arm64 ;;
  x86_64) GARCH=x86_64 ;;
  *) echo "Arch nao suportada"; exit 4 ;;
esac
RELEASE=https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable
if ! command -v godot >/dev/null; then
  curl -fL --retry 3 "$RELEASE/Godot_v4.7.2-stable_linux.$GARCH.zip" -o /tmp/bob-godot.zip
  unzip -oq /tmp/bob-godot.zip -d /tmp
  install -m 755 "/tmp/Godot_v4.7.2-stable_linux.$GARCH" /usr/local/bin/godot
fi
TEMPLATES="/home/$RUN_USER/.local/share/godot/export_templates/4.7.2.stable"
install -d -o "$RUN_USER" -g "$RUN_USER" "$TEMPLATES"
if [[ ! -s "$TEMPLATES/web_release.zip" ]]; then
  curl -fL --retry 3 "$RELEASE/Godot_v4.7.2-stable_export_templates.tpz" -o /tmp/bob-templates.tpz
  unzip -oq -j /tmp/bob-templates.tpz 'templates/web*.zip' -d "$TEMPLATES"
  chown -R "$RUN_USER:$RUN_USER" "$TEMPLATES"
fi
runuser -u "$RUN_USER" -- mkdir -p "$APP/site/game"
runuser -u "$RUN_USER" -- env HOME="/home/$RUN_USER" godot --headless --path "$APP/.generated/game" --import > /tmp/bob-import.log 2>&1
runuser -u "$RUN_USER" -- env HOME="/home/$RUN_USER" godot --headless --path "$APP/.generated/game" --export-release Web "$APP/site/game/index.html" > /tmp/bob-export.log 2>&1
if grep -Eq "SCRIPT ERROR|Failed to load script|Parse Error|Compile Error" /tmp/bob-import.log /tmp/bob-export.log; then
  tail -n 60 /tmp/bob-import.log /tmp/bob-export.log
  exit 5
fi
[[ -s "$APP/site/game/index.wasm" && -s "$APP/site/game/index.html" ]] || exit 5

install -d -m 700 /etc/bob-live
cat >/etc/bob-live/bob.env <<EOF
TIKTOK_USERNAME=$TIKTOK
PORT=9393
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=$MODEL
OLLAMA_NUM_CTX=4096
REPLY_LENGTH=curta
TTS_PROVIDER=custom
CUSTOM_TTS_URL=http://127.0.0.1:8022/tts
CUSTOM_TTS_METHOD=POST
CUSTOM_TTS_FORMAT=audio
CUSTOM_TTS_BODY='{"text":"{text}"}'
CUSTOM_TTS_HEADERS='Content-Type: application/json'
VOICE_AUTOSTART=0
PUBLIC_PORT=9494
BOB_PUBLIC_ORIGIN=https://$DOMAIN
BOB_SESSION_KEY=$KEY
PIPER_CARTOON_PITCH=1.12
EOF
chmod 600 /etc/bob-live/bob.env

write_unit() {
  local name="$1" command="$2" after="$3"
  cat > "/etc/systemd/system/$name.service" <<EOF
[Unit]
Description=$name
After=network-online.target $after
Wants=network-online.target
[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP
EnvironmentFile=/etc/bob-live/bob.env
ExecStart=$command
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$APP
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
}
write_unit bob-live-piper "$APP/.venv/bin/python -u $APP/scripts/piper_server.py --model $APP/models/pt_BR-faber-medium.onnx" ""
write_unit bob-live-node "/usr/bin/node $APP/.generated/server/src/index.js" "ollama.service bob-live-piper.service"
write_unit bob-live-bridge "/usr/bin/node $APP/scripts/public_bridge.js" "bob-live-node.service"
cat >/etc/caddy/Caddyfile <<EOF
$DOMAIN {
    encode gzip zstd
    @backend path /api/status /api/simulate/chat /api/simulate/gift /ws/godot /health
    handle @backend {
        reverse_proxy 127.0.0.1:9494
    }
    handle {
        root * $APP/site
        file_server
    }
}
EOF
caddy validate --config /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable --now bob-live-piper.service bob-live-node.service bob-live-bridge.service caddy.service
systemctl restart bob-live-piper.service bob-live-node.service bob-live-bridge.service caddy.service
echo "Servidor e pagina: https://$DOMAIN/"
echo "Abrir TCP 80/443 no painel de rede da Oracle (NSG/Security List)."
echo "Senha salva em /etc/bob-live/bob.env; veja com sudo."
echo "Servico: systemctl status bob-live-node bob-live-bridge bob-live-piper caddy"
