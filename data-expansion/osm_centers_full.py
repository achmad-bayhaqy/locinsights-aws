#!/usr/bin/env python3
"""Fetch admin centers for all 14 Jabodetabek kabupaten/kota via Overpass.

Strategy:
  1. Nominatim: resolve each regency -> osm relation id + boundingbox.
  2. Overpass (maps.mail.ru mirror, robust retries): per-regency bbox query for
     boundary relations. Admin levels differ by region:
       - DKI Jakarta (kota + Kep. Seribu): kecamatan=6, kelurahan=7
       - Jawa Barat / Banten: kecamatan=8, kelurahan=10
  3. Match OSM names -> Kemendagri official rows (normalized; fuzzy fallback).

Output: clean/osm_matched.json { kec: {code: {lat,lng,osm_name}}, kel: {...},
                                  unmatched_kec: [], unmatched_kel: [] }
"""
import difflib
import json
import os
import time
import urllib.parse
import urllib.request

OUT = "/home/z/my-project/workspace/data-expansion/clean"
UA = "LocInsights-DataPipeline/1.0 (retail analytics; contact bayhaqy.my.id)"
OVERPASS = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"

REGS = [
    # code, nominatim county name, state, type
    ("3171", "Kabupaten Kepulauan Seribu", "DKI Jakarta", "kab"),
    ("3172", "Jakarta Selatan", "DKI Jakarta", "kota"),
    ("3173", "Jakarta Timur", "DKI Jakarta", "kota"),
    ("3174", "Jakarta Pusat", "DKI Jakarta", "kota"),
    ("3175", "Jakarta Barat", "DKI Jakarta", "kota"),
    ("3176", "Jakarta Utara", "DKI Jakarta", "kota"),
    ("3201", "Kabupaten Bogor", "Jawa Barat", "kab"),
    ("3271", "Bogor", "Jawa Barat", "kota"),
    ("3276", "Depok", "Jawa Barat", "kota"),
    ("3603", "Kabupaten Tangerang", "Banten", "kab"),
    ("3671", "Tangerang", "Banten", "kota"),
    ("3676", "Tangerang Selatan", "Banten", "kota"),
    ("3216", "Kabupaten Bekasi", "Jawa Barat", "kab"),
    ("3275", "Bekasi", "Jawa Barat", "kota"),
]
# OSM admin mapping in Jabodetabek (verified): kecamatan=6, kelurahan=7
# (some duplicates mapped at 7/8/9 — handled by name matching with level priority)
ALL_LEVELS = (6, 7, 8, 9, 10)


