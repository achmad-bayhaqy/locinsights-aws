/**
 * ML Train — Phase 3.
 *
 * POST /api/locinsight/ml/train
 *   body: { n_estimators?, max_depth?, learning_rate?, min_samples_split?, subsample? }
 *   returns: { run_id, model_id, metrics, history, feature_importance }
 *
 * Runs a real gradient-boosted regression training, persists the model JSON
 * in-memory (so the inference route can pick it up on the same Lambda warm
 * instance), and records the run in the TrainingRun table for audit history.
 *
 * IMPORTANT: Vercel serverless has a READ-ONLY filesystem — we must NOT call
 * fs.writeFile outside /tmp. The model artifact is persisted to the DB via
 * the TrainingRun row's metrics/features/hyperparameters/feature_importance
 * columns. The in-memory model cache (src/app/api/locinsight/ml/route.ts)
 * is updated so subsequent predictions on the same warm instance use the new
 * model. A cold instance will fall back to the bundled JSON model.
 *
 * GET /api/locinsight/ml/train — list previous training runs
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { trainGBR, computeFeatureImportance, type GBRModel } from '@/lib/ml/gbr'
import { buildTrainingDataset, FEATURE_NAMES } from '@/lib/ml/dataset'
import { setTrainedModel } from '@/lib/ml/model-cache'
import { requirePermission } from '@/lib/auth-server'
import { setTenantContext, tenantFilter, withTenantId } from '@/lib/tenant-context'

import { requireAuth, requireSuperadmin } from '@/lib/auth-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return auth.response

  let model_id = 'mdl_gbr_revenue_v1'
  let trainDuration = 0
  let datasetSize = 0
  let algoForFailure = 'gbr_regressor'
  let authSession: any = null

  try {
    const auth = await requirePermission('ml', 'create')
    if (!auth.ok) return auth.response
    authSession = auth.session
    await setTenantContext(authSession)

    const body = await req.json().catch(() => ({}))
    const config = {
      n_estimators: body.n_estimators ?? 80,
      max_depth: body.max_depth ?? 3,
      learning_rate: body.learning_rate ?? 0.1,
      min_samples_split: body.min_samples_split ?? 8,
      subsample: body.subsample ?? 1.0,
      noise_seed: body.noise_seed ?? Date.now() % 100000,
    }

    const startTime = Date.now()

    // Build dataset
    const rows = buildTrainingDataset(config.noise_seed)
    datasetSize = rows.length
    const X = rows.map(r => r.X)
    const y = rows.map(r => r.y)

    // Train
    const { model, history } = trainGBR(X, y, [...FEATURE_NAMES], config)
    const featureImportance = computeFeatureImportance(model)

    trainDuration = Date.now() - startTime

    // Persist the model in an in-memory cache so the inference route can use
    // it on subsequent requests (until the Lambda instance is recycled).
    setTrainedModel(model)

    // STEP 1: Upsert the parent MLModel row FIRST so the FK from TrainingRun
    // is satisfiable. (Previously we created TrainingRun first, which broke on
    // fresh DBs where mdl_gbr_revenue_v1 didn't yet exist.)
    await prisma.mLModel.upsert({
      where: { id: model_id },
      create: {
        id: model_id,
        name: 'GBR Revenue Predictor v1',
        version: 'v1.0',
        type: 'revenue_forecast',
        algorithm: 'gbr_regressor',
        description: `Pure-TypeScript Gradient-Boosted Regression (Friedman 2001). Trained on ${rows.length} (kelurahan × brand) synthetic samples with log-normal noise (sigma=0.35). Replaces the heuristic revenue projection with learned model.`,
        features: JSON.stringify(model.feature_names),
        hyperparameters: JSON.stringify({
          n_estimators: model.n_estimators,
          max_depth: model.max_depth,
          learning_rate: model.learning_rate,
        }),
        metrics: JSON.stringify(model.training_metrics),
        status: 'active',
        trained_at: new Date(),
      },
      update: {
        description: `Pure-TypeScript Gradient-Boosted Regression (Friedman 2001). Trained on ${rows.length} (kelurahan × brand) synthetic samples with log-normal noise (sigma=0.35). Replaces the heuristic revenue projection with learned model.`,
        features: JSON.stringify(model.feature_names),
        hyperparameters: JSON.stringify({
          n_estimators: model.n_estimators,
          max_depth: model.max_depth,
          learning_rate: model.learning_rate,
        }),
        metrics: JSON.stringify(model.training_metrics),
        status: 'active',
        trained_at: new Date(),
      },
    })

    // STEP 2: Now safe to create the TrainingRun child row (FK satisfied).
    // Inject tenant_id so each tenant's training history is isolated.
    const trainingRun = await prisma.trainingRun.create({
      data: withTenantId(authSession, {
        model_id,
        model_name: 'GBR Revenue Predictor v1',
        algorithm: 'gbr_regressor',
        status: 'completed',
        dataset_size: rows.length,
        features: JSON.stringify(model.feature_names),
        hyperparameters: JSON.stringify({
          n_estimators: model.n_estimators,
          max_depth: model.max_depth,
          learning_rate: model.learning_rate,
          min_samples_split: config.min_samples_split,
          subsample: config.subsample,
          noise_seed: config.noise_seed,
        }),
        metrics: JSON.stringify(model.training_metrics),
        feature_importance: JSON.stringify(featureImportance),
        // Mark as in-memory since Vercel FS is read-only
        model_artifact_url: 'in-memory://gbr-revenue-bali-v1',
        train_duration_ms: trainDuration,
        finished_at: new Date(),
      }),
    })

    // Update MLModel version stamp with the run id (cosmetic)
    await prisma.mLModel.update({
      where: { id: model_id },
      data: { version: `v1.${trainingRun.id.slice(-4)}` },
    }).catch(() => {/* version stamp is cosmetic; ignore failures */})

    return NextResponse.json({
      success: true,
      run_id: trainingRun.id,
      model_id,
      dataset_size: rows.length,
      train_duration_ms: trainDuration,
      metrics: model.training_metrics,
      feature_importance: featureImportance.slice(0, 10),
      history_sample: history.filter((_, i) => i % 10 === 0 || i === history.length - 1),
      note: 'Model is active in-memory for this server instance. Cold instances will use the bundled baseline model.',
    })
  } catch (e: any) {
    // Record the failed run if we can (for audit history) — but only if the
    // parent MLModel row already exists; otherwise just return the error.
    try {
      await prisma.trainingRun.create({
        data: withTenantId(authSession, {
          model_id,
          model_name: 'GBR Revenue Predictor v1',
          algorithm: algoForFailure as any,
          status: 'failed',
          dataset_size: datasetSize,
          features: '[]',
          hyperparameters: '{}',
          metrics: '{}',
          feature_importance: '[]',
          error: (e?.message || String(e)).slice(0, 500),
          train_duration_ms: trainDuration,
          finished_at: new Date(),
        }),
      })
    } catch { /* parent MLModel may not exist yet; ignore */ }

    return NextResponse.json(
      { success: false, error: e?.message || String(e), stack: e?.stack?.slice(0, 800) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/locinsight/ml/train — list previous training runs
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const auth = await requirePermission('ml', 'read')
    if (!auth.ok) return auth.response
    await setTenantContext(auth.session)

    const sp = req.nextUrl.searchParams
    const limit = Math.min(50, Number(sp.get('limit') || 20))
    const runs = await prisma.trainingRun.findMany({
      where: { OR: [{ tenant_id: null }, tenantFilter(auth.session)] },
      orderBy: { started_at: 'desc' },
      take: limit,
    })
    return NextResponse.json({
      success: true,
      count: runs.length,
      data: runs.map(r => ({
        id: r.id,
        model_name: r.model_name,
        algorithm: r.algorithm,
        status: r.status,
        dataset_size: r.dataset_size,
        metrics: JSON.parse((r.metrics as string) || '{}'),
        train_duration_ms: r.train_duration_ms,
        started_at: r.started_at,
        finished_at: r.finished_at,
        feature_importance: JSON.parse((r.feature_importance as string) || '[]').slice(0, 5),
        error: r.error || null,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
