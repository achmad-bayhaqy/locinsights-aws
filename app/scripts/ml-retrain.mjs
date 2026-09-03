/**
 * LocInsights scheduled GBR retraining — R2 (ML improvement plan).
 *
 * Runs as an ECS one-off Fargate task (web image, command override) triggered
 * by EventBridge Scheduler `locinsights-ml-retrain` every 7 days.
 *
 * What it does:
 *   1. Builds the training dataset FROM THE RDS DATABASE (all provinces,
 *      incl. Jabodetabek) — kelurahan × representative brands, spatial
 *      features via PostGIS ST_DWithin (same semantics as the inference
 *      feature builder db-features.ts).
 *   2. Trains the pure-JS Gradient-Boosted Regression (same algorithm as
 *      src/lib/ml/gbr.ts) with an honest 80/20 holdout split.
 *   3. Persists: TrainingRun (completed/failed) + model artifact JSON into
 *      training_runs.model_artifact + MLModel upsert — the running web app
 *      picks it up automatically via predict-service loadBestModel().
 *
 * Self-contained (no imports from the Next.js app) because it runs from the
 * standalone image's /app/scripts directory with only @prisma/client
 * available (same pattern as sync-from-supabase.mjs).
 *
 * Usage: node /app/scripts/ml-retrain.mjs
 * Env:   DATABASE_URL (from task def secrets), RETRAIN_MAX_KELURAHAN (opt),
 *        RETRAIN_N_ESTIMATORS (opt, default 80), RETRAIN_MAX_DEPTH (opt, 3)
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[ml-retrain] DATABASE_URL is required')
  process.exit(1)
}

const MAX_KELURAHAN = Number(process.env.RETRAIN_MAX_KELURAHAN || 1200)
const N_ESTIMATORS = Number(process.env.RETRAIN_N_ESTIMATORS || 80)
const MAX_DEPTH = Number(process.env.RETRAIN_MAX_DEPTH || 3)
const LEARNING_RATE = Number(process.env.RETRAIN_LEARNING_RATE || 0.1)
const VALIDATION_SPLIT = 0.2

const FEATURE_NAMES = [
  'population', 'density', 'urban_index', 'income_index', 'tourist_index',
  'transport_index', 'poi_density_index', 'is_coastal', 'tier',
  'nearest_mall_distance_km', 'nearest_mall_gla_k',
  'same_brand_within_2km', 'other_brand_within_2km', 'map_stores_within_5km',
  'brand_strength', 'typical_size_m2', 'tourist_multiplier',
]

// Representative brands — same selection logic as dataset.ts
const REPRESENTATIVE_BRAND_IDS = ['BR001', 'BR101', 'BR201', 'BR301', 'BR401']

// ============ tiny LCG (same as the app) ============
function makeRng(seed) {
  let s = seed >>> 0 || 42
  return () => {
    s = (s * 1664525 + 1013904223) % 0x80000000
    return s / 0x80000000
  }
}

// ============ regression tree (port of gbr.ts) ============
function variance(vals) {
  if (vals.length === 0) return 0
  const m = vals.reduce((a, b) => a + b, 0) / vals.length
  return vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length
}

function bestSplit(X, y, f) {
  if (X.length < 4) return null
  const colVals = X.map(r => r[f]).sort((a, b) => a - b)
  const candidates = []
  for (let i = 1; i < colVals.length; i++) {
    if (colVals[i] !== colVals[i - 1]) candidates.push((colVals[i] + colVals[i - 1]) / 2)
  }
  if (candidates.length === 0) return null
  const sampled = candidates.length > 20
    ? candidates.filter((_, i) => i % Math.ceil(candidates.length / 20) === 0)
    : candidates
  const totalVar = variance(y) * y.length
  let bestGain = 0
  let bestThr = candidates[0]
  for (const thr of sampled) {
    const leftY = []
    const rightY = []
    for (let i = 0; i < X.length; i++) {
      if (X[i][f] <= thr) leftY.push(y[i])
      else rightY.push(y[i])
    }
    if (leftY.length < 2 || rightY.length < 2) continue
    const gain = totalVar - variance(leftY) * leftY.length - variance(rightY) * rightY.length
    if (gain > bestGain) {
      bestGain = gain
      bestThr = thr
    }
  }
  return { threshold: bestThr, gain: bestGain }
}

function buildTree(X, y, depth, maxDepth, minSamplesSplit) {
  if (depth >= maxDepth || X.length < minSamplesSplit || variance(y) < 1e-6) {
    return { leaf: true, prediction: y.reduce((a, b) => a + b, 0) / y.length, n_samples: X.length }
  }
  let bestFeat = -1
  let bestThr = 0
  let bestGain = 0
  for (let f = 0; f < X[0].length; f++) {
    const split = bestSplit(X, y, f)
    if (split && split.gain > bestGain) {
      bestGain = split.gain
      bestFeat = f
      bestThr = split.threshold
    }
  }
  if (bestFeat === -1) {
    return { leaf: true, prediction: y.reduce((a, b) => a + b, 0) / y.length, n_samples: X.length }
  }
  const leftIdx = []
  const rightIdx = []
  for (let i = 0; i < X.length; i++) {
    if (X[i][bestFeat] <= bestThr) leftIdx.push(i)
    else rightIdx.push(i)
  }
  if (leftIdx.length === 0 || rightIdx.length === 0) {
    return { leaf: true, prediction: y.reduce((a, b) => a + b, 0) / y.length, n_samples: X.length }
  }
  return {
    leaf: false,
    feature: bestFeat,
    threshold: bestThr,
    n_samples: X.length,
    left: buildTree(leftIdx.map(i => X[i]), leftIdx.map(i => y[i]), depth + 1, maxDepth, minSamplesSplit),
    right: buildTree(rightIdx.map(i => X[i]), rightIdx.map(i => y[i]), depth + 1, maxDepth, minSamplesSplit),
  }
}

function predictTree(node, x) {
  let n = node
  while (!n.leaf) n = x[n.feature] <= n.threshold ? n.left : n.right
  return n.prediction ?? 0
}

function regressionMetrics(y, yHat) {
  const n = y.length
  const resid = y.map((yi, i) => yi - yHat[i])
  const rmse = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / n)
  const mae = resid.reduce((s, r) => s + Math.abs(r), 0) / n
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0)
  const ssRes = resid.reduce((s, r) => s + r * r, 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
  const mape = y.reduce((s, yi, i) => (yi !== 0 ? s + Math.abs((yi - yHat[i]) / yi) : s), 0) / n * 100
  return { rmse, mae, r2, mape }
}

function featureImportance(model) {
  const importances = new Array(model.feature_names.length).fill(0)
  function walk(node) {
    if (node.leaf) return
    if (node.feature != null) {
      const left = node.left?.prediction ?? 0
      const right = node.right?.prediction ?? 0
      importances[node.feature] += (left - right) ** 2 * (node.n_samples ?? 1)
    }
    if (node.left) walk(node.left)
    if (node.right) walk(node.right)
  }
  for (const tree of model.trees) walk(tree)
  const total = importances.reduce((a, b) => a + b, 0) || 1
  return FEATURE_NAMES.map((f, i) => ({ feature: f, importance: importances[i] / total }))
    .sort((a, b) => b.importance - a.importance)
}

// ============ main ============
async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const startTime = Date.now()
  let datasetSize = 0

  try {
    console.log('[ml-retrain] step 1/4 — building dataset from DB')
    // Representative brands that actually exist in the DB
    const brands = await prisma.$queryRawUnsafe(`
      SELECT id, name, category::text AS category,
             COALESCE(brand_strength, 0.5) AS brand_strength,
             COALESCE(typical_size_m2, 100) AS typical_size_m2
      FROM brands
      WHERE id = ANY($1::text[])`, REPRESENTATIVE_BRAND_IDS)
    const brandList = brands.length >= 1 ? brands : []
    if (brandList.length === 0) throw new Error('no representative brands found in DB')

    // Kelurahan sample: stratified — everything with a store nearby plus
    // random fill up to MAX_KELURAHAN (keeps training time bounded)
    const kelRows = await prisma.$queryRawUnsafe(`
      SELECT k.id, k.name, k.lat, k.lng, k.tier,
             COALESCE(k.population, 0) AS population,
             COALESCE(NULLIF(k.area_km2, 0), 1) AS area_km2,
             COALESCE(k.urban_index, 50) AS urban_index,
             COALESCE(k.income_index, 50) AS income_index,
             COALESCE(k.tourist_index, 30) AS tourist_index,
             COALESCE(k.transport_index, 50) AS transport_index,
             COALESCE(k.poi_density_index, 30) AS poi_density_index,
             COALESCE(k.is_coastal, false) AS is_coastal,
             COALESCE(store_rank.store_count, 0) AS store_count
      FROM kelurahan k
      LEFT JOIN LATERAL (
        SELECT count(*)::int AS store_count
        FROM stores st
        WHERE ST_DWithin(st.geom, ST_SetSRID(ST_MakePoint(k.lng, k.lat), 4326)::geography, 10000)
      ) store_rank ON true
      ORDER BY store_count DESC, random()
      LIMIT $1`, MAX_KELURAHAN)

    if (kelRows.length < 40) throw new Error(`not enough kelurahan rows (${kelRows.length}) for training`)
    datasetSize = kelRows.length * brandList.length

    // Spatial features in bulk: one query per (kelurahan, brand) is too slow —
    // compute per-kelurahan counts across ALL brands then split by brand_id.
    console.log(`[ml-retrain] step 2/4 — PostGIS features for ${kelRows.length} kelurahan × ${brandList.length} brands`)
    const X = []
    const y = []
    const kelIds = kelRows.map(k => k.id)

    // Bulk feature table: for every sampled kelurahan and brand
    const featRows = await prisma.$queryRawUnsafe(`
      WITH pts AS (
        SELECT k.id AS kel_id, b.brand_id,
               ST_SetSRID(ST_MakePoint(k.lng, k.lat), 4326)::geography AS pt
        FROM kelurahan k
        CROSS JOIN (SELECT unnest($1::text[]) AS brand_id) b
        WHERE k.id = ANY($2::text[])
      ),
      nearest_mall AS (
        SELECT p.kel_id, MIN(m.d_km) AS d_km, MAX(m.gla_m2) AS gla_m2
        FROM pts p
        JOIN LATERAL (
          SELECT ST_Distance(m.geom, p.pt) / 1000.0 AS d_km, m.gla_m2
          FROM malls m WHERE COALESCE(m.gla_m2, 0) > 0
          ORDER BY m.geom <-> p.pt LIMIT 1
        ) m ON true
        GROUP BY p.kel_id
      ),
      store_counts AS (
        SELECT p.kel_id, p.brand_id,
               count(*) FILTER (WHERE st.brand_id = p.brand_id AND ST_DWithin(st.geom, p.pt, 2000))::int AS same_brand,
               count(*) FILTER (WHERE st.brand_id <> p.brand_id AND ST_DWithin(st.geom, p.pt, 2000))::int AS other_brand,
               count(*) FILTER (WHERE ST_DWithin(st.geom, p.pt, 5000))::int AS map_5km
        FROM pts p
        LEFT JOIN stores st ON ST_DWithin(st.geom, p.pt, 5000)
        GROUP BY p.kel_id, p.brand_id
      )
      SELECT pts.kel_id, pts.brand_id,
             COALESCE(nm.d_km, 999) AS nearest_mall_distance_km,
             COALESCE(nm.gla_m2, 0) / 1000.0 AS nearest_mall_gla_k,
             COALESCE(sc.same_brand, 0) AS same_brand,
             COALESCE(sc.other_brand, 0) AS other_brand,
             COALESCE(sc.map_5km, 0) AS map_5km
      FROM pts
      LEFT JOIN nearest_mall nm ON nm.kel_id = pts.kel_id
      LEFT JOIN store_counts sc ON sc.kel_id = pts.kel_id AND sc.brand_id = pts.brand_id`, brandList.map(b => b.id), kelIds)

    const featMap = new Map()
    for (const r of featRows) featMap.set(`${r.kel_id}|${r.brand_id}`, r)

    const rng = makeRng(Math.floor(Date.now() / 1000) % 100000)
    const logNormalNoise = (mean, sigma) => {
      const u1 = Math.max(rng(), 1e-9)
      const u2 = rng()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      return mean * Math.exp(sigma * z)
    }

    for (const kel of kelRows) {
      const density = Math.round(Number(kel.population) / Number(kel.area_km2))
      const tierRaw = String(kel.tier || '')
      const tierNum = tierRaw.includes('tier_') ? Number(tierRaw.replace('tier_', '')) || 2 : 2
      for (const brand of brandList) {
        const f = featMap.get(`${kel.id}|${brand.id}`) || {}
        const touristMultiplier = 1 + (Number(kel.tourist_index) / 100) * 1.5

        // Synthetic target — same semantics as dataset.ts (documented:
        // heuristic + log-normal noise). Real sales replace this once the
        // ground-truth flywheel (R4) accumulates actuals.
        const tradeAreaPop = Number(kel.population) * 1.4
        const category = String(brand.category)
        const conversionRate = category === 'food_beverage' ? 0.02 : category === 'sports' ? 0.005 : 0.008
        const ticketSize = category === 'food_beverage' ? 60 : category === 'sports' ? 700 : 350
        const sameBrand = Number(f.same_brand || 0)
        const map5km = Number(f.map_5km || 0)
        const marketShare = 0.4 / (1 + Math.max(0, map5km) * 0.15 + sameBrand * 0.3)
        const baseRevenue = (tradeAreaPop * conversionRate * marketShare * touristMultiplier * ticketSize * 30) / 1000
        const target = Math.max(0, Math.round(baseRevenue * logNormalNoise(1.0, 0.35)))

        X.push([
          Number(kel.population), density, Number(kel.urban_index), Number(kel.income_index),
          Number(kel.tourist_index), Number(kel.transport_index), Number(kel.poi_density_index),
          kel.is_coastal ? 1 : 0, tierNum,
          Math.round(Number(f.nearest_mall_distance_km || 999) * 10) / 10,
          Math.round(Number(f.nearest_mall_gla_k || 0)),
          sameBrand, Number(f.other_brand || 0), map5km,
          Number(brand.brand_strength), Number(brand.typical_size_m2),
          Math.round(touristMultiplier * 100) / 100,
        ])
        y.push(target)
      }
    }
    datasetSize = X.length
    console.log(`[ml-retrain] dataset rows: ${datasetSize}`)

    console.log('[ml-retrain] step 3/4 — training GBR with 80/20 holdout')
    // ---- holdout split ----
    const shuffled = X.map((_, i) => i)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const nVal = Math.max(5, Math.floor(X.length * VALIDATION_SPLIT))
    const valIdx = shuffled.slice(0, nVal)
    const trainIdx = shuffled.slice(nVal)
    const Xtr = trainIdx.map(i => X[i])
    const ytr = trainIdx.map(i => y[i])
    const valPreds = new Array(valIdx.length).fill(0)
    const trainPreds = new Array(Xtr.length).fill(0)

    const initPred = ytr.reduce((a, b) => a + b, 0) / ytr.length
    for (let i = 0; i < trainPreds.length; i++) trainPreds[i] = initPred
    for (let i = 0; i < valPreds.length; i++) valPreds[i] = initPred

    const trees = []
    for (let iter = 0; iter < N_ESTIMATORS; iter++) {
      const residuals = ytr.map((yi, i) => yi - trainPreds[i])
      const tree = buildTree(Xtr, residuals, 0, MAX_DEPTH, 8)
      trees.push(tree)
      for (let i = 0; i < Xtr.length; i++) trainPreds[i] += LEARNING_RATE * predictTree(tree, Xtr[i])
      for (let i = 0; i < valIdx.length; i++) valPreds[i] += LEARNING_RATE * predictTree(tree, X[valIdx[i]])
      if ((iter + 1) % 20 === 0) {
        const valRmse = Math.sqrt(valIdx.reduce((s, vi, i) => s + (y[vi] - valPreds[i]) ** 2, 0) / valIdx.length)
        console.log(`[ml-retrain] iter ${iter + 1}/${N_ESTIMATORS} val_rmse=${valRmse.toFixed(2)}`)
      }
    }

    const inSample = regressionMetrics(ytr, trainPreds)
    const holdout = regressionMetrics(valIdx.map(i => y[i]), valPreds)
    console.log('[ml-retrain] in-sample :', JSON.stringify(inSample))
    console.log('[ml-retrain] holdout   :', JSON.stringify(holdout))

    const model = {
      version: 'gbr-v1-db',
      feature_names: FEATURE_NAMES,
      init_prediction: initPred,
      learning_rate: LEARNING_RATE,
      max_depth: MAX_DEPTH,
      n_estimators: N_ESTIMATORS,
      trees,
      training_metrics: holdout,
      training_metrics_train: inSample,
      validation_split: VALIDATION_SPLIT,
      trained_at: new Date().toISOString(),
    }
    const featureImportanceOut = featureImportance(model)
    const trainDuration = Date.now() - startTime

    console.log('[ml-retrain] step 4/4 — persisting model artifact to DB')
    await prisma.$executeRawUnsafe(`
      INSERT INTO ml_models (id, name, version, type, algorithm, description, features, hyperparameters, metrics, status, trained_at, created_at, updated_at)
      VALUES ('mdl_gbr_revenue_v1', 'GBR Revenue Predictor v1', 'v1.scheduled', 'revenue_forecast', 'gbr_regressor',
              $1, $2::jsonb, $3::jsonb, $4::jsonb, 'active', NOW(), NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        description = EXCLUDED.description,
        features = EXCLUDED.features,
        hyperparameters = EXCLUDED.hyperparameters,
        metrics = EXCLUDED.metrics,
        status = 'active',
        trained_at = NOW(),
        updated_at = NOW()`,
      `Scheduled retrain (ECS one-off). Pure-TS GBR on DB-backed dataset (${datasetSize} rows, all provinces) with 80/20 holdout.`,
      JSON.stringify(FEATURE_NAMES),
      JSON.stringify({ n_estimators: N_ESTIMATORS, max_depth: MAX_DEPTH, learning_rate: LEARNING_RATE, validation_split: VALIDATION_SPLIT }),
      JSON.stringify({ ...holdout, evaluation: 'holdout', in_sample: inSample }),
    )

    await prisma.$executeRawUnsafe(`
      INSERT INTO training_runs (model_id, model_name, algorithm, status, dataset_size, features, hyperparameters, metrics, feature_importance, model_artifact, model_artifact_url, train_duration_ms, finished_at, started_at)
      VALUES ('mdl_gbr_revenue_v1', 'GBR Revenue Predictor v1', 'gbr_regressor', 'completed', $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, 'db://training_runs/scheduled', $7, NOW(), NOW())`,
      datasetSize,
      JSON.stringify(FEATURE_NAMES),
      JSON.stringify({ n_estimators: N_ESTIMATORS, max_depth: MAX_DEPTH, learning_rate: LEARNING_RATE, validation_split: VALIDATION_SPLIT }),
      JSON.stringify({ ...holdout, evaluation: 'holdout', in_sample: inSample }),
      JSON.stringify(featureImportanceOut),
      JSON.stringify(model),
      trainDuration,
    )

    console.log(`[ml-retrain] DONE in ${trainDuration}ms — model artifact persisted (holdout r2=${holdout.r2.toFixed(3)}, rmse=${holdout.rmse.toFixed(2)})`)
    await prisma.$disconnect()
    process.exit(0)
  } catch (e) {
    console.error('[ml-retrain] FAILED:', e?.message || e)
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO training_runs (model_id, model_name, algorithm, status, dataset_size, features, hyperparameters, metrics, feature_importance, error, train_duration_ms, finished_at, started_at)
        VALUES ('mdl_gbr_revenue_v1', 'GBR Revenue Predictor v1', 'gbr_regressor', 'failed', $1, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, $2, $3, NOW(), NOW())`,
        datasetSize,
        String(e?.message || e).slice(0, 500),
        Date.now() - startTime,
      )
    } catch { /* ml_models FK may not exist yet */ }
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  }
}

main()
