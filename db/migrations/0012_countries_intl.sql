-- Migration 0012 (international expansion): country rows + scraper centroids.
-- Adds centroid columns used by the scraper for country-level bounding and
-- seeds the 9 supported markets (Indonesia + 8 expansion countries).
-- Idempotent: safe to re-run.

ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS lat       double precision,
  ADD COLUMN IF NOT EXISTS lng       double precision,
  ADD COLUMN IF NOT EXISTS radius_km integer;

INSERT INTO countries (id, name, iso2, iso3, lat, lng, radius_km, created_at, updated_at)
VALUES
  ('ID', 'Indonesia',  'ID', 'IDN', -2.2180, 117.4200, NULL, NOW(), NOW()),
  ('SG', 'Singapore',  'SG', 'SGP',  1.3521, 103.8198,   60, NOW(), NOW()),
  ('MY', 'Malaysia',   'MY', 'MYS',  4.2105, 101.9758,  900, NOW(), NOW()),
  ('TH', 'Thailand',   'TH', 'THA', 15.8700, 100.9925,  900, NOW(), NOW()),
  ('KH', 'Cambodia',   'KH', 'KHM', 12.5657, 104.9910,  350, NOW(), NOW()),
  ('VN', 'Vietnam',    'VN', 'VNM', 14.0583, 108.2772,  800, NOW(), NOW()),
  ('PH', 'Philippines','PH', 'PHL', 12.8797, 121.7740,  900, NOW(), NOW()),
  ('IN', 'India',      'IN', 'IND', 22.3511,  78.6677, 1800, NOW(), NOW()),
  ('AU', 'Australia',  'AU', 'AUS', -25.7329, 134.4896, 2200, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  iso2 = EXCLUDED.iso2,
  iso3 = EXCLUDED.iso3,
  lat  = COALESCE(countries.lat, EXCLUDED.lat),
  lng  = COALESCE(countries.lng, EXCLUDED.lng),
  radius_km = COALESCE(countries.radius_km, EXCLUDED.radius_km),
  updated_at = NOW();
