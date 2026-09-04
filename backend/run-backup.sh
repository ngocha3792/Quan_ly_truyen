#!/usr/bin/env bash
set -euo pipefail

cd /opt/quan-ly-truyen/backend

docker compose --env-file .env.production \
  -f compose.production.yml -f compose.production.build.yml -f compose.vps.yml \
  --profile maintenance run --rm backup-postgres

COMPLETED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '{"completedAt":"%s","offsiteVerified":false}\n' "$COMPLETED_AT" > /opt/quan-ly-truyen/backend/backups/backup-last-success.json

echo "Backup wrapper completed at $COMPLETED_AT"
