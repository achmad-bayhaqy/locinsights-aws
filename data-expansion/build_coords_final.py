#!/usr/bin/env python3
"""Integrate Bekasi L7 village matches + build FINAL coordinate table with
deterministic fallbacks.

Fallback hierarchy (documented data lineage):
  1. OSM admin boundary center (matched by name)          -> source: osm
  2. Centroid of matched sibling kelurahan (kecamatan)     -> source: derived
  3. Parent kecamatan center + deterministic jitter (kel)  -> source: derived
  4. Kabupaten center + deterministic jitter               -> source: derived
"""
import json
import math
import os

OUT = "/home/z/my-project/workspace/data-expansion/clean"
TMP = "/tmp"

state = json.load(open(f"{OUT}/osm_matched_partial.json"))
matched, unmatched = state["matched"], state["unmatched"]
kec_rows = json.load(open(f"{OUT}/jabodetabek_kecamatan.json"))
kel_rows = json.load(open(f"{OUT}/jabodetabek_kelurahan.json"))


def norm(name: str) -> str:
    n = name.lower().strip()
    for p in ("desa ", "kelurahan ", "kel. ", "kel ", "kecamatan ", "kabupaten ", "kota "):
        if n.startswith(p):
            n = n[len(p):].strip()
    n = n.replace("–", "-").replace("’", "'")
    return " ".join(n.split())


# --- integrate Bekasi L7 files ---
import difflib
for code, path in (("3216", f"{TMP}/l7_3216.json"), ("3275", f"{TMP}/l7_3275.json")):
    d = json.load(open(path))
    by_norm = {}
    for el in d.get("elements", []):
        tags = el.get("tags", {})
        nm = tags.get("name")
        c = el.get("center")
        if not nm or not c:
            continue
        by_norm.setdefault(norm(nm), (c["lat"], c["lon"], nm))
    rows_v = [r for r in kel_rows if r["kab_code"] == code]
    added = 0
    still_unmatched = []
    for r in rows_v:
        k = norm(r["name"])
        hit = by_norm.get(k)
        if not hit:
            cand = difflib.get_close_matches(k, list(by_norm.keys()), n=1, cutoff=0.9)
            hit = by_norm[cand[0]] if cand else None
        if hit and r["code"] not in matched["kel"]:
            matched["kel"][r["code"]] = {"lat": hit[0], "lng": hit[1], "osm_name": hit[2]}
            if r["code"] in unmatched["kel"]:
                unmatched["kel"].remove(r["code"])
            added += 1
        elif not hit and r["code"] not in matched["kel"]:
            still_unmatched.append(r["code"])
    unmatched["kel"].extend(still_unmatched)
    print(f"{code}: +{added} villages via L7 files")

# --- rebuild unmatched lists from scratch (truth) ---
matched_kec_codes = set(matched["kec"])
matched_kel_codes = set(matched["kel"])
unmatched_kec = [r["code"] for r in kec_rows if r["code"] not in matched_kec_codes]
unmatched_kel = [r["code"] for r in kel_rows if r["code"] not in matched_kel_codes]
print(f"before fallback: kec matched {len(matched_kec_codes)}/{len(kec_rows)}, kel matched {len(matched_kel_codes)}/{len(kel_rows)}")

# --- kabupaten centers (approx, official) — used for final fallback ---
KAB_CENTERS = {
    "3171": (-5.8700, 106.3800), "3172": (-6.2862, 106.7891), "3173": (-6.2320, 106.8883),
    "3174": (-6.1822, 106.8292), "3175": (-6.1654, 106.7570), "3176": (-6.1195, 106.8946),
    "3201": (-6.5000, 106.8000), "3271": (-6.5950, 106.8166), "3276": (-6.4000, 106.8200),
    "3603": (-6.1800, 106.4500), "3671": (-6.1700, 106.6400), "3676": (-6.3000, 106.6800),
    "3216": (-6.2700, 107.1000), "3275": (-6.2400, 107.0000),
}


def jitter(code: str, base: tuple, max_km: float) -> tuple:
    """Deterministic pseudo-random offset from code hash (stable across runs)."""
    h = hash(str(code)) & 0xFFFFFFFF
    ang = (h % 3600) / 3600.0 * 2 * math.pi
    rad = ((h >> 12) % 1000) / 1000.0 * max_km
    dlat = (rad * math.cos(ang)) / 111.32
    dlng = (rad * math.sin(ang)) / (111.32 * math.cos(math.radians(base[0])))
    return (round(base[0] + dlat, 6), round(base[1] + dlng, 6))


final = {"kec": {}, "kel": {}}

# pass 1: OSM matches
for c, v in matched["kec"].items():
    final["kec"][c] = {"lat": v["lat"], "lng": v["lng"], "src": "osm"}
for c, v in matched["kel"].items():
    final["kel"][c] = {"lat": v["lat"], "lng": v["lng"], "src": "osm"}

# pass 2: unmatched kecamatan -> centroid of matched kelurahan in it
kec_by_code = {r["code"]: r for r in kec_rows}
kel_by_kec = {}
for r in kel_rows:
    kel_by_kec.setdefault(r["kec_code"], []).append(r["code"])
for code in unmatched_kec:
    kids = [k for k in kel_by_kec.get(code, []) if k in final["kel"] and final["kel"][k]["src"] == "osm"]
    if kids:
        la = sum(final["kel"][k]["lat"] for k in kids) / len(kids)
        ln = sum(final["kel"][k]["lng"] for k in kids) / len(kids)
        final["kec"][code] = {"lat": round(la, 6), "lng": round(ln, 6), "src": "derived_kel_centroid"}
    else:
        kab = kec_by_code[code]["kabupaten_code"]
        base = KAB_CENTERS[kab]
        la, ln = jitter(code, base, 8.0)
        final["kec"][code] = {"lat": la, "lng": ln, "src": "derived_kab_jitter"}

# pass 3: unmatched kelurahan -> kecamatan center + jitter
kec_final_by_code = final["kec"]
for code in unmatched_kel:
    row = next(r for r in kel_rows if r["code"] == code)
    kec = kec_final_by_code.get(row["kec_code"])
    if kec and kec["src"] == "osm":
        la, ln = jitter(code, (kec["lat"], kec["lng"]), 0.9)
        final["kel"][code] = {"lat": la, "lng": ln, "src": "derived_kec_jitter"}
    elif kec:
        la, ln = jitter(code, (kec["lat"], kec["lng"]), 1.5)
        final["kel"][code] = {"lat": la, "lng": ln, "src": "derived_kec_jitter"}
    else:
        base = KAB_CENTERS[row["kab_code"]]
        la, ln = jitter(code, base, 8.0)
        final["kel"][code] = {"lat": la, "lng": ln, "src": "derived_kab_jitter"}

from collections import Counter
print("kec src:", Counter(v["src"] for v in final["kec"].values()))
print("kel src:", Counter(v["src"] for v in final["kel"].values()))

json.dump(final, open(f"{OUT}/coords_final.json", "w"), ensure_ascii=False)
print("coords_final.json written:", len(final["kec"]), "kec,", len(final["kel"]), "kel")
