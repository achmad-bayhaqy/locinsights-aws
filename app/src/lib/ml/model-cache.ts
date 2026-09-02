/**
 * In-memory cache for the most recently trained GBR model.
 *
 * On Vercel serverless, the filesystem is READ-ONLY — we can't persist the
 * trained model JSON to disk. Instead, we hold it in this module-level cache
 * so subsequent inference requests on the SAME warm Lambda instance can use
 * the freshly-trained model. When a cold instance spins up, the inference
 * route falls back to the bundled baseline JSON model (prisma/ml-models/).
 *
 * This is intentionally simple — for true cross-instance persistence, write
 * the model artifact to Supabase (e.g. an `ml_model_artifacts` table) and
 * have the inference route load it from there on cold start.
 */
import type { GBRModel } from './gbr'

let trainedModel: GBRModel | null = null
let trainedAt: number | null = null

export function setTrainedModel(model: GBRModel): void {
  trainedModel = model
  trainedAt = Date.now()
}

export function getTrainedModel(): GBRModel | null {
  // Models expire after 15 min (Vercel Lambda instances are typically
  // recycled before this, but it's a safety net for stale predictions).
  if (trainedAt && Date.now() - trainedAt > 15 * 60 * 1000) {
    trainedModel = null
    trainedAt = null
  }
  return trainedModel
}

export function getTrainedModelAge(): number | null {
  return trainedAt ? Date.now() - trainedAt : null
}
