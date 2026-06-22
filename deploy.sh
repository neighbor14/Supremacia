#!/bin/bash
# Deploy Supremacia Digital → VPS Hostinger
# Uso: ./deploy.sh  (ou peça ao Claude Code para rodar)
set -e

VPS="root@72.60.155.198"
REMOTE_DIR="/var/www/supremacia"

echo "=== Build local ==="
pnpm run build

echo "=== Sincronizando arquivos para VPS ==="
rsync -az --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  dist/public/ \
  "$VPS:$REMOTE_DIR/dist/public/"

echo "=== Reiniciando container ==="
ssh -o StrictHostKeyChecking=no "$VPS" "docker restart root-supremacia-1"

echo ""
echo "✓ Deploy concluído!"
echo "  https://supremacia.srv1031356.hstgr.cloud"
