"""Build manifest.m4.json: the m3 tag index plus example names for each tag.

m3 showed that some places are relevant because of their name, not their tag (a pharmacy that is a
drugstore chain, a "park" that is a memorial hall). m4 adds, per tag, the 4 most frequent names and the
8 names whose character pairs are rarest among the names with that tag, so unusual places are visible.

Usage: python pipeline/manifest_m4.py data/city=<city>
"""
import json
import math
import sys
from collections import Counter
from pathlib import Path

import duckdb

KEYS = ["amenity", "leisure", "shop", "tourism", "historic", "office", "healthcare", "craft", "sport", "club", "cuisine"]


def bigrams(s):
    s = "".join(ch for ch in s if not ch.isspace())
    return {s[i:i + 2] for i in range(len(s) - 1)} or {s}


def main(city_dir):
    d = Path(city_dir)
    m3 = json.loads((d / "manifest.m3.json").read_text())
    con = duckdb.connect()
    union = " UNION ALL ".join(
        f"SELECT '{k}=' || {k} AS tag, name FROM read_parquet('{d}/category=*/area=*/part-0.parquet') "
        f"WHERE {k} IS NOT NULL AND name IS NOT NULL" for k in KEYS)
    by_tag = {}
    for tag, name in con.sql(union).fetchall():
        by_tag.setdefault(tag, []).append(name)
    for t in m3["tags"]:
        names = by_tag.get(t["tag"], [])
        freq = Counter(names)
        common = [n for n, _ in freq.most_common(4)]
        bg = Counter(b for n in freq for b in bigrams(n))
        total = sum(bg.values()) or 1
        score = {n: sum(-math.log(bg[b] / total) for b in bigrams(n)) / len(bigrams(n)) for n in freq}
        rare = [n for n in sorted(score, key=lambda n: -score[n]) if n not in common][:8]
        t["example_names"] = common + rare
    m3["version"] = "m4"
    (d / "manifest.m4.json").write_text(json.dumps(m3, ensure_ascii=False, indent=1))
    ex = {t["tag"]: t["example_names"] for t in m3["tags"]}
    print(d, len(m3["tags"]), "tags")
    for k in ("amenity=pharmacy", "leisure=park"):
        print(" ", k, ex.get(k))


if __name__ == "__main__":
    main(sys.argv[1])
