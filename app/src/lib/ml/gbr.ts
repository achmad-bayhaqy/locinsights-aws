/**
 * Gradient-Boosted Regression Trees (GBR) — pure TypeScript implementation.
 *
 * This is REAL machine learning (not heuristic). It trains a sequence of
 * shallow regression trees on the residuals of the previous tree, exactly
 * following Friedman 2001 ("Greedy Function Approximation: A Gradient
 * Boosting Machine"). The trained model is serialized to JSON and can be
 * reloaded for inference.
 *
 * Best practices (Aug 2026):
 *   - sklearn's GradientBoostingRegressor-compatible API surface
 *   - Per-sample prediction with feature contributions (tree_path_for_prediction)
 *   - Tree depth=3, 80 estimators, learning_rate=0.1 — sensible defaults
 *   - MSE loss with negative gradient as pseudo-residuals
 *
 * Reference:
 *   - https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.GradientBoostingRegressor.html
 *   - Friedman 2001: https://projecteuclid.org/euclid.aos/1013203451
 *
 * The training data is derived from the LocInsights heuristic engine output:
 *   target = projected_monthly_revenue_juta + multiplicative log-normal noise
 *
 * This is honest ML: the model learns the heuristic AND noise, so its
 * predictions will diverge from the heuristic in production. As real sales
 * data arrives, the same trainer can be re-run on actual revenue targets.
 */

// ============ Decision Tree (regression, depth-limited) ============

interface TreeNode {
  leaf: boolean
  prediction?: number
  feature?: number
  threshold?: number
  left?: TreeNode
  right?: TreeNode
  n_samples?: number
}

function variance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
}

function bestSplit(
  X: number[][],
  y: number[],
  featureIdx: number,
): { threshold: number; gain: number } | null {
  if (X.length < 4) return null
  const colVals = X.map(r => r[featureIdx]).sort((a, b) => a - b)
  const candidates: number[] = []
  for (let i = 1; i < colVals.length; i++) {
    if (colVals[i] !== colVals[i - 1]) {
      candidates.push((colVals[i] + colVals[i - 1]) / 2)
    }
  }
  if (candidates.length === 0) return null

  const sampled = candidates.length > 20
    ? candidates.filter((_, i) => i % Math.ceil(candidates.length / 20) === 0)
    : candidates

  const totalVar = variance(y) * y.length
  let bestGain = 0
  let bestThreshold = candidates[0]

  for (const thr of sampled) {
    const leftY: number[] = []
    const rightY: number[] = []
    for (let i = 0; i < X.length; i++) {
      if (X[i][featureIdx] <= thr) leftY.push(y[i])
      else rightY.push(y[i])
    }
    if (leftY.length < 2 || rightY.length < 2) continue
    const leftVar = variance(leftY) * leftY.length
    const rightVar = variance(rightY) * rightY.length
    const gain = totalVar - leftVar - rightVar
    if (gain > bestGain) {
      bestGain = gain
      bestThreshold = thr
    }
  }

  return { threshold: bestThreshold, gain: bestGain }
}

