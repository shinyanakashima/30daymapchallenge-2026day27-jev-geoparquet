"""Summarize results/runs.json and write the JSON files the web page loads.

Usage: python pipeline/summarize.py <data_dir> <questions.json> <runs.json> <web_data_dir>
"""
import json
import statistics as st
import sys
from pathlib import Path

import duckdb

ATTR_COLS = ["name", "name_en", "amenity", "leisure", "shop", "tourism", "historic", "office",
             "healthcare", "craft", "sport", "club", "cuisine", "operator", "brand", "access", "fee",
             "opening_hours", "description", "religion", "building", "playground", "indoor"]


def med(xs):
    return round(st.median(xs), 4)


def main(data_dir, questions, runs_path, out_dir):
    data, out = Path(data_dir), Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((data / "manifest.json").read_text())
    qs = json.loads(Path(questions).read_text())
    runs = json.loads(Path(runs_path).read_text())
    file_of = {}
    con = duckdb.connect()
    con.sql("LOAD spatial")
    feats = []
    for f in manifest["files"]:
        for row in con.sql(f"SELECT osm_id, ST_X(geometry), ST_Y(geometry), {', '.join(ATTR_COLS)} "
                           f"FROM '{data / f['file']}'").fetchall():
            attrs = {c: v for c, v in zip(ATTR_COLS, row[3:]) if v is not None}
            file_of[row[0]] = f["id"]
            feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(row[1], 6), round(row[2], 6)]},
                          "properties": {"id": row[0], "file": f["id"], "category": f["category"], "attrs": attrs}})
    (out / "features.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False))
    (out / "boundary.geojson").write_text((data / "boundary.geojson").read_text())
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False))

    by = {}
    for r in runs["runs"]:
        by.setdefault((r["question"], r["method"]), []).append(r)
    summary = []
    for q in qs["questions"]:
        entry = {"id": q["id"], "en": q["en"], "ja": q["ja"], "rule_categories": q["rule_categories"], "methods": {}}
        refs = {r["rep"]: {k for k, v in r["judgments"].items() if v == "supported"} for r in by[(q["id"], "A")]}
        for m in ["A", "B", "C"]:
            rs = sorted(by[(q["id"], m)], key=lambda r: r["rep"])
            per_run = []
            for r in rs:
                ref = refs[r["rep"]]
                read_files = {fid for fid, s in r["file_status"].items() if s not in ("exclude", "skipped")}
                kept = {k for k in ref if file_of[k] in read_files}
                missed = sorted(ref - kept)
                per_run.append({
                    "rep": r["rep"],
                    "file_status": r["file_status"],
                    "files_read": r["files_read"], "bytes_read": r["bytes_read"], "rows_read": r["rows_read"],
                    "features_sent": r["features_sent"],
                    "time_s": r["time_s"],
                    "input_tokens": r["usage_select"]["input_tokens"] + r["usage_judge"]["input_tokens"],
                    "select_input_tokens": r["usage_select"]["input_tokens"],
                    "requests": r["usage_select"]["requests"] + r["usage_judge"]["requests"],
                    "select_requests": r["usage_select"]["requests"],
                    "estimated_cost_usd": round(r["usage_select"]["estimated_cost_usd"] + r["usage_judge"]["estimated_cost_usd"], 8),
                    "reference_candidates": len(ref),
                    "retained": len(kept),
                    "retention": round(len(kept) / len(ref), 4) if ref else None,
                    "missed": missed,
                    "judgments": r["judgments"],
                })
            entry["methods"][m] = {
                "runs": per_run,
                "median": {
                    "total_s": med([p["time_s"]["total"] for p in per_run]),
                    "select_s": med([p["time_s"]["select"] for p in per_run]),
                    "read_s": med([p["time_s"]["read"] for p in per_run]),
                    "judge_s": med([p["time_s"]["judge"] for p in per_run]),
                    "files_read": med([p["files_read"] for p in per_run]),
                    "bytes_read": med([p["bytes_read"] for p in per_run]),
                    "rows_read": med([p["rows_read"] for p in per_run]),
                    "features_sent": med([p["features_sent"] for p in per_run]),
                    "input_tokens": med([p["input_tokens"] for p in per_run]),
                    "select_input_tokens": med([p["select_input_tokens"] for p in per_run]),
                    "requests": med([p["requests"] for p in per_run]),
                    "estimated_cost_usd": med([p["estimated_cost_usd"] for p in per_run]),
                    "retention": med([p["retention"] for p in per_run if p["retention"] is not None]),
                },
                "range": {
                    "total_s": [min(p["time_s"]["total"] for p in per_run), max(p["time_s"]["total"] for p in per_run)],
                    "retention": [min(p["retention"] for p in per_run), max(p["retention"] for p in per_run)],
                },
            }
        # how stable the per-feature judgment of method A is between runs
        a = [r["judgments"] for r in sorted(by[(q["id"], "A")], key=lambda r: r["rep"])]
        same = sum(1 for k in a[0] if all(x.get(k) == a[0][k] for x in a))
        entry["a_judgment_agreement"] = round(same / len(a[0]), 4)
        summary.append(entry)
    meta = {k: runs[k] for k in ["started_utc", "finished_utc", "model_alias", "model_served", "duckdb",
                                 "jev_extension", "manifest_version", "questions_version", "reps"]}
    meta["features"] = len(feats)
    meta["files"] = len(manifest["files"])
    meta["osm_extract"] = json.loads((data / "source.json").read_text()) if (data / "source.json").exists() else None
    (out / "results.json").write_text(json.dumps({"meta": meta, "questions": summary}, ensure_ascii=False))
    for e in summary:
        print(e["id"], "agreeA", e["a_judgment_agreement"])
        for m, v in e["methods"].items():
            md = v["median"]
            print(f"  {m}: total {md['total_s']}s (sel {md['select_s']}, read {md['read_s']}, judge {md['judge_s']}) "
                  f"files {md['files_read']} rows {md['rows_read']} tok {md['input_tokens']} "
                  f"retention {md['retention']} range {v['range']['retention']} missed {[len(p['missed']) for p in v['runs']]}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
