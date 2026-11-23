# Cloudflare Containers + R2 版（DuckDB + jev 拡張）

静的な作品（`web/`）は、計算済みの JSON を表示します。この `container/` は、同じ検索をその場で実行する API です。

- R2 に置いた GeoParquet を、Cloudflare Containers 上の DuckDB が読みます。
- 目録の評価と地物の判定は、jev 拡張が行います。

```
ブラウザ / curl ──> Worker ──> Durable Object ──> Container（Python + DuckDB 1.5.5 + spatial / httpfs / jev）
                                                     ├─ r2://geo-opendata/osm-poi/parquet/2026-11-21/city=<地域>/…
                                                     └─ api.typesafe.ai（Jev）
```

## API

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/health` | 起動確認（`ok`） |
| GET | `/questions` | 同梱の質問（`app/questions.json`） |
| POST | `/search` | 検索。`{"city": "sapporo", "method": "C", "question_id": "groceries"}` または `{"city": "sapporo", "method": "C", "question_text": "A place to eat ramen"}` |

- `city` は `kitahiroshima` か `sapporo` を指定します。
- `method` は `A`（全ファイル）、`B`（固定ルール。同梱の質問だけ）、`C`（Jev がファイルを選ぶ）のいずれかです。
- 応答に含まれるもの:
  - ファイルごとの選択結果、読んだファイル数・行数、Jev に渡した地物数
  - 判定の内訳、supported になった地物（名前と位置）
  - 時間（選択・読み込み・判定）、jev 拡張の `jev_stats()` の差分（リクエスト数・トークン・推定費用）

## jev 拡張の設定

| 設定 | 値 | 意味 |
|---|---|---|
| `jev_batch_size` | 20（既定） | 1 リクエストにまとめて送る行数 |
| `jev_concurrency` | 16（既定） | 同時に送るリクエスト数 |
| `jev_cache_clear()` | 検索ごとに実行 | 同じ行への答えのキャッシュを毎回消す（計測と同じ条件にするため） |
| `jev_stats()` | 検索の前後で取得 | リクエスト数・入力／出力トークン・推定費用・キャッシュヒット |
| `jev_max_rows_per_statement` | 20000（`JEV_MAX_ROWS_PER_STATEMENT`） | 1 つの SQL で送る行数の上限（使いすぎを防ぐ） |

## 配信の手順

1. **R2 にデータを入れる**（バケット `geo-opendata`）

   書き込みのできる R2 の API トークンで、リポジトリの直下から実行します。先に `--dry-run` で送り先を確かめられます。

   ```bash
   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... python pipeline/upload_r2.py --dry-run
   ```

   ```bash
   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... python pipeline/upload_r2.py
   ```

   送り先は `osm-poi/parquet/2026-11-21/city=<地域>/`（目録・境界・Hive 形式の GeoParquet）と `osm-poi/source/2026-11-21/_source.json` です（全部で 75 オブジェクト、約 1 MB）。`geo-opendata` は公開 URL でも読めるバケットなので、置いたものは公開されます（OSM 由来のデータは ODbL で、出典を `_source.json` に書いています）。

2. **秘密情報を登録する**（コンテナから R2 を読むためのキーは、`geo-opendata` の読み取り専用のトークンで作ります）

   ```bash
   cd container
   npm install
   npx wrangler secret put TYPESAFE_API_KEY
   npx wrangler secret put R2_ACCOUNT_ID
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   npx wrangler secret put DEMO_TOKEN
   ```

   - `DEMO_TOKEN` は任意です。登録すると、`/search` に `x-demo-token` ヘッダーが必要になります。
   - 検索のたびに TypeSafe の API の料金がかかるので、公開する場合は登録をおすすめします。

3. **配信する**（イメージのビルドに Docker が必要です）

   ```bash
   npx wrangler types
   npx wrangler deploy
   ```

4. **確認する**

   ```bash
   curl https://jev-geoparquet-search.<subdomain>.workers.dev/health
   ```

   ```bash
   curl -X POST https://jev-geoparquet-search.<subdomain>.workers.dev/search -H 'content-type: application/json' -H 'x-demo-token: <DEMO_TOKEN>' -d '{"city":"sapporo","method":"C","question_id":"groceries"}'
   ```

## 手元で動かす

R2 の代わりに、リポジトリの `data/` を読みます。

```bash
pip install duckdb==1.5.5
python -c "import duckdb; c=duckdb.connect(); c.sql('INSTALL spatial; INSTALL httpfs; INSTALL jev FROM community')"
cd container/app
DATA_BASE=../../data TYPESAFE_API_KEY=... python server.py
```

```bash
curl -X POST localhost:8080/search -d '{"city":"kitahiroshima","method":"C","question_id":"groceries"}'
```

## 注意

- コンテナの大きさは `standard-1`（1/2 vCPU、メモリ 4 GiB）にしています。札幌の全件（16,610 行）でも足ります。
- 1 つのコンテナで、検索は 1 件ずつ順に処理します（1 件の検索の中で、すでに最大 16 リクエストを同時に送るため）。
- 10 分間リクエストが無いと、コンテナは止まります。止まったあとの最初の検索は、起動を待つ分だけ遅くなります。
