"""Build manifest.m2.json next to manifest.m1.json without touching the data files.

m1 (used for the first measurements) gives Jev, per file: category, row count, unnamed rows,
the 8 most common tags, and the first 6 names.
m2 is written to be read by a decision model:
  - every key=value of the summary keys with its count (no top-N cut)
  - names picked per tag (up to 2 per tag value, at most 30), so that rare kinds of places are visible
  - how complete the attributes are (share of rows with a name / with any detail attribute)

Usage: python pipeline/manifest_m2.py data/city=<city>
"""
import json
import sys
from pathlib import Path

import duckdb

SUMMARY_KEYS = ["amenity", "leisure", "shop", "tourism", "historic", "office", "healthcare",
                "craft", "sport", "club", "cuisine"]
DETAIL_KEYS = ["opening_hours", "operator", "brand", "description", "cuisine", "website_like"]


def main(city_dir):
    d = Path(city_dir)
    m1 = json.loads((d / "manifest.m1.json").read_text())
    con = duckdb.connect()
    files = []
    for f in m1["files"]:
        p = str(d / f["file"])
        tags = con.sql(" UNION ALL ".join(
            f"SELECT '{k}=' || {k} AS tag, name FROM read_parquet('{p}') WHERE {k} IS NOT NULL"
            for k in SUMMARY_KEYS)).fetchall()
        counts, names = {}, {}
        for tag, name in tags:
            counts[tag] = counts.get(tag, 0) + 1
            if name and len(names.setdefault(tag, [])) < 2 and name not in names[tag]:
                names[tag].append(name)
        ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        picked, seen = [], set()
        for tag, _ in ordered:
            for n in names.get(tag, []):
                if n not in seen and len(picked) < 30:
                    picked.append(n)
                    seen.add(n)
        named, detailed = con.sql(f"""SELECT avg((name IS NOT NULL)::INT),
              avg((coalesce(opening_hours, operator, brand, description, cuisine) IS NOT NULL)::INT)
              FROM read_parquet('{p}')""").fetchone()
        e = {k: f[k] for k in ("file", "id", "category", "category_label", "zone", "rows", "bytes", "bbox")}
        e.update({"tag_counts": dict(ordered), "named_share": round(named, 2),
                  "detail_share": round(detailed, 2), "sample_names": picked})
        files.append(e)
    m2 = {**{k: v for k, v in m1.items() if k != "files"}, "version": "m2", "files": files}
    (d / "manifest.m2.json").write_text(json.dumps(m2, ensure_ascii=False, indent=1))
    sizes = [len(json.dumps({k: e[k] for k in ("category_label", "rows", "named_share", "detail_share", "tag_counts", "sample_names")}, ensure_ascii=False)) for e in files]
    print(f"{d}: {len(files)} entries, summary chars per entry: min {min(sizes)} / median {sorted(sizes)[len(sizes)//2]} / max {max(sizes)}")


if __name__ == "__main__":
    main(sys.argv[1])
