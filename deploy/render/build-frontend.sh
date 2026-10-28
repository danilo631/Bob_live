#!/usr/bin/env bash
set -euo pipefail
# A interface vem SEMPRE do commit atual. O ZIP do Actions traz apenas game/.
# Evita 404: o Render nao publica JS antigo enquanto a API ja foi atualizada.
ASSET="https://github.com/danilo631/Bob_live/releases/download/web-latest/bob-live-web.zip"
echo "Baixando somente o pacote Godot compilado pelo GitHub Actions..."
curl -fsSL --retry 3 --retry-delay 2 "$ASSET" -o /tmp/bob-live-web.zip
mkdir -p /tmp/bob-live-web-game
unzip -oq /tmp/bob-live-web.zip 'game/*' -d /tmp/bob-live-web-game
test -s /tmp/bob-live-web-game/game/index.html
test -s /tmp/bob-live-web-game/game/index.wasm
test -s /tmp/bob-live-web-game/game/index.pck
rm -rf site/game
mv /tmp/bob-live-web-game/game site/game
# Opcional: banco de falas pre-sintetizadas pelo Piper no GitHub Actions.
# Os audios sao reproduzidos em <audio> na fonte Web, sem CPU de TTS no Render.
VOICE_ASSET="https://github.com/danilo631/Bob_live/releases/download/voices-latest/bob-live-voices.zip"
if curl -fLsS --retry 2 --max-time 30 "$VOICE_ASSET" -o /tmp/bob-live-voices.zip; then
  unzip -oq /tmp/bob-live-voices.zip -d site
  test -s site/voices/manifest.json
  echo "Pacote de voz pt-BR carregado no site."
else
  echo "Pacote Piper ainda nao publicado; usando Web Speech e Kokoro."
fi
test -s site/index.html
test -s site/main.js
test -s site/voice.js
echo "Interface do commit atual + Godot Web: publicacao consistente, sem sobrescrever rotas atuais."
