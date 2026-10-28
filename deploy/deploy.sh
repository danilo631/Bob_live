#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f deploy/.env || { echo "Copie deploy/.env.example para deploy/.env e configure."; exit 1; }
set -a; source deploy/.env; set +a
[[ "$BOB_DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "BOB_DOMAIN invalido"; exit 1; }
[[ "${#BOB_SESSION_KEY}" -ge 20 ]] || { echo "BOB_SESSION_KEY fraca"; exit 1; }
git submodule update --init --recursive
python3 scripts/prepare_web.py
docker compose --env-file deploy/.env -f deploy/compose.yaml pull web ollama
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T ollama ollama pull "$OLLAMA_MODEL"
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
echo "Site: https://$BOB_DOMAIN/"
