#!/bin/bash
# LocInsights v7 build — bundled fixes:
#   1. sw.js: never intercept RSC/prefetch payloads; network-first HTML (refresh bug hardening)
#   2. ai-chat.tsx: persist chat panel open state (sessionStorage)
#   3. tenant-context.ts: SET LOCAL $1 -> SELECT set_config(..., false) (PG 42601 fix)
# Source: tarball of the local repo (patches included) uploaded to S3.
set -euxo pipefail
export HOME=/root
exec > /var/log/locinsights-build.log 2>&1

ACCOUNT=715841354009
REGION=us-east-1
ECR_REPO="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/locinsights/web"
TARBALL_URL="<S3-PRESIGNED-URL-REDACTED>"

echo "=== [1/6] Packages ==="
dnf install -y docker git postgresql16 unzip >/dev/null
systemctl enable --now docker
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "=== [2/6] ECR login + source tarball ==="
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT".dkr.ecr."$REGION".amazonaws.com
mkdir -p /opt/build && cd /opt/build
curl -sS "$TARBALL_URL" -o locinsights.tar.gz
mkdir -p LocInsights && tar -xzf locinsights.tar.gz -C LocInsights
git clone --depth 1 https://github.com/bayhaqy/LocInsights_db.git
echo "=== verify patches present ==="
grep -c "text/x-component" LocInsights/public/sw.js
grep -c "OPEN_KEY" LocInsights/src/components/locinsight/ai-chat.tsx
grep -c "set_config" LocInsights/src/lib/tenant-context.ts

echo "=== [3/6] Local postgres ==="
docker rm -f locinsights-build-db 2>/dev/null || true
docker run -d --name locinsights-build-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=locinsights -p 5432:5432 postgis/postgis:15-3.4
sleep 12
LOCAL_PSQL="postgresql://postgres:postgres@127.0.0.1:5432/locinsights"

echo "=== [4/6] Migrations ==="
cd /opt/build/LocInsights_db
for f in migrations/0001*.sql migrations/0002*.sql migrations/0003*.sql migrations/0004*.sql migrations/0005*.sql migrations/0006*.sql migrations/0007*.sql migrations/0008*.sql migrations/0009_kelurahan*.sql; do
  psql "$LOCAL_PSQL" -v ON_ERROR_STOP=1 -f "$f" || { echo "MIGRATION_FAILED $f"; exit 1; }
done
cd /opt/build/LocInsights
export DATABASE_URL="${LOCAL_PSQL}?schema=public"
export DIRECT_URL="${LOCAL_PSQL}?schema=public"
bun install
bunx prisma migrate diff --from-url "${LOCAL_PSQL}" --to-schema-datamodel prisma/schema.prisma --script > /opt/build/delta.sql 2>/opt/build/delta.err || { echo "DELTA_DIFF_FAILED"; cat /opt/build/delta.err; exit 1; }
if grep -q "CREATE TABLE\|ALTER TABLE\|CREATE TYPE" /opt/build/delta.sql; then
  psql "$LOCAL_PSQL" -v ON_ERROR_STOP=1 -f /opt/build/delta.sql || { echo "DELTA_APPLY_FAILED"; exit 1; }
fi
cd /opt/build/LocInsights_db
psql "$LOCAL_PSQL" -v ON_ERROR_STOP=1 -f migrations/0009_saas_multi_tenant_auth.sql
psql "$LOCAL_PSQL" -t -c "SELECT 'kelurahan='||count(*) FROM kelurahan;" || true

echo "=== [5/6] Build v7 ==="
cd /opt/build/LocInsights
export NEXTAUTH_SECRET="build-time-placeholder-0000000000000000"
export NEXTAUTH_URL="http://127.0.0.1:3000"
export NEXT_PUBLIC_MAP_TILE_URL="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
export NEXT_PUBLIC_SUPABASE_URL="https://fcyhrzzfvdsghtummizv.supabase.co"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_qoO6_bu4mcgG1fmjsH3Gug_BMTXtCZf"
bun install
bun add @aws-sdk/client-bedrock-agentcore
bun run build
ls -la .next/standalone/ | head -5
grep -c "text/x-component" .next/standalone/public/sw.js 2>/dev/null || grep -rc "text/x-component" .next/standalone/public/sw.js || true

echo "=== [6/6] Docker + smoke + push :v7 ==="
cat > /opt/build/Dockerfile << 'DOCKER'
FROM node:20-bookworm-slim
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends postgresql-client curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 PATH="/root/.bun/bin:${PATH}" NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY LocInsights/.next/standalone ./
COPY LocInsights/.next/static ./.next/static
COPY LocInsights/public ./public
COPY LocInsights/prisma ./prisma
COPY LocInsights/scripts ./scripts
COPY LocInsights/docs ./docs
COPY LocInsights/package.json ./package.json
COPY LocInsights/node_modules/.prisma ./node_modules/.prisma
COPY LocInsights/node_modules/@prisma ./node_modules/@prisma
COPY LocInsights/node_modules/bcryptjs ./node_modules/bcryptjs
COPY LocInsights_db/migrations ./db-migrations
EXPOSE 3000
CMD ["node","server.js"]
DOCKER

docker build -t locinsights/web:v7 /opt/build

docker run -d --name locinsights-smoke -p 3001:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@172.17.0.1:5432/locinsights?schema=public" \
  -e NEXTAUTH_SECRET="smoke-test-secret-0000000000000000000000" \
  -e NEXTAUTH_URL="http://localhost:3001" \
  locinsights/web:v7

SMOKE_OK=0
for i in $(seq 1 30); do
  sleep 5
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/sw.js || true)
  echo "attempt $i: /sw.js=$CODE"
  if [ "$CODE" = "200" ]; then SMOKE_OK=1; break; fi
done
if [ "$SMOKE_OK" != "1" ]; then echo "SMOKE_TEST_FAILED"; docker logs locinsights-smoke --tail 100 || true; exit 1; fi
docker exec locinsights-smoke grep -c "text/x-component" /app/public/sw.js || true
docker rm -f locinsights-smoke

docker tag locinsights/web:v7 "$ECR_REPO":v7
docker push "$ECR_REPO":v7

echo "BUILD_COMPLETE" > /opt/build/DONE
echo "=== LOCINSIGHTS v7 BUILD SELESAI ==="
