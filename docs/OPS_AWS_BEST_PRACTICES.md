# Catatan Operasional & Best Practices (2026-09-02)

## Diterapkan
1. **CloudFront ORP**: managed `AllViewerExceptHostHeader` — memperbaiki bug
   full-page reload (header RSC kini sampai ke Next.js).
2. **AWS WAF** `locinsights-waf`: AWSManagedRulesCommonRuleSet +
   KnownBadInputs (block) + rate-limit 2000 req/5 menit/IP — terasosiasi ke
   distribusi app & ML.
3. **RDS deletion protection = ON** (encrypted, backup 7 hari, private
   subnet, auto minor upgrade sudah aktif sebelumnya).
4. **SW v4** (bypass RSC, network-first HTML) — mencegah reload pasca-deploy.
5. **Task def immutable per versi** (:v7) untuk web & sync; scheduler
   EventBridge menunjuk revisi eksplisit.

## Rekomendasi berikutnya (biaya/mutu)
- **Multi-AZ RDS** (+~USD 26/bln) — HA penuh; saat ini single-AZ.
- **CloudFront standard logging** ke S3 — audit akses (±USD 0,75/bln).
- **VPC Flow Logs → S3** — jejak jaringan (±USD 1/bln).
- **Secrets rotation** berkala utk NEXTAUTH_SECRET/DATABASE_URL.
- Enable Bedrock model access utk Claude Sonnet/gpt-oss (butuh akses akun).

---

# Update 2026-09-03 — ML R1–R5 + hardening tambahan

## ML pipeline (semua fix kini di SOURCE, teregistrasi di repo)
1. **R1a self-fetch fix** — `analyze/route.ts` kini memanggil `predictAndPersist()`
   in-process (dulu: HTTP self-fetch tanpa cookie → ml_prediction selalu null).
2. **R1b DB-backed features** — `src/lib/ml/db-features.ts`: resolusi kelurahan/brand
   dari RDS (2173 kelurahan incl. Jabodetabek, ID Kemendagri), fitur spasial via
   PostGIS `ST_DWithin`/KNN `<->` (GiST-indexed), fallback statis Bali.
3. **R1c persist prediksi** — setiap prediksi analyze tersimpan di tabel
   `predictions` (dengan dedup 60 menit per target+brand).
4. **R2 retraining terjadwal** — EventBridge Scheduler `locinsights-ml-retrain`
   `rate(7 days)` → ECS one-off (`node scripts/ml-retrain.mjs`, image web).
   Dataset DB-backed, holdout 80/20, artifact JSONB ke `training_runs.model_artifact`
   (dibaca `predict-service.loadBestModel()` → selamat dari cold start).
   Actuals (R4) ≥ 10 baris otomatis digabung sebagai label nyata.
5. **R3 PostGIS pushdown** — nearby lists (stores/competitor/mall/POI) di
   `analyze` & fitur ML dikomputasi di Postgres, bukan loop Haversine di JS.
6. **R4 ground-truth flywheel** — kolom `predictions.actual_revenue/`
   `actual_recorded_at/decision_note` + endpoint `POST /api/locinsight/ml`
   (`{prediction_id, actual_revenue, note}`) + tool agent
   `record_actual_revenue`. Migration: `db/migrations/0011_*.sql`.
7. **R5 agent ↔ ML** — tool agent: `predict_revenue` (param diperbaiki:
   `kelurahan_id`), `get_model_health` (drift: MAPE/bias/coverage/freshness),
   `train_model`, `record_actual_revenue`.
8. **Registry jujur** — metrik fiktif Huff/KMeans (r2 0.71/silhouette 0.51)
   diganti `metrics: null` + keterangan "not statistically evaluated";
   KMeans diberi label rule-based, bukan model terlatih.

## Hardening tambahan (2026-09-03)
- **RDS Multi-AZ = ON** + **Enhanced Monitoring** (60 s, role
  `rds-monitoring-role`) + **CloudWatch log export** (postgresql, upgrade).
  Catatan: Performance Insights deprecated (Nov 2025) — gunakan CloudWatch
  Database Insights bila perlu per-query analysis.
- **ECR scan-on-push = ON** (web + agentcore).
- **ALB access logs → S3** `locinsights-alb-logs-*` (SSE, public-block).
- **VPC Flow Logs → S3** `locinsights-flow-logs-*` (ALL traffic, custom format
  incl. flow-direction).
- **S3 default encryption (SSE-S3)** di kedua bucket artifacts/static.
- **CloudWatch alarms + SNS `locinsights-ops-alerts`**: ALB 5xx, unhealthy
  hosts, RDS CPU >90%, RDS free storage <2 GB. Langkah ops: subscribe email ke
  topic SNS tersebut.
- **Guard build v13**: keberadaan artifact ML, guard "honest metrics" (grep
  fake metrics = FAIL), syntax-check ml-retrain, guard anti-CARTO tetap.

## Build & deploy
- `deploy/ec2-build-v13-userdata.sh` (template; presigned URL diisi saat build)
- `deploy/agent/main.py` + `deploy/agent/ec2-agent-build.sh` (AgentCore v3)
