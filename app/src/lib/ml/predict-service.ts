/**
 * ML Prediction Service — R1a + R1c of the ML improvement plan.
 *
 * R1a (self-fetch fix):
 *   analyze/route.ts used to self-fetch `/api/locinsight/ml` over HTTP WITHOUT
 *   forwarding the auth cookie → requireAuth in the sub-request 401'd →
 *   ml_prediction was ALWAYS null in production (silent bug). This service is
 *   an in-process module the routes call directly — no HTTP, no cookies.
 *
 * R1c (persistence):
 *   Predictions are now written to the `predictions` table (target_type=
 *   'kelurahan') with explanation JSON, so ground truth (R4) can be captured
 *   against them later. Persist is opt-out (listing endpoints pass
 *   persist:false to avoid flooding the table).
 *
 * Model loading priority (fixes "in-memory 15 minutes" ML1 finding):
 *   1. In-memory freshly trained model (model-cache.ts)
 *   2. DB artifact — latest completed TrainingRun with model_artifact JSON
 *      (written by /ml/train and the scheduled retrain one-off) — survives
 *      cold starts / new deployments
 *   3. Bundled JSON file (prisma/ml-models/gbr-revenue-bali-v1.json)
 */
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { predictGBR, type GBRModel } from './gbr'
import { buildFeatureVectorFromDB } from './db-features'
import { getTrainedModel } from './model-cache'
import { promises as fs } from 'fs'
import path from 'path'

const MODEL_PATH = path.join(process.cwd(), 'prisma', 'ml-models', 'gbr-revenue-bali-v1.json')

let dbArtifactCache: { model: GBRModel; loadedAt: number } | null = null
const DB_ARTIFACT_TTL_MS = 120_000 // 2 min

/** Module-level flag: parent MLModel row existence is checked once per process. */
let parentModelEnsured = false

async function loadBundledModel(): Promise<GBRModel | null> {
  try {
    const raw = await fs.readFile(MODEL_PATH, 'utf-8')
    return JSON.parse(raw) as GBRModel
  } catch {
    return null
  }
}

async function loadDbArtifactModel(): Promise<GBRModel | null> {
  const now = Date.now()
  if (dbArtifactCache && (now - dbArtifactCache.loadedAt) < DB_ARTIFACT_TTL_MS) {
    return dbArtifactCache.model
  }
  try {
    const run = await prisma.trainingRun.findFirst({
      where: { model_id: 'mdl_gbr_revenue_v1', status: 'completed', model_artifact: { not: Prisma.DbNull } },
      orderBy: { started_at: 'desc' },
    })
    if (!run?.model_artifact) return null
    const raw = typeof run.model_artifact === 'string'
      ? run.model_artifact
      : JSON.stringify(run.model_artifact)
    const model = JSON.parse(raw) as GBRModel
    if (!model?.trees?.length) return null
    dbArtifactCache = { model, loadedAt: now }
    return model
  } catch {
    return null
  }
}

export async function loadBestModel(): Promise<GBRModel | null> {
  const trained = getTrainedModel()
  if (trained) return trained
  const fromDb = await loadDbArtifactModel()
  if (fromDb) return fromDb
  return loadBundledModel()
}

export interface PredictResult {
  ok: boolean
  reason?: 'no_model' | 'no_feature_vector'
  data?: {
    model_name: string
    model_version: string
    predicted_revenue_juta: number
    confidence: number
    brand_used: string
    kelurahan_id: string
    kelurahan_name: string
    feature_source: { kelurahan: 'db' | 'static'; brand: 'db' | 'static' }
    top_features: { feature: string; contribution: number }[]
    persisted: boolean
  }
}

/**
 * Predict monthly revenue (juta IDR) for one kelurahan × brand and optionally
 * persist the result to the `predictions` table for ground-truth tracking.
 */
