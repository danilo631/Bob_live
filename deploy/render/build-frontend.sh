#!/usr/bin/env bash
set -euo pipefail
# GitHub Actions gera Godot Web. Render so copia o artefato pronto.
ASSET="https://github.com/danilo631/Bob_live/releases/download/web-latest/bob-live-web.zip"
echo "Baixando export Web publicado pelo GitHub Actions..."
curl -fL --retry 3 --retry-delay 2 "$ASSET" -o /tmp/bob-live-web.zip
unzip -oq /tmp/bob-live-web.zip -d site
test -s site/index.html
test -s site/game/index.html
test -s site/game/index.wasm
test -s site/game/index.pck
echo "Site Godot Web pronto para CDN Render"
