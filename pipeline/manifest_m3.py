"""Build manifest.m3.json: a tag index (tag -> files that contain it, with counts).

With m3 the selector asks Jev about each distinct tag instead of each file, so a minority tag
(for example amenity=pharmacy inside a file of schools and hospitals) is judged on its own and is not
hidden by what most of the file contains. A file is read when at least one of its tags is not excluded.

Usage: python pipeline/manifest_m3.py data/city=<city>
"""
import json
import sys
from pathlib import Path


def main(city_dir):
    d = Path(city_dir)
    m2 = json.loads((d / "manifest.m2.json").read_text())
    index = {}
    for f in m2["files"]:
        for tag, n in f["tag_counts"].items():
            e = index.setdefault(tag, {"tag": tag, "rows": 0, "files": {}})
            e["rows"] += n
            e["files"][f["id"]] = n
    files = [{k: f[k] for k in ("file", "id", "category", "category_label", "zone", "rows", "bytes", "bbox")}
             for f in m2["files"]]
    m3 = {**{k: v for k, v in m2.items() if k != "files"}, "version": "m3", "files": files,
          "tags": sorted(index.values(), key=lambda e: (-e["rows"], e["tag"]))}
    (d / "manifest.m3.json").write_text(json.dumps(m3, ensure_ascii=False, indent=1))
    print(f"{d}: {len(m3['tags'])} tags, {len(files)} files")


if __name__ == "__main__":
    main(sys.argv[1])
