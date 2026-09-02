#!/usr/bin/env python3
"""Fetch remaining OSM datasets with checkpoints:
  A. All Indonesia admin_level=4 (provinces) and 5/6 (kabupaten/kota) centers
  B. Jabodetabek POIs (civic, tourism, offices)
  C. Jabodetabek competitor outlets (brand-tagged retail)
  D. Jabodetabek malls (shop=mall)
  E. Jabodetabek MAP/MAA brand outlets (stores)
Each checkpoint saved to clean/osm_*.json — resumable.
"""
import json
import os
import time
import urllib.parse
import urllib.request

OUT = "/home/z/my-project/workspace/data-expansion/clean"
UA = "LocInsights-DataPipeline/1.0 (retail analytics; contact bayhaqy.my.id)"
OV = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"

# Indonesia bbox
ID_BB = "(-11.5,94.5,6.5,141.5)"
# Jabodetabek bbox
JBB = "(-6.79,106.34,-5.92,107.30)"

QUERIES = {
    "provinces_l4": f'[out:json][timeout:180];relation[boundary=administrative][admin_level=4]{ID_BB};out tags center;',
    "kab_l56": f'[out:json][timeout:300];relation[boundary=administrative][admin_level~"^(5|6)$"]{ID_BB};out tags center;',
    "poi_civic": f'[out:json][timeout:300];(node[amenity~"^(school|hospital|clinic|university|college|marketplace|bus_station|townhall|ferry_terminal|bank|police)$"]{JBB};way[amenity~"^(school|hospital|clinic|university|college|marketplace|bus_station|townhall|ferry_terminal|bank|police)$"]{JBB};node[leisure=stadium]{JBB};node[aeroway=aerodrome]{JBB};);out tags center;',
    "poi_tourism": f'[out:json][timeout:300];(node[tourism~"^(attraction|hotel|museum)$"]{JBB};way[tourism~"^(attraction|hotel|museum)$"]{JBB};node[natural=beach]{JBB};node[amenity=place_of_worship][religion~"^(buddhist|hindu|christian)$"]{JBB};);out tags center;',
    "poi_office": f'[out:json][timeout:300];(node[office~"^(company|government)$"]{JBB};way[office~"^(company|government)$"]{JBB};);out tags center;',
    "competitors": f"""[out:json][timeout:300];
(node[shop~"^(convenience|supermarket|department_store|beauty|clothes|shoes|sports|coffee)$"][brand~"Indomaret|Alfamart|Alfa Express|Circle K|Lawson|FamilyMart|Dan.dan|Superindo|Lotte|Hypermart|Ranch Market|Grand Lucky|Farmers Market|Fresh Market|Primo|Guardian|Century|K-24|Kimia Farma|Watsons|Sephora|The Body Shop|Uniqlo|H&M|Zara|Pull&Bear|Bershka|Stradivarius|Muji|Cotton On|Miniso|McDonald|KFC|Wendy|Burger King|Texas Chicken|A&W|Starbucks|Excelso|Kopi Kenangan|Janji Jiwa|Fore|Tomoro|Point Coffee|J.CO|Decathlon",i]{JBB};
way[shop~"^(convenience|supermarket|department_store|beauty|clothes|shoes|sports|coffee)$"][brand~"Indomaret|Alfamart|Alfa Express|Circle K|Lawson|FamilyMart|Dan.dan|Superindo|Lotte|Hypermart|Ranch Market|Grand Lucky|Farmers Market|Fresh Market|Primo|Guardian|Century|K-24|Kimia Farma|Watsons|Sephora|The Body Shop|Uniqlo|H&M|Zara|Pull&Bear|Bershka|Stradivarius|Muji|Cotton On|Miniso|McDonald|KFC|Wendy|Burger King|Texas Chicken|A&W|Starbucks|Excelso|Kopi Kenangan|Janji Jiwa|Fore|Tomoro|Point Coffee|J.CO|Decathlon",i]{JBB};);out tags center;""",
    "malls": f'[out:json][timeout:240];(node[shop=mall]{JBB};way[shop=mall]{JBB};);out tags center;',
    "map_stores": f"""[out:json][timeout:240];
(node[brand~"Sports Station|Planet Sports|Kidz Station|Sogo|SEIBU|Debenhams|Swatch|Fossil|Tissot|Galeries Lafayette|Massimo Dutti",i]{JBB};way[brand~"Sports Station|Planet Sports|Kidz Station|Sogo|SEIBU|Debenhams|Swatch|Fossil|Tissot|Galeries Lafayette|Massimo Dutti",i]{JBB};node[shop=department_store][name~"Sogo|SEIBU|Galeries",i]{JBB};way[shop=department_store][name~"Sogo|SEIBU|Galeries",i]{JBB};);out tags center;""",
}


def overpass(q, max_tries=5):
    data = urllib.parse.urlencode({"data": q}).encode()
    for attempt in range(max_tries):
        try:
            req = urllib.request.Request(OV, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=420) as r:
                txt = r.read().decode("utf-8")
            if not txt.strip():
                raise ValueError("empty")
            return json.loads(txt)
        except Exception as e:
            wait = 30 + 30 * attempt
            print(f"    retry {attempt+1}: {e} — wait {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("overpass exhausted")


def main():
    todo = sys.argv[1].split(",") if len(sys.argv) > 1 else list(QUERIES.keys())
    for key in todo:
        outp = f"{OUT}/osm_{key}.json"
        if os.path.exists(outp):
            d = json.load(open(outp))
            print(f"== {key}: cached ({len(d.get('elements', []))} elements)")
            continue
        print(f"== {key} ...", flush=True)
        d = overpass(QUERIES[key])
        n = len(d.get("elements", []))
        json.dump(d, open(outp, "w"))
        print(f"   saved {n} elements", flush=True)
        time.sleep(8)


import sys
if __name__ == "__main__":
    main()
