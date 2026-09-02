#!/usr/bin/env python3
"""Part 2: classify POIs/competitors/malls/stores, assign admin areas,
derive indices, and emit all SQL files."""
import json
import math
import os
import re
import unicodedata

import numpy as np

BASE = "/home/z/my-project/workspace/data-expansion"
OUT = f"{BASE}/clean"
SQL = f"{BASE}/sql"
TENANT = "tnt_map_active_0001"

def q(s):
    if s is None:
        return "NULL"
    s = str(s).replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"

def norm(n):
    n = (n or "").lower().strip()
    for p in ("kabupaten ", "kota ", "kab. ", "kab ", "desa ", "kelurahan ", "kel. ", "kel ", "kecamatan "):
        if n.startswith(p):
            n = n[len(p):].strip()
    return " ".join(n.split())

def slug_id(name, kind):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()[:60]
    return f"{kind}-{s}"


static = json.load(open(f"{OUT}/_gen_static.json"))
kel_rows = json.load(open(f"{OUT}/jabodetabek_kelurahan.json"))
coords = json.load(open(f"{OUT}/coords_final.json"))
brands_db = json.load(open(f"{OUT}/db_brands.json"))
kab_meta = {}  # rebuild light version
import re
def _ptitle(n):
    return "DKI Jakarta" if norm(n)=="dki jakarta" else n.title()
prov_names = {p["code"]: _ptitle(p["name"]) for p in json.load(open(f"{OUT}/provinces_all.json"))}
for r in json.load(open(f"{OUT}/regencies_all.json")):
    kab_meta[r["code"]] = {"name": norm(r["name"]).title(), "province": prov_names[r["province_code"]],
                           "type": "Kota" if r["name"].lower().startswith("kota") else "Kabupaten"}

kec_centers = np.array([[coords["kec"][r["code"]]["lat"], coords["kec"][r["code"]]["lng"]] for r in kel_rows.__class__([r for r in json.load(open(f"{OUT}/jabodetabek_kecamatan.json"))])])
kec_codes = [r["code"] for r in json.load(open(f"{OUT}/jabodetabek_kecamatan.json"))]
kec_by_code = {r["code"]: r for r in json.load(open(f"{OUT}/jabodetabek_kecamatan.json"))}

def nearest_kec(lat, lng):
    d = (kec_centers[:, 0] - lat) ** 2 + (kec_centers[:, 1] - lng) ** 2
    i = int(np.argmin(d))
    return kec_codes[i]


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ================================================================ POIs
CAPS = {
    "school": 2500, "hospital": 600, "university": 300, "market": 600,
    "government": 400, "transit_hub": 120, "stadium": 80, "airport": 10,
    "tourist_attraction": 900, "hotel_cluster": 1300, "beach": 60,
    "temple": 250, "office_cluster": 1500,
}
counts = {k: 0 for k in CAPS}
pois = []
seen = set()

def add_poi(name, ptype, lat, lng, tags):
    if counts[ptype] >= CAPS[ptype]:
        return
    key = (norm(name), round(lat, 3), round(lng, 3))
    if key in seen:
        return
    seen.add(key)
    counts[ptype] += 1
    kid = nearest_kec(lat, lng)
    kec = kec_by_code[kid]
    kab = kab_meta[kec["kabupaten_code"]]
    osm = tags.get("@osmid") or ""
    pois.append({
        "id": f"osm-{ptype}-{osm or slug_id(name,'x')}-{counts[ptype]}",
        "name": name.strip()[:120],
        "type": ptype, "lat": round(lat, 6), "lng": round(lng, 6),
        "kec": kec["name"], "kab": kab["name"], "city": kab["name"],
        "magnitude": 0.0, "source": "OpenStreetMap",
    })

