"""Two small experiments on how rows are sent to Jev (Kitahiroshima, "A place where children can play").

1. Input format: a struct with every attribute column (empty ones included) vs. one text with only the
   non-empty attributes ("key: value; ..."), 20 rows per request, 2 runs each.
2. Batch size: the same 60 rows sent 1 per request vs. 20 per request, 2 runs each.

The Jev cache is cleared before every run. Usage: python pipeline/input_experiments.py <data_dir> <out.json> [--api-url URL]
"""
import argparse
import datetime as dt
import json
import time
from collections import Counter
from pathlib import Path

from run_compare import ATTR_COLS, FEATURE_OPTIONS, connect, delta, feature_question, sql_str, stats

Q = "A place where children can play"


def run(args, expr, source, batch):
    con = connect(args)
    con.sql(f"SET jev_batch_size = {batch}")
    s0, t0 = stats(con), time.perf_counter()
    rows = dict(con.sql(f"SELECT osm_id, jev_choice({expr}, {sql_str(feature_question(Q))}, {FEATURE_OPTIONS}) "
                        f"FROM {source}").fetchall())
    t = time.perf_counter() - t0
    d = delta(s0, stats(con))
    con.close()
    return rows, {"time_s": round(t, 3), "requests": d["requests"], "input_tokens": d["input_tokens"],
                  "counts": dict(Counter(rows.values()))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data_dir")
    ap.add_argument("out")
    ap.add_argument("--api-url", default=None)
    ap.add_argument("--model", default="jev-latest")
    args = ap.parse_args()
    all_rows = f"read_parquet('{Path(args.data_dir)}/category=*/area=*/part-0.parquet')"
    sample = f"(SELECT * FROM {all_rows} ORDER BY osm_id LIMIT 60)"
    struct_all = "struct_pack(" + ", ".join(ATTR_COLS) + ")"
    text = "struct_pack(attributes := concat_ws('; ', " + ", ".join(f"'{c}: ' || {c}" for c in ATTR_COLS) + "))"
    out = {"started_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "question": Q, "experiments": {}}
    for name, expr, source, batch in [("format_struct_all_columns", struct_all, all_rows, 20),
                                      ("format_text_non_empty", text, all_rows, 20),
                                      ("batch_1", text, sample, 1), ("batch_20", text, sample, 20)]:
        r1, m1 = run(args, expr, source, batch)
        r2, m2 = run(args, expr, source, batch)
        agree = sum(r1[k] == r2[k] for k in r1) / len(r1)
        out["experiments"][name] = {"rows": len(r1), "batch_size": batch, "runs": [m1, m2],
                                    "agreement_between_runs": round(agree, 4), "answers_run1": r1}
        print(name, len(r1), m1, m2, "agreement", round(agree, 3), flush=True)
    b1, b20 = out["experiments"]["batch_1"]["answers_run1"], out["experiments"]["batch_20"]["answers_run1"]
    out["batch_1_vs_batch_20_same_answer"] = sum(b1[k] == b20[k] for k in b1)
    print("batch1 vs batch20 same answer:", out["batch_1_vs_batch_20_same_answer"], "/", len(b1))
    out["finished_utc"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
