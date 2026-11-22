"""Extract the Kitahiroshima city boundary and points of interest from an OSM PBF extract.

Usage: python pipeline/extract.py <hokkaido-latest.osm.pbf> <out_dir>
Writes <out_dir>/boundary.geojson and <out_dir>/features.parquet (WKT geometry, lon/lat, tags).
"""
import json
import sys
from pathlib import Path

import osmium
import pyarrow as pa
import pyarrow.parquet as pq
from shapely import wkb as swkb
from shapely.geometry import mapping, shape
from shapely.prepared import prep

CITY_NAME = "北広島市"
# Rough window around the city, used only to skip far-away objects quickly.
WINDOW = (141.40, 42.86, 141.75, 43.06)

POI_KEYS = ["amenity", "leisure", "shop", "tourism", "historic", "office",
            "healthcare", "craft", "sport", "club"]
# Street furniture and parking: not places people search for.
SKIP = {
    "amenity": {"bench", "waste_basket", "waste_disposal", "vending_machine", "parking",
                "parking_space", "parking_entrance", "bicycle_parking", "motorcycle_parking",
                "recycling", "telephone", "post_box", "drinking_water", "atm", "clock",
                "shelter", "letter_box", "grit_bin", "loading_dock", "smoking_area",
                "fountain", "hunting_stand", "compressed_air", "charging_station"},
    "leisure": {"picnic_table", "outdoor_seating", "firepit"},
}
KEEP_TAGS = ["name", "name:en", "amenity", "leisure", "shop", "tourism", "historic", "office",
             "healthcare", "craft", "sport", "club", "cuisine", "operator", "brand", "access",
             "fee", "opening_hours", "description", "religion", "building", "playground",
             "indoor", "wheelchair", "website"]


def is_poi(tags):
    found = False
    for k in POI_KEYS:
        v = tags.get(k)
        if v is None:
            continue
        if v in SKIP.get(k, set()):
            continue
        found = True
    return found


def in_window(lon, lat):
    return WINDOW[0] <= lon <= WINDOW[2] and WINDOW[1] <= lat <= WINDOW[3]


def main(pbf, out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    wkbf = osmium.geom.WKBFactory()
    boundary = None
    rows = []
    fp = osmium.FileProcessor(pbf).with_areas().with_filter(osmium.filter.KeyFilter(*POI_KEYS, "boundary"))
    for obj in fp:
        tags = dict(obj.tags)
        if obj.is_area():
            if tags.get("boundary") == "administrative" and tags.get("name") == CITY_NAME \
                    and tags.get("admin_level") == "7":
                boundary = swkb.loads(wkbf.create_multipolygon(obj), hex=True)
                continue
            if not is_poi(tags):
                continue
            try:
                g = swkb.loads(wkbf.create_multipolygon(obj), hex=True)
            except Exception:
                continue
            c = g.representative_point()
            if not in_window(c.x, c.y):
                continue
            oid = ("way/" if obj.from_way() else "relation/") + str(obj.orig_id())
            rows.append((oid, "area", c.x, c.y, tags))
        elif obj.is_node():
            if not is_poi(tags) or not obj.location.valid():
                continue
            lon, lat = obj.location.lon, obj.location.lat
            if not in_window(lon, lat):
                continue
            rows.append(("node/" + str(obj.id), "point", lon, lat, tags))
    if boundary is None:
        sys.exit("city boundary not found")
    pb = prep(boundary)
    from shapely.geometry import Point
    kept = [r for r in rows if pb.contains(Point(r[2], r[3]))]
    (out / "boundary.geojson").write_text(json.dumps(
        {"type": "Feature", "properties": {"name": CITY_NAME}, "geometry": mapping(boundary)}))
    cols = {"osm_id": [r[0] for r in kept], "osm_geom": [r[1] for r in kept],
            "lon": [round(r[2], 7) for r in kept], "lat": [round(r[3], 7) for r in kept]}
    for t in KEEP_TAGS:
        cols[t.replace(":", "_")] = [r[4].get(t) for r in kept]
    pq.write_table(pa.table(cols), out / "features.parquet")
    print(f"boundary area deg2={boundary.area:.4f}; candidates in window={len(rows)}; in city={len(kept)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
