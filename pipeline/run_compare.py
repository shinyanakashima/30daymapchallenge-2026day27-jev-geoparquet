"""Compare three ways of searching the partitioned GeoParquet files with Jev.

  A: read every file
  B: read the files a fixed rule table assigns to the question (questions.json: rule_categories)
  C: ask Jev, for each manifest entry, whether the file may hold matches; read
     "candidate" and "insufficient_information", skip "exclude"

The spatial condition, the SQL and the per-feature judgment are the same in all three:
  SELECT ... FROM read_parquet(files) WHERE ST_Within(geometry, <city boundary>)
  jev_choice({attributes: 'name: ...; leisure: ...'}, <question>, ['supported','contradicted','insufficient_information'])

Usage: python pipeline/run_compare.py <data_dir> <questions.json> <out.json> [--reps 3] [--api-url URL]
"""
import argparse
import datetime as dt
import json
import time
from pathlib import Path

import duckdb

ATTR_COLS = ["name", "name_en", "amenity", "leisure", "shop", "tourism", "historic", "office",
             "healthcare", "craft", "sport", "club", "cuisine", "operator", "brand", "access", "fee",
             "opening_hours", "description", "religion", "building", "playground", "indoor"]
FEATURE_OPTIONS = ["supported", "contradicted", "insufficient_information"]
FILE_OPTIONS = ["candidate", "exclude", "insufficient_information"]


def feature_question(q):
    return f'Does this place match the request "{q}"? Judge only from the attributes given.'


def file_question(q):
    return (f'This is a summary of one data file of places. Could the file contain places that match the '
            f'request "{q}"? Answer candidate if it may contain such places, exclude if it clearly does '
            f'not, insufficient_information if the summary is not enough to tell.')


def attributes_text():
    """Only the non-empty attributes, as 'key: value; key: value' (geometry is never sent)."""
    return "concat_ws('; ', " + ", ".join(f"'{c}: ' || {c}" for c in ATTR_COLS) + ")"


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def connect(args):
    con = duckdb.connect()
    con.sql("LOAD spatial; LOAD jev;")
    if args.api_url:
        con.sql(f"SET jev_api_url = {sql_str(args.api_url)}")
        con.sql("SET jev_api_key = 'proxy-injected'")
    con.sql(f"SET jev_model = {sql_str(args.model)}")
    con.sql("SELECT jev_cache_clear()").fetchall()
    return con


def stats(con):
    return json.loads(con.sql("SELECT jev_stats()").fetchone()[0])


def delta(a, b):
    keys = ["requests", "input_tokens", "output_tokens", "rows_evaluated", "cache_hits", "errors",
            "retries", "estimated_cost_usd"]
    return {k: round(b[k] - a[k], 10) if isinstance(b[k], float) else b[k] - a[k] for k in keys}


def manifest_table(con, manifest):
    rows = []
    for f in manifest["files"]:
        tags = ", ".join(f"{k}: {v}" for k, v in f["tag_counts"].items())
        names = ", ".join(f["sample_names"])
        rows.append((f["id"], f["category_label"], f["rows"], f["unnamed_rows"], tags, names))
    con.sql("CREATE OR REPLACE TABLE manifest (id VARCHAR, category VARCHAR, rows INTEGER, "
            "unnamed_rows INTEGER, most_common_tags VARCHAR, sample_names VARCHAR)")
    con.executemany("INSERT INTO manifest VALUES (?, ?, ?, ?, ?, ?)", rows)


