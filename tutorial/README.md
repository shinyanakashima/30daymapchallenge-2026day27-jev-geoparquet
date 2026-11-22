# チュートリアル

手を動かして確かめるためのチュートリアルを 2 つ用意しています。

| | 内容 | 必要なもの |
|---|---|---|
| [1. Google Colab](#1-google-colab処理の仕組み) | DuckDB から Jev を呼ぶ処理を、1 段ずつ実行して確かめる | Google アカウント、TypeSafe の API キー |
| [2. Docker](#2-docker検索-api-を手元で動かす) | Cloudflare Containers で動かすのと同じコンテナを、手元で動かす | Docker、TypeSafe の API キー |

どちらも、TypeSafe の API キーは https://console.typesafe.ai/keys で作ります。キーは、ファイルやノートブックの本文に書かないでください。

## 1. Google Colab：処理の仕組み

[jev_geoparquet_colab.ipynb を Colab で開く](https://colab.research.google.com/github/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet/blob/main/tutorial/jev_geoparquet_colab.ipynb)

1. 左側の鍵のアイコン（シークレット）で、`TYPESAFE_API_KEY` という名前でキーを登録します。「ノートブックからのアクセス」をオンにします。
2. 上から順に実行します。

ノートブックで確かめる内容は次のとおりです。

| 節 | 内容 |
|---|---|
| 1 | GeoParquet（カテゴリ × 区域の 20 ファイル）と目録の中身 |
| 2 | `jev_choice()` で地物を判定する SQL |
| 3 | jev 拡張の 4 つの仕組み |
| 4 | 目録を Jev に読ませて、読むファイルを選ぶ（候補／除外／判断材料不足） |
| 5 | 方式A（全ファイル）と方式C（Jev が選ぶ）の比較、候補保持率 |
| 6 | 結果を地図（folium）で見る |
| 7 | 自分の質問で試す |

節 3 で確かめる jev 拡張の仕組みは次の 4 つです。

| 仕組み | 確かめ方 |
|---|---|
| 20 行をまとめて 1 リクエスト | `jev_batch_size` を 1 と 20 で比べる |
| 同時 16 リクエスト | `jev_concurrency` を 1 と 16 で比べる |
| 同じ入力の答えはキャッシュ | 同じ問い合わせを 2 回実行し、2 回目の `cache_hits` を見る |
| 使用量の集計 | `jev_stats()` の値を見る |

北広島市（589 件）だけを使います。最後まで実行して、入力トークンは 20〜30 万、jev 拡張の推定で $0.01 前後です。

## 2. Docker：検索 API を手元で動かす

`container/` のイメージは、Cloudflare Containers で動かすものと同じです。手元では、R2 の代わりにリポジトリの `data/` を読ませます。

### 2-1. イメージを作る

```bash
git clone https://github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet.git
```

```bash
cd 30daymapchallenge-2026day27-jev-geoparquet
```

```bash
docker build -t jev-search container
```

- イメージは `linux/amd64` で作ります（Cloudflare Containers の条件）。
- Apple Silicon の Mac ではエミュレーションになるので、ビルドと実行が遅くなります。

### 2-2. API キーを環境変数に入れる

画面に表示せず、シェルの履歴にも残らない方法で入れます。

```bash
read -rs TYPESAFE_API_KEY && export TYPESAFE_API_KEY
```

### 2-3. コンテナを起動する

```bash
docker run --rm -p 8080:8080 -e TYPESAFE_API_KEY -e DATA_BASE=/data -v "$PWD/data:/data:ro" jev-search
```

- `-e TYPESAFE_API_KEY` は、値を書かずに名前だけ渡します（手元の環境変数がそのまま渡ります）。
- `DATA_BASE=/data` で、マウントしたリポジトリの `data/` を読ませます。

### 2-4. 別の端末から呼ぶ

```bash
curl localhost:8080/health
```

```bash
curl -s localhost:8080/questions
```

同梱の質問（食料品）を、方式C（Jev がファイルを選ぶ）で検索します。

```bash
curl -s -X POST localhost:8080/search -d '{"city":"kitahiroshima","method":"C","question_id":"groceries"}'
```

方式A（全ファイル）と比べます。

```bash
curl -s -X POST localhost:8080/search -d '{"city":"kitahiroshima","method":"A","question_id":"groceries"}'
```

自分の質問で試します（方式A・C のみ）。

```bash
curl -s -X POST localhost:8080/search -d '{"city":"kitahiroshima","method":"C","question_text":"A place to eat ramen"}'
```

応答の主な項目は次のとおりです。

| 項目 | 内容 |
|---|---|
| `file_status` | ファイルごとの選択結果 |
| `files_read`、`rows_read`、`features_sent` | 読んだファイル数・行数、Jev に渡した地物数 |
| `judgment_counts`、`supported` | 判定の内訳と、該当した地物（名前・位置） |
| `time_s` | 時間（ファイル選択・読み込み・判定・合計） |
| `usage_select`、`usage_judge` | `jev_stats()` の差分（リクエスト数・トークン・推定費用） |

### 2-5. R2 から読ませる（任意）

`pipeline/upload_r2.py` で R2 にデータを入れたあと、`DATA_BASE` を `r2://` に変えて起動します。

```bash
read -rs R2_SECRET_ACCESS_KEY && export R2_SECRET_ACCESS_KEY
```

```bash
docker run --rm -p 8080:8080 -e TYPESAFE_API_KEY -e R2_SECRET_ACCESS_KEY -e R2_ACCOUNT_ID=<アカウントID> -e R2_ACCESS_KEY_ID=<アクセスキーID> -e DATA_BASE=r2://jev-geoparquet/data jev-search
```

ここまで動けば、`container/README.md` の手順で Cloudflare に配信できます。

### 2-6. Worker も含めて手元で動かす（任意）

`wrangler dev` は、Docker でコンテナをビルドして、Worker とつないで動かします。

```bash
cd container
```

```bash
npm install
```

```bash
npx wrangler dev
```

秘密情報は `container/.dev.vars` に書きます（`.gitignore` 済み。コミットしないでください）。

```
TYPESAFE_API_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
```
