#!/usr/bin/env python3
"""Fetch official Indonesian administrative data (Kemendagri-sourced, via
emsifa/api-wilayah-indonesia — widely used mirror of Permendagri kode wilayah).

Downloads:
  1. regencies (kabupaten/kota) for ALL provinces  -> raw/regencies/
  2. districts (kecamatan) for Jabodetabek regencies -> raw/districts/
  3. villages (kelurahan/desa) for Jabodetabek districts -> raw/villages/
"""
import json
import os
import time
import urllib.request

BASE = "https://emsifa.github.io/api-wilayah-indonesia/api"
RAW = os.path.join(os.path.dirname(__file__), "raw")
UA = {"User-Agent": "LocInsights-DataPipeline/1.0 (contact: bayhaqy)"}

# Jabodetabek kabupaten/kota codes (Kemendagri)
JABODETABEK = [
    "3171",  # Kab. Kepulauan Seribu
    "3172",  # Kota Jakarta Selatan
    "3173",  # Kota Jakarta Timur
    "3174",  # Kota Jakarta Pusat
    "3175",  # Kota Jakarta Barat
    "3176",  # Kota Jakarta Utara
    "3201",  # Kab. Bogor
    "3271",  # Kota Bogor
    "3276",  # Kota Depok
    "3603",  # Kab. Tangerang
    "3671",  # Kota Tangerang
    "3676",  # Kota Tangerang Selatan
    "3216",  # Kab. Bekasi
    "3275",  # Kota Bekasi
]


def get_json(path: str, retries: int = 3):
    url = f"{BASE}/{path}"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt+1} for {url}: {e}")
            time.sleep(2 * (attempt + 1))


def main():
    os.makedirs(f"{RAW}/regencies", exist_ok=True)
    os.makedirs(f"{RAW}/districts", exist_ok=True)
    os.makedirs(f"{RAW}/villages", exist_ok=True)

    provinces = get_json("provinces.json")
    print(f"provinces: {len(provinces)}")

    # 1. Regencies for all provinces
    all_regencies = []
    for i, p in enumerate(provinces):
        code = p["id"]
        out = f"{RAW}/regencies/{code}.json"
        if os.path.exists(out):
            regs = json.load(open(out))
        else:
            regs = get_json(f"regencies/{code}.json")
            json.dump(regs, open(out, "w"))
            time.sleep(0.3)
        all_regencies.extend(regs)
        if (i + 1) % 10 == 0:
            print(f"  regencies fetched for {i+1}/{len(provinces)} provinces...")
    print(f"total regencies (all Indonesia): {len(all_regencies)}")

    # 2+3. Jabodetabek districts + villages
    jab_regs = [r for r in all_regencies if r["id"] in JABODETABEK]
    print(f"Jabodetabek regencies found: {len(jab_regs)}")
    for r in jab_regs:
        rid = r["id"]
        dout = f"{RAW}/districts/{rid}.json"
        if os.path.exists(dout):
            districts = json.load(open(dout))
        else:
            districts = get_json(f"districts/{rid}.json")
            json.dump(districts, open(dout, "w"))
            print(f"  districts {r['name']}: {len(districts)}")
            time.sleep(0.3)
        vtotal = 0
        for d in districts:
            did = d["id"]
            vout = f"{RAW}/villages/{did}.json"
            if not os.path.exists(vout):
                villages = get_json(f"villages/{did}.json")
                json.dump(villages, open(vout, "w"))
                time.sleep(0.25)
            vtotal += len(json.load(open(vout)))
        print(f"  {r['name']}: {len(districts)} kecamatan, {vtotal} kelurahan/desa")

    print("DONE")


if __name__ == "__main__":
    main()
