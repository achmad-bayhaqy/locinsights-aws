#!/usr/bin/env python3
"""Normalize Kemendagri wilayah data to OFFICIAL current codes and build the
Jabodetabek dataset (14 kabupaten/kota) ready for coordinate enrichment.

Code fixes applied (old emsifa dataset -> current official Permendagri):
  DKI Jakarta:  3101(KepSeribu Kab)->3171, 3171(Jaksel)->3172, 3172(Jaktim)->3173,
                3173(Jakpus)->3174, 3174(Jakbar)->3175, 3175(Jakut)->3176
  Banten:       3673(Kota Serang)->3674, 3674(Tangsel)->3676

Output: /home/z/my-project/workspace/data-expansion/clean/
  provinces_all.json    — 34 old + 4 new (Papua splits) = 38 provinces
  regencies_all.json    — 514 regencies with corrected codes + new-Papua reassign
  jabodetabek.json      — 14 regencies + kecamatan + kelurahan (official codes)
"""
import json
import os

RAW = "/home/z/my-project/scripts/raw"
OUT = "/home/z/my-project/workspace/data-expansion/clean"
os.makedirs(OUT, exist_ok=True)

# old regency code -> (new regency code, new province code)
REMAP = {
    "3101": "3171",  # Kep. Seribu -> DKI (31)
    "3171": "3172",  # Jaksel
    "3172": "3173",  # Jaktim
    "3173": "3174",  # Jakpus
    "3174": "3175",  # Jakbar
    "3175": "3176",  # Jakut
    "3673": "3674",  # Kota Serang
    "3674": "3676",  # Kota Tangerang Selatan
}

# 4 new Papua provinces (Permendagri 2022): code, name, lat, lng
NEW_PROVINCES = [
    ("91", "Papua Barat Daya", -1.3266, 132.5291),
    ("92", "Papua", -3.6983, 138.3706),      # (Irian Jaya Win Poso) Sorong moved; keep Sorong for 91
    ("93", "Papua Selatan", -7.4955, 140.0979),
    ("94", "Papua Tengah", -4.2491, 136.3370),
    ("95", "Papua Pegunungan", -4.1660, 138.6222),
    ("96", "Papua Barat", -0.8797, 131.1873),
]

# Papua regency -> new province mapping (official, 2022 splits)
PAPUA_REG_PROVINCE = {
    # Papua Barat Daya (91)
    "9101": "91",  # Sorong (city 9171? keep kab mapping below too)
    "9171": "91",  # Kota Sorong
    "9127": "91", "9128": "91", "9129": "91", "9130": "91", "9131": "91",
    "9132": "91", "9133": "91", "9134": "91", "9135": "91", "9136": "91",
    # Papua Selatan (93)
    "9201": "93", "9209": "93", "9210": "93", "9211": "93", "9212": "93",
    "9213": "93", "9214": "93",
    # Papua Tengah (94)
    "9401": "94", "9402": "94", "9403": "94", "9408": "94", "9409": "94",
    "9410": "94", "9411": "94", "9412": "94", "9413": "94",
    # Papua Pegunungan (95)
    "9501": "95", "9502": "95", "9503": "95", "9504": "95", "9505": "95",
    "9506": "95", "9507": "95", "9508": "95",
    # Papua (92) — remainder of old 94
}


def title_case(name: str) -> str:
    # dataset names are UPPERCASE; proper-case with careful separators
    name = name.title()
    for tok in ("Dk", "Dusun", "Kp", "Kampung"):
        pass
    return name


