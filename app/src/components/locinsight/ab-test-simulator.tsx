'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  GitCompareArrows, Play, Loader2, ArrowUp, ArrowDown, Plus, Minus,
  TrendingUp, Award,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'

interface WeightKey {
  market_potential: number
  accessibility: number
  foot_traffic: number
  competition: number
  socioeconomic: number
  network_synergy: number
}

const DEFAULT_WEIGHTS: WeightKey = {
  market_potential: 0.30,
  accessibility: 0.15,
  foot_traffic: 0.20,
  competition: 0.15,
  socioeconomic: 0.10,
  network_synergy: 0.10,
}

const WEIGHT_LABELS: Record<keyof WeightKey, string> = {
  market_potential: 'ab.market_potential',
  accessibility: 'ab.accessibility',
  foot_traffic: 'ab.foot_traffic',
  competition: 'ab.competition',
  socioeconomic: 'ab.socioeconomic',
  network_synergy: 'ab.network_synergy',
}

interface ABResult {
  weights_a: WeightKey
  weights_b: WeightKey
  a: { top: any[]; stats: any }
  b: { top: any[]; stats: any }
  diff: {
    new_in_top_b: any[]
    dropped_from_top_b: any[]
    rank_changes: any[]
    summary: { total_changes: number; biggest_winner: any; biggest_loser: any }
  }
}