def walk(dataset):
    for el in dataset["elements"]:
        t = el.get("tags", {})
        c = el.get("center")
        if not c and el.get("lat") is not None and el.get("lon") is not None:
            c = {"lat": el["lat"], "lon": el["lon"]}  # nodes carry lat/lon top-level
        nm = t.get("name") or t.get("brand") or t.get("operator")
        if not c or not nm:
            continue
        t["@osmid"] = f"{el['type']}/{el['id']}"
        yield nm, c["lat"], c["lon"], t

for nm, lat, lng, t in walk(json.load(open(f"{OUT}/osm_poi_civic.json"))):
    am = t.get("amenity")
    if am in ("school",):
        add_poi(nm, "school", lat, lng, t)
    elif am in ("hospital", "clinic"):
        add_poi(nm, "hospital", lat, lng, t)
    elif am in ("university", "college"):
        add_poi(nm, "university", lat, lng, t)
    elif am == "marketplace":
        add_poi(nm, "market", lat, lng, t)
    elif am in ("police", "townhall"):
        add_poi(nm, "government", lat, lng, t)
    elif am in ("bus_station", "ferry_terminal"):
        add_poi(nm, "transit_hub", lat, lng, t)

# extra ways/relations: stadium, airport, beach, temple, transit
_extra = json.load(open(f"{OUT}/osm_extra.json")) if os.path.exists(f"{OUT}/osm_extra.json") else {"elements": []}
for nm, lat, lng, t in walk(_extra):
    if t.get("leisure") == "stadium":
        add_poi(nm, "stadium", lat, lng, t)
    elif t.get("aeroway") == "aerodrome":
        add_poi(nm, "airport", lat, lng, t)
    elif t.get("natural") == "beach":
        add_poi(nm, "beach", lat, lng, t)
    elif t.get("amenity") == "place_of_worship":
        add_poi(nm, "temple", lat, lng, t)
    elif t.get("railway") in ("station", "halt") or t.get("station") == "subway":
        add_poi(nm or "Stasiun", "transit_hub", lat, lng, t)

# railway/transit nodes (osm_transit.json if present)
tr = json.load(open(f"{OUT}/osm_transit.json")) if os.path.exists(f"{OUT}/osm_transit.json") else {"elements": []}
for nm, lat, lng, t in walk(tr):
    if t.get("railway") in ("station", "halt") or t.get("station") == "subway":
        add_poi(nm or "Stasiun", "transit_hub", lat, lng, t)

for nm, lat, lng, t in walk(json.load(open(f"{OUT}/osm_poi_tourism.json"))):
    tour = t.get("tourism")
    if tour in ("attraction", "museum"):
        add_poi(nm, "tourist_attraction", lat, lng, t)
    elif tour == "hotel":
        add_poi(nm, "hotel_cluster", lat, lng, t)
    elif t.get("natural") == "beach":
        add_poi(nm, "beach", lat, lng, t)
    elif t.get("amenity") == "place_of_worship" and t.get("religion") in ("buddhist", "hindu"):
        add_poi(nm, "temple", lat, lng, t)

for nm, lat, lng, t in walk(json.load(open(f"{OUT}/osm_poi_office.json"))):
    if t.get("office") in ("company", "government"):
        add_poi(nm, "office_cluster", lat, lng, t)

print("POIs:", len(pois), counts)

# ================================================================ malls
malls_seen = {}
mall_rows = []
for el in json.load(open(f"{OUT}/osm_malls.json"))["elements"]:
    t = el.get("tags", {})
    c = el.get("center")
    if not c and el.get("lat") is not None and el.get("lon") is not None:
        c = {"lat": el["lat"], "lon": el["lon"]}
    nm = t.get("name")
    if not c or not nm:
        continue
    key = norm(nm)
    if key in malls_seen:
        continue
    malls_seen[key] = True
    kid = nearest_kec(c["lat"], c["lon"])
    kec = kec_by_code[kid]
    kab = kab_meta[kec["kabupaten_code"]]
    mid = slug_id(nm, "mall")
    mall_rows.append({
        "id": mid, "name": nm.strip()[:120], "lat": round(c["lat"], 6), "lng": round(c["lon"], 6),
        "kec": kec["name"], "kab": kab["name"], "city": kab["name"],
        "source": "OpenStreetMap (shop=mall)",
    })