export async function predictAndPersist(
  kelurahanId: string,
  brandId?: string,
  opts: { persist?: boolean; tenantId?: string | null } = {},
): Promise<PredictResult> {
  const model = await loadBestModel()
  if (!model) return { ok: false, reason: 'no_model' }

  const fv = await buildFeatureVectorFromDB(kelurahanId, brandId, { tenantId: opts.tenantId ?? null })
  if (!fv) return { ok: false, reason: 'no_feature_vector' }

  const { prediction, contributions } = predictGBR(model, fv.X)
  const r2 = model.training_metrics?.r2 ?? 0.5
  const confidence = Math.max(0.3, Math.min(0.95, r2))

  const predicted = Math.max(0, Math.round(prediction))
  const topFeatures = contributions.slice(0, 5)
  const persist = opts.persist !== false

  let persisted = false
  if (persist) {
    try {
      // Dedup: repeated identical requests (user clicking twice, multiple UI
      // widgets) must not flood the predictions table. Skip persist when an
      // identical (model, target, brand) row already exists in the last 60 min.
      const dedupSince = new Date(Date.now() - 60 * 60 * 1000)
      const dup = await prisma.prediction.findFirst({
        where: {
          model_id: 'mdl_gbr_revenue_v1',
          target_id: fv.kelurahan_id,
          created_at: { gte: dedupSince },
          explanation: { string_contains: fv.brand_id },
        },
        select: { id: true },
      })
      if (dup) {
        persisted = true // already recorded — treat as persisted, no new row
      } else {
      // FK requires the parent MLModel row — ensure it exists (idempotent,
      // cached after first success so we don't upsert on every request)
      if (!parentModelEnsured) {
        await prisma.mLModel.upsert({
          where: { id: 'mdl_gbr_revenue_v1' },
          create: {
            id: 'mdl_gbr_revenue_v1',
            name: 'GBR Revenue Predictor v1',
            version: model.version,
            type: 'revenue_forecast',
            algorithm: 'gbr_regressor',
            description: `GBR revenue predictor (auto-ensured by predict-service). Trained ${model.trained_at}.`,
            features: JSON.stringify(model.feature_names),
            hyperparameters: JSON.stringify({
              n_estimators: model.n_estimators,
              max_depth: model.max_depth,
              learning_rate: model.learning_rate,
            }),
            metrics: JSON.stringify(model.training_metrics ?? {}),
            status: 'active',
            trained_at: new Date(),
          },
          update: {},
        })
        parentModelEnsured = true
      }
      await prisma.prediction.create({
        data: {
          model_id: 'mdl_gbr_revenue_v1',
          target_type: 'kelurahan',
          target_id: fv.kelurahan_id,
          target_name: fv.kelurahan_name,
          lat: fv.lat,
          lng: fv.lng,
          prediction: predicted,
          confidence,
          explanation: JSON.stringify({
            top_features: topFeatures,
            brand_used: fv.brand_name,
            brand_id: fv.brand_id,
            model_version: model.version,
            feature_source: { kelurahan: fv.kel_source, brand: fv.brand_source },
            training_metrics: model.training_metrics ?? null,
          }),
          ...(opts.tenantId ? { tenant_id: opts.tenantId } : {}),
        },
      })
      persisted = true
      }
    } catch (e: any) {
      // Persistence is best-effort — never fail the prediction itself
      console.error('[predict-service] persist failed:', e?.message || e)
      persisted = false
    }
  }

  return {
    ok: true,
    data: {
      model_name: 'GBR Revenue Predictor v1',
      model_version: model.version,
      predicted_revenue_juta: predicted,
      confidence: Math.round(confidence * 100) / 100,
      brand_used: fv.brand_name,
      kelurahan_id: fv.kelurahan_id,
      kelurahan_name: fv.kelurahan_name,
      feature_source: { kelurahan: fv.kel_source, brand: fv.brand_source },
      top_features: topFeatures,
      persisted,
    },
  }
}