export function ABTestSimulator() {
  const { t } = useLanguage()
  const [weightsA, setWeightsA] = useState<WeightKey>({ ...DEFAULT_WEIGHTS })
  const [weightsB, setWeightsB] = useState<WeightKey>({
    ...DEFAULT_WEIGHTS,
    foot_traffic: 0.25,
    competition: 0.20,
    market_potential: 0.25,
    network_synergy: 0.05,
  })
  const [tier, setTier] = useState<number | undefined>(undefined)
  const [limit, setLimit] = useState(20)
  const [result, setResult] = useState<ABResult | null>(null)
  const [loading, setLoading] = useState(false)

  function sumWeights(w: WeightKey): number {
    return Object.values(w).reduce((a, b) => a + b, 0)
  }

  function runTest() {
    setLoading(true)
    setResult(null)
    fetch('/api/locinsight/ab-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config_a: weightsA,
        config_b: weightsB,
        tier,
        limit,
      }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setResult(j)
          toast.success(`A/B test complete — ${j.diff.summary.total_changes} rank changes`)
        } else {
          toast.error(j.error || 'A/B test failed')
        }
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }

  function resetB() {
    setWeightsB({ ...DEFAULT_WEIGHTS })
  }
  function copyAToB() {
    setWeightsB({ ...weightsA })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
          {t('ab.title_full')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('ab.subtitle_full')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeightCard
          title={t('ab.config_a')}
          color="ink"
          weights={weightsA}
          onChange={setWeightsA}
        />
        <WeightCard
          title={t('ab.config_b')}
          color="red"
          weights={weightsB}
          onChange={setWeightsB}
          onReset={resetB}
          onCopyFromA={copyAToB}
        />
      </div>

      <Card className="card-premium">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60">{t('ab.tier_filter')}</Label>
            <select
              value={tier ?? ''}
              onChange={e => setTier(e.target.value ? Number(e.target.value) : undefined)}
              className="block text-[12px] px-2 py-1.5 border border-[var(--brand-border)] rounded mt-1"
            >
              <option value="">{t('ab.all_tiers')}</option>
              <option value="1">{t('ab.tier_1')}</option>
              <option value="2">{t('ab.tier_2')}</option>
              <option value="3">{t('ab.tier_3')}</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60">{t('ab.top_n')}</Label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="block text-[12px] px-2 py-1.5 border border-[var(--brand-border)] rounded mt-1"
            >
              <option value={10}>{t('ab.top_n_value', { n: 10 })}</option>
              <option value={20}>{t('ab.top_n_value', { n: 20 })}</option>
              <option value={30}>{t('ab.top_n_value', { n: 30 })}</option>
              <option value={50}>{t('ab.top_n_value', { n: 50 })}</option>
            </select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-[11px] text-[var(--brand-ink)]/60">
              {t('ab.sum_a')}: <strong style={{ color: Math.abs(sumWeights(weightsA) - 1) < 0.05 ? 'green' : 'red' }}>{(sumWeights(weightsA) * 100).toFixed(1)}%</strong>
              {' · '}
              {t('ab.sum_b')}: <strong style={{ color: Math.abs(sumWeights(weightsB) - 1) < 0.05 ? 'green' : 'red' }}>{(sumWeights(weightsB) * 100).toFixed(1)}%</strong>
            </div>
            <Button onClick={runTest} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {t('ab.run_test')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {result && (
        <>
          {/* Stats comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StatsCard title={t('ab.config_a_short')} stats={result.a.stats} weights={result.weights_a} color="ink" />
            <StatsCard title={t('ab.config_b_short')} stats={result.b.stats} weights={result.weights_b} color="red" />
          </div>

          {/* Rank changes summary */}
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2">
                <GitCompareArrows className="w-4 h-4 text-[var(--brand-red)]" /> {t('ab.rank_changes_summary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox label={t('ab.total_changes')} value={result.diff.summary.total_changes} />
                <StatBox label={t('ab.new_in_top_b')} value={result.diff.new_in_top_b.length} accent="green" />
                <StatBox label={t('ab.dropped_from_b')} value={result.diff.dropped_from_top_b.length} accent="red" />
                <StatBox label={t('ab.top_n')} value={limit} />
              </div>

              {result.diff.summary.biggest_winner && (
                <div className="mt-3 p-3 bg-green-50 rounded-md border border-green-200">
                  <div className="text-[11px] uppercase tracking-wider text-green-700 font-medium flex items-center gap-1 mb-1">
                    <ArrowUp className="w-3 h-3" /> {t('ab.biggest_winner')}
                  </div>
                  <div className="text-[13px]">
                    <strong>{result.diff.summary.biggest_winner.kelurahan_name}</strong> ({result.diff.summary.biggest_winner.kab_name})
                    <span className="text-[11px] text-green-700 ml-2">
                      Rank #{result.diff.summary.biggest_winner.rank_a} → #{result.diff.summary.biggest_winner.rank_b} (+{result.diff.summary.biggest_winner.delta})
                    </span>
                  </div>
                </div>
              )}
              {result.diff.summary.biggest_loser && (
                <div className="mt-2 p-3 bg-red-50 rounded-md border border-red-200">
                  <div className="text-[11px] uppercase tracking-wider text-red-700 font-medium flex items-center gap-1 mb-1">
                    <ArrowDown className="w-3 h-3" /> {t('ab.biggest_loser')}
                  </div>
                  <div className="text-[13px]">
                    <strong>{result.diff.summary.biggest_loser.kelurahan_name}</strong> ({result.diff.summary.biggest_loser.kab_name})
                    <span className="text-[11px] text-red-700 ml-2">
                      Rank #{result.diff.summary.biggest_loser.rank_a} → #{result.diff.summary.biggest_loser.rank_b} ({result.diff.summary.biggest_loser.delta})
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rank changes table */}
          <Card className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--brand-red)]" /> {t('ab.all_rank_changes')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-[11.5px]">
                  <thead className="bg-[var(--brand-cream)] sticky top-0">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/70">
                      <th className="p-2">{t('ab.kelurahan_col')}</th>
                      <th className="p-2">{t('ab.kabupaten_col')}</th>
                      <th className="p-2">{t('ab.rank_a')}</th>
                      <th className="p-2">{t('ab.rank_b')}</th>
                      <th className="p-2">Δ</th>
                      <th className="p-2">{t('ab.score_a')}</th>
                      <th className="p-2">{t('ab.score_b')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.diff.rank_changes.map((c, i) => (
                      <tr key={i} className="border-t border-[var(--brand-border)]">
                        <td className="p-2 font-medium">{c.kelurahan_name}</td>
                        <td className="p-2">{c.kab_name}</td>
                        <td className="p-2 num-tabular">#{c.rank_a}</td>
                        <td className="p-2 num-tabular">#{c.rank_b}</td>
                        <td className={`p-2 num-tabular font-bold ${c.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {c.delta > 0 ? '+' : ''}{c.delta}
                        </td>
                        <td className="p-2 num-tabular">{c.composite_a}</td>
                        <td className="p-2 num-tabular">{c.composite_b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* New in top / dropped */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="card-premium border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-600" /> {t('ab.new_in_top_b_count', { count: result.diff.new_in_top_b.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 max-h-64 overflow-y-auto">
                {result.diff.new_in_top_b.length === 0 ? (
                  <div className="text-[12px] text-[var(--brand-ink)]/50 py-4 text-center">{t('ab.no_new_entries')}</div>
                ) : (
                  result.diff.new_in_top_b.map((n, i) => (
                    <div key={i} className="py-1.5 border-b border-[var(--brand-border)] last:border-0">
                      <div className="flex items-center justify-between">
                        <strong className="text-[12px]">{n.kelurahan_name}</strong>
                        <Badge variant="outline" className="text-[9px]">#{n.rank_in_b}</Badge>
                      </div>
                      <div className="text-[10px] text-[var(--brand-ink)]/55">{n.kab_name} · {t('ab.score_value', { value: n.composite_b })}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="card-premium border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2">
                  <Minus className="w-4 h-4 text-red-600" /> {t('ab.dropped_from_top_b_count', { count: result.diff.dropped_from_top_b.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 max-h-64 overflow-y-auto">
                {result.diff.dropped_from_top_b.length === 0 ? (
                  <div className="text-[12px] text-[var(--brand-ink)]/50 py-4 text-center">{t('ab.no_dropouts')}</div>
                ) : (
                  result.diff.dropped_from_top_b.map((n, i) => (
                    <div key={i} className="py-1.5 border-b border-[var(--brand-border)] last:border-0">
                      <div className="flex items-center justify-between">
                        <strong className="text-[12px]">{n.kelurahan_name}</strong>
                        <Badge variant="outline" className="text-[9px]">{t('ab.was_rank', { n: n.rank_in_a })}</Badge>
                      </div>
                      <div className="text-[10px] text-[var(--brand-ink)]/55">{n.kab_name} · {t('ab.score_value', { value: n.composite_a })}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function WeightCard({
  title, color, weights, onChange, onReset, onCopyFromA,
}: {
  title: string
  color: 'ink' | 'red'
  weights: WeightKey
  onChange: (w: WeightKey) => void
  onReset?: () => void
  onCopyFromA?: () => void
}) {
  const { t } = useLanguage()
  return (
    <Card className={`card-premium ${color === 'red' ? 'border-l-4 border-l-[var(--brand-red)]' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-[12px] uppercase tracking-wider flex items-center justify-between">
          <span>{title}</span>
          {(onReset || onCopyFromA) && (
            <div className="flex gap-1">
              {onCopyFromA && (
                <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={onCopyFromA}>{t('ab.copy_a')}</Button>
              )}
              {onReset && (
                <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={onReset}>{t('ab.reset')}</Button>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {(Object.keys(weights) as (keyof WeightKey)[]).map(key => (
          <div key={key}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <Label className="font-medium">{t(WEIGHT_LABELS[key])}</Label>
              <span className="num-tabular text-[var(--brand-red)] font-bold">{(weights[key] * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[weights[key] * 100]}
              min={0}
              max={50}
              step={1}
              onValueChange={(v) => onChange({ ...weights, [key]: v[0] / 100 })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function StatsCard({
  title, stats, weights, color,
}: {
  title: string
  stats: any
  weights: WeightKey
  color: 'ink' | 'red'
}) {
  const { t } = useLanguage()
  return (
    <Card className={`card-premium ${color === 'red' ? 'bg-[var(--brand-cream)]' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[12px] uppercase tracking-wider flex items-center gap-2">
          <Award className="w-3 h-3" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 grid grid-cols-2 gap-3 text-[12px]">
        <Stat label={t('ab.avg_composite')} value={stats?.avg_score ?? 0} />
        <Stat label={t('ab.avg_revenue_jt')} value={stats?.avg_revenue ?? 0} />
        <Stat label={t('ab.tier_n_in_top', { n: 1 })} value={stats?.by_tier?.[1] ?? 0} />
        <Stat label={t('ab.tier_n_in_top', { n: 2 })} value={stats?.by_tier?.[2] ?? 0} />
        <Stat label={t('ab.tier_n_in_top', { n: 3 })} value={stats?.by_tier?.[3] ?? 0} />
        <Stat label={t('ab.kabupaten_span')} value={Object.keys(stats?.by_kab ?? {}).length} />
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white p-2 rounded">
      <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60">{label}</div>
      <div className="text-[18px] font-bold text-[var(--brand-ink)] num-tabular">{value}</div>
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: number; accent?: 'green' | 'red' }) {
  const color = accent === 'green' ? 'text-green-600' : accent === 'red' ? 'text-red-600' : 'text-[var(--brand-ink)]'
  return (
    <div className="bg-[var(--brand-cream)] p-3 rounded">
      <div className="text-[10px] uppercase tracking-wider text-[var(--brand-ink)]/60">{label}</div>
      <div className={`text-[28px] font-bold num-tabular ${color}`}>{value}</div>
    </div>
  )
}
