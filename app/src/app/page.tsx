'use client'

/**
 * LocInsights — Public Marketing Landing Page (/)
 *
 * Modern interactive design with red/black/white theme.
 *
 * Sections:
 *   1. Sticky top nav — transparent → solid on scroll
 *   2. Hero — animated gradient + floating stats + dual CTA
 *   3. Live stats strip — animated counters
 *   4. Feature grid — 16 modules with hover effects
 *   5. Workflow — 3-step process with connecting line
 *   6. Pricing — 3 tiers with highlight card
 *   7. Final CTA — gradient banner with arrow
 *   8. Footer
 *
 * Brand palette: red #C8102E + ink #0F0F12 + white #FFFFFF
 * Accent: bright red #E94560 for hover states
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Map, Target, Crosshair, Store, Building2, Shield,
  GitCompareArrows, Brain, FileText, Database, Search, BookOpen, Info,
  Settings as SettingsIcon, FileQuestion,
  ArrowRight, Check, MapPin, TrendingUp, Zap, Globe2, Server, Lock,
  Sparkles, BarChart3, Layers, Workflow, Cloud, ChevronDown, Menu, X,
} from 'lucide-react'

// =====================================================
// Module catalog — 16 modules
// =====================================================
const MODULES = [
  { icon: LayoutDashboard,   name: 'Dashboard',          desc: 'KPI overview & priority heatmap' },
  { icon: Map,               name: 'Map Explorer',       desc: 'Choropleth + 8 layers across 5 region levels' },
  { icon: Target,            name: 'Opportunities',      desc: 'Top expansion sites, composite-scored' },
  { icon: Crosshair,         name: 'Deep Analysis',      desc: 'Per-kelurahan detail with isochrones' },
  { icon: Store,             name: 'Brand Coverage',     desc: 'MAP & MAA portfolio gaps by region' },
  { icon: Building2,         name: 'Mall Network',       desc: 'Anchored-mall analysis + tenant audit' },
  { icon: Shield,            name: 'Competitor Intel',   desc: '833+ competitor stores scraped live from OSM' },
  { icon: GitCompareArrows,  name: 'A/B Simulator',      desc: 'Weight comparison & sensitivity analysis' },
  { icon: Brain,             name: 'ML / AI Engine',     desc: 'Gradient Boosted Regressor for revenue' },
  { icon: FileText,          name: 'Reports',            desc: 'PDF / CSV / JSON export, scheduled' },
  { icon: Database,          name: 'Data Manager',       desc: 'CRUD on stores, malls, brands, POIs' },
  { icon: Search,            name: 'Data Scraper',       desc: 'Auto-scrape OSM POIs into staging tables' },
  { icon: BookOpen,          name: 'Methodology',        desc: 'Scoring framework, math, validation' },
  { icon: FileQuestion,      name: 'Documentation',      desc: 'Searchable guides & API references' },
  { icon: Info,              name: 'About',              desc: 'Project overview & data sources' },
  { icon: SettingsIcon,      name: 'Settings',           desc: 'Per-user AI config & preferences' },
] as const

// =====================================================
// Pricing tiers
// =====================================================
const PRICING = [
  {
    name: 'Managed SaaS',
    tagline: 'Cloud-hosted by LocInsights',
    icon: Cloud,
    highlight: false,
    price: 'Rp 25 jt',
    period: '/ bulan',
    altPrice: 'or Rp 250 jt / tahun (2 months free)',
    blurb: 'Fastest way to go live. We host, monitor, and update the platform; you focus on expansion decisions.',
    features: [
      'All 16 modules, always up-to-date',
      'Multi-tenant with role-based access (6 roles)',
      'Bali region data included (716 villages, 57 kecamatan)',
      'Daily auto-scrape of competitor stores from OSM',
      'Up to 10 users per tenant',
      '10,000 API calls / day',
      'Email support (24h response)',
      '99.5% uptime SLA',
    ],
    cta: 'Start with Managed SaaS',
  },
  {
    name: 'Enterprise On-Premise',
    tagline: 'Your cloud, your control',
    icon: Server,
    highlight: true,
    price: 'Rp 450 jt',
    period: '/ tahun',
    altPrice: 'one-time setup + annual license',
    blurb: 'Deploy LocInsights inside your own VPC. Full source access, custom integrations, unlimited users.',
    features: [
      'Everything in Managed SaaS, plus:',
      'Deploy in your own AWS / Azure / GCP / on-prem',
      'Unlimited users & API calls',
      'Custom region data (Bali + any other province)',
      'White-label: your logo, your colors, your domain',
      'SSO (SAML / OIDC) + audit log export',
      'Dedicated Slack channel + 4h response SLA',
      'Quarterly ML model retraining on your data',
    ],
    cta: 'Talk to Sales',
  },
  {
    name: 'Professional Services',
    tagline: 'Custom build & training',
    icon: Workflow,
    highlight: false,
    price: 'Custom',
    period: '',
    altPrice: 'scoped per engagement',
    blurb: 'Already have a BI stack? We embed LocInsights capabilities into your existing tools, or build bespoke modules.',
    features: [
      'Custom ML model development',
      'Integration with your POS / ERP / CRM',
      'Bespoke choropleth layers (your KPIs, your shapefiles)',
      'On-site training (Jakarta / Bali / Singapore)',
      'Data migration & cleansing',
      'API & SDK development',
      'Quarterly business review',
      'Co-marketing opportunities',
    ],
    cta: 'Request a Quote',
  },
] as const

// =====================================================
// Live stats — for animated counters
// =====================================================
const HERO_STATS = [
  { label: 'Kelurahan Analyzed',    value: 709,  suffix: '+' },
  { label: 'Competitor Stores',     value: 833,  suffix: '+' },
  { label: 'Tracked Brands',        value: 120,  suffix: '+' },
  { label: 'Bali POIs',             value: 2700, suffix: '+' },
]

// =====================================================
// Workflow steps
// =====================================================
const STEPS = [
  {
    num: '01',
    icon: Database,
    title: 'Ingest & Curate',
    desc: 'OSM scraper + BPS government data + human-curated master data on stores, malls, brands, and competitors — all in one PostGIS database with RLS isolation per tenant.',
  },
  {
    num: '02',
    icon: Brain,
    title: 'Score & Forecast',
    desc: '6-factor composite opportunity score (0–100) per kelurahan, plus Gradient-Boosted Regression models trained on actual outlet performance to project monthly revenue, market share, and cannibalization risk.',
  },
  {
    num: '03',
    icon: Target,
    title: 'Decide & Expand',
    desc: 'Interactive choropleth maps, deep-dive per-kelurahan analysis, A/B weight simulator, and PDF/CSV export — everything your expansion team needs to pick the next 100 store locations with confidence.',
  },
] as const

// =====================================================
// Animated counter hook
// =====================================================
function useCountUp(end: number, durationMs = 1500, start = false) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    if (!start) return
    const startTime = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * end))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [end, durationMs, start])
  return count
}

// =====================================================
// Main page
// =====================================================
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  // Sticky nav background on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Intersection observer for stats animation
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setStatsVisible(true)
            obs.disconnect()
          }
        }
      },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-white text-[#0F0F12] antialiased">
      {/* ===================== NAV ===================== */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-lg border-b border-[#0F0F12]/8 shadow-sm py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-105 ${
                scrolled ? 'bg-[#0F0F12]' : 'bg-white/10 backdrop-blur-sm border border-white/20'
              }`}
            >
              <img src="/logo-white.png" alt="LocInsights" className="w-6 h-6 object-contain" />
            </div>
            <span
              className={`font-bold text-[17px] tracking-tight transition-colors ${
                scrolled ? 'text-[#0F0F12]' : 'text-white'
              }`}
            >
              LocInsights
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-7">
            {['Features', 'How it works', 'Pricing'].map(label => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s/g, '-')}`}
                className={`text-[13px] font-medium transition-colors ${
                  scrolled
                    ? 'text-[#0F0F12]/70 hover:text-[#C8102E]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              className="px-5 py-2 rounded-md bg-[#C8102E] hover:bg-[#0F0F12] text-white text-[13px] font-semibold transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
            >
              Sign in
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className={`w-6 h-6 ${scrolled ? 'text-[#0F0F12]' : 'text-white'}`} />
            ) : (
              <Menu className={`w-6 h-6 ${scrolled ? 'text-[#0F0F12]' : 'text-white'}`} />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-[#0F0F12]/8 px-6 py-4 space-y-3">
            {['Features', 'How it works', 'Pricing'].map(label => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s/g, '-')}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-[14px] text-[#0F0F12]/70 hover:text-[#C8102E] font-medium"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              className="block text-center px-5 py-2.5 rounded-md bg-[#C8102E] text-white text-[13px] font-semibold"
            >
              Sign in
            </Link>
          </div>
        )}
      </nav>

      {/* ===================== HERO ===================== */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0F0F12]">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 20% 30%, rgba(200, 16, 46, 0.35) 0%, transparent 50%),' +
              'radial-gradient(ellipse at 80% 70%, rgba(122, 10, 26, 0.45) 0%, transparent 50%),' +
              'linear-gradient(180deg, #0F0F12 0%, #000 100%)',
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating decorative blobs */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-[#C8102E]/20 blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-[#7A0A1A]/30 blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-32 grid lg:grid-cols-12 gap-12 items-center">
          {/* Left: text */}
          <div className="lg:col-span-7">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E94560] animate-pulse" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/70 font-semibold">
                Multi-tenant SaaS · v5.0
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-[44px] sm:text-[56px] lg:text-[68px] xl:text-[76px] font-bold text-white leading-[1.02] tracking-tight mb-6">
              Find your next{' '}
              <span className="relative inline-block">
                <span className="text-[#E94560]">high-potential</span>
                <svg
                  className="absolute -bottom-1 left-0 w-full"
                  viewBox="0 0 300 12"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 9C50 3 150 3 298 9"
                    stroke="#E94560"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <br />
              store location.
            </h1>

            {/* Sub */}
            <p className="text-[16px] lg:text-[18px] text-white/65 leading-relaxed max-w-[560px] mb-9">
              Enterprise-grade location intelligence combining government data, live web data, and
              ML-driven scoring — calibrated to your portfolio and competitive landscape. Multi-tenant,
              role-based, and ready to scale.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 mb-12">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-[#C8102E] hover:bg-[#E94560] text-white text-[14px] font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-[#C8102E]/30 hover:-translate-y-0.5"
              >
                Sign in to dashboard
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/15 text-white text-[14px] font-semibold backdrop-blur-sm transition-all"
              >
                Explore features
                <ChevronDown className="w-4 h-4" />
              </a>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] text-white/45">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> NextAuth + bcrypt
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> RBAC with 6 roles
              </span>
              <span className="flex items-center gap-1.5">
                <Globe2 className="w-3 h-3" /> PostGIS + Supabase
              </span>
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3" /> ML-powered scoring
              </span>
            </div>
          </div>

          {/* Right: floating stat cards */}
          <div className="lg:col-span-5 hidden lg:block">
            <div className="relative h-[480px]">
              {/* Big card */}
              <div className="absolute top-0 right-0 w-72 p-6 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold">
                    Top Opportunity
                  </div>
                  <div className="px-2 py-0.5 rounded bg-[#E94560]/20 text-[#E94560] text-[10px] font-bold">
                    TIER 1
                  </div>
                </div>
                <div className="text-white text-[18px] font-bold mb-1">Kelurahan Kuta</div>
                <div className="text-white/50 text-[11.5px] mb-4">Kuta, Badung, Bali</div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Opportunity Score', value: '94 / 100', pct: 94 },
                    { label: 'Forecasted Revenue', value: 'Rp 287 jt / mo', pct: 78 },
                    { label: 'Market Share', value: '32%', pct: 32 },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between text-[10.5px] text-white/60 mb-1">
                        <span>{s.label}</span>
                        <span className="text-white font-semibold">{s.value}</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#C8102E] to-[#E94560]"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Small card 1 */}
              <div
                className="absolute top-44 left-0 w-52 p-4 rounded-xl bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-2xl animate-[float_4s_ease-in-out_infinite]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md bg-[#C8102E]/20 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-[#E94560]" />
                  </div>
                  <div className="text-[10.5px] text-white/55 uppercase tracking-wider font-semibold">
                    Growth
                  </div>
                </div>
                <div className="text-white text-[22px] font-bold leading-none">+24.6%</div>
                <div className="text-[10.5px] text-white/45 mt-1">vs last quarter</div>
              </div>

              {/* Small card 2 */}
              <div
                className="absolute bottom-8 right-12 w-56 p-4 rounded-xl bg-white/[0.06] backdrop-blur-xl border border-white/10 shadow-2xl animate-[float_5s_ease-in-out_infinite_1s]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md bg-[#C8102E]/20 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-[#E94560]" />
                  </div>
                  <div className="text-[10.5px] text-white/55 uppercase tracking-wider font-semibold">
                    Coverage
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-white">
                  <div>
                    <div className="text-[20px] font-bold leading-none">709</div>
                    <div className="text-[10px] text-white/45 mt-1">Kelurahan</div>
                  </div>
                  <div>
                    <div className="text-[20px] font-bold leading-none">833</div>
                    <div className="text-[10px] text-white/45 mt-1">Competitors</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-[11px] flex flex-col items-center gap-2 animate-bounce">
          <span className="uppercase tracking-[0.2em]">Scroll</span>
          <ChevronDown className="w-4 h-4" />
        </div>

        {/* Float keyframes */}
        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
        `}</style>
      </section>

      {/* ===================== LIVE STATS ===================== */}
      <section ref={statsRef} className="bg-[#0F0F12] border-t border-white/5 py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
            {HERO_STATS.map((s, i) => (
              <StatCounter
                key={s.label}
                label={s.label}
                value={s.value}
                suffix={s.suffix}
                visible={statsVisible}
                delay={i * 120}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section id="features" className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section header */}
          <div className="max-w-2xl mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8102E]/8 text-[#C8102E] text-[11px] uppercase tracking-[0.16em] font-semibold mb-5">
              <Layers className="w-3 h-3" />
              Platform Modules
            </div>
            <h2 className="font-display text-[36px] lg:text-[44px] font-bold text-[#0F0F12] leading-tight tracking-tight mb-5">
              16 modules. One source of truth for{' '}
              <span className="text-[#C8102E]">retail expansion</span>.
            </h2>
            <p className="text-[15px] text-[#0F0F12]/60 leading-relaxed">
              From interactive choropleth maps to ML-powered revenue forecasting, every module is
              designed to shorten the path from data to decision.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MODULES.map((m, i) => {
              const Icon = m.icon
              return (
                <div
                  key={m.name}
                  className="group relative p-6 rounded-xl bg-white border border-[#0F0F12]/8 hover:border-[#C8102E]/30 hover:shadow-xl hover:shadow-[#C8102E]/5 transition-all duration-300 hover:-translate-y-1"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Hover gradient bar */}
                  <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-[#C8102E] to-[#E94560] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="w-11 h-11 rounded-lg bg-[#0F0F12] group-hover:bg-[#C8102E] flex items-center justify-center mb-4 transition-colors duration-300">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-[14.5px] font-bold text-[#0F0F12] mb-1.5">{m.name}</h3>
                  <p className="text-[12.5px] text-[#0F0F12]/55 leading-relaxed">{m.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how-it-works" className="bg-[#F7F4F0] py-24 relative overflow-hidden">
        {/* Decorative shape */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#C8102E]/5 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative">
          {/* Section header */}
          <div className="max-w-2xl mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F0F12] text-white text-[11px] uppercase tracking-[0.16em] font-semibold mb-5">
              <Workflow className="w-3 h-3" />
              The Workflow
            </div>
            <h2 className="font-display text-[36px] lg:text-[44px] font-bold text-[#0F0F12] leading-tight tracking-tight mb-5">
              From raw data to expansion decision in{' '}
              <span className="text-[#C8102E]">three steps</span>.
            </h2>
          </div>

          {/* Steps */}
          <div className="grid lg:grid-cols-3 gap-8 relative">
            {/* Connecting line on lg */}
            <div className="hidden lg:block absolute top-16 left-[16%] right-[16%] h-px bg-gradient-to-r from-[#C8102E]/0 via-[#C8102E]/40 to-[#C8102E]/0" />

            {STEPS.map(step => {
              const Icon = step.icon
              return (
                <div key={step.num} className="relative">
                  {/* Numbered icon */}
                  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0F0F12] text-white mb-6 shadow-xl">
                    <Icon className="w-7 h-7" />
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#C8102E] text-white text-[11px] font-bold flex items-center justify-center border-2 border-[#F7F4F0]">
                      {step.num}
                    </span>
                  </div>

                  <h3 className="text-[20px] font-bold text-[#0F0F12] mb-3">{step.title}</h3>
                  <p className="text-[14px] text-[#0F0F12]/65 leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===================== PRICING ===================== */}
      <section id="pricing" className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C8102E]/8 text-[#C8102E] text-[11px] uppercase tracking-[0.16em] font-semibold mb-5">
              <Zap className="w-3 h-3" />
              Pricing
            </div>
            <h2 className="font-display text-[36px] lg:text-[44px] font-bold text-[#0F0F12] leading-tight tracking-tight mb-5">
              Choose your deployment model.
            </h2>
            <p className="text-[15px] text-[#0F0F12]/60 leading-relaxed">
              From a single tenant in the cloud to a fully white-labeled on-prem installation —
              pick the option that fits your team and scale.
            </p>
          </div>

          {/* Pricing grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {PRICING.map(p => {
              const Icon = p.icon
              return (
                <div
                  key={p.name}
                  className={`relative p-7 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 ${
                    p.highlight
                      ? 'bg-[#0F0F12] border-[#0F0F12] text-white shadow-2xl lg:scale-[1.03]'
                      : 'bg-white border-[#0F0F12]/10 text-[#0F0F12] hover:border-[#C8102E]/40 hover:shadow-xl'
                  }`}
                >
                  {p.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#C8102E] text-white text-[10px] uppercase tracking-[0.16em] font-bold">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        p.highlight ? 'bg-[#C8102E]/20' : 'bg-[#0F0F12]/5'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${p.highlight ? 'text-[#E94560]' : 'text-[#0F0F12]'}`} />
                    </div>
                    <div>
                      <div className={`text-[15px] font-bold ${p.highlight ? 'text-white' : 'text-[#0F0F12]'}`}>
                        {p.name}
                      </div>
                      <div className={`text-[11.5px] ${p.highlight ? 'text-white/55' : 'text-[#0F0F12]/50'}`}>
                        {p.tagline}
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-2">
                    <span className={`text-[36px] font-bold ${p.highlight ? 'text-white' : 'text-[#0F0F12]'}`}>
                      {p.price}
                    </span>
                    {p.period && (
                      <span className={`text-[14px] ${p.highlight ? 'text-white/55' : 'text-[#0F0F12]/50'}`}>
                        {p.period}
                      </span>
                    )}
                  </div>
                  <div className={`text-[11.5px] mb-5 ${p.highlight ? 'text-white/45' : 'text-[#0F0F12]/45'}`}>
                    {p.altPrice}
                  </div>

                  <p className={`text-[13px] leading-relaxed mb-6 ${p.highlight ? 'text-white/70' : 'text-[#0F0F12]/65'}`}>
                    {p.blurb}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-7">
                    {p.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-[12.5px] leading-snug">
                        <Check
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                            p.highlight ? 'text-[#E94560]' : 'text-[#C8102E]'
                          }`}
                        />
                        <span className={p.highlight ? 'text-white/75' : 'text-[#0F0F12]/70'}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href="/login"
                    className={`block text-center px-5 py-3 rounded-md text-[13px] font-semibold transition-all duration-200 ${
                      p.highlight
                        ? 'bg-[#C8102E] hover:bg-[#E94560] text-white hover:shadow-lg hover:shadow-[#C8102E]/30'
                        : 'bg-[#0F0F12] hover:bg-[#C8102E] text-white'
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===================== FINAL CTA ===================== */}
      <section className="bg-[#0F0F12] py-24 relative overflow-hidden">
        {/* Decorative gradient */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(200, 16, 46, 0.25) 0%, transparent 50%),' +
              'radial-gradient(ellipse at 70% 50%, rgba(122, 10, 26, 0.3) 0%, transparent 50%)',
          }}
        />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-7">
            <Sparkles className="w-3 h-3 text-[#E94560]" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/70 font-semibold">
              Ready to start?
            </span>
          </div>

          <h2 className="font-display text-[40px] lg:text-[56px] font-bold text-white leading-tight tracking-tight mb-6">
            Stop guessing.
            <br />
            <span className="text-[#E94560]">Start expanding</span> with confidence.
          </h2>

          <p className="text-[16px] text-white/65 leading-relaxed mb-9 max-w-xl mx-auto">
            Sign in with your demo account and explore the full platform — 709 kelurahan, 833
            competitors, 120+ brands, and ML-powered opportunity scoring.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-md bg-[#C8102E] hover:bg-[#E94560] text-white text-[14px] font-semibold transition-all duration-200 hover:shadow-xl hover:shadow-[#C8102E]/30 hover:-translate-y-0.5"
            >
              Sign in to dashboard
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="https://bayhaqy.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-md bg-white/5 hover:bg-white/10 border border-white/15 text-white text-[14px] font-semibold backdrop-blur-sm transition-all"
            >
              Contact sales
            </a>
          </div>

          {/* Demo accounts */}
          <div className="mt-10 inline-block p-4 rounded-lg bg-white/[0.03] border border-white/10 backdrop-blur-sm">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-white/45 font-semibold mb-2">
              Demo accounts
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] font-mono">
              <span className="text-white/70">
                <span className="text-[#E94560]">admin_map</span> / admin_map
              </span>
              <span className="text-white/70">
                <span className="text-[#E94560]">data_map</span> / data_map
              </span>
              <span className="text-white/70">
                <span className="text-[#E94560]">demo_map</span> / demo_map
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="bg-[#0F0F12] border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
              <img src="/logo-white.png" alt="LocInsights" className="w-5 h-5 object-contain" />
            </div>
            <div className="text-white font-semibold text-[14px]">LocInsights</div>
            <span className="text-white/40 text-[12px] ml-2">Location Intelligence Platform</span>
          </div>
          <div className="text-white/45 text-[12px]">
            © 2026 LocInsights · Built by{' '}
            <a
              href="https://bayhaqy.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-white underline-offset-2 hover:underline"
            >
              Achmad Bayhaqy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// =====================================================
// Stat counter — animates when visible
// =====================================================
function StatCounter({
  label,
  value,
  suffix,
  visible,
  delay = 0,
}: {
  label: string
  value: number
  suffix: string
  visible: boolean
  delay?: number
}) {
  const [start, setStart] = useState(false)
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setStart(true), delay)
      return () => clearTimeout(t)
    }
  }, [visible, delay])
  const count = useCountUp(value, 1800, start)
  return (
    <div className="text-center md:text-left">
      <div className="font-display text-[36px] lg:text-[44px] font-bold text-white leading-none tabular-nums">
        {count.toLocaleString('en-US')}
        <span className="text-[#E94560]">{suffix}</span>
      </div>
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-white/45 mt-2 font-semibold">
        {label}
      </div>
    </div>
  )
}
