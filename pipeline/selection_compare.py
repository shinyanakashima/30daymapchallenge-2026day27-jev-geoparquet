"""Compare manifest versions on the file selection step alone (method C, without judging features).

For each manifest version and question, the selection is repeated N times with the Jev cache cleared.
Retention is computed against the features that method A judged "supported" in results/<city>/runs.json
(the three measured runs; the minimum over them is reported).

Usage: python pipeline/selection_compare.py <data_dir> <questions.json> <runs.json> <out.json>
         [--manifests manifest.m1.json,manifest.m2.json] [--reps 10] [--api-url URL]
"""
import argparse
import datetime as dt
import json
import time
from collections import Counter
from pathlib import Path

import sys

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))  # allow running from the repository root
from run_compare import connect, delta, select_files, stats  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data_dir")
    ap.add_argument("questions")
    ap.add_argument("runs")
    ap.add_argument("out")
    ap.add_argument("--manifests", default="manifest.m1.json,manifest.m2.json")
    ap.add_argument("--reps", type=int, default=10)
    ap.add_argument("--api-url", default=None)
    ap.add_argument("--model", default="jev-latest")
    args = ap.parse_args()
    data = Path(args.data_dir)
    qs = json.loads(Path(args.questions).read_text())["questions"]
    runs = json.loads(Path(args.runs).read_text())["runs"]
    m1 = json.loads((data / "manifest.m1.json").read_text())
    file_of = {}
    con = duckdb.connect()
    for f in m1["files"]:
        for (oid,) in con.sql(f"SELECT osm_id FROM '{data / f['file']}'").fetchall():
            file_of[oid] = f["id"]
    refs = {q["id"]: [{k for k, v in r["judgments"].items() if v == "supported"}
                      for r in runs if r["question"] == q["id"] and r["method"] == "A"] for q in qs}
    started = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    out = {"started_utc": started, "reps": args.reps, "results": []}
    for mname in args.manifests.split(","):
        manifest = json.loads((data / mname).read_text())
        for q in qs:
            trials = []
            for rep in range(args.reps):
                c = connect(args)
                s0, t0 = stats(c), time.perf_counter()
                st = select_files(c, manifest, q["en"])
                t = time.perf_counter() - t0
                d = delta(s0, stats(c))
                c.close()
                read = {f for f, s in st.items() if s != "exclude"}
                kept = [len({k for k in ref if file_of[k] in read}) / len(ref) for ref in refs[q["id"]]]
                missed = sorted({k for ref in refs[q["id"]] for k in ref if file_of[k] not in read})
                trials.append({"status": st, "files_read": len(read), "rows_read": sum(f["rows"] for f in manifest["files"] if f["id"] in read),
                               "retention_min": round(min(kept), 4), "missed": missed, "time_s": round(t, 3),
                               "input_tokens": d["input_tokens"], "requests": d["requests"]})
            # stability: for each file, share of trials agreeing with its most frequent status
            agree = [Counter(t["status"][f["id"]] for t in trials).most_common(1)[0][1] / len(trials) for f in manifest["files"]]
            flips = sum(1 for a in agree if a < 1)
            rec = {"manifest": manifest["version"], "question": q["id"], "trials": trials,
                   "files_with_changing_status": flips, "mean_status_agreement": round(sum(agree) / len(agree), 4)}
            out["results"].append(rec)
            fr = sorted(t["files_read"] for t in trials)
            rt = sorted(t["retention_min"] for t in trials)
            print(f"{manifest['version']} {q['id']:14s} files_read {fr[0]}-{fr[-1]} (median {fr[len(fr)//2]}) "
                  f"retention min {rt[0]:.3f} median {rt[len(rt)//2]:.3f} | files changing {flips:2d} "
                  f"| tokens {trials[0]['input_tokens']}", flush=True)
    out["finished_utc"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
