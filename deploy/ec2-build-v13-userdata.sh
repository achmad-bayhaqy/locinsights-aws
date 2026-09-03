#!/bin/bash
# LocInsights v13 build — ML R1-R5 source-level fixes (reconstructed + hardened):
#   R1a in-process predict-service (no self-fetch), R1b DB-backed features,
#   R1c prediction persistence, R2 holdout + DB artifact + scheduled retrain,
#   R3 PostGIS pushdown, R4 ground-truth columns + feedback endpoint,
#   R5 agent ML tools + drift action.
# NEW guards vs v8: ML artifact presence, honest heuristic metrics (no fake r2/silhouette),
#   ml-retrain syntax check, migration 0011 applied, CARTO anti-regression kept.
set -euxo pipefail
export HOME=/root
exec > /var/log/locinsights-build.log 2>&1

ACCOUNT=715841354009
REGION=us-east-1
ECR_REPO="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/locinsights/web"
TARBALL_URL="https://<ARTIFACTS_BUCKET>.s3.<REGION>.amazonaws.com/src/locinsights-src-v13.tar.gz?<PRESIGNED_QUERY_STRING>"

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
tar -xzf locinsights.tar.gz -C /opt/build
if [ ! -d /opt/build/LocInsights_db ]; then
  git clone --depth 1 https://github.com/bayhaqy/LocInsights_db.git
fi
echo "=== verify patches present (ALL MUST BE >0) ==="
grep -c "text/x-component" LocInsights/public/sw.js
grep -c "sessionStorage" LocInsights/src/components/locinsight/ai-chat.tsx
grep -c "set_config" LocInsights/src/lib/tenant-context.ts
grep -c "tile.openstreetmap.org" LocInsights/src/components/locinsight/locinsight-map.tsx
echo "=== ML guards (R1-R5) ==="
test -f LocInsights/scripts/ml-retrain.mjs
test -f LocInsights/src/lib/ml/db-features.ts
test -f LocInsights/src/lib/ml/predict-service.ts
grep -c "predictAndPersist" LocInsights/src/app/api/locinsight/ml/route.ts
grep -c "action === 'drift'" LocInsights/src/app/api/locinsight/ml/route.ts
grep -c "predictAndPersist" LocInsights/src/app/api/locinsight/analyze/route.ts || true
grep -c "actual_revenue" LocInsights/prisma/schema.prisma || true
node --check LocInsights/scripts/ml-retrain.mjs && echo ML_RETRAIN_SYNTAX_OK
# honest-metrics guard: fake Huff/KMeans numbers must NOT return
if grep -q "r2: 0.71" LocInsights/src/app/api/locinsight/ml/route.ts; then echo "GUARD_FAILED: fake Huff metrics"; exit 1; fi
if grep -q "silhouette: 0.51" LocInsights/src/app/api/locinsight/ml/route.ts; then echo "GUARD_FAILED: fake KMeans metrics"; exit 1; fi
# ANTI-REGRESSION GUARD: no CARTO basemap anywhere in src/
if grep -rn "basemaps.cartocdn" LocInsights/src/ ; then
  echo "GUARD_FAILED: CARTO basemap URL found in src/ — refusing to build"
  exit 1
fi
echo "ALL_PATCHES_VERIFIED"

echo "=== [3/6] Local postgres ==="
docker rm -f locinsights-build-db 2>/dev/null || true
docker run -d --name locinsights-build-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=locinsights -p 5432:5432 postgis/postgis:15-3.4
sleep 12
LOCAL_PSQL="postgresql://postgres:postgres@127.0.0.1:5432/locinsights"

echo "=== [4/6] Migrations (incl. 0011 ML ground truth) ==="
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
psql "$LOCAL_PSQL" -v ON_ERROR_STOP=1 -f migrations/0010_indonesia_expansion_constraints.sql || echo "0010 optional (skip if missing)"
psql "$LOCAL_PSQL" -v ON_ERROR_STOP=1 -f migrations/0011_ml_ground_truth_and_artifact.sql || { echo "MIGRATION_0011_FAILED"; exit 1; }
psql "$LOCAL_PSQL" -t -c "SELECT 'kelurahan='||count(*) FROM kelurahan;" || true
psql "$LOCAL_PSQL" -t -c "SELECT 'pred_cols='||count(*) FROM information_schema.columns WHERE table_name='predictions' AND column_name IN ('actual_revenue','actual_recorded_at','decision_note');" || true

echo "=== [5/6] Build v13 ==="
cd /opt/build/LocInsights
export NEXTAUTH_SECRET="build-time-placeholder-0000000000000000"
export NEXTAUTH_URL="http://127.0.0.1:3000"
export NEXT_PUBLIC_SUPABASE_URL="https://fcyhrzzfvdsghtummizv.supabase.co"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_qoO6_bu4mcgG1fmjsH3Gug_BMTXtCZf"
bun install
bun add @aws-sdk/client-bedrock-agentcore
bun run build
ls -la .next/standalone/ | head -5
# verify the BUILT output actually contains OSM tile URL and NOT cartocdn
if grep -rl "basemaps.cartocdn" .next/static/ ; then
  echo "BUILT_OUTPUT_STILL_HAS_CARTO"; exit 1
fi
grep -rl "tile.openstreetmap.org" .next/static/ | head -3

echo "=== [6/6] Docker + smoke + push :v13 ==="
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

docker build -t locinsights/web:v13 /opt/build

docker run -d --name locinsights-smoke -p 3001:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@172.17.0.1:5432/locinsights?schema=public" \
  -e NEXTAUTH_SECRET="smoke-test-secret-0000000000000000000000" \
  -e NEXTAUTH_URL="http://localhost:3001" \
  locinsights/web:v13

SMOKE_OK=0
for i in $(seq 1 30); do
  sleep 5
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/sw.js || true)
  echo "attempt $i: /sw.js=$CODE"
  if [ "$CODE" = "200" ]; then SMOKE_OK=1; break; fi
done
if [ "$SMOKE_OK" != "1" ]; then echo "SMOKE_TEST_FAILED"; docker logs locinsights-smoke --tail 100 || true; exit 1; fi
docker exec locinsights-smoke sh -c "grep -rl 'basemaps.cartocdn' /app/.next/static/ && echo CARTO_IN_IMAGE || echo NO_CARTO_IN_IMAGE" || true
docker exec locinsights-smoke grep -c "text/x-component" /app/public/sw.js || true
# ML smoke: retrain script present in image and syntax-valid
docker exec locinsights-smoke node --check /app/scripts/ml-retrain.mjs && echo ML_RETRAIN_IN_IMAGE_OK
docker rm -f locinsights-smoke

docker tag locinsights/web:v13 "$ECR_REPO":v13
docker tag locinsights/web:v13 "$ECR_REPO":latest
docker push "$ECR_REPO":v13
docker push "$ECR_REPO":latest

echo "BUILD_COMPLETE" > /opt/build/DONE
echo "=== LOCINSIGHTS v13 BUILD SELESAI ==="
