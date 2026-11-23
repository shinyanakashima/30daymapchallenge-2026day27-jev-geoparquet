"""Split the extracted features into GeoParquet files by attribute category x area,
and write a manifest (one entry per file) that the file selector reads.

Files are laid out Hive-style: <data_dir>/category=<category>/area=<area>/part-0.parquet,
with <data_dir> itself named city=<city> (for example data/city=sapporo).
The manifest is <data_dir>/manifest.m1.json ("m1" is the manifest format version).

Area: the city's wards when <work_dir>/wards.geojson exists (Sapporo), otherwise four
quadrants split at the median longitude and latitude of the features (Kitahiroshima).

Usage: python pipeline/partition.py <work_dir> <data_dir> <city label, e.g. Sapporo>
"""
import json
import os
import sys
from collections import Counter
from pathlib import Path

import duckdb
from shapely.geometry import Point, shape
from shapely.prepared import prep
import pandas as pd

CATEGORIES = {
    "parks_play": "Parks and play areas",
    "sports": "Sports facilities",
    "commercial": "Shops, food and other businesses",
    "public_culture": "Public, cultural, education and health facilities",
    "other_unknown": "Other / not classified",
}

PARKS = {"park", "playground", "garden", "nature_reserve", "dog_park", "picnic_site", "common"}
SPORTS = {"pitch", "sports_centre", "sports_hall", "golf_course", "swimming_pool", "track",
          "stadium", "fitness_centre", "ice_rink", "miniature_golf", "horse_riding", "water_park"}
COMMERCIAL_AMENITY = {"restaurant", "cafe", "fast_food", "bar", "pub", "bank", "fuel", "car_wash",
                      "car_rental", "food_court", "ice_cream", "karaoke_box", "cinema", "nightclub"}
PUBLIC_AMENITY = {"school", "kindergarten", "college", "university", "library", "community_centre",
                  "townhall", "police", "fire_station", "post_office", "place_of_worship", "hospital",
                  "clinic", "doctors", "dentist", "pharmacy", "social_facility", "childcare",
                  "arts_centre", "theatre", "courthouse", "public_building", "veterinary"}
PUBLIC_TOURISM = {"museum", "attraction", "artwork", "information", "gallery"}
COMMERCIAL_TOURISM = {"hotel", "motel", "guest_house", "hostel"}
PARK_TOURISM = {"camp_site", "picnic_site", "viewpoint"}

# Attribute columns kept in the GeoParquet files (geometry is stored separately).
ATTR_COLS = ["name", "name_en", "amenity", "leisure", "shop", "tourism", "historic", "office",
             "healthcare", "craft", "sport", "club", "cuisine", "operator", "brand", "access", "fee",
             "opening_hours", "description", "religion", "building", "playground", "indoor"]
SUMMARY_KEYS = ["amenity", "leisure", "shop", "tourism", "historic", "office", "healthcare",
                "craft", "sport", "club"]


def categorize(row):
    r = {k: (None if pd.isna(v) else v) for k, v in row.items()}  # NaN/NA -> None
    a, l, t = r["amenity"], r["leisure"], r["tourism"]
    if l in PARKS or t in PARK_TOURISM:
        return "parks_play"
    if l in SPORTS:
        return "sports"
    if r["shop"] or a in COMMERCIAL_AMENITY or t in COMMERCIAL_TOURISM or l == "adult_gaming_centre" \
            or r["office"] == "company" or r["craft"]:
        return "commercial"
    if a in PUBLIC_AMENITY or t in PUBLIC_TOURISM or r["historic"] or r["healthcare"] \
            or r["office"] == "government":
        return "public_culture"
    return "other_unknown"


def main(work_dir, data_dir, city_label):
    work, data = Path(work_dir), Path(data_dir)
    con = duckdb.connect()
    con.sql("INSTALL spatial; LOAD spatial;")
    feats = con.sql(f"select * from '{work / 'features.parquet'}' order by osm_id").fetchdf()
    feats["category"] = [categorize(r) for _, r in feats.iterrows()]
    wards_path = work / "wards.geojson"
    if wards_path.exists():
        wards = json.loads(wards_path.read_text())["features"]
        zones = [{"id": w["properties"]["name_en"].split()[0].lower(), "ja": w["properties"]["name"],
                  "en": w["properties"]["name_en"].replace(" Ward", "")} for w in wards]
        polys = [(z["id"], prep(shape(w["geometry"])), shape(w["geometry"])) for z, w in zip(zones, wards)]

        def zone_of(lo, la):
            p = Point(lo, la)
            for zid, pp, _ in polys:
                if pp.contains(p):
                    return zid
            return min(polys, key=lambda t: t[2].distance(p))[0]  # on a ward border
        feats["zone"] = [zone_of(lo, la) for lo, la in zip(feats["lon"], feats["lat"])]
        zone_split = {"method": "ward"}
        zones.sort(key=lambda z: z["id"])
    else:
        lon_mid, lat_mid = float(feats["lon"].median()), float(feats["lat"].median())
        feats["zone"] = [("n" if la >= lat_mid else "s") + ("w" if lo < lon_mid else "e")
                         for lo, la in zip(feats["lon"], feats["lat"])]
        zone_split = {"method": "median", "lon": lon_mid, "lat": lat_mid}
        zones = [{"id": "nw", "ja": "北西", "en": "NW"}, {"id": "ne", "ja": "北東", "en": "NE"},
                 {"id": "sw", "ja": "南西", "en": "SW"}, {"id": "se", "ja": "南東", "en": "SE"}]
    con.register("feats", feats)
    entries = []
    for cat, label in CATEGORIES.items():
        for zone in [z["id"] for z in zones]:
            sub = feats[(feats.category == cat) & (feats.zone == zone)]
            if sub.empty:
                continue
            fid = f"{cat}__{zone}"
            rel = f"category={cat}/area={zone}/part-0.parquet"
            path = data / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            cols = ", ".join(ATTR_COLS)
            con.sql(f"""COPY (SELECT osm_id, osm_geom, {cols}, ST_Point(lon, lat) AS geometry
                        FROM feats WHERE category = '{cat}' AND zone = '{zone}' ORDER BY osm_id)
                        TO '{path}' (FORMAT parquet, COMPRESSION zstd)""")
            counts = Counter()
            for k in SUMMARY_KEYS:
                for v in sub[k].dropna():
                    counts[f"{k}={v}"] += 1
            names = [n for n in sub["name"].dropna().tolist()][:6]
            entries.append({
                "file": rel,
                "id": fid,
                "category": cat,
                "category_label": label,
                "zone": zone,
                "rows": int(len(sub)),
                "bytes": os.path.getsize(path),
                "bbox": [round(float(sub.lon.min()), 6), round(float(sub.lat.min()), 6),
                         round(float(sub.lon.max()), 6), round(float(sub.lat.max()), 6)],
                "tag_counts": dict(counts.most_common(8)),
                "unnamed_rows": int(sub["name"].isna().sum()),
                "sample_names": names,
            })
    manifest = {"version": "m1", "dataset": f"OpenStreetMap POIs, {city_label}, Hokkaido",
                "zone_split": zone_split, "zones": zones, "files": entries}
    (data / "manifest.m1.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(len(entries), "files;", int(feats.shape[0]), "features")
    print(feats.groupby("category").size().to_dict())


if __name__ == "__main__":
    main(*sys.argv[1:4])
