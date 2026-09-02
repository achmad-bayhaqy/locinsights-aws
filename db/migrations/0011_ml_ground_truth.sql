-- 0011: ML ground-truth flywheel + DB model artifacts
-- Context: ML1 audit (Task ML1) — R2/R4 improvements.
--   * training_runs.model_artifact  : full serialized GBR model JSON so the
--     inference route can load the latest trained model across cold starts.
--   * predictions.actual_revenue    : observed monthly revenue (juta IDR) for
--     a persisted prediction (ground truth via POST /api/locinsight/ml).
--   * predictions.actual_recorded_at / decision_note : audit trail.

ALTER TABLE training_runs ADD COLUMN IF NOT EXISTS model_artifact JSONB;

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS actual_revenue DOUBLE PRECISION;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS actual_recorded_at TIMESTAMPTZ;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS decision_note TEXT;

-- Helpful index for drift queries (predictions that have ground truth)
CREATE INDEX IF NOT EXISTS predictions_actual_revenue_idx
  ON predictions (actual_revenue)
  WHERE actual_revenue IS NOT NULL;
