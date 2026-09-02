'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Layers, Network, BookOpen, ArrowRight, Database, GitBranch, Target } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-provider'

/**
 * Methodology page — the actual methods, formulas, and models used to produce
 * the results (composite score, market share, revenue projection).
 *
 * Project overview, data sources, tech stack, and capabilities live on the
 * About page (per user request — no duplication).
 *
 * Writing conventions applied (best practices for technical methodology docs):
 *  • Each section opens with a one-sentence thesis, then expands with assumptions,
 *    formula, intuition, and limitations (no orphan paragraphs).
 *  • Mathematical notation uses monospace code blocks for reproducibility.
 *  • Model hyperparameters and decision thresholds are stated explicitly so
 *    analysts can audit and replicate.
 *  • Cross-references to the A/B Simulator and Deep Analysis pages rather than
 *    restating the same content.
 */
export function Methodology() {
  const { t } = useLanguage()
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[24px] font-bold text-[var(--brand-ink)] leading-tight">
          {t('methodology.title')}
        </h2>
        <p className="text-[13px] text-[var(--brand-ink)]/60 mt-0.5">
          {t('methodology.subtitle_full')}
        </p>
      </div>

      <Card className="card-premium bg-[var(--brand-cream)]">
        <CardContent className="p-3 flex items-center gap-2 text-[12px] text-[var(--brand-ink)]/70">
          <BookOpen className="w-4 h-4 text-[var(--brand-red)] flex-shrink-0" />
          <span
            dangerouslySetInnerHTML={{
              __html: t('methodology.see_about_hint', { about: `<strong>${t('methodology.about_link')}</strong>`, ab_simulator: `<strong>${t('methodology.ab_simulator_link')}</strong>` }),
            }}
          />
        </CardContent>
      </Card>

      {/* Methodology Overview / Pipeline */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[var(--brand-red)]" />
            {t('methodology.overview_pipeline')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <p className="text-[13px] text-[var(--brand-ink)]/85 leading-relaxed">
            {t('methodology.overview_desc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <PipelineStep
              step="1"
              title={t('methodology.step1_title')}
              desc={t('methodology.step1_desc')}
            />
            <PipelineStep
              step="2"
              title={t('methodology.step2_title')}
              desc={t('methodology.step2_desc')}
            />
            <PipelineStep
              step="3"
              title={t('methodology.step3_title')}
              desc={t('methodology.step3_desc')}
            />
            <PipelineStep
              step="4"
              title={t('methodology.step4_title')}
              desc={t('methodology.step4_desc')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Composite Score formula */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--brand-red)]" />
            {t('methodology.composite_score_formula')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-[13px] text-[var(--brand-ink)]/85 leading-relaxed">
            {t('methodology.composite_score_desc')}
          </p>

          <div className="bg-[var(--brand-ink)] text-white p-4 rounded-md font-mono text-[11px] leading-relaxed overflow-x-auto">
            <div className="text-white/60">{t('methodology.code_comment_composite')}</div>
            <div>composite_score =</div>
            <div className="pl-4">0.30 × MarketPotential +      <span className="text-[#FFB3B3]">{t('methodology.code_comment_market_potential')}</span></div>
            <div className="pl-4">0.15 × Accessibility +         <span className="text-[#FFB3B3]">{t('methodology.code_comment_accessibility')}</span></div>
            <div className="pl-4">0.20 × FootTraffic +           <span className="text-[#FFB3B3]">{t('methodology.code_comment_foot_traffic')}</span></div>
            <div className="pl-4">0.15 × Competition +           <span className="text-[#FFB3B3]">{t('methodology.code_comment_competition')}</span></div>
            <div className="pl-4">0.10 × Socioeconomic +        <span className="text-[#FFB3B3]">{t('methodology.code_comment_socioeconomic')}</span></div>
            <div className="pl-4">0.10 × NetworkSynergy         <span className="text-[#FFB3B3]">{t('methodology.code_comment_network_synergy')}</span></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            <FactorCard name={t('methodology.factor_market_potential')} weight="30%" desc={t('methodology.factor_market_potential_desc')} />
            <FactorCard name={t('methodology.factor_accessibility')} weight="15%" desc={t('methodology.factor_accessibility_desc')} />
            <FactorCard name={t('methodology.factor_foot_traffic')} weight="20%" desc={t('methodology.factor_foot_traffic_desc')} />
            <FactorCard name={t('methodology.factor_competition')} weight="15%" desc={t('methodology.factor_competition_desc')} />
            <FactorCard name={t('methodology.factor_socioeconomic')} weight="10%" desc={t('methodology.factor_socioeconomic_desc')} />
            <FactorCard name={t('methodology.factor_network_synergy')} weight="10%" desc={t('methodology.factor_network_synergy_desc')} />
          </div>

          <div className="mt-3 p-3 bg-[var(--brand-cream)] rounded-md text-[11.5px] text-[var(--brand-ink)]/80">
            {t('methodology.recommendation_thresholds')}
          </div>
        </CardContent>
      </Card>

      {/* Feature Engineering */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--brand-red)]" />
            {t('methodology.feature_engineering_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-[13px] text-[var(--brand-ink)]/85 leading-relaxed">
            {t('methodology.feature_engineering_desc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11.5px]">
            <FeatureRow name="competitor_density_1km" desc={t('methodology.feature_competitor_density_1km_desc')} />
            <FeatureRow name="competitor_density_3km" desc={t('methodology.feature_competitor_density_3km_desc')} />
            <FeatureRow name="poi_density_1km" desc={t('methodology.feature_poi_density_1km_desc')} />
            <FeatureRow name="mall_distance_m" desc={t('methodology.feature_mall_distance_m_desc')} />
            <FeatureRow name="income_index" desc={t('methodology.feature_income_index_desc')} />
            <FeatureRow name="population_density" desc={t('methodology.feature_population_density_desc')} />
            <FeatureRow name="tourist_index" desc={t('methodology.feature_tourist_index_desc')} />
            <FeatureRow name="transport_index" desc={t('methodology.feature_transport_index_desc')} />
            <FeatureRow name="is_coastal" desc={t('methodology.feature_is_coastal_desc')} />
            <FeatureRow name="is_in_mall" desc={t('methodology.feature_is_in_mall_desc')} />
          </div>
        </CardContent>
      </Card>

      {/* Huff Model */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <Network className="w-4 h-4 text-[var(--brand-red)]" />
            {t('methodology.huff_step_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <p className="text-[13px] text-[var(--brand-ink)]/85 leading-relaxed">
            {t('methodology.huff_desc')}
          </p>

          <div className="bg-[var(--brand-ink)] text-white p-4 rounded-md font-mono text-[11px] leading-relaxed overflow-x-auto">
            <div className="text-white/60">{t('methodology.code_comment_huff')}</div>
            <div>P(customer at zone i visits store j) =</div>
            <div className="pl-4">A_j / d_ij^λ</div>
            <div className="pl-4">─────────────────────</div>
            <div className="pl-4">Σ_k (A_k / d_ik^λ)</div>
            <div className="mt-3 text-white/60">{t('methodology.code_comment_where')}</div>
            <div>A_j = Attractiveness of store j</div>
            <div className="pl-4">= store_size_m² × brand_strength × format_factor × freshness</div>
            <div>d_ij = distance zone i → store j (km, Haversine proxy)</div>
            <div>λ = distance decay (F&B: 1.5, sports: 2.0, fashion: 1.9, dept store: 2.2)</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="bg-[var(--brand-cream)] p-3 rounded-md">
              <div className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 font-medium mb-1">{t('methodology.attractiveness')}</div>
              <div className="text-[12px] text-[var(--brand-ink)]/85">
                {t('methodology.attractiveness_desc')}
              </div>
            </div>
            <div className="bg-[var(--brand-cream)] p-3 rounded-md">
              <div className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 font-medium mb-1">{t('methodology.revenue_projection')}</div>
              <div className="text-[12px] text-[var(--brand-ink)]/85">
                daily_customers = trade_area_pop × conversion_rate × market_share × tourist_multiplier<br />
                monthly_revenue = daily_customers × avg_ticket_size × 30
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GBR */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-[var(--brand-red)]" />
            {t('methodology.gbr_step_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-[13px] text-[var(--brand-ink)]/85 leading-relaxed">
            {t('methodology.gbr_desc1')}
          </p>
          <p className="text-[13px] text-[var(--brand-ink)]/85 leading-relaxed">
            {t('methodology.gbr_desc2')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[var(--brand-cream)] p-3 rounded-md">
              <div className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 font-medium mb-1">{t('methodology.hyperparameters')}</div>
              <div className="text-[12px] text-[var(--brand-ink)]/85 font-mono">
                n_estimators = 80<br />
                max_depth = 3<br />
                learning_rate = 0.1<br />
                subsample = 0.8<br />
                loss = mse
              </div>
            </div>
            <div className="bg-[var(--brand-cream)] p-3 rounded-md">
              <div className="text-[11px] uppercase tracking-wider text-[var(--brand-ink)]/60 font-medium mb-1">{t('methodology.per_prediction_explanation')}</div>
              <div className="text-[12px] text-[var(--brand-ink)]/85">
                {t('methodology.per_prediction_desc')}
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-[var(--brand-cream)] rounded-md text-[11.5px] text-[var(--brand-ink)]/80">
            {t('methodology.ten_canonical_features')}
          </div>
        </CardContent>
      </Card>

      {/* Validation & Limitations */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-[var(--brand-ink)] flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--brand-red)]" />
            {t('methodology.validation_step_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-[13px] text-[var(--brand-ink)]/85 leading-relaxed">
            {t('methodology.validation_desc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[var(--brand-cream)] p-3 rounded-md">
              <div className="text-[12px] font-bold text-[var(--brand-ink)] mb-1">{t('methodology.model_cross_validation')}</div>
              <div className="text-[11px] text-[var(--brand-ink)]/70 leading-snug">
                {t('methodology.model_cross_validation_desc')}
              </div>
            </div>
            <div className="bg-[var(--brand-cream)] p-3 rounded-md">
              <div className="text-[12px] font-bold text-[var(--brand-ink)] mb-1">{t('methodology.data_freshness')}</div>
              <div className="text-[11px] text-[var(--brand-ink)]/70 leading-snug">
                {t('methodology.data_freshness_desc')}
              </div>
            </div>
            <div className="bg-[var(--brand-cream)] p-3 rounded-md">
              <div className="text-[12px] font-bold text-[var(--brand-ink)] mb-1">{t('methodology.known_limitations')}</div>
              <div className="text-[11px] text-[var(--brand-ink)]/70 leading-snug">
                {t('methodology.known_limitations_desc')}
              </div>
            </div>
            <div className="bg-[var(--brand-cream)] p-3 rounded-md">
              <div className="text-[12px] font-bold text-[var(--brand-ink)] mb-1">{t('methodology.ab_weight_tuning')}</div>
              <div className="text-[11px] text-[var(--brand-ink)]/70 leading-snug">
                {t('methodology.ab_weight_tuning_desc')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PipelineStep({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="border border-[var(--brand-border)] rounded-md p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-full bg-[var(--brand-red)] text-white text-[11px] font-bold flex items-center justify-center">{step}</span>
        <span className="text-[12px] font-bold text-[var(--brand-ink)]">{title}</span>
      </div>
      <div className="text-[11px] text-[var(--brand-ink)]/70 leading-snug">{desc}</div>
    </div>
  )
}

function FactorCard({ name, weight, desc }: { name: string; weight: string; desc: string }) {
  return (
    <div className="bg-[var(--brand-cream)] rounded-md p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold text-[var(--brand-ink)]">{name}</span>
        <span className="text-[11px] font-bold text-[var(--brand-red)] num-tabular">{weight}</span>
      </div>
      <div className="text-[11px] text-[var(--brand-ink)]/70 leading-snug">{desc}</div>
    </div>
  )
}

function FeatureRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 py-1 border-b border-[var(--brand-border)]/50">
      <code className="text-[11px] text-[var(--brand-red)] font-mono flex-shrink-0 min-w-[180px]">{name}</code>
      <span className="text-[11px] text-[var(--brand-ink)]/70">{desc}</span>
    </div>
  )
}