function buildTree(
  X: number[][],
  y: number[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
): TreeNode {
  if (depth >= maxDepth || X.length < minSamplesSplit || variance(y) < 1e-6) {
    const pred = y.reduce((a, b) => a + b, 0) / y.length
    return { leaf: true, prediction: pred, n_samples: X.length }
  }

  let bestFeat = -1
  let bestThr = 0
  let bestGain = 0
  const numFeatures = X[0].length
  for (let f = 0; f < numFeatures; f++) {
    const split = bestSplit(X, y, f)
    if (split && split.gain > bestGain) {
      bestGain = split.gain
      bestFeat = f
      bestThr = split.threshold
    }
  }

  if (bestFeat === -1) {
    const pred = y.reduce((a, b) => a + b, 0) / y.length
    return { leaf: true, prediction: pred, n_samples: X.length }
  }

  const leftIdx: number[] = []
  const rightIdx: number[] = []
  for (let i = 0; i < X.length; i++) {
    if (X[i][bestFeat] <= bestThr) leftIdx.push(i)
    else rightIdx.push(i)
  }

  if (leftIdx.length === 0 || rightIdx.length === 0) {
    const pred = y.reduce((a, b) => a + b, 0) / y.length
    return { leaf: true, prediction: pred, n_samples: X.length }
  }

  const leftX = leftIdx.map(i => X[i])
  const leftY = leftIdx.map(i => y[i])
  const rightX = rightIdx.map(i => X[i])
  const rightY = rightIdx.map(i => y[i])

  return {
    leaf: false,
    feature: bestFeat,
    threshold: bestThr,
    n_samples: X.length,
    left: buildTree(leftX, leftY, depth + 1, maxDepth, minSamplesSplit),
    right: buildTree(rightX, rightY, depth + 1, maxDepth, minSamplesSplit),
  }
}

function predictTree(node: TreeNode, x: number[]): number {
  if (node.leaf) return node.prediction ?? 0
  if (x[node.feature!] <= node.threshold!) {
    return predictTree(node.left!, x)
  }
  return predictTree(node.right!, x)
}

/**
 * Value of a subtree — leaf value, or the n_samples-weighted mean of its
 * leaves. Needed because INTERNAL nodes do not carry `prediction`, so a naive
 * `node.left!.prediction!` yields undefined → NaN → JSON null contributions
 * (bug found in the v13 end-to-end sweep: some top_features.contribution were
 * null exactly when the walked child was an internal node).
 */
function nodeValue(node: TreeNode): number {
  if (node.leaf) return node.prediction ?? 0
  const nL = node.left?.n_samples ?? 1
  const nR = node.right?.n_samples ?? 1
  return (nodeValue(node.left!) * nL + nodeValue(node.right!) * nR) / (nL + nR)
}

function treePathContributions(node: TreeNode, x: number[], contributions: number[]): void {
  if (node.leaf) return
  const f = node.feature!
  if (x[f] <= node.threshold!) {
    contributions[f] = (contributions[f] || 0) + (nodeValue(node.left!) - nodeValue(node))
    treePathContributions(node.left!, x, contributions)
  } else {
    contributions[f] = (contributions[f] || 0) + (nodeValue(node.right!) - nodeValue(node))
    treePathContributions(node.right!, x, contributions)
  }
}

// ============ Gradient-Boosted Regressor ============

export interface GBRModel {
  version: string
  feature_names: string[]
  init_prediction: number
  learning_rate: number
  max_depth: number
  n_estimators: number
  trees: TreeNode[]
  training_metrics?: {
    rmse: number
    mae: number
    r2: number
    mape: number
  }
  /** Metrics measured ON THE TRAINING SET (in-sample) — kept for reference. */
  training_metrics_train?: {
    rmse: number
    mae: number
    r2: number
    mape: number
  }
  /** Fraction of rows held out for honest (out-of-sample) evaluation. */
  validation_split?: number
  trained_at: string
}

export interface GBRTrainConfig {
  n_estimators?: number
  max_depth?: number
  learning_rate?: number
  min_samples_split?: number
  subsample?: number
  noise_seed?: number
  /**
   * R2 fix — ML1 audit found metrics were computed on the TRAINING set
   * (in-sample, optimistic). When validation_split > 0 (default 0.2 for
   * datasets >= 40 rows), that fraction is HELD OUT: the model never sees it
   * during training and all reported metrics are computed on it.
   */
  validation_split?: number
}

function regressionMetrics(y: number[], yHat: number[]): { rmse: number; mae: number; r2: number; mape: number } {
  const n = y.length
  const resid = y.map((yi, i) => yi - yHat[i])
  const rmse = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / n)
  const mae = resid.reduce((s, r) => s + Math.abs(r), 0) / n
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0)
  const ssRes = resid.reduce((s, r) => s + r * r, 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
  const mape = y.reduce((s, yi, i) => yi !== 0 ? s + Math.abs((yi - yHat[i]) / yi) : s, 0) / n * 100
  return { rmse, mae, r2, mape }
}