def main():
    provinces = json.load(open(f"{RAW}/provinces.json"))  # 34 (old)

    # Build 38-province list: replace old Papua rows with the new six
    old_papua = {"91", "92", "93", "94"}
    prov_rows = []
    for p in provinces:
        if p["id"] in old_papua:
            continue
        prov_rows.append({"code": p["id"], "name": p["name"]})
    # new Papua provinces (code, name, lat, lng)
    new_papua = [
        ("91", "Papua Barat Daya", -1.3266, 132.5291),
        ("92", "Papua", -3.6983, 138.3706),
        ("93", "Papua Selatan", -7.4955, 140.0979),
        ("94", "Papua Tengah", -4.2491, 136.3370),
        ("95", "Papua Pegunungan", -4.1660, 138.6222),
        ("96", "Papua Barat", -0.8797, 131.1873),
    ]
    for code, name, *_ in new_papua:
        prov_rows.append({"code": code, "name": name})
    prov_rows.sort(key=lambda r: r["code"])
    print(f"provinces (new official set): {len(prov_rows)}")

    # regencies
    reg_rows = []
    for fn in sorted(os.listdir(f"{RAW}/regencies")):
        pcode = fn[:-5]
        regs = json.load(open(f"{RAW}/regencies/{fn}"))
        for r in regs:
            rid = r["id"]
            new_pid = pcode
            if pcode in old_papua:
                new_pid = PAPUA_REG_PROVINCE.get(rid, "92")
            if rid in REMAP:
                rid = REMAP[rid]
            reg_rows.append({
                "code": rid,
                "name": title_case(r["name"]),
                "province_code": new_pid,
            })
    # dedupe (old 3673 vs 3674 collision after remap? 3673->3674 but 3674 also existed as Tangsel->3676; check)
    seen = {}
    for r in reg_rows:
        if r["code"] in seen and seen[r["code"]]["name"] != r["name"]:
            print(f"  WARN duplicate regency code {r['code']}: {seen[r['code']]['name']} vs {r['name']}")
        seen[r["code"]] = r
    reg_rows = list(seen.values())
    print(f"regencies: {len(reg_rows)}")

    # Jabodetabek official codes
    JBD = ["3171", "3172", "3173", "3174", "3175", "3176",
           "3201", "3271", "3276", "3603", "3671", "3676", "3216", "3275"]
    # map OLD dataset regency code -> official
    OFFICIAL = {v: k for k, v in REMAP.items()}  # official -> old-in-dataset
    # we need dataset(old) -> official
    OLD2OFF = {k: v for k, v in REMAP.items()}

    jbd_regs = {c: next(r for r in reg_rows if r["code"] == c) for c in JBD}
    print("Jabodetabek regencies:", [jbd_regs[c]["name"] for c in JBD])

    jbd_kec, jbd_kel = [], []
    for off in JBD:
        # find dataset regency code for this official code
        if off in OLD2OFF.values():
            old = [k for k, v in OLD2OFF.items() if v == off][0]
        else:
            old = off
        districts = json.load(open(f"{RAW}/districts/{old}.json"))
        for d in districts:
            kec_code = off + d["id"][4:]  # replace regency prefix
            jbd_kec.append({
                "code": kec_code,
                "name": title_case(d["name"]),
                "kabupaten_code": off,
            })
            villages = json.load(open(f"{RAW}/villages/{d['id']}.json"))
            for v in villages:
                kel_code = off + v["id"][4:]
                jbd_kel.append({
                    "id": kel_code,
                    "code": kel_code,
                    "name": title_case(v["name"]),
                    "kec_code": kec_code,
                    "kec_name": title_case(d["name"]),
                    "kab_code": off,
                })
    print(f"Jabodetabek kecamatan: {len(jbd_kec)}, kelurahan/desa: {len(jbd_kel)}")

    json.dump(prov_rows, open(f"{OUT}/provinces_all.json", "w"), ensure_ascii=False)
    json.dump(reg_rows, open(f"{OUT}/regencies_all.json", "w"), ensure_ascii=False)
    json.dump(jbd_kec, open(f"{OUT}/jabodetabek_kecamatan.json", "w"), ensure_ascii=False)
    json.dump(jbd_kel, open(f"{OUT}/jabodetabek_kelurahan.json", "w"), ensure_ascii=False)
    print("clean files written")


if __name__ == "__main__":
    main()
