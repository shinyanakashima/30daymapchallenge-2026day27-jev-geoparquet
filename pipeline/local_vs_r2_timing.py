"""Same DuckDB query on local files and on the same files in R2: where does the reading time go?

The query is the reading step of a search (container/app/search.py): read the files, keep the
features inside the city boundary. No Jev calls.
Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (read access to the bucket).
Usage: python pipeline/local_vs_r2_timing.py <local city dir, e.g. data/city=kitahiroshima>
         <r2 city base, e.g. r2://geo-opendata/osm-poi/parquet/2026-11-21/city=kitahiroshima> <out.json> [--reps 3]
"""
import argparse
import datetime as dt
import json
import os
import statistics as st
import sys
import time
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "container" / "app"))
from search import ATTR_COLS  # noqa: E402


def connect(r2):
    con = duckdb.connect()
    con.sql("INSTALL spatial; LOAD spatial;")
    if r2:
        con.sql("INSTALL httpfs; LOAD httpfs;")
        con.sql("CREATE SECRET r2 (TYPE r2, KEY_ID '%s', SECRET '%s', ACCOUNT_ID '%s')" % (
            os.environ["R2_ACCESS_KEY_ID"], os.environ["R2_SECRET_ACCESS_KEY"], os.environ["R2_ACCOUNT_ID"]))
    return con


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("local")
    ap.add_argument("r2base")
    ap.add_argument("out")
    ap.add_argument("--reps", type=int, default=3)
    args = ap.parse_args()
    local = Path(args.local)
    m = json.loads((local / "manifest.m1.json").read_text())
    files = [f["file"] for f in m["files"]]
    con = connect(False)
    wkt = con.sql(f"SELECT ST_AsText(geom) FROM ST_Read('{local / 'boundary.geojson'}')").fetchone()[0]
    con.close()
    paths = {"local": [str(local / f) for f in files], "r2": [f"{args.r2base}/{f}" for f in files]}
    cols = ", ".join(ATTR_COLS)

    def search_read(p):
        return (f"SELECT count(*) FROM (SELECT osm_id, {cols}, ST_X(geometry), ST_Y(geometry) FROM read_parquet({p}) "
                f"WHERE ST_Within(geometry, ST_GeomFromText('{wkt}')))")

    tests = {
        "local_search_read": ("local", search_read(paths["local"])),
        "r2_search_read": ("r2", search_read(paths["r2"])),
        "r2_footers_only": ("r2", f"SELECT count(*) FROM parquet_metadata({paths['r2']})"),
        "r2_one_file_search_read": ("r2", search_read(paths["r2"][:1])),
    }
    out = {"started_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
           "local": str(local), "r2base": args.r2base, "files": len(files),
           "bytes_total": sum(f["bytes"] for f in m["files"]), "duckdb": duckdb.__version__,
           "note": "measured from the machine running this script; a new connection for every run", "tests": {}}
    times = {k: [] for k in tests}
    rows = {}
    for _ in range(args.reps):
        for k, (where, q) in tests.items():
            con = connect(where == "r2")
            t0 = time.perf_counter()
            rows[k] = con.sql(q).fetchone()[0]
            times[k].append(round(time.perf_counter() - t0, 3))
            con.close()
    for k in tests:
        out["tests"][k] = {"rows": rows[k], "times_s": times[k], "median_s": st.median(times[k])}
        print(f"{k:26s} rows={rows[k]:6d} median={st.median(times[k]):.3f}s {times[k]}")
    out["finished_utc"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