def run_once(args, manifest, boundary_wkt, q, method):
    con = connect(args)
    data = Path(args.data_dir)
    by_id = {f["id"]: f for f in manifest["files"]}
    s0 = stats(con)
    t0 = time.perf_counter()
    file_status = {}
    if method == "A":
        file_status = {fid: "read" for fid in by_id}
    elif method == "B":
        cats = set(q["rule_categories"])
        file_status = {fid: ("read" if f["category"] in cats else "skipped") for fid, f in by_id.items()}
    else:
        manifest_table(con, manifest)
        res = con.sql(f"""SELECT id, jev_choice(struct_pack(category, rows, unnamed_rows, most_common_tags,
                              sample_names), {sql_str(file_question(q['en']))}, {FILE_OPTIONS}) AS c
                          FROM manifest""").fetchall()
        file_status = {fid: c for fid, c in res}
    t1 = time.perf_counter()
    s1 = stats(con)
    to_read = [fid for fid, st in file_status.items() if st != "exclude" and st != "skipped"]
    paths = [str(data / by_id[fid]["file"]) for fid in to_read]
    if paths:
        con.sql(f"""CREATE TEMP TABLE cand AS
                    SELECT osm_id, {', '.join(ATTR_COLS)}, filename AS src
                    FROM read_parquet({paths}, filename = true)
                    WHERE ST_Within(geometry, ST_GeomFromText({sql_str(boundary_wkt)}))""")
    else:
        con.sql(f"CREATE TEMP TABLE cand AS SELECT NULL::VARCHAR AS osm_id WHERE false")
    t2 = time.perf_counter()
    rows_read = con.sql("SELECT count(*) FROM cand").fetchone()[0]
    judged = {}
    if rows_read:
        judged = dict(con.sql(f"""SELECT osm_id, jev_choice(struct_pack(attributes := {attributes_text()}),
                                  {sql_str(feature_question(q['en']))}, {FEATURE_OPTIONS}) FROM cand""").fetchall())
    t3 = time.perf_counter()
    s2 = stats(con)
    model_used = con.sql("SELECT current_setting('jev_model')").fetchone()[0]
    con.close()
    return {
        "question": q["id"], "method": method,
        "file_status": file_status,
        "files_read": len(to_read),
        "bytes_read": sum(by_id[f]["bytes"] for f in to_read),
        "rows_read": rows_read,
        "features_sent": len(judged),
        "time_s": {"select": round(t1 - t0, 4), "read": round(t2 - t1, 4), "judge": round(t3 - t2, 4),
                   "total": round(t3 - t0, 4)},
        "usage_select": delta(s0, s1),
        "usage_judge": delta(s1, s2),
        "judgments": judged,
        "model_setting": model_used,
    }


def served_model(args):
    import requests
    url = (args.api_url or "https://api.typesafe.ai/v1/systemone")
    body = {"model": args.model, "state": "ping",
            "questions": {"q": {"type": "noul", "instructions": "This text is a greeting."}}}
    r = requests.post(url, json=body, headers={"Authorization": "Bearer proxy-injected"}, timeout=30)
    return r.json().get("model")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data_dir")
    ap.add_argument("questions")
    ap.add_argument("out")
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--api-url", default=None)
    ap.add_argument("--model", default="jev-latest")
    args = ap.parse_args()
    manifest = json.loads((Path(args.data_dir) / "manifest.m1.json").read_text())
    qs = json.loads(Path(args.questions).read_text())
    con = duckdb.connect()
    con.sql("LOAD spatial")
    boundary_wkt = con.sql(f"SELECT ST_AsText(geom) FROM ST_Read('{Path(args.data_dir) / 'boundary.geojson'}')").fetchone()[0]
    con.close()
    started = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    runs = []
    methods = ["A", "B", "C"]
    for rep in range(args.reps):
        order = methods[rep % 3:] + methods[:rep % 3]  # rotate the order between repetitions
        for q in qs["questions"]:
            for m in order:
                r = run_once(args, manifest, boundary_wkt, q, m)
                r["rep"] = rep
                runs.append(r)
                print(f"rep{rep} {q['id']:14s} {m}: files={r['files_read']:2d} rows={r['rows_read']:3d} "
                      f"t={r['time_s']['total']:.2f}s sel={r['time_s']['select']:.2f}s "
                      f"tok={r['usage_select']['input_tokens'] + r['usage_judge']['input_tokens']}", flush=True)
    out = {
        "started_utc": started,
        "finished_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "model_alias": args.model,
        "model_served": served_model(args),
        "duckdb": duckdb.__version__,
        "jev_extension": "community jev " + duckdb.connect().sql("LOAD jev; SELECT jev_version()").fetchone()[0],
        "manifest_version": manifest["version"],
        "questions_version": qs["version"],
        "reps": args.reps,
        "runs": runs,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
