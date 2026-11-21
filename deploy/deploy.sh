#!/usr/bin/env bash
# Deploy Cadence (content-management.gkykgd.org) to gkykgd-vm.
#
#   ./deploy/deploy.sh            # sync + build + up + health check
#   ./deploy/deploy.sh caddy      # print the Caddy block and exit
#
# Requires:
#   - SSH host alias `gkykgd-vm` in ~/.ssh/config
#   - Network `gky-kelapa-gading_default` (shared with gky-internal/Caddy)
set -euo pipefail

HOST="gkykgd-vm"
REMOTE_DIR="/home/gkykgd-server/apps/gky-content"
COMPOSE="docker compose -f docker-compose.gky-content.yml"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${BLUE}[gky-content]${NC} $1"; }
ok()  { echo -e "${GREEN}✅ $1${NC}"; }
warn(){ echo -e "${YELLOW}⚠️  $1${NC}"; }

if [[ "${1:-all}" == "caddy" ]]; then
  cat deploy/Caddyfile.content
  exit 0
fi

log "Syncing project to ${HOST}:${REMOTE_DIR}"
ssh "$HOST" "mkdir -p ${REMOTE_DIR}"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.DS_Store' \
  --exclude '*.log' \
  ./ "${HOST}:${REMOTE_DIR}/"
ok "Files synced"

log "Building and starting the container"
ssh "$HOST" "cd ${REMOTE_DIR} && ${COMPOSE} up -d --build"
ok "Container started"

log "Waiting for health check"
for _ in $(seq 1 30); do
  if ssh "$HOST" "docker exec gky-content wget -qO- http://127.0.0.1/healthz" >/dev/null 2>&1; then
    ok "Container healthy"
    break
  fi
  sleep 2
done

ssh "$HOST" "docker ps --filter name=gky-content --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'"

CODE="$(ssh "$HOST" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8088/" || true)"
if [[ "$CODE" == "302" ]]; then
  ok "Auth gate aktif (302 -> app.gkykgd.org/login)"
else
  warn "Respons tanpa sesi: HTTP ${CODE:-?} (harusnya 302)"
fi

warn "Domain belum live sampai DNS A record dibuat dan blok Caddy dipasang."
