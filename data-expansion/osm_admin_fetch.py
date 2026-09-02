#!/usr/bin/env python3
"""Resolve OSM relation IDs for the 14 Jabodetabek kabupaten/kota via Nominatim,
then fetch administrative centers (kecamatan admin_level=8, kelurahan
admin_level=10) per kabupaten from Overpass API.

Output: raw/osm_admin_centers.json  (list of {reg_official, level, name, lat, lng})
"""
import json
import os
import time
import urllib.parse
import urllib.request

RAW = "/home/z/my-project/scripts/raw"
OUT = "/home/z/my-project/workspace/data-expansion/clean"
UA = "LocInsights-DataPipeline/1.0 (retail analytics; contact bayhaqy.my.id)"

# official code -> Nominatim search
REGS = [
    ("3171", "Kepulauan Seribu", "DKI Jakarta"),
    ("3172", "Jakarta Selatan", "DKI Jakarta"),
    ("3173", "Jakarta Timur", "DKI Jakarta"),
    ("3174", "Jakarta Pusat", "DKI Jakarta"),
    ("3175", "Jakarta Barat", "DKI Jakarta"),
    ("3176", "Jakarta Utara", "DKI Jakarta"),
    ("3201", "Bogor", "Jawa Barat"),        # kabupaten
    ("3271", "Bogor", "Jawa Barat"),        # kota
    ("3276", "Depok", "Jawa Barat"),
    ("3603", "Tangerang", "Banten"),        # kabupaten
    ("3671", "Tangerang", "Banten"),        # kota
    ("3676", "Tangerang Selatan", "Banten"),
    ("3216", "Bekasi", "Jawa Barat"),       # kabupaten
    ("3275", "Bekasi", "Jawa Barat"),       # kota
]
KAB_CODES = {"3201", "3603", "3216", "3171"}


def http_json(url: str, timeout: int = 60):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def nominatim_relation(name: str, state: str, is_kab: bool) -> str:
    q = urllib.parse.urlencode({
        "county": name,
        "state": state,
        "country": "Indonesia",
        "format": "jsonv2",
        "polygon_geojson": "0",
        "limit": 5,
    })
    res = http_json(f"https://nominatim.openstreetmap.org/search?{q}")
    time.sleep(1.1)
    otype = "administrative"
    for r in res:
        if r.get("osm_type") == "relation" and r.get("type") == otype:
            nm = r["display_name"].lower()
            want = "kabupaten" if is_kab else None
            if want and want not in nm:
                continue
            if not is_kab and ("kabupaten" in nm or "kab." in nm):
                continue
            return r["osm_id"]
    # fallback: take first relation
    if res:
        for r in res:
            if r.get("osm_type") == "relation":
                return r["osm_id"]
    return ""


def overpass(q: str, retries: int = 4):
    data = urllib.parse.urlencode({"data": q}).encode()
    endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
    for attempt in range(retries):
        ep = endpoints[attempt % len(endpoints)]
        try:
            req = urllib.request.Request(ep, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print(f"  overpass retry {attempt+1}: {e}")
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("overpass failed")


def main():
    # 1. resolve relation ids
    rels_path = f"{OUT}/jabodetabek_osm_rels.json"
    if os.path.exists(rels_path):
        rels = json.load(open(rels_path))
    else:
        rels = {}
        for code, name, prov in REGS:
            is_kab = code in KAB_CODES
            want_name = f"Kabupaten {name}" if (is_kab and code != "3171") else name
            if code == "3171":
                want_name = "Kabupaten Kepulauan Seribu"
                is_kab = True
            rid = nominatim_relation(want_name, prov, is_kab)
            rels[code] = rid
            print(f"{code} {want_name}: rel {rid}")
            time.sleep(0.5)
        json.dump(rels, open(rels_path, "w"))
    print("relations:", rels)

    # 2. overpass per regency
    results = []
    for code, name, prov in REGS:
        rel = rels.get(code)
        if not rel:
            print(f"SKIP {code} (no rel)")
            continue
        area_id = int(rel) + 3600000000
        q = f"""
        [out:json][timeout:240];
        area({area_id})->.a;
        (
          relation[boundary=administrative][admin_level=8](area.a);
          relation[boundary=administrative][admin_level=10](area.a);
        );
        out tags center;
        """
        d = overpass(q)
        n = 0
        for el in d.get("elements", []):
            tags = el.get("tags", {})
            c = el.get("center", {})
            if not c or "name" not in tags:
                continue
            results.append({
                "reg_official": code,
                "level": int(tags.get("admin_level", 0)),
                "name": tags["name"],
                "lat": c["lat"],
                "lng": c["lon"],
            })
            n += 1
        print(f"{code} {name}: {n} admin units")
        time.sleep(1.5)

    json.dump(results, open(f"{OUT}/osm_admin_centers.json", "w"), ensure_ascii=False)
    print(f"TOTAL admin centers: {len(results)}")


if __name__ == "__main__":
    main()