print("malls:", len(mall_rows))

# ================================================================ MAP portfolio brands
MAP_BRANDS = {
    "starbucks": ("BR001", "Starbucks", "MAP", "food_beverage"),
    "sports station": ("BR101", "Sports Station", "MAA", "sports"),
    "planet sports": ("BR102", "Planet Sports", "MAA", "sports"),
    "sogo": ("BR201", "Sogo", "MAP", "department_store"),
    "seibu": ("BR202", "SEIBU", "MAP", "department_store"),
    "sephora": ("BR307", "Sephora", "MAP", "beauty"),
    "zara": ("BR204", "Zara", "MAP", "fashion"),
    "bershka": ("bershka", "Bershka", "MAP", "fashion"),
    "stradivarius": ("stradivarius", "Stradivarius", "MAP", "fashion"),
    "massimo dutti": ("massimodutti", "Massimo Dutti", "MAA", "fashion"),
    "galeries lafayette": ("galeries_lafayette", "Galeries Lafayette", "MAP", "department_store"),
    "kidz station": ("kidz_station", "Kidz Station", "MAA", "kids"),
    "the body shop": ("the_body_shop", "The Body Shop", "MAP", "beauty"),
    "muji": ("muji", "MUJI", "MAP", "lifestyle"),
    "cotton on": ("cotton_on", "Cotton On", "MAP", "fashion"),
}
brand_inserts = {v[0]: v for v in MAP_BRANDS.values()}
for bid, nm, parent, cat in brand_inserts.values():
    pass

store_rows = []
store_seen = set()
for el in json.load(open(f"{OUT}/osm_map_stores.json"))["elements"]:
    t = el.get("tags", {})
    c = el.get("center")
    if not c and el.get("lat") is not None and el.get("lon") is not None:
        c = {"lat": el["lat"], "lon": el["lon"]}
    brand_raw = t.get("brand") or ""
    key = norm(brand_raw)
    info = MAP_BRANDS.get(key)
    if not c or not info:
        continue
    nm = t.get("name") or brand_raw
    sid = f"osm-{el['type']}-{el['id']}"
    if sid in store_seen:
        continue
    store_seen.add(sid)
    kid = nearest_kec(c["lat"], c["lon"])
    kec = kec_by_code[kid]
    kab = kab_meta[kec["kabupaten_code"]]
    mall_ref = None
    store_rows.append({
        "id": sid, "brand_id": info[0], "brand_name": info[1], "brand_category": info[3],
        "parent": info[2], "name": nm.strip()[:120],
        "lat": round(c["lat"], 6), "lng": round(c["lon"], 6),
        "kec": kec["name"], "kab": kab["name"], "city": kab["name"],
        "source": "OpenStreetMap (brand tag)",
    })
print("stores:", len(store_rows))

