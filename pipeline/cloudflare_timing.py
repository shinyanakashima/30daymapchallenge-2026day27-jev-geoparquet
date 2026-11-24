"""Call the deployed search API several times and keep the time breakdown it reports.

Usage: python pipeline/cloudflare_timing.py <api base url> <city> <method> <question_id> <out.json> [--reps 3]
The API reports time_s = select (Jev picks files), read (DuckDB reads from R2 and keeps the city),
judge (Jev judges each feature). "http_s" is the whole request seen from the caller.
"""
import argparse
import datetime as dt
import json
import statistics as st
import time
from pathlib import Path

import requests


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("city")
    ap.add_argument("method")
    ap.add_argument("question_id")
    ap.add_argument("out")
    ap.add_argument("--reps", type=int, default=3)
    args = ap.parse_args()
    requests.get(f"{args.base}/health", timeout=180).raise_for_status()  # start the container first
    out = {"started_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "city": args.city,
           "method": args.method, "question_id": args.question_id, "runs": []}
    for _ in range(args.reps):
        t0 = time.perf_counter()
        r = requests.post(f"{args.base}/search", json={"city": args.city, "method": args.method,
                                                       "question_id": args.question_id}, timeout=600)
        r.raise_for_status()
        d = r.json()
        run = {"http_s": round(time.perf_counter() - t0, 3), "time_s": d["time_s"], "files_read": d["files_read"],
               "rows_read": d["rows_read"], "judgment_counts": d["judgment_counts"],
               "requests_judge": d["usage_judge"]["requests"],
               "cost_usd": round(d["usage_select"]["estimated_cost_usd"] + d["usage_judge"]["estimated_cost_usd"], 6)}
        out["runs"].append(run)
        print(run, flush=True)
    for k in ("select", "read", "judge", "total"):
        out[f"median_{k}_s"] = st.median(r["time_s"][k] for r in out["runs"])
    out["median_http_s"] = st.median(r["http_s"] for r in out["runs"])
    out["finished_utc"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
