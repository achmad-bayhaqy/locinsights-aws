#!/usr/bin/env python3
"""Generate the full LocInsights data-expansion SQL dataset.

Outputs (clean/sql/):
  01_provinces.sql      02_kabupaten.sql    03_kecamatan.sql
  04_kelurahan.sql      05_brands.sql       06_malls.sql
  07_stores.sql         08_competitors.sql  09_pois.sql
All inserts are idempotent (ON CONFLICT DO NOTHING / DO UPDATE guarded).

Data sources (documented per row via `source` column):
  - Administrative hierarchy: Kemendagri/Permendagri kode wilayah
    (via public mirror emsifa/api-wilayah-indonesia), official codes
  - Coordinates: OpenStreetMap admin boundary centers (matched by name);
    deterministic derived fallbacks where OSM boundaries are unmapped
  - Population: BPS 2024 published projections (provinces & Jabodetabek
    kabupaten/kota); kelurahan/kecamatan = documented pro-rata estimate
  - POIs / competitors / malls / stores: OpenStreetMap brand & amenity tags
"""
import json
import math
import os
import re
import unicodedata

import numpy as np

BASE = "/home/z/my-project/workspace/data-expansion"
OUT = f"{BASE}/clean"
SQL = f"{BASE}/sql"
os.makedirs(SQL, exist_ok=True)

TENANT = "tnt_map_active_0001"

def norm(n):
    n = (n or "").lower().strip()
    for p in ("kabupaten ", "kota ", "kab. ", "kab ", "desa ", "kelurahan ", "kel. ", "kel ", "kecamatan "):
        if n.startswith(p):
            n = n[len(p):].strip()
    return " ".join(n.split())


def despace(n):
    return re.sub(r"\s+", "", (n or "").lower())


def q(s):
    """SQL literal escape."""
    if s is None:
        return "NULL"
    s = str(s).replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"


def slug_id(name, kind):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()[:60]
    return f"{kind}-{s}"


# ================================================================ BPS data
PROV_POP_2024 = {  # BPS proyeksi penduduk 2024 (jiwa, rounded)
    "11": 5548000, "12": 15723000, "13": 5833000, "14": 6791000, "15": 3720000,
    "16": 9024000, "17": 2205000, "18": 9188000, "19": 1518000, "21": 2244000,
    "31": 10678000, "32": 50311000, "33": 37314000, "34": 3724000, "35": 41508000,
    "36": 12017000, "51": 4362000, "52": 5584000, "53": 5603000, "61": 5602000,
    "62": 2787000, "63": 4324000, "64": 4118000, "65": 1832000, "71": 2674000,
    "72": 3209000, "73": 9336000, "74": 2733000, "75": 1234000, "76": 1485000,
    "81": 1958000, "82": 1399000, "91": 649000, "92": 1052000, "93": 556000,
    "94": 1397000, "95": 1493000, "96": 618000,
}
PROV_CENTROIDS = {  # fallback/administrative capitals
    "11": (4.6951, 96.7494), "12": (3.5952, 98.6722), "13": (-0.9471, 100.4172),
    "14": (0.5071, 101.4478), "15": (-1.6101, 103.6131), "16": (-2.9761, 104.7754),
    "17": (-3.8004, 102.2655), "18": (-5.4292, 105.2616), "19": (-2.7411, 106.4407),
    "21": (0.5376, 104.4912), "31": (-6.2088, 106.8456), "32": (-6.9059, 107.6109),
    "33": (-7.1509, 110.1430), "34": (-7.8754, 110.4286), "35": (-7.5361, 112.5570),
    "36": (-6.4025, 106.0638), "51": (-8.4095, 115.1889), "52": (-8.6529, 117.3616),
    "53": (-9.8408, 124.4689), "61": (-0.0263, 109.3425), "62": (-2.2094, 113.9213),
    "63": (-3.3187, 114.5908), "64": (-1.2402, 116.8527), "65": (2.5590, 117.5033),
    "71": (1.4748, 124.8421), "72": (-1.4300, 120.8000), "73": (-4.1449, 119.8799),
    "74": (-3.9707, 122.5128), "75": (0.6995, 122.4467), "76": (-2.1281, 126.1855),
    "81": (-3.6547, 128.1906), "82": (0.6328, 127.9768), "91": (-0.8797, 131.1873),
    "92": (-3.6983, 138.3706), "93": (-7.4955, 140.0979), "94": (-4.2491, 136.3370),
    "95": (-4.1660, 138.6222), "96": (-1.1060, 133.5000),
}
JBD_BPS = {  # population 2024 (BPS projections) + PDRB per kapita (juta Rp, ~BPS 2023)
    "3171": (30772, 95), "3172": (2282000, 380), "3173": (2872000, 280),
    "3174": (947000, 450), "3175": (2531000, 300), "3176": (1826000, 330),
    "3201": (4086000, 52), "3271": (1130000, 62), "3276": (2158000, 60),
    "3603": (3311000, 58), "3671": (1873000, 85), "3676": (1484000, 72),
    "3216": (3414000, 120), "3275": (2572000, 95),
}
COASTAL_KAB = {"3171", "3176", "3216", "3275", "3603", "3671"}
JBD_CODES = set(JBD_BPS.keys())