# ================================================================ competitors
COMP_MAP = {
    "indomaret": ("Indomaret", "convenience_store"), "alfamart": ("Alfamart", "convenience_store"),
    "alfa express": ("Alfa Express", "convenience_store"), "circle k": ("Circle K", "convenience_store"),
    "lawson": ("Lawson", "convenience_store"), "familymart": ("FamilyMart", "convenience_store"),
    "dan.dan": ("Dan+Dan", "convenience_store"), "dandan": ("Dan+Dan", "convenience_store"),
    "superindo": ("Superindo", "supermarket"), "lotte mart": ("Lotte Mart", "supermarket"),
    "hypermart": ("Hypermart", "supermarket"), "ranch market": ("Ranch Market", "supermarket"),
    "grand lucky": ("Grand Lucky", "supermarket"), "farmers market": ("Farmers Market", "supermarket"),
    "fresh market": ("Fresh Market", "supermarket"), "primo": ("Primo", "supermarket"),
    "guardian": ("Guardian", "pharmacy"), "century": ("Century", "pharmacy"),
    "k-24": ("K-24", "pharmacy"), "kimia varma": ("Kimia Farma", "pharmacy"),
    "watsons": ("Watsons", "beauty"), "mcdonald": ("McDonald's", "fast_food"),
    "mcdonald's": ("McDonald's", "fast_food"), "kfc": ("KFC", "fast_food"),
    "wendy": ("Wendy's", "fast_food"), "burger king": ("Burger King", "fast_food"),
    "texas chicken": ("Texas Chicken", "fast_food"), "a&w": ("A&W", "fast_food"),
    "excelso": ("Excelso", "coffee"), "kopi kenangan": ("Kopi Kenangan", "coffee"),
    "janji jiwa": ("Janji Jiwa", "coffee"), "fore": ("Fore", "coffee"),
    "tomoro": ("Tomoro", "coffee"), "point coffee": ("Point Coffee", "coffee"),
    "j.co": ("J.CO", "coffee"), "jco": ("J.CO", "coffee"), "j.co donuts": ("J.CO", "coffee"),
    "decathlon": ("Decathlon", "sports"),
    "uniqlo": ("Uniqlo", "fashion"), "h&m": ("H&M", "fashion"), "hnm": ("H&M", "fashion"),
    "miniso": ("Miniso", "fashion"),
}
comp_rows = []
comp_seen = set()
for el in json.load(open(f"{OUT}/osm_competitors.json"))["elements"]:
    t = el.get("tags", {})
    c = el.get("center")
    if not c and el.get("lat") is not None and el.get("lon") is not None:
        c = {"lat": el["lat"], "lon": el["lon"]}
    brand_raw = t.get("brand") or ""
    info = COMP_MAP.get(norm(brand_raw))
    if not c or not info:
        continue
    if norm(brand_raw) in MAP_BRANDS:  # MAP portfolio → stores, not competitors
        continue
    sid = f"osm-{el['type']}-{el['id']}"
    if sid in comp_seen:
        continue
    comp_seen.add(sid)
    kid = nearest_kec(c["lat"], c["lon"])
    kec = kec_by_code[kid]
    kab = kab_meta[kec["kabupaten_code"]]
    nm = t.get("name") or brand_raw
    comp_rows.append({
        "id": sid, "brand_name": info[0], "brand_category": info[1], "name": nm.strip()[:120],
        "lat": round(c["lat"], 6), "lng": round(c["lon"], 6),
        "kec": kec["name"], "kab": kab["name"], "city": kab["name"],
        "source": "osm", "source_url": f"https://www.openstreetmap.org/{el['type']}/{el['id']}",
    })
print("competitors:", len(comp_rows))

# ================================================================ kelurahan indices (POI-derived)
poi_lats = np.array([p["lat"] for p in pois])
poi_lngs = np.array([p["lng"] for p in pois])
poi_types = np.array([p["type"] for p in pois])

def count_within(lat, lng, types, radius_km):
    if len(poi_lats) == 0:
        return 0
    # bbox prefilter
    dlat = radius_km / 110.574
    dlng = radius_km / (111.32 * math.cos(math.radians(lat)) + 1e-9)
    m = (np.abs(poi_lats - lat) < dlat) & (np.abs(poi_lngs - lng) < dlng)
    if types is not None:
        m &= np.isin(poi_types, types)
    idx = np.where(m)[0]
    n = 0
    for i in idx:
        if haversine_km(lat, lng, poi_lats[i], poi_lngs[i]) <= radius_km:
            n += 1
    return n

kel_static = static["kel"]  # rows as lists
tourist_types = ("tourist_attraction", "beach", "temple", "hotel_cluster")
transit_types = ("transit_hub", "airport")
tn, tt, pn = [], [], []
for row in kel_static:
    lat, lng = row[7], row[8]
    tn.append(count_within(lat, lng, tourist_types, 5.0))
    tt.append(count_within(lat, lng, transit_types, 5.0))
    pn.append(count_within(lat, lng, None, 3.0))