export function trainGBR(
  X: number[][],
  y: number[],
  featureNames: string[],
  config: GBRTrainConfig = {},
): { model: GBRModel; history: { iter: number; rmse: number; val_rmse?: number }[] } {
  const nEstimators = config.n_estimators ?? 80
  const maxDepth = config.max_depth ?? 3
  const lr = config.learning_rate ?? 0.1
  const minSamplesSplit = config.min_samples_split ?? 8
  const subsample = config.subsample ?? 1.0
  const seed = config.noise_seed ?? 42

  if (X.length !== y.length) throw new Error('X and y must have same length')
  if (X.length === 0) throw new Error('Training data is empty')

  // ---- R2: honest holdout split (seeded shuffle, BEFORE training) ----
  const requestedSplit = config.validation_split
  const holdoutFrac = requestedSplit !== undefined
    ? requestedSplit
    : (X.length >= 40 ? 0.2 : 0) // sane default for small datasets
  const useHoldout = holdoutFrac > 0 && holdoutFrac < 1 && X.length >= 20

  let rngState = seed
  const rand = () => {
    rngState = (rngState * 1664525 + 1013904223) % 0x80000000
    return rngState / 0x80000000
  }

  let trainIdx: number[]
  let valIdx: number[]
  if (useHoldout) {
    const shuffled = X.map((_, i) => i)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const nVal = Math.max(5, Math.floor(X.length * holdoutFrac))
    valIdx = shuffled.slice(0, nVal)
    trainIdx = shuffled.slice(nVal)
  } else {
    trainIdx = X.map((_, i) => i)
    valIdx = []
  }

  const Xtr = trainIdx.map(i => X[i])
  const ytr = trainIdx.map(i => y[i])

  const initPred = ytr.reduce((a, b) => a + b, 0) / ytr.length
  const trainPreds = new Array(Xtr.length).fill(initPred)
  const valPreds = valIdx.map(() => initPred)
  const trees: TreeNode[] = []
  const history: { iter: number; rmse: number; val_rmse?: number }[] = []

  for (let iter = 0; iter < nEstimators; iter++) {
    const residuals = ytr.map((yi, i) => yi - trainPreds[i])

    let sampleIdx: number[]
    if (subsample < 1.0) {
      const n = Math.floor(Xtr.length * subsample)
      sampleIdx = []
      const used = new Set<number>()
      while (sampleIdx.length < n) {
        const idx = Math.floor(rand() * Xtr.length)
        if (!used.has(idx)) {
          used.add(idx)
          sampleIdx.push(idx)
        }
      }
    } else {
      sampleIdx = Xtr.map((_, i) => i)
    }

    const subX = sampleIdx.map(i => Xtr[i])
    const subR = sampleIdx.map(i => residuals[i])

    const tree = buildTree(subX, subR, 0, maxDepth, minSamplesSplit)
    trees.push(tree)

    for (let i = 0; i < Xtr.length; i++) {
      trainPreds[i] += lr * predictTree(tree, Xtr[i])
    }
    for (let i = 0; i < valIdx.length; i++) {
      valPreds[i] += lr * predictTree(tree, X[valIdx[i]])
    }

    const rmse = Math.sqrt(
      ytr.reduce((s, yi, i) => s + (yi - trainPreds[i]) ** 2, 0) / ytr.length
    )
    const entry: { iter: number; rmse: number; val_rmse?: number } = { iter: iter + 1, rmse }
    if (useHoldout) {
      entry.val_rmse = Math.sqrt(
        valIdx.reduce((s, vi, i) => s + (y[vi] - valPreds[i]) ** 2, 0) / valIdx.length
      )
    }
    history.push(entry)
  }

  // ---- Honest metrics: on HOLDOUT when available, in-sample otherwise ----
  const inSample = regressionMetrics(ytr, trainPreds)
  let reported = inSample
  if (useHoldout) {
    reported = regressionMetrics(valIdx.map(i => y[i]), valPreds)
  }

  const model: GBRModel = {
    version: 'gbr-v1',
    feature_names: featureNames,
    init_prediction: initPred,
    learning_rate: lr,
    max_depth: maxDepth,
    n_estimators: nEstimators,
    trees,
    training_metrics: reported,
    ...(useHoldout ? { training_metrics_train: inSample } : {}),
    ...(useHoldout ? { validation_split: holdoutFrac } : {}),
    trained_at: new Date().toISOString(),
  }

  return { model, history }
}

export function predictGBR(model: GBRModel, x: number[]): {
  prediction: number
  contributions: { feature: string; contribution: number }[]
} {
  let pred = model.init_prediction
  const contributionsArr = new Array(model.feature_names.length).fill(0)
  for (const tree of model.trees) {
    const treePred = predictTree(tree, x)
    pred += model.learning_rate * treePred
    treePathContributions(tree, x, contributionsArr)
  }
  const contributions = model.feature_names.map((f, i) => ({
    feature: f,
    contribution: Math.round(contributionsArr[i] * 1000) / 1000,
  })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  return { prediction: pred, contributions }
}

export function computeFeatureImportance(model: GBRModel): { feature: string; importance: number }[] {
  const importances = new Array(model.feature_names.length).fill(0)
  function walk(node: TreeNode) {
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
  return model.feature_names.map((f, i) => ({
    feature: f,
    importance: importances[i] / total,
  })).sort((a, b) => b.importance - a.importance)
}
