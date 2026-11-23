"""Summarize the comparison of manifest versions (m1-m4) on one city.

Inputs (all produced by run_compare.py / selection_compare.py):
  <results_dir>/runs.json                 full judging (A) and AI file selection with m1 (C), 3 runs
  <results_dir>/runs_a_20261123.json      full judging measured again on the same day as m2-m4
  <results_dir>/runs_c_m2.json, runs_c_m3.json, runs_c_m4.json   AI file selection with m2-m4, 3 runs
  <results_dir>/selection_m1_m2.json, selection_m3.json, selection_m4.json   file selection only, 10 runs

Retention is computed against the features that full judging marked "supported" in runs.json
(the minimum over its three runs).

Usage: python pipeline/compare_manifests.py "data/city=sapporo" results/sapporo
Writes <results_dir>/manifest_comparison_summary.json
"""
import json
import statistics as st
import sys
from pathlib import Path

import duckdb

QUESTIONS = ["kids_play", "rainy_day", "groceries", "local_history"]


def main(data_dir, results_dir):
    data, res = Path(data_dir), Path(results_dir)
    m1 = json.loads((data / "manifest.m1.json").read_text())
    file_of = {}
    con = duckdb.connect()
    for f in m1["files"]:
        for (oid,) in con.sql(f"SELECT osm_id FROM '{data / f['file']}'").fetchall():
            file_of[oid] = f["id"]
    load = lambda name: json.loads((res / name).read_text())["runs"]
    base = load("runs.json")
    refs = {q: [{k for k, v in r["judgments"].items() if v == "supported"}
                for r in base if r["question"] == q and r["method"] == "A"] for q in QUESTIONS}

    def summarize(runs, method):
        out = {}
        for q in QUESTIONS:
            rs = [r for r in runs if r["question"] == q and r["method"] == method]
            ret = []
            for r in rs:
                read = {f for f, s in r["file_status"].items() if s not in ("exclude", "skipped")}
                ret.append(min(len({k for k in ref if file_of[k] in read}) / len(ref) for ref in refs[q]))
            out[q] = {
                "total": st.median([r["time_s"]["total"] for r in rs]),
                "sel": st.median([r["time_s"]["select"] for r in rs]),
                "files": st.median([r["files_read"] for r in rs]),
                "rows": st.median([r["rows_read"] for r in rs]),
                "tok": st.median([r["usage_select"]["input_tokens"] + r["usage_judge"]["input_tokens"] for r in rs]),
                "cost": st.median([r["usage_select"]["estimated_cost_usd"] + r["usage_judge"]["estimated_cost_usd"] for r in rs]),
                "ret_min": min(ret),
            }
        return out

    full = {"A": summarize(load("runs_a_20261123.json"), "A"), "m1": summarize(base, "C"),
            "m2": summarize(load("runs_c_m2.json"), "C"), "m3": summarize(load("runs_c_m3.json"), "C"),
            "m4": summarize(load("runs_c_m4.json"), "C")}
    selection = {}
    for name in ("selection_m1_m2.json", "selection_m3.json", "selection_m4.json"):
        for r in json.loads((res / name).read_text())["results"]:
            t = r["trials"]
            selection[f"{r['manifest']}|{r['question']}"] = {
                "ret_min": min(x["retention_min"] for x in t), "flips": r["files_with_changing_status"],
                "files": st.median([x["files_read"] for x in t]), "tok": st.median([x["input_tokens"] for x in t])}
    (res / "manifest_comparison_summary.json").write_text(
        json.dumps({"full": full, "selection": selection}, ensure_ascii=False, indent=1))
    print("wrote", res / "manifest_comparison_summary.json")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