def normalize100(vals, lo=None, hi=None):
    a = np.array(vals, dtype=float)
    h = hi if hi is not None else max(a.max(), 1)
    l = lo if lo is not None else 0
    out = (a - l) / max(h - l, 1e-9) * 100
    return np.clip(np.round(out), 0, 100).astype(int)

tour_idx = normalize100(tn, hi=max(np.percentile(tn, 95), 4))
trans_idx = normalize100(tt, hi=max(np.percentile(tt, 95), 3))
poi_idx = normalize100(pn, hi=max(np.percentile(pn, 95), 8))

kel_sql_rows = []
for i, row in enumerate(kel_static):
    code, name, kec_code, kec_name, kab_code, kab_name, prov, lat, lng, pop, area, income, urban, src = row
    coastal = kab_code in ("3171", "3176", "3216", "3275", "3603", "3671")
    density = int(round(pop / area)) if (pop and area) else None
    kel_sql_rows.append(
        f"({q(code)}, {q(code)}, {q(name)}, {q(kec_code)}, {q(kec_name)}, {q(kab_code)}, {q(kab_name)}, "
        f"{q(prov)}, {q('Indonesia')}, {q(kab_name)}, NULL, {lat!r}, {lng!r}, {pop}, NULL, {density if density is not None else 'NULL'}, "
        f"{int(urban)}, {int(income) if income is not None else 'NULL'}, {int(tour_idx[i])}, "
        f"{int(trans_idx[i])}, {int(poi_idx[i])}, {str(coastal).lower()}, {q(src)})")

# ================================================================ emit SQL
def write_sql(fname, header, values, onconflict):
    path = f"{SQL}/{fname}"
    with open(path, "w") as f:
        for chunk_start in range(0, len(values), 200):
            chunk = values[chunk_start:chunk_start + 200]
            f.write(header)
            f.write(",\n".join(chunk) + f"\n{onconflict}\n\n")
    print("wrote", path, len(values), "rows")

write_sql("01_provinces.sql",
    "-- Provinces (38, official Permendagri codes; Bali untouched via DO NOTHING)\n"
    "INSERT INTO provinces (code, name, lat, lng, area_km2, population) VALUES\n",
    static["prov"], "ON CONFLICT (code) DO NOTHING;")

write_sql("02_kabupaten.sql",
    "-- Kabupaten/Kota (514; existing Bali rows untouched)\n"
    "INSERT INTO kabupaten (code, name, type, capital, province_code, province, country, city, lat, lng, area_km2, population_2024, population_density, gdrp_per_capita_juta, tier, hdmi_2024, tourist_hotels, source) VALUES\n",
    static["kab"], "ON CONFLICT (code) DO NOTHING;")

write_sql("03_kecamatan.sql",
    "-- Kecamatan Jabodetabek (185)\n"
    "INSERT INTO kecamatan (code, name, kabupaten_code, province, country, city, lat, lng, population_2024, area_km2, tier, urban_score, is_capital, source) VALUES\n",
    static["kec"], "ON CONFLICT (code) DO NOTHING;")

write_sql("04_kelurahan.sql",
    "-- Kelurahan/Desa Jabodetabek (1457) with derived indices\n"
    "INSERT INTO kelurahan (id, code, name, kec_code, kec_name, kab_code, kab_name, province, country, city, tier, lat, lng, population, area_km2, density, urban_index, income_index, tourist_index, transport_index, poi_density_index, is_coastal, source) VALUES\n",
    kel_sql_rows, "ON CONFLICT (id) DO NOTHING;")

brand_vals = [
    f"({q(bid)}, {q(nm)}, {q(parent)}::brand_parent_enum, {q(cat)}::brand_category_enum, 'Indonesia', "
    f"NULL, 'both'::location_format_enum, 0, '', 0.5, '', {q('Jabodetabek')}, 'OpenStreetMap/brand audit', true)"
    for bid, nm, parent, cat in brand_inserts.values()
]
write_sql("05_brands.sql",
    "-- New MAP/MAA portfolio brands referenced by OSM outlets\n"
    "INSERT INTO brands (id, name, parent, category, origin_country, format, location_preference, typical_size_m2, target_audience, brand_strength, notes, city, source, is_active) VALUES\n",
    brand_vals, "ON CONFLICT (id) DO NOTHING;")