# name-collision disambiguation (official approx centroids, BPS)
COLLISION_REFS = {
    "3216": (-6.2400, 107.0800), "3275": (-6.2400, 106.9950),
    "3201": (-6.5600, 106.8000), "3271": (-6.5950, 106.8166),
    "3603": (-6.1800, 106.4600), "3671": (-6.1700, 106.6400),
    "3273": (-6.9149, 107.6069), "3276": (-6.4000, 106.8200),
    "3274": (-6.9667, 107.6453), "3277": (-6.9322, 107.6070),
    "3278": (-6.8951, 107.6325), "3279": (-6.9669, 107.7148),
    "3573": (-7.9769, 112.6336), "3503": (-8.1330, 112.4200),
    "3374": (-6.9667, 110.4167), "3305": (-7.7300, 110.0000),
    "3471": (-7.7656, 110.4380), "3402": (-7.8831, 110.0536),
    "3472": (-7.8384, 110.3123), "3404": (-7.6826, 110.6583),
    "3273": (-6.9149, 107.6069), "3204": (-6.8720, 107.8100),
    "3373": (-6.9849, 110.4091), "3313": (-7.1333, 110.1333),
    "3578": (-7.2575, 112.7521), "3505": (-7.6500, 112.9000),
    "3372": (-6.9845, 109.6750), "3305": (-7.7300, 110.0000),
    "3272": (-6.9075, 107.6109), "3205": (-6.8680, 107.4000),
    "3674": (-6.1133, 106.1497), "3604": (-6.2036, 106.0333),
    "3171": (-5.8700, 106.3800),
}

# ================================================================ load raw
prov_rows = json.load(open(f"{OUT}/provinces_all.json"))
reg_rows = json.load(open(f"{OUT}/regencies_all.json"))
kec_rows = json.load(open(f"{OUT}/jabodetabek_kecamatan.json"))
kel_rows = json.load(open(f"{OUT}/jabodetabek_kelurahan.json"))
coords = json.load(open(f"{OUT}/coords_final.json"))
brands_db = json.load(open(f"{OUT}/db_brands.json"))
p4 = json.load(open(f"{OUT}/osm_provinces_l4.json"))
k56 = json.load(open(f"{OUT}/osm_kab_l56.json"))
civic = json.load(open(f"{OUT}/osm_poi_civic.json"))
tour = json.load(open(f"{OUT}/osm_poi_tourism.json"))
office = json.load(open(f"{OUT}/osm_poi_office.json"))
comp = json.load(open(f"{OUT}/osm_competitors.json"))
malls = json.load(open(f"{OUT}/osm_malls.json"))
mstores = json.load(open(f"{OUT}/osm_map_stores.json"))
transit_path = f"{OUT}/osm_transit.json"
transit = json.load(open(transit_path)) if os.path.exists(transit_path) else {"elements": []}

print(f"inputs: {len(prov_rows)} prov, {len(reg_rows)} reg, {len(kec_rows)} kec, {len(kel_rows)} kel")

