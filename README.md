# LocInsights — AWS Deployment (locinsights-*)

Repository hasil re-engineering & deployment LocInsights ke AWS us-east-1
(account `715841354009`). Dikelola oleh **achmad-bayhaqy**.

> LokInsights = SaaS location intelligence untuk ekspansi retail (Next.js 16 +
> Prisma 6 + NextAuth v4 + PostgreSQL/PostGIS), dengan ML explorer
> PyScript/Pyodide dan AI agent (AWS Bedrock AgentCore + Strands Agents SDK).

## Struktur

```
app/             Source aplikasi web (Next.js 16 App Router, standalone build)
db/              Migrasi SQL 0001–0010 (PostgreSQL 17 + PostGIS) + policies/seeds
ml/              ML explorer statis (PyScript/Pyodide) — S3 + CloudFront
infra/           CloudFormation template infrastruktur (locinsights-*)
data-expansion/  Pipeline & hasil ekspansi data Jabodetabek + 38 provinsi
deploy/          Skrip build & operasi (EC2 build, ECS one-off, CloudFront fix)
docs/            Laporan & dokumentasi operasional
```

## Arsitektur

```
CloudFront (app, WAF, HTTPS) ──► ALB (header gate) ──► ECS Fargate (Next.js standalone)
        │                                                    │
        │                                             RDS PostgreSQL 17 + PostGIS (private subnet)
        └─ CloudFront (ML) ──► S3 (ML explorer statis)
Bedrock AgentCore Runtime (AI agent) ──► ECR locinsights/agentcore
EventBridge Scheduler ──► ECS RunTask (locinsights-sync, data sync harian)
Secrets Manager ──► DATABASE_URL / NEXTAUTH_SECRET / agent-service
```

## Perbaikan kunci (rilis ini)

| # | Masalah | Root cause | Fix |
|---|---------|-----------|-----|
| 1 | Full-page reload tiap ganti menu → chat bot tertutup | Origin Request Policy CloudFront
whitelist header membuang `RSC` / `Next-Router-*` → Next.js menerima HTML utk request RSC →
MPA fallback | Pakai managed `AllViewerExceptHostHeader` (`infra/`) |
| 2 | Reload berulang dari service worker | SW lama meng-cache payload RSC (`?_rsc=`) &
melayani HTML stale | `app/public/sw.js` v4: bypass request RSC/prefetch, network-first
HTML |
| 3 | Chat panel hilang saat reload tak terhindarkan | state `open` hanya di memori |
`sessionStorage` persistence di `ai-chat.tsx` |
| 4 | `SET LOCAL x = $1` ditolak PG (42601) | parameter tak diizinkan di `SET` |
`SELECT set_config(..., false)` di `tenant-context.ts` |
| 5 | Constraint `*_on_bali_land_chk` menolak data luar Bali | era data Bali-only |
`db/migrations/0010_indonesia_expansion_constraints.sql` (drop constraint; geo-validasi Bali
tetap ada di scraper app-level) |

## Ekspansi data (Lihat `data-expansion/README.md`)

Jabodetabek lengkap (14 kab/kota, 185 kecamatan, 1.457 kelurahan/desa, stores,
POI, competitor, mall) + 38 provinsi & 514 kabupaten/kota — sumber: kode
wilayah resmi Kemendagri/Permendagri, OpenStreetMap (koordinat & POI), BPS 2024
(populasi/PDRB). Total ±12.000 baris baru di RDS.

## Operasi

- Build image: `deploy/ec2-build-v7-userdata.sh` (EC2 t3.large ephemeral → ECR `locinsights/web`)
- Deploy: register task def baru → `update-service --force-new-deployment`
- Load data SQL: `deploy/run-data-load.sh` (ECS one-off + psql, file dari S3)
- CloudFront ORP fix: `deploy/fix-cloudfront-orp.py`

## Hardening aktif

- AWS WAF (CommonRuleSet + KnownBadInputs + rate-limit/IP) di kedua distribusi
- RDS: encrypted, deletion protection, backup 7 hari, private subnet
- S3: full public access block; Secrets Manager utk kredensial app
- ALB hanya menerima dari CloudFront prefix-list + secret header

## Catatan lisensi & sumber data

- Kode aplikasi: milik pemilik proyek (Achmad Bayhaqy).
- Data wilayah: Kemendagri/Permendagri (kode resmi).
- Data spasial & POI: © OpenStreetMap contributors (ODbL).
- Statistik: BPS (proyeksi penduduk 2024, PDRB per kapita).
