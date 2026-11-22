"""Search GeoParquet files on R2 (or a local folder) with DuckDB and the jev extension.

The same three methods as pipeline/run_compare.py:
  A: read every file
  B: read the files that questions.json assigns to the question (only for the bundled questions)
  C: Jev judges each manifest entry; files marked "exclude" are skipped
"""
import json
import os
import time

import duckdb

ATTR_COLS = ["name", "name_en", "amenity", "leisure", "shop", "tourism", "historic", "office",
             "healthcare", "craft", "sport", "club", "cuisine", "operator", "brand", "access", "fee",
             "opening_hours", "description", "religion", "building", "playground", "indoor"]
FEATURE_OPTIONS = ["supported", "contradicted", "insufficient_information"]
FILE_OPTIONS = ["candidate", "exclude", "insufficient_information"]
CITIES = ("kitahiroshima", "sapporo")


def feature_question(q):
    return f'Does this place match the request "{q}"? Judge only from the attributes given.'


def file_question(q):
    return (f'This is a summary of one data file of places. Could the file contain places that match the '
            f'request "{q}"? Answer candidate if it may contain such places, exclude if it clearly does '
            f'not, insufficient_information if the summary is not enough to tell.')


def attributes_text():
    return "concat_ws('; ', " + ", ".join(f"'{c}: ' || {c}" for c in ATTR_COLS) + ")"


def sql_str(s):
    return "'" + str(s).replace("'", "''") + "'"


