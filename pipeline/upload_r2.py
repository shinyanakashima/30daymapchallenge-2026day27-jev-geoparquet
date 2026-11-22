"""Upload the GeoParquet files, manifests and boundaries to an R2 bucket.

Usage:
  R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
  python pipeline/upload_r2.py <bucket> [prefix=data] [--dry-run]

Uploads data/<city>/manifest.json, boundary.geojson and parts/*.parquet to <bucket>/<prefix>/<city>/.
"""
import os
import sys
from pathlib import Path

import boto3

TYPES = {".json": "application/json", ".geojson": "application/geo+json", ".parquet": "application/vnd.apache.parquet"}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    bucket = args[0]
    prefix = args[1] if len(args) > 1 else "data"
    root = Path(__file__).resolve().parent.parent / "data"
    files = [p for city in ("kitahiroshima", "sapporo") for p in sorted((root / city).rglob("*"))
             if p.is_file() and p.suffix in TYPES]
    s3 = None if dry else boto3.client(
        "s3", endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto")
    for p in files:
        key = f"{prefix}/{p.relative_to(root).as_posix()}"
        print(("would upload " if dry else "upload ") + f"{key} ({p.stat().st_size} bytes)")
        if s3:
            s3.upload_file(str(p), bucket, key, ExtraArgs={"ContentType": TYPES[p.suffix]})
    print(len(files), "files")


if __name__ == "__main__":
    main()
