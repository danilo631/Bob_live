#!/usr/bin/env bash
set -euo pipefail
git submodule update --init --recursive
python3 deploy/render/prepare_runtime.py
npm ci --prefix .generated/server --omit=dev --no-audit --no-fund
node --check deploy/render/server.js
node --check scripts/public_bridge.js
node scripts/test_public_bridge.js
echo "Runtime Render Free pronto; voz e processamento local de modelo desabilitados."