# ================================================================ provinces
prov_by_code = {p["code"]: p for p in prov_rows}
prov_latlng = {}
p4map = {}
for e in p4["elements"]:
    t = e.get("tags", {})
    c = e.get("center")
    nm = t.get("name")
    if not c or not nm:
        continue
    key = norm(nm)
    if key not in p4map:  # first (largest/primary) wins
        p4map[key] = (c["lat"], c["lon"])
# special name fixes
NAME_FIX = {"jakarta": "dki jakarta"}
for p in prov_rows:
    key = norm(p["name"])
    key = NAME_FIX.get(key, key)
    ll = p4map.get(key) or PROV_CENTROIDS.get(p["code"])
    prov_latlng[p["code"]] = {"lat": ll[0], "lng": ll[1],
                              "src": "osm" if key in p4map else "derived_capital"}

def _ptitle(n):
    return "DKI Jakarta" if norm(n) == "dki jakarta" else n.title()

prov_sql_rows = []
for code, p in sorted(prov_by_code.items()):
    ll = prov_latlng[code]
    pop = PROV_POP_2024.get(code)
    src = ("Kemendagri/Permendagri; OpenStreetMap (admin center); BPS proyeksi penduduk 2024"
           if ll["src"] == "osm" else
           "Kemendagri/Permendagri; koordinat pusat administratif (derived); BPS proyeksi penduduk 2024")
    prov_sql_rows.append(
        f"({q(code)}, {q(_ptitle(p['name']))}, {ll['lat']!r}, {ll['lng']!r}, NULL, {pop})")
print(f"provinces: {len(prov_sql_rows)}")

# ================================================================ kabupaten
k56els = [e for e in k56["elements"] if e.get("center") and e["tags"].get("name")]
k56map = {}
for e in k56els:
    key = norm(e["tags"]["name"])
    k56map.setdefault(key, []).append((e["center"]["lat"], e["center"]["lon"], int(e["tags"].get("admin_level", 6))))