class Searcher:
    def __init__(self):
        # DATA_BASE: r2://<bucket>/<prefix> on Cloudflare, or a local folder such as ../data
        self.base = os.environ.get("DATA_BASE", "../data").rstrip("/")
        self.model = os.environ.get("JEV_MODEL", "jev-latest")
        self.max_rows = int(os.environ.get("JEV_MAX_ROWS_PER_STATEMENT", "20000"))
        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, "questions.json"), encoding="utf-8") as f:
            self.questions = json.load(f)
        self._cities = {}

    def connect(self):
        con = duckdb.connect()
        con.sql("LOAD spatial; LOAD httpfs; LOAD jev;")
        if self.base.startswith("r2://"):
            con.sql(f"""CREATE SECRET r2 (TYPE r2,
                        KEY_ID {sql_str(os.environ['R2_ACCESS_KEY_ID'])},
                        SECRET {sql_str(os.environ['R2_SECRET_ACCESS_KEY'])},
                        ACCOUNT_ID {sql_str(os.environ['R2_ACCOUNT_ID'])})""")
        if os.environ.get("JEV_API_URL"):
            con.sql(f"SET jev_api_url = {sql_str(os.environ['JEV_API_URL'])}")
        if os.environ.get("TYPESAFE_API_KEY"):
            con.sql(f"SET jev_api_key = {sql_str(os.environ['TYPESAFE_API_KEY'])}")
        con.sql(f"SET jev_model = {sql_str(self.model)}")
        con.sql(f"SET jev_max_rows_per_statement = {self.max_rows}")
        con.sql("SELECT jev_cache_clear()").fetchall()
        return con

    def city(self, con, city):
        if city not in self._cities:
            base = f"{self.base}/{city}"
            manifest = json.loads(con.sql(f"SELECT content FROM read_text({sql_str(base + '/manifest.json')})").fetchone()[0])
            gj = json.loads(con.sql(f"SELECT content FROM read_text({sql_str(base + '/boundary.geojson')})").fetchone()[0])
            geom = json.dumps(gj.get("geometry", gj))
            wkt = con.sql(f"SELECT ST_AsText(ST_GeomFromGeoJSON({sql_str(geom)}))").fetchone()[0]
            self._cities[city] = (base, manifest, wkt)
        return self._cities[city]

    @staticmethod
    def stats(con):
        return json.loads(con.sql("SELECT jev_stats()").fetchone()[0])

    @staticmethod
    def delta(a, b):
        keys = ["requests", "input_tokens", "output_tokens", "rows_evaluated", "cache_hits", "errors",
                "retries", "estimated_cost_usd"]
        return {k: round(b[k] - a[k], 10) if isinstance(b[k], float) else b[k] - a[k] for k in keys}

    def search(self, city, method, question_id=None, question_text=None):
        if city not in CITIES:
            raise ValueError(f"city must be one of {CITIES}")
        if method not in ("A", "B", "C"):
            raise ValueError("method must be A, B or C")
        rule = None
        if question_id:
            q = next((x for x in self.questions["questions"] if x["id"] == question_id), None)
            if q is None:
                raise ValueError("unknown question_id")
            question_text, rule = q["en"], q["rule_categories"]
        if not question_text or len(question_text) > 200:
            raise ValueError("question_text is required (200 characters or fewer)")
        if method == "B" and rule is None:
            raise ValueError("method B needs one of the bundled question_id values")

        con = self.connect()
        try:
            base, manifest, wkt = self.city(con, city)
            by_id = {f["id"]: f for f in manifest["files"]}
            s0 = self.stats(con)
            t0 = time.perf_counter()
            if method == "A":
                status = {fid: "read" for fid in by_id}
            elif method == "B":
                status = {fid: ("read" if f["category"] in rule else "skipped") for fid, f in by_id.items()}
            else:
                rows = [(f["id"], f["category_label"], f["rows"], f["unnamed_rows"],
                         ", ".join(f"{k}: {v}" for k, v in f["tag_counts"].items()),
                         ", ".join(f["sample_names"])) for f in manifest["files"]]
                con.sql("CREATE TABLE manifest (id VARCHAR, category VARCHAR, rows INTEGER, unnamed_rows INTEGER, "
                        "most_common_tags VARCHAR, sample_names VARCHAR)")
                con.executemany("INSERT INTO manifest VALUES (?, ?, ?, ?, ?, ?)", rows)
                status = dict(con.sql(f"""SELECT id, jev_choice(struct_pack(category, rows, unnamed_rows,
                                          most_common_tags, sample_names), {sql_str(file_question(question_text))},
                                          {FILE_OPTIONS}) FROM manifest""").fetchall())
            t1 = time.perf_counter()
            s1 = self.stats(con)
            read = [fid for fid, s in status.items() if s not in ("exclude", "skipped")]
            paths = [f"{base}/{by_id[fid]['file']}" for fid in read]
            if paths:
                con.sql(f"""CREATE TEMP TABLE cand AS
                            SELECT osm_id, {', '.join(ATTR_COLS)}, ST_X(geometry) AS lon, ST_Y(geometry) AS lat
                            FROM read_parquet({paths})
                            WHERE ST_Within(geometry, ST_GeomFromText({sql_str(wkt)}))""")
            else:
                con.sql("CREATE TEMP TABLE cand AS SELECT NULL::VARCHAR AS osm_id WHERE false")
            t2 = time.perf_counter()
            rows_read = con.sql("SELECT count(*) FROM cand").fetchone()[0]
            judged = []
            if rows_read:
                judged = con.sql(f"""SELECT osm_id, name, lon, lat,
                                     jev_choice(struct_pack(attributes := {attributes_text()}),
                                                {sql_str(feature_question(question_text))}, {FEATURE_OPTIONS}) AS j
                                     FROM cand""").fetchall()
            t3 = time.perf_counter()
            s2 = self.stats(con)
        finally:
            con.close()
        counts = {o: 0 for o in FEATURE_OPTIONS}
        for r in judged:
            counts[r[4]] += 1
        return {
            "city": city, "method": method, "question": question_text, "question_id": question_id,
            "model": self.model,
            "file_status": status,
            "files_read": len(read),
            "bytes_read": sum(by_id[f]["bytes"] for f in read),
            "rows_read": rows_read,
            "features_sent": len(judged),
            "judgment_counts": counts,
            "supported": [{"id": r[0], "name": r[1], "lon": round(r[2], 6), "lat": round(r[3], 6)}
                          for r in judged if r[4] == "supported"],
            "time_s": {"select": round(t1 - t0, 4), "read": round(t2 - t1, 4), "judge": round(t3 - t2, 4),
                       "total": round(t3 - t0, 4)},
            "usage_select": self.delta(s0, s1),
            "usage_judge": self.delta(s1, s2),
        }
