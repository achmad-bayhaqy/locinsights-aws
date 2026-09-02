# Data Expansion — Jabodetabek + 38 Provinsi

Pipeline & hasil ekspansi data LocInsights dari Bali-only menjadi cakupan
Indonesia. **Semua update dilakukan langsung ke RDS AWS** (bukan Vercel/Supabase).

## Hasil (RDS produksi)

| Tabel | Sebelum | Sesudah | Sumber |
|---|---|---|---|
| provinces | 1 | 38 | Kemendagri/Permendagri (kode resmi) |
| kabupaten | 17 | 522 | Kemendagri + koordinat OSM + BPS 2024 |
| kecamatan | 57 | 242 | Kemendagri + koordinat OSM |
| kelurahan/desa | 716 | 2.173 | Kemendagri + koordinat OSM |
| stores (MAP/MAA) | 136 | 270 | OSM brand tag (MAP portfolio) |
| competitor_stores | 887 | 2.975 | OSM brand tag (27+ brand) |
| pois | 3.706 | 10.923 | OSM amenity/tourism/office/railway |
| malls | 38 | 369 | OSM shop=mall |
| brands | 116 | 119 | Brand MAP/MAA yg ditemukan di OSM |

## Sumber data (valid & kredibel)

1. **Kode wilayah (hierarki administratif)** — dataset berbasis
   **Kemendagri/Permendagri** (mirror publik `emsifa/api-wilayah-indonesia`).
   Kode lama DKI/Banten dinormalisasi ke kode resmi saat ini
   (`wilayah_normalize.py`, mapping terdokumentasi di dalamnya).
2. **Koordinat admin (kecamatan/kelurahan/kabupaten/provinsi)** —
   **OpenStreetMap**: pusat boundary `admin_level` (relasi), dicocokkan per
   nama (`osm_centers_full.py`, `osm_matched*.json`).
   Fallback deterministik bila OSM belum memetakan boundary (terutama
   kecamatan/kelurahan Kabupaten Bekasi):
   - `derived_kel_centroid` — centroid kelurahan sekabupaten
   - `derived_kec_jitter` — pusat kecamatan + offset deterministik ≤0,9 km
   - `derived_kab_jitter` — pusat kabupaten + offset ≤8 km
   Kolom `source` per baris mencatat lineage secara transparan.
3. **POI / competitor / mall / store** — **OpenStreetMap** (amenity, tourism,
   office, railway, shop=mall, brand tag). Klasifikasi ke enum aplikasi di
   `gen_dataset2.py`. Map portfolio brands (Starbucks, Zara, Sephora, Sogo,
   Sports Station, dll.) diarahkan ke tabel `stores` (MAP = pemegang lisensi),
   sisanya `competitor_stores`.
4. **Populasi & ekonomi** — **BPS**: proyeksi penduduk 2024 per provinsi &
   Jabodetabek (kab/kota), PDRB per kapita. Kelurahan/kecamatan = pro-rata
   terdokumentasi (kolom `source` menyatakan ini) — siap diperkaya via
   pipeline sinkronisasi berikutnya.

## Pipeline

```
wilayah_fetch.py       → unduh kode wilayah (Kemendagri mirror)
wilayah_normalize.py   → 38 provinsi + 514 kab/kota + Jabodetabek (kode resmi)
osm_centers_full.py    → koordinat pusat admin per kab/kota (Overpass, resumable)
build_coords_final.py  → tabel koordinat final + fallback deterministik
osm_poi_fetch.py       → POI/competitor/mall/stores/transit (Overpass)
gen_dataset.py         → tabel statik (provinces..kelurahan) + BPS + indeks
gen_dataset2.py        → POI/competitor/mall/store + indeks turunan + SQL emit
sql/00-09*.sql         → hasil (upsert idempotent ON CONFLICT DO NOTHING)
```

Indeks turunan per kelurahan (dari sinyal nyata):
`income_index` dari PDRB/kapita BPS; `urban_index` dari tipe admin (kota/kab);
`tourist_index` / `transport_index` / `poi_density_index` dari kedekatan POI
OSM (5 km / 5 km / 3 km, Haversine, dinormalisasi 0–100 persentil-95).

## Load ke RDS

`deploy/run-data-load.sh` → ECS one-off task (image web, ada psql) →
unduh SQL dari S3 (presigned) → `psql $DATABASE_URL -v ON_ERROR_STOP=1`.
Idempotent — aman dijalankan ulang.

## Batasan & langkah lanjut

- Populasi kelurahan bersifat pro-rata (belum per-kelurahan BPS).
- ±28 kecamatan & ±460 kelurahan (terutama Kab. Bekasi & Kab. Tangerang)
  memakai koordinat derived — lineage tercatat di kolom `source`; bisa
  diperkaya otomatis via scraper AgentCore.
- `geom` (PostGIS generated) dihitung otomatis oleh database.