def kab_center(row):
    """Resolve kabupaten/kota center; disambiguate collisions by reference."""
    key = norm(row["name"])
    cands = k56map.get(key) or k56map.get(despace(row["name"])) or []
    if len(cands) == 1:
        return cands[0][0], cands[0][1], "osm"
    if len(cands) > 1:
        ref = COLLISION_REFS.get(row["code"])
        if ref:
            best = min(cands, key=lambda c: (c[0] - ref[0]) ** 2 + (c[1] - ref[1]) ** 2)
            return best[0], best[1], "osm"
        return cands[0][0], cands[0][1], "osm"
    # fallback: province center + 20km deterministic jitter
    prov_c = prov_latlng[row["province_code"]]
    lat = prov_c["lat"] + (((int(row['code']) % 40) - 20) / 111.0)
    lng = prov_c["lng"] + (((int(row['code']) // 40 % 40) - 20) / 111.0)
    return round(lat, 4), round(lng, 4), "derived"

def kab_type(name):
    return "Kota" if name.lower().startswith("kota") else "Kabupaten"

kab_sql_rows = []
kab_meta = {}
for r in reg_rows:
    code = r["code"]
    typ = kab_type(r["name"])
    name = norm(r["name"]).title()
    lat, lng, src = kab_center(r)
    pop, pdrb = JBD_BPS.get(code, (None, None))
    prov_name = _ptitle(prov_by_code[r["province_code"]]["name"])
    src_label = (f"Kemendagri/Permendagri; OpenStreetMap (admin center); "
                 f"BPS 2024 (populasi & PDRB per kapita)" if code in JBD_BPS and src == "osm" else
                 f"Kemendagri/Permendagri; OpenStreetMap (admin center)" if src == "osm" else
                 f"Kemendagri/Permendagri; koordinat derived (pending enrichment)")
    kab_meta[code] = {"name": name, "province": prov_name, "type": typ, "pop": pop, "pdrb": pdrb,
                      "lat": lat, "lng": lng}
    kab_sql_rows.append(
        f"({q(code)}, {q(name)}, {q(typ)}, NULL, {q(r['province_code'])}, {q(prov_name)}, "
        f"{q('Indonesia')}, {q(name)}, {lat!r}, {lng!r}, NULL, {pop if pop is not None else 'NULL'}, NULL, {pdrb if pdrb is not None else 'NULL'}, NULL, NULL, 0, {q(src_label)})")
print(f"kabupaten: {len(kab_sql_rows)}")

# ================================================================ kecamatan
kec_sql_rows = []
kec_meta = {}
for r in kec_rows:
    code = r["code"]
    c = coords["kec"].get(code)
    kab = kab_meta[r["kabupaten_code"]]
    kec_meta[code] = {"lat": c["lat"], "lng": c["lng"]}
    # population: pro-rata later (needs village counts)
    src = ("Kemendagri/Permendagri; OpenStreetMap (admin center)" if c["src"] == "osm"
           else f"Kemendagri/Permendagri; koordinat {c['src']} (derived)")
    kec_sql_rows.append(
        f"({q(code)}, {q(r['name'])}, {q(r['kabupaten_code'])}, {q(kab['province'])}, "
        f"{q('Indonesia')}, {q(kab['name'])}, {c['lat']!r}, {c['lng']!r}, NULL, NULL, NULL, "
        f"NULL, false, {q(src)})")
print(f"kecamatan: {len(kec_sql_rows)}")

# ================================================================ kelurahan
kel_by_kec = {}
for r in kel_rows:
    kel_by_kec.setdefault(r["kec_code"], []).append(r)
kec_pop = {}
# pro-rata: kabupaten pop -> kecamatan equal split; kecamatan pop -> kelurahan equal split
for kcode, meta in kab_meta.items():
    if meta["pop"] is None:
        continue
    kids = [k for k in kec_meta if k.startswith(kcode)]
    if kids:
        share = meta["pop"] // len(kids)
        for k in kids:
            kec_pop[k] = share
kel_sql_rows = []
kel_pop = {}
for r in kel_rows:
    code = r["code"]
    c = coords["kel"].get(code)
    kab = kab_meta[r["kab_code"]]
    pop = kec_pop.get(r["kec_code"])
    if pop:
        sibs = kel_by_kec[r["kec_code"]]
        pop = pop // len(sibs)
        kel_pop[code] = pop
    # indices derived from kabupaten (income) + admin type (urban); poi-derived added later
    pdrb = kab["pdrb"]
    income = min(100, max(5, round(pdrb / 1.5))) if pdrb else None
    urban = (78 if kab["type"] == "Kota" else (25 if r["kab_code"] == "3171" else 45))
    src = ("Kemendagri/Permendagri; OpenStreetMap (admin center); populasi BPS pro-rata" if c["src"] == "osm"
           else f"Kemendagri/Permendagri; koordinat {c['src']} (derived); populasi BPS pro-rata")
    kel_sql_rows.append([code, r["name"], r["kec_code"], r["kec_name"], r["kab_code"], kab["name"],
                         kab["province"], c["lat"], c["lng"], pop, None, income, urban, src])
print(f"kelurahan: {len(kel_sql_rows)}")

# ================================================================ POIs
POI_MAP_CAPS = {
    "school": ("school", 2500), "clinic": ("hospital", 600), "hospital": ("hospital", 600),
    "college": ("university", 300), "university": ("university", 300),
    "marketplace": ("market", 600), "police": ("government", 400), "townhall": ("government", 400),
    "bus_station": ("transit_hub", 100), "ferry_terminal": ("transit_hub", 100),
    "stadium": ("stadium", 80), "aerodrome": ("airport", 10),
    "attraction": ("tourist_attraction", 900), "museum": ("tourist_attraction", 900),
    "hotel": ("hotel_cluster", 1300), "beach": ("beach", 60),
    "company": ("office_cluster", 1500), "government": ("office_cluster", 1500),
}
json.dump({"ok": True}, open(f"{OUT}/_gen_checkpoint.json", "w"))
print("checkpoint: static tables prepared")
json.dump({
    "prov": prov_sql_rows, "kab": kab_sql_rows, "kec": kec_sql_rows, "kel": kel_sql_rows,
    "kel_pop": kel_pop, "kec_pop": kec_pop,
}, open(f"{OUT}/_gen_static.json", "w"))
print("static JSON saved")
