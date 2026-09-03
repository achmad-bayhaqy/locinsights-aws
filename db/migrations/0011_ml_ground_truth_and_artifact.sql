-- Migration 0011 (ML R4/R5): ground-truth flywheel + model artifact persistence.
--
-- Formalizes the schema changes that power:
--   R4 — ground-truth capture: observed monthly revenue recorded against a
--        persisted prediction (POST /api/locinsight/ml feedback endpoint or
--        the AgentCore agent tool), enabling drift measurement (action=drift)
--        and real-label retraining (scripts/ml-retrain.mjs merges >= 10 actuals).
--   R2 — model artifact persistence: the full serialized GBR model JSON is
--        stored on the completed training run so inference survives cold
--        starts (predict-service loadBestModel reads it with a 2-min TTL).
--
-- Idempotent: safe to re-run.
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS actual_revenue     double precision,
  ADD COLUMN IF NOT EXISTS actual_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note      text;

ALTER TABLE training_runs
  ADD COLUMN IF NOT EXISTS model_artifact jsonb;

-- Drift queries filter "predictions with actuals" frequently.
CREATE INDEX IF NOT EXISTS predictions_actual_idx
  ON predictions (actual_recorded_at)
  WHERE actual_revenue IS NOT NULL;
