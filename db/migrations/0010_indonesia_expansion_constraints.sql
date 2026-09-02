-- Migration 0010 (expansion): drop legacy Bali-only land check constraints.
-- The platform now covers all of Indonesia; app-level Bali geo-validation
-- for the scraper workflow remains (src/lib/data/bali-land.ts).
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_on_bali_land_chk;
ALTER TABLE pois DROP CONSTRAINT IF EXISTS pois_on_bali_land_chk;
ALTER TABLE competitor_stores DROP CONSTRAINT IF EXISTS competitor_on_bali_land_chk;
