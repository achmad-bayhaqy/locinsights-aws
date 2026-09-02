'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Brain, Activity, Award, Boxes, Cpu, Play, Loader2, RefreshCw,
  TrendingUp, Zap, History, CheckCircle2, XCircle, GitCompare,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'

interface MLModel {
  id: string
  name: string
  version: string
  type: string
  algorithm: string
  description: string
  features: string
  hyperparameters: string
  metrics: string
  status: string
  trained_at: string
}

interface PredictionRow {
  kelurahan_id: string
  kelurahan_name: string
  kab_name: string
  composite_score: number
  recommendation: string
  heuristic_revenue_juta: number
  ml_revenue_juta: number
  estimated_daily_customers: number
  confidence: number
  top_driving_factors: { feature: string; contribution: number }[]
}

interface FeatureImportance {
  feature: string
  importance: number
  description: string
}

interface TrainingRun {
  id: string
  model_name: string
  algorithm: string
  status: string
  dataset_size: number
  metrics: { rmse?: number; mae?: number; r2?: number; mape?: number }
  train_duration_ms: number | null
  started_at: string
  finished_at: string | null
  feature_importance: { feature: string; importance: number }[]
}

interface Cluster {
  id: number
  name: string
  color: string
  count: number
  members: string[]
}

export function MLAIEngine() {
  const { t } = useLanguage()
  const [tab, setTab] = useState('models')
  const [models, setModels] = useState<MLModel[]>([])
  const [predictions, setPredictions] = useState<PredictionRow[]>([])
  const [featureImportance, setFeatureImportance] = useState<FeatureImportance[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [trainingRuns, setTrainingRuns] = useState<TrainingRun[]>([])
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [modelsRes, fiRes, runsRes] = await Promise.all([
        fetch('/api/locinsight/ml?action=models'),
        fetch('/api/locinsight/ml?action=feature_importance'),
        fetch('/api/locinsight/ml?action=training_runs&limit=20'),
      ])
      const modelsJson = await modelsRes.json()
      const fiJson = await fiRes.json()
      const runsJson = await runsRes.json()

      if (modelsJson.success) setModels(modelsJson.data)
      if (fiJson.success) setFeatureImportance(fiJson.data)
      if (runsJson.success) setTrainingRuns(runsJson.data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadPredictions() {
    try {
      const res = await fetch('/api/locinsight/ml?action=predictions&limit=50')
      const json = await res.json()
      if (json.success) setPredictions(json.data)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function loadClusters() {
    try {
      const res = await fetch('/api/locinsight/ml?action=clusters')
      const json = await res.json()
      // API returns clusters at top level (not under .data)
      const clustersData = json.data?.clusters ?? json.clusters ?? []
      if (json.success) setClusters(clustersData)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function trainModel() {
    setTraining(true)
    try {
      const res = await fetch('/api/locinsight/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Trained in ${json.train_duration_ms}ms — R²=${json.metrics.r2?.toFixed(3)}, RMSE=${json.metrics.rmse?.toFixed(1)}`)
        await loadAll()
      } else {
        toast.error(json.error || 'Training failed')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTraining(false)
    }
  }

  useEffect(() => {
    if (tab === 'predictions' && predictions.length === 0) loadPredictions()
    if (tab === 'clusters' && clusters.length === 0) loadClusters()
  }, [tab])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
            {t('ml.title')}
          </h2>
          <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
            {t('ml.subtitle_full')}
          </p>
        </div>
        <Button onClick={trainModel} disabled={training}>
          {training ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          {training ? t('ml.training_in_progress') : t('ml.train_gbr_ts')}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="models" className="text-[12px]"><Cpu className="w-3 h-3 mr-1" /> {t('ml.tab_models')}</TabsTrigger>
          <TabsTrigger value="predictions" className="text-[12px]"><Brain className="w-3 h-3 mr-1" /> {t('ml.tab_predictions')}</TabsTrigger>
          <TabsTrigger value="importance" className="text-[12px]"><Award className="w-3 h-3 mr-1" /> {t('ml.feature_importance')}</TabsTrigger>
          <TabsTrigger value="clusters" className="text-[12px]"><Boxes className="w-3 h-3 mr-1" /> {t('ml.tab_segments')}</TabsTrigger>
          <TabsTrigger value="training" className="text-[12px]"><History className="w-3 h-3 mr-1" /> {t('ml.tab_training_runs')}</TabsTrigger>
          <TabsTrigger value="ml_lab" className="text-[12px]"><Brain className="w-3 h-3 mr-1" /> {t('ml.tab_ml_lab')}</TabsTrigger>
        </TabsList>

        {/* Models tab */}
        <TabsContent value="models" className="space-y-3">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Card className="bg-[var(--brand-ink)] text-white border-0 rounded-xl shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Brain className="w-8 h-8 text-[var(--brand-red)] flex-shrink-0 mt-1" />
                    <div>
                      <div className="text-[14px] font-bold mb-1">{t('ml.real_ml_title')}</div>
                      <div className="text-[12px] text-white/70 leading-relaxed">
                        {t('ml.real_ml_desc')}
                      </div>
                      <Button size="sm" variant="outline" className="mt-3 bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={trainModel} disabled={training}>
                        {training ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                        {t('ml.retrain_now')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {models.map(m => {
                const metrics = JSON.parse(m.metrics || '{}')
                const features = JSON.parse(m.features || '[]')
                const hp = JSON.parse(m.hyperparameters || '{}')
                return (
                  <Card key={m.id} className="card-premium">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[14px] font-bold text-[var(--brand-ink)]">{m.name}</h3>
                            <Badge variant="outline" className="text-[9px]">{m.version}</Badge>
                            {m.status === 'active' && <Badge className="text-[9px] bg-green-600">{t('ml.active_badge')}</Badge>}
                          </div>
                          <div className="text-[11px] text-[var(--brand-ink)]/60 uppercase tracking-wider">
                            {m.algorithm.replace(/_/g, ' ')} · {m.type.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-[var(--brand-ink)]/50">
                          {t('ml.trained_label')} {new Date(m.trained_at).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-[12px] text-[var(--brand-ink)]/80 leading-relaxed">{m.description}</p>
                      {Object.keys(metrics).length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {Object.entries(metrics).slice(0, 4).map(([k, v]) => (
                            <div key={k} className="bg-[var(--brand-cream)] p-2 rounded">
                              <div className="text-[9px] uppercase tracking-wider text-[var(--brand-ink)]/55">{k}</div>
                              <div className="text-[16px] font-bold text-[var(--brand-ink)] num-tabular">
                                {typeof v === 'number' ? v.toFixed(3) : String(v)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">{t('ml.features_count', { count: features.length })}</div>
                        <div className="flex flex-wrap gap-1">
                          {features.map((f: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] font-mono">{f}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </>
          )}
        </TabsContent>

        {/* Predictions tab */}
        <TabsContent value="predictions" className="space-y-3">
          <Card className="card-premium">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="text-[11px] text-[var(--brand-ink)]/60">
                {t('ml.predictions_desc')}
              </div>
              <Button variant="outline" size="sm" onClick={loadPredictions}>
                <RefreshCw className="w-3 h-3 mr-1" /> {t('common.refresh')}
              </Button>
            </CardContent>
          </Card>

          {predictions.length === 0 ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Card className="card-premium">
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full text-[11.5px]">
                    <thead className="bg-[var(--brand-cream)] sticky top-0">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/70">
                        <th className="p-2">#</th>
                        <th className="p-2">{t('ab.kelurahan_col')}</th>
                        <th className="p-2">{t('ml.kab_short')}</th>
                        <th className="p-2">{t('ml.score')}</th>
                        <th className="p-2">{t('ml.heuristic_rev')}</th>
                        <th className="p-2">{t('ml.ml_rev')}</th>
                        <th className="p-2">{t('ml.conf_short')}</th>
                        <th className="p-2">{t('ml.top_factors')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.map((p, i) => (
                        <tr key={p.kelurahan_id} className="border-t border-[var(--brand-border)]">
                          <td className="p-2 num-tabular text-[var(--brand-ink)]/40">{i + 1}</td>
                          <td className="p-2 font-medium">{p.kelurahan_name}</td>
                          <td className="p-2 text-[10px]">{p.kab_name}</td>
                          <td className="p-2 num-tabular font-bold text-[var(--brand-red)]">{p.composite_score}</td>
                          <td className="p-2 num-tabular">{p.heuristic_revenue_juta} jt</td>
                          <td className="p-2 num-tabular font-bold">
                            {p.ml_revenue_juta !== p.heuristic_revenue_juta ? `${p.ml_revenue_juta} jt` : '—'}
                          </td>
                          <td className="p-2 num-tabular">
                            <Badge variant="outline" className="text-[9px]">{(p.confidence * 100).toFixed(0)}%</Badge>
                          </td>
                          <td className="p-2 text-[10px]">
                            {p.top_driving_factors.slice(0, 2).map((f, j) => (
                              <span key={j} className="inline-block bg-[var(--brand-cream)] px-1.5 py-0.5 rounded mr-1">
                                {f.feature}: {f.contribution}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Feature importance tab */}
        <TabsContent value="importance" className="space-y-3">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : featureImportance.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <Award className="w-8 h-8 mx-auto text-[var(--brand-ink)]/30 mb-3" />
                <div className="text-[14px] text-[var(--brand-ink)]/60">{t('ml.no_model_trained')}</div>
                <Button className="mt-3" onClick={trainModel} disabled={training}>
                  {training ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                  {t('ml.train_model')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-premium">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-[var(--brand-red)]" /> {t('ml.gbr_feature_importance_full')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {featureImportance.map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="font-medium">{f.feature}</span>
                      <span className="num-tabular text-[var(--brand-red)] font-bold">{(f.importance * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-[var(--brand-cream)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${f.importance * 100 / (featureImportance[0]?.importance || 1)}%`,
                          background: i < 3 ? 'var(--brand-red)' : '#D45F4A',
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-[var(--brand-ink)]/55 mt-0.5">{f.description}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Clusters tab */}
        <TabsContent value="clusters" className="space-y-3">
          {clusters.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <Boxes className="w-8 h-8 mx-auto text-[var(--brand-ink)]/30 mb-3" />
                <div className="text-[14px] text-[var(--brand-ink)]/60">{t('ml.no_clusters')}</div>
                <div className="text-[11px] text-[var(--brand-ink)]/40 mt-1">{t('ml.no_clusters_hint')}</div>
                <Button className="mt-3" size="sm" variant="outline" onClick={loadClusters}>
                  <RefreshCw className="w-3 h-3 mr-1" /> {t('common.refresh')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {clusters.map(c => (
                <Card key={c.id} className="card-premium">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[13px] font-bold" style={{ color: c.color }}>{c.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{t('ml.kelurahan_count', { count: c.count })}</Badge>
                    </div>
                    <div className="h-1 rounded-full mb-3" style={{ background: c.color }} />
                    <div className="space-y-0.5">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/55 mb-1">{t('ml.sample_members')}</div>
                      {c.members.map((m, i) => (
                        <div key={i} className="text-[11.5px] text-[var(--brand-ink)]/80">• {m}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Training runs tab */}
        <TabsContent value="training" className="space-y-3">
          <Card className="card-premium">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="text-[11px] text-[var(--brand-ink)]/60">
                {t('ml.training_runs_desc')}
              </div>
              <Button size="sm" onClick={trainModel} disabled={training}>
                {training ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                {t('ml.retrain')}
              </Button>
            </CardContent>
          </Card>

          {trainingRuns.length === 0 ? (
            <Card className="card-premium">
              <CardContent className="py-12 text-center">
                <History className="w-8 h-8 mx-auto text-[var(--brand-ink)]/30 mb-3" />
                <div className="text-[14px] text-[var(--brand-ink)]/60">{t('ml.no_training_runs')}</div>
                <div className="text-[11px] text-[var(--brand-ink)]/40 mt-1">{t('ml.no_training_runs_hint')}</div>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-premium">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <thead className="bg-[var(--brand-cream)]">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/70">
                        <th className="p-2">{t('ml.started')}</th>
                        <th className="p-2">{t('ml.model')}</th>
                        <th className="p-2">{t('ml.algorithm')}</th>
                        <th className="p-2">{t('ml.status')}</th>
                        <th className="p-2">{t('ml.dataset')}</th>
                        <th className="p-2">R²</th>
                        <th className="p-2">RMSE</th>
                        <th className="p-2">MAE</th>
                        <th className="p-2">{t('ml.duration')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingRuns.map(r => (
                        <tr key={r.id} className="border-t border-[var(--brand-border)]">
                          <td className="p-2 text-[10px]">{new Date(r.started_at).toLocaleString()}</td>
                          <td className="p-2 font-medium">{r.model_name}</td>
                          <td className="p-2 text-[10px]">{r.algorithm}</td>
                          <td className="p-2">
                            {r.status === 'completed' ? (
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                            ) : r.status === 'failed' ? (
                              <XCircle className="w-3 h-3 text-red-600" />
                            ) : (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                          </td>
                          <td className="p-2 num-tabular">{r.dataset_size}</td>
                          <td className="p-2 num-tabular font-bold">{r.metrics.r2?.toFixed(3) ?? '—'}</td>
                          <td className="p-2 num-tabular">{r.metrics.rmse?.toFixed(1) ?? '—'}</td>
                          <td className="p-2 num-tabular">{r.metrics.mae?.toFixed(1) ?? '—'}</td>
                          <td className="p-2 num-tabular text-[10px]">{r.train_duration_ms ? `${(r.train_duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ML Lab (Python via HF Space) tab */}
        <TabsContent value="ml_lab" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px] flex items-center gap-2">
                <Brain className="w-4 h-4 text-[var(--brand-red)]" />
                {t('ml.lab_title')}
              </CardTitle>
              <p className="text-[12px] text-[var(--brand-ink)]/60 mt-1">
                {t('ml.lab_desc')}
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border border-[var(--brand-border)] bg-white">
                <iframe
                  src="https://bayhaqy-locinsights-ml.static.hf.space"
                  title="LocInsights ML Lab (Python via Pyodide)"
                  className="w-full"
                  style={{ height: '900px', border: 0 }}
                  loading="lazy"
                  allow="clipboard-read; clipboard-write"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--brand-ink)]/50">
                <span>
                  {t('common.powered_by')} <a href="https://huggingface.co/spaces/Bayhaqy/LocInsights_ml" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-red)] hover:underline">Hugging Face Space</a>
                </span>
                <span>scikit-learn · numpy · Pyodide (WASM)</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
