"""How long DuckDB takes to read the GeoParquet files from R2, with and without Hive-style filtering.

No Jev calls. Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (read access to the bucket).
Usage: python pipeline/r2_read_timing.py <r2 base, e.g. r2://geo-opendata/osm-poi/parquet/2026-11-21/city=sapporo>
         <local manifest.m1.json> <out.json> [--reps 3]
"""
import argparse
import datetime as dt
import json
import os
import statistics as st
import time
from pathlib import Path

import duckdb


def connect():
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs;")
    con.sql("CREATE SECRET r2 (TYPE r2, KEY_ID '%s', SECRET '%s', ACCOUNT_ID '%s')" % (
        os.environ["R2_ACCESS_KEY_ID"], os.environ["R2_SECRET_ACCESS_KEY"], os.environ["R2_ACCOUNT_ID"]))
    return con


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("manifest")
    ap.add_argument("out")
    ap.add_argument("--reps", type=int, default=3)
    args = ap.parse_args()
    m = json.loads(Path(args.manifest).read_text())
    allf = [f"{args.base}/{f['file']}" for f in m["files"]]
    com = [f"{args.base}/{f['file']}" for f in m["files"] if f["category"] == "commercial"]
    glob = f"read_parquet('{args.base}/*/*/*.parquet', hive_partitioning = true)"
    tests = {
        "all_files_glob": f"SELECT count(*) FROM {glob}",
        "all_files_glob_where_category_commercial": f"SELECT count(*) FROM {glob} WHERE category = 'commercial'",
        "commercial_files_listed": f"SELECT count(*) FROM read_parquet({com})",
        "all_files_listed": f"SELECT count(*) FROM read_parquet({allf})",
        "all_files_glob_without_hive": f"SELECT count(*) FROM read_parquet('{args.base}/*/*/*.parquet', hive_partitioning = false)",
    }
    out = {"started_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "base": args.base,
           "files_total": len(allf), "files_commercial": len(com), "duckdb": duckdb.__version__, "tests": {}}
    times = {k: [] for k in tests}
    rows = {}
    for _ in range(args.reps):
        for k, q in tests.items():
            con = connect()
            t0 = time.perf_counter()
            rows[k] = con.sql(q).fetchone()[0]
            times[k].append(round(time.perf_counter() - t0, 3))
            con.close()
    con = connect()
    plan = con.sql(f"EXPLAIN {tests['all_files_glob_where_category_commercial']}").fetchall()[0][1]
    scanning = next((line.strip(" │") for line in plan.splitlines() if "Scanning Files" in line), None)
    for k in tests:
        out["tests"][k] = {"rows": rows[k], "times_s": times[k], "median_s": st.median(times[k])}
        print(f"{k:42s} rows={rows[k]:6d} median={st.median(times[k]):.2f}s {times[k]}")
    out["explain_where_category"] = scanning
    print("EXPLAIN:", scanning)
    out["finished_utc"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