def http_json(url, timeout=60, headers=None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def nominatim_bbox(name, state):
    q = urllib.parse.urlencode({
        "county": name, "state": state, "country": "Indonesia",
        "format": "jsonv2", "limit": 3,
    })
    res = http_json(f"https://nominatim.openstreetmap.org/search?{q}")
    time.sleep(1.2)
    for r in res:
        if r.get("osm_type") == "relation" and r.get("addresstype") == "administrative":
            return r["osm_id"], [float(x) for x in r["boundingbox"]]  # s,n,w,e
    for r in res:
        if r.get("osm_type") == "relation":
            return r["osm_id"], [float(x) for x in r["boundingbox"]]
    return None, None


def overpass(q, max_tries=6):
    data = urllib.parse.urlencode({"data": q}).encode()
    for attempt in range(max_tries):
        try:
            req = urllib.request.Request(OVERPASS, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=300) as r:
                txt = r.read().decode("utf-8")
            if not txt.strip():
                raise ValueError("empty response")
            return json.loads(txt)
        except Exception as e:
            wait = 20 + 15 * attempt
            print(f"    overpass fail {attempt+1}/{max_tries}: {e} — wait {wait}s")
            time.sleep(wait)
    raise RuntimeError("overpass exhausted")


def norm(name: str) -> str:
    n = name.lower().strip()
    for p in ("desa ", "kelurahan ", "kel. ", "kel ", "kecamatan ", "kabupaten ", "kota "):
        if n.startswith(p):
            n = n[len(p):].strip()
    n = n.replace("–", "-").replace("’", "'")
    return " ".join(n.split())


def match_osm_to_rows(osm_items, rows, latlng_of):
    """Return dict row_code -> {lat, lng} plus list of unmatched row codes."""
    by_norm = {}
    for it in osm_items:
        by_norm.setdefault(norm(it["name"]), it)
    out = {}
    unmatched = []
    for row in rows:
        code = row["code"]
        key = norm(row["name"])
        it = by_norm.get(key)
        if not it:
            # fuzzy fallback
            cand = difflib.get_close_matches(key, list(by_norm.keys()), n=1, cutoff=0.87)
            it = by_norm[cand[0]] if cand else None
        if it:
            c = it["center"]
            out[code] = {"lat": c[0], "lng": c[1], "osm_name": it["name"]}
        else:
            unmatched.append(code)
    return out, unmatched


import re
_RW_RT = re.compile(r"^(rw|rt)\s*\d", re.I)


def classify_items(elements, kec_lv, kel_lv):
    """Split OSM admin relations into kecamatan/kelurahan candidates.
    Primary level first; keep other levels as fallback candidates."""
    kec_primary, kec_fallback = [], []
    kel_primary, kel_fallback = [], []
    for el in elements:
        tags = el.get("tags", {})
        c = el.get("center")
        nm = tags.get("name")
        if not c or not nm or _RW_RT.match(nm):
            continue
        lv = int(tags.get("admin_level", 0))
        item = {"name": nm, "center": (c["lat"], c["lon"]), "lv": lv}
        if lv == kec_lv:
            kec_primary.append(item)
        elif lv in (6, 7, 8):
            kec_fallback.append(item)
        if lv == kel_lv:
            kel_primary.append(item)
        elif lv in (7, 9, 10, 8):
            kel_fallback.append(item)
    return kec_primary, kec_fallback, kel_primary, kel_fallback


def main():
    kec_rows = json.load(open(f"{OUT}/jabodetabek_kecamatan.json"))
    kel_rows = json.load(open(f"{OUT}/jabodetabek_kelurahan.json"))

    # 1. bounding boxes
    bbox_path = f"{OUT}/jabodetabek_bboxes.json"
    if os.path.exists(bbox_path):
        bboxes = json.load(open(bbox_path))
    else:
        bboxes = {}
        for code, name, state, typ in REGS:
            rel, bb = nominatim_bbox(name, state)
            bboxes[code] = {"rel": rel, "bbox": bb}
            print(f"{code} {name}: rel={rel} bbox={bb}")
        json.dump(bboxes, open(bbox_path, "w"))

    # resumable state
    state_path = f"{OUT}/osm_matched_partial.json"
    if os.path.exists(state_path):
        state = json.load(open(state_path))
        matched, unmatched = state["matched"], state["unmatched"]
        done = set(state.get("done", []))
    else:
        matched, unmatched, done = {"kec": {}, "kel": {}}, {"kec": [], "kel": []}, set()

    pending = [r for r in REGS if r[0] not in done]
    if not pending:
        print("all regencies already done")
        return

    for code, name, state_name, typ in pending:
        bb = bboxes[code]["bbox"]
        if not bb:
            print(f"!! no bbox for {code} {name}")
            unmatched["kec"].extend([r["code"] for r in kec_rows if r["kabupaten_code"] == code])
            unmatched["kel"].extend([r["code"] for r in kel_rows if r["kab_code"] == code])
            done.add(code)
            json.dump({"matched": matched, "unmatched": unmatched, "done": list(done)}, open(state_path, "w"))
            continue
        s, n, w, e = bb
        lv_str = "|".join(str(x) for x in ALL_LEVELS)
        q = (f"[out:json][timeout:300];"
             f"relation[boundary=administrative][admin_level~\"^({lv_str})$\"]({s},{w},{n},{e});"
             f"out tags center;")
        print(f"== {code} {name} (levels {ALL_LEVELS}) bbox={s:.2f},{w:.2f},{n:.2f},{e:.2f}", flush=True)
        d = overpass(q)
        # kecamatan: primary L6, kelurahan: primary L7 (uniform Jabodetabek mapping)
        kp, kf, vp, vf = classify_items(d.get("elements", []), 6, 7)
        print(f"   osm: kecP={len(kp)} kecF={len(kf)} kelP={len(vp)} kelF={len(vf)}", flush=True)

        rows_k = [r for r in kec_rows if r["kabupaten_code"] == code]
        rows_v = [r for r in kel_rows if r["kab_code"] == code]
        mk, uk = match_osm_to_rows(kp + kf, rows_k, None)
        mv, uv = match_osm_to_rows(vp + vf, rows_v, None)
        matched["kec"].update(mk)
        matched["kel"].update(mv)
        unmatched["kec"].extend(uk)
        unmatched["kel"].extend(uv)
        done.add(code)
        json.dump({"matched": matched, "unmatched": unmatched, "done": list(done)}, open(state_path, "w"))
        print(f"   matched kec {len(mk)}/{len(rows_k)}, kel {len(mv)}/{len(rows_v)}", flush=True)
        time.sleep(3)

    json.dump({"matched": matched, "unmatched": unmatched},
              open(f"{OUT}/osm_matched.json", "w"), ensure_ascii=False)
    print(f"\nTOTAL matched kec={len(matched['kec'])} kel={len(matched['kel'])}")
    print(f"unmatched kec={len(unmatched['kec'])} kel={len(unmatched['kel'])}")


if __name__ == "__main__":
    main()
