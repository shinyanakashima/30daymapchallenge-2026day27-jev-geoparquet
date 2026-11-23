"""Upload the GeoParquet files, manifests and boundaries to R2.

Layout in the bucket (same convention as the other datasets in geo-opendata: <source>-<dataset>/<format>/<date>/):

  osm-poi/source/<date>/_source.json
  osm-poi/parquet/<date>/<city>/manifest.m1.json
  osm-poi/parquet/<date>/<city>/boundary.geojson
  osm-poi/parquet/<date>/<city>/category=<category>/area=<area>/part-0.parquet

Usage:
  R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \\
  python pipeline/upload_r2.py [--bucket geo-opendata] [--date 2026-11-21] [--dry-run]
"""
import argparse
import json
import os
from pathlib import Path

TYPES = {".json": "application/json", ".geojson": "application/geo+json",
         ".parquet": "application/vnd.apache.parquet"}
CITIES = ("kitahiroshima", "sapporo")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bucket", default="geo-opendata")
    ap.add_argument("--date", default="2026-11-21", help="date of the OSM extract")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    root = Path(__file__).resolve().parent.parent / "data"

    uploads = []
    for city in CITIES:
        d = root / city
        files = [d / "manifest.m1.json", d / "boundary.geojson"] + sorted(d.glob("category=*/area=*/part-0.parquet"))
        for p in files:
            uploads.append((p, f"osm-poi/parquet/{args.date}/{city}/{p.relative_to(d).as_posix()}"))
    source = json.loads((root / CITIES[0] / "source.json").read_text())
    source["cities"] = list(CITIES)
    source["extraction"] = "pipeline/extract.py and pipeline/partition.py in github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet"
    source_body = json.dumps(source, ensure_ascii=False, indent=1).encode()

    s3 = None
    if not args.dry_run:
        import boto3
        s3 = boto3.client("s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                          aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                          aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto")
    key = f"osm-poi/source/{args.date}/_source.json"
    print(("would upload " if args.dry_run else "upload ") + key)
    if s3:
        s3.put_object(Bucket=args.bucket, Key=key, Body=source_body, ContentType="application/json")
    for p, key in uploads:
        print(("would upload " if args.dry_run else "upload ") + f"{key} ({p.stat().st_size} bytes)")
        if s3:
            s3.upload_file(str(p), args.bucket, key, ExtraArgs={"ContentType": TYPES[p.suffix]})
    print(len(uploads) + 1, "objects to", args.bucket)


if __name__ == "__main__":
    main()