mall_vals = [
    f"({q(m['id'])}, {q(m['name'])}, {m['lat']!r}, {m['lng']!r}, {q(m['kec'])}, {q(m['kab'])}, {q(m['city'])}, "
    f"{q('Indonesia')}, 0, NULL, 'regional'::mall_class_enum, 0, false, false, false, 0, '', {q(m['source'])})"
    for m in mall_rows
]
write_sql("06_malls.sql",
    "-- Jabodetabek malls (OSM shop=mall)\n"
    "INSERT INTO malls (id, name, lat, lng, kec, kab, city, country, gla_m2, opened_year, class, anchor_count, has_cinema, has_supermarket, has_department_store, visitor_estimate_daily, notes, source) VALUES\n",
    mall_vals, "ON CONFLICT (id) DO NOTHING;")

store_vals = [
    f"({q(s['id'])}, {q(s['brand_id'])}, {q(s['brand_name'])}, {q(s['brand_category'])}::brand_category_enum, "
    f"{q(s['parent'])}::brand_parent_enum, {q(s['name'])}, {s['lat']!r}, {s['lng']!r}, {q(s['kec'])}, {q(s['kab'])}, "
    f"{q(s['city'])}, {q('Indonesia')}, false, NULL, NULL, {q(s['address'] if s.get('address') else '')}, NULL, 0, false, {q(s['source'])})"
    for s in store_rows
]
write_sql("07_stores.sql",
    "-- MAP/MAA brand outlets in Jabodetabek (OSM brand tags)\n"
    f"UPDATE stores SET tenant_id = '{TENANT}' WHERE tenant_id IS NULL;\n"
    "INSERT INTO stores (id, brand_id, brand_name, brand_category, parent, name, lat, lng, kec, kab, city, country, is_in_mall, mall_id, mall_name, address, opened_year, estimated_size_m2, confirmed, source) VALUES\n",
    store_vals, "ON CONFLICT (id) DO NOTHING;")

comp_vals = [
    f"({q(c['id'])}, {q(c['brand_name'])}, {q(c['brand_category'])}::competitor_category_enum, {q(c['name'])}, "
    f"{c['lat']!r}, {c['lng']!r}, {q(c['kec'])}, {q(c['kab'])}, {q(c['city'])}, {q('Indonesia')}, '', false, NULL, NULL, "
    f"'osm'::scraper_source_enum, {q(c['source_url'])}, now(), now(), now(), {q(TENANT)})"
    for c in comp_rows
]
write_sql("08_competitors.sql",
    "-- Competitor outlets in Jabodetabek (OSM brand tags)\n"
    "INSERT INTO competitor_stores (id, brand_name, brand_category, name, lat, lng, kec, kab, city, country, address, is_in_mall, mall_id, mall_name, source, source_url, last_crawled_at, created_at, updated_at, tenant_id) VALUES\n",
    comp_vals, "ON CONFLICT (id) DO NOTHING;")

poi_vals = [
    f"({q(p['id'])}, {q(p['name'])}, {q(p['type'])}::poi_type_enum, {p['lat']!r}, {p['lng']!r}, "
    f"{q(p['kec'])}, {q(p['kab'])}, {q(p['city'])}, {q('Indonesia')}, 0, '', {q(p['source'])}, {q(TENANT)})"
    for p in pois
]
write_sql("09_pois.sql",
    "-- POIs Jabodetabek (OSM amenity/tourism/office)\n"
    "INSERT INTO pois (id, name, type, lat, lng, kec, kab, city, country, magnitude, notes, source, tenant_id) VALUES\n",
    poi_vals, "ON CONFLICT (id) DO NOTHING;")

print("\nDONE. SQL files in", SQL)
