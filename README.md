# Before reading, the AI picks the files

**読む前に、AIがファイルを選ぶ** — #30DayMapChallenge 2026 Day 27「New tool」

![screenshot](docs/screenshot.png)

## 公開先

| 対象 | 公開先 | URL |
|---|---|---|
| 地図の作品（`web/`） | GitHub Pages | https://shinyanakashima.github.io/30daymapchallenge-2026day27-jev-geoparquet/ |
| 検索 API（`container/`） | Cloudflare Containers ＋ R2 | 手順は [`container/README.md`](container/README.md) |

### GitHub Pages

- `main` に `web/` の変更を push すると、`.github/workflows/pages.yml` がビルドして公開します（Node 22、`npm ci && npm run build`、出力先 `web/dist`）。
- 初回だけ、リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にします。
- 作品は静的なファイルだけで動きます（HTML・JS・CSS・JSON）。Jev の結果は計算済みの JSON（`web/public/data/`）として同梱しており、配信物に API キーは入りません。
- 最も大きいファイルは札幌の地物データ（約 4.4 MB）、全体で約 7 MB です。

## 作品について

北海道の 2 つの地域の OpenStreetMap の地物を、属性のカテゴリ（5 種）と区域で GeoParquet ファイルに分けました。ファイルごとの要約は、目録（`data/city=<地域>/manifest.m1.json`）にまとめています。

| 地域 | 地物 | ファイル | 区域の分け方 |
|---|---:|---:|---|
| 北広島市 | 589 | 20 | 地物の経度・緯度の中央値で 4 つ（北西・北東・南西・南東） |
| 札幌市 | 16,610 | 50 | 10 区（OSM の区界、`admin_level=8`） |

自然言語の質問を受けると、Jev（TypeSafe AI）が目録の各項目を評価して、読むファイルを決めます。DuckDB はそのファイルだけを読み、地物ごとの判定も Jev が行います。読むファイルの決め方を 3 通り（A・B・C）用意して、時間・API 使用量・候補の取りこぼしを比べました。

画面では、地域・質問・方式を選ぶと次のように表示されます。

- 各ファイルの受け持ち範囲（bbox）を、破線の枠で示します。色はファイル選択の結果です。
  - 方式C: 候補／除外／判断材料不足
  - 方式A・B: 読む／読まない
- bbox は、そのファイルに入っているデータの範囲です。地物がある位置そのものではありません。
- 地物の判定（supported／contradicted／insufficient_information）を点の色で示します。点をクリックすると、名前と、Jev に送った属性を表示します。
- 方式Aで supported になったのに、その方式が読まなかったファイルに入っていた地物は、取りこぼしとして赤い輪で示します。
- 区域×カテゴリのファイル一覧に、ファイルごとの行数と取りこぼしの件数を表示します。
- 3 回の計測から 1 回を選んで表示できます。
- 英語と日本語を切り替えられます。URL でも指定できます（例: `?lang=ja&city=sapporo&q=2&m=C`）。

## 分割と目録の作り方

1. `pipeline/extract.py`: OSM の PBF から市の行政界（`admin_level=7`）を取り出し、その中にある地物を抽出します。札幌市では、区界（`admin_level=8`）も取り出します。
   - 対象: `amenity` / `leisure` / `shop` / `tourism` / `historic` / `office` / `healthcare` / `craft` / `sport` / `club` のいずれかのタグを持つ地物です。
   - 除外: ベンチ、ごみ箱、駐車場などの設備は外しています。
   - 面の地物は、面の内側の代表点で表します。
2. `pipeline/partition.py`: タグの対応表で、地物を 5 つのカテゴリに分けます。
   - `parks_play`（公園・遊び場）
   - `sports`（スポーツ）
   - `commercial`（商業施設）
   - `public_culture`（文化・公共施設）
   - `other_unknown`（その他／分類不明）

   区域×カテゴリごとに 1 ファイルとし、GeoParquet 1.0（点のジオメトリ・WKB、zstd 圧縮）で書き出します。ファイルは Hive 形式（`data/city=<地域>/category=<カテゴリ>/area=<区域>/part-0.parquet`）で並べています。
3. 目録 `manifest.m1.json`（`m1` は目録の書き方の版）には、ファイルごとに次の項目を入れています。
   - ファイル名、カテゴリ、区域、bbox、行数、ファイルサイズ
   - 多いタグの上位 8 件とその件数
   - 名称の無い行の数
   - 名称の例（最大 6 件）

   目録は、この検索のために用意した補助のメタデータです。

R2 には、バケット `geo-opendata` のほかのデータと同じ決まり（出典-データ名 / 形式 / 時点）で置きます（`pipeline/upload_r2.py`）。

```
geo-opendata/osm-poi/source/2026-11-21/_source.json        出典・ライセンス・抽出の条件
geo-opendata/osm-poi/parquet/2026-11-21/city=<地域>/manifest.m1.json
geo-opendata/osm-poi/parquet/2026-11-21/city=<地域>/boundary.geojson
geo-opendata/osm-poi/parquet/2026-11-21/city=<地域>/category=<カテゴリ>/area=<区域>/part-0.parquet
```

## 比較の方法

3 つの方式で同じ質問を検索します。`pipeline/run_compare.py`

| 方式 | 読むファイル |
|---|---|
| A: 全ファイル | すべてのファイル |
| B: 固定ルール | 計測の前に作った対応表（`pipeline/questions.json` の `rule_categories`）で、質問ごとに決めたカテゴリのファイル |
| C: Jev が選ぶ | 目録の各項目を Jev の `jev_choice` で「candidate／exclude／insufficient_information」に分け、exclude 以外のファイル（判断材料不足は読む側に残す） |

ファイルを読んだあとの処理は、3 方式で同じです。

```sql
SELECT osm_id, ... FROM read_parquet([...]) WHERE ST_Within(geometry, <市の行政界>);
SELECT osm_id, jev_choice({attributes: 'name: ...; leisure: ...'}, '<質問>',
       ['supported', 'contradicted', 'insufficient_information']) FROM cand;
```

- Jev に送るのは、値のある属性だけを `key: value` の形でつないだ文字列です。ジオメトリは送りません。
- 候補保持率は、次の割合です。

  （方式Aで supported になった地物のうち、その方式が読んだファイルに含まれていたもの）÷（方式Aで supported になった地物）

  同じ回の方式Aを基準にします。地物の判定は回によって揺れるので、ファイル選択による取りこぼしだけを数えるために、この定義にしています。
- 方式Aの判定が 3 回とも一致した地物の割合は、北広島市で 90.0〜94.9%、札幌市で 89.5〜95.9% でした。
- 判定が正しいかどうか（適合率・再現率）は、人が付けた正解が無いため計っていません（未計測）。

## 測定の条件

- 地域ごとに、質問 4 つ×方式 3 つを、それぞれ 3 回ずつ計測しました。回ごとに方式の順番を入れ替えています。
- 1 回ごとに DuckDB の接続を作り直し、`jev_cache_clear()` で Jev のキャッシュを消しています。
- モデルは `jev-latest` を指定しました（実際に応答したのは `jev-1.14.0`）。DuckDB 1.5.5、community 拡張の `jev` 0.1.0 を使っています。
- jev 拡張の設定は既定値のままです（1 リクエスト 20 行、同時 16 リクエスト）。
- クラウドのコンテナから計測しました。手元の中継（`pipeline/jev_relay.py`）を経由しているため、その分の遅れも時間に含まれます。
- 総時間 = ファイル選択 + 読み込み + 地物の判定 です。
- 入力トークンと推定費用は、jev 拡張の `jev_stats()` の値です。費用は拡張による推定で、請求額ではありません。
- 計測日時（UTC）: 北広島市 2026-11-22 01:19–01:20、札幌市 2026-11-22 01:54–02:00。生データは `results/<地域>/runs.json` にあります。

## 結果

### 北広島市（589 件・20 ファイル）

| 質問 | 方式 | 読んだファイル | Jev に渡した地物 | 総時間 秒（中央値、最小–最大） | うちファイル選択 秒 | 入力トークン | 候補保持率（最小–最大） |
|---|---|---:|---:|---:|---:|---:|---:|
| 子どもが遊べる場所 | A | 20 | 589 | 0.69（0.66–1.51） | 0.00 | 57,802 | 100.0%（100.0–100.0%） |
| 子どもが遊べる場所 | B | 4 | 121 | 0.47（0.44–0.48） | 0.00 | 11,422 | 75.0%（73.6–78.2%） |
| 子どもが遊べる場所 | C | 19 | 571 | 0.94（0.92–1.12） | 0.27 | 61,361 | 100.0%（100.0–100.0%） |
| 雨の日に屋内で過ごせる場所 | A | 20 | 589 | 0.66（0.65–0.82） | 0.00 | 59,770 | 100.0%（100.0–100.0%） |
| 雨の日に屋内で過ごせる場所 | B | 8 | 318 | 0.56（0.49–0.69） | 0.00 | 37,677 | 75.0%（72.7–75.4%） |
| 雨の日に屋内で過ごせる場所 | C | 18 | 538 | 0.88（0.80–0.88） | 0.26 | 60,388 | 100.0%（100.0–100.0%） |
| 食料品や日用品を買える場所 | A | 20 | 589 | 0.62（0.60–0.76） | 0.00 | 58,786 | 100.0%（100.0–100.0%） |
| 食料品や日用品を買える場所 | B | 4 | 154 | 0.47（0.46–0.49） | 0.00 | 17,761 | 98.1%（98.0–98.1%） |
| 食料品や日用品を買える場所 | C | 8 | 305 | 0.79（0.74–0.85） | 0.27 | 39,867 | 100.0%（100.0–100.0%） |
| 地域の歴史や文化を学べる場所 | A | 20 | 589 | 0.69（0.67–0.73） | 0.00 | 59,278 | 100.0%（100.0–100.0%） |
| 地域の歴史や文化を学べる場所 | B | 4 | 164 | 0.42（0.41–0.44） | 0.00 | 19,480 | 88.9%（87.5–88.9%） |
| 地域の歴史や文化を学べる場所 | C | 18 | 541 | 0.89（0.82–0.97） | 0.23 | 62,374 | 100.0%（100.0–100.0%） |

### 札幌市（16,610 件・50 ファイル）

| 質問 | 方式 | 読んだファイル | Jev に渡した地物 | 総時間 秒（中央値、最小–最大） | うちファイル選択 秒 | 入力トークン | 候補保持率（最小–最大） |
|---|---|---:|---:|---:|---:|---:|---:|
| 子どもが遊べる場所 | A | 50 | 16,610 | 12.18（11.97–14.33） | 0.00 | 1,449,239 | 100.0%（100.0–100.0%） |
| 子どもが遊べる場所 | B | 10 | 2,863 | 2.45（2.29–2.61） | 0.00 | 232,158 | 84.4%（84.3–84.5%） |
| 子どもが遊べる場所 | C | 50 | 16,610 | 12.78（12.47–13.55） | 0.34 | 1,463,886 | 100.0%（100.0–100.0%） |
| 雨の日に屋内で過ごせる場所 | A | 50 | 16,610 | 12.62（12.52–16.37） | 0.00 | 1,497,015 | 100.0%（100.0–100.0%） |
| 雨の日に屋内で過ごせる場所 | B | 20 | 11,430 | 9.11（8.83–9.13） | 0.00 | 1,149,331 | 86.2%（80.2–86.3%） |
| 雨の日に屋内で過ごせる場所 | C | 42 | 14,174 | 10.87（10.49–11.17） | 0.28 | 1,309,756 | 100.0%（100.0–100.0%） |
| 食料品や日用品を買える場所 | A | 50 | 16,610 | 12.50（12.50–12.58） | 0.00 | 1,473,127 | 100.0%（100.0–100.0%） |
| 食料品や日用品を買える場所 | B | 10 | 6,998 | 5.43（5.31–5.74） | 0.00 | 662,340 | 99.1%（99.0–99.3%） |
| 食料品や日用品を買える場所 | C | 31 | 12,957 | 10.45（10.12–11.49） | 0.28 | 1,240,853 | 100.0%（100.0–100.0%） |
| 地域の歴史や文化を学べる場所 | A | 50 | 16,610 | 12.50（12.28–12.58） | 0.00 | 1,485,071 | 100.0%（100.0–100.0%） |
| 地域の歴史や文化を学べる場所 | B | 10 | 4,432 | 4.02（3.75–4.03） | 0.00 | 473,065 | 96.9%（96.9–97.7%） |
| 地域の歴史や文化を学べる場所 | C | 39 | 15,132 | 11.98（10.50–12.11） | 0.27 | 1,448,048 | 100.0%（99.6–100.0%） |

### 読み取れること

- 北広島市の規模では、方式Cの総時間はどの質問でも方式Aより長くなりました。589 行なら判定は 1〜2 回の同時リクエストで終わるので、ファイル選択の約 0.25 秒を取り戻せません。
- 札幌市では、方式Cがファイルを除外した 3 問で、方式Aより短くなりました。
  - 食料品: 12.50 → 10.45 秒、入力トークン 16% 減
  - 雨の日: 12.62 → 10.87 秒、13% 減
  - 歴史・文化: 12.50 → 11.98 秒、2.5% 減
  - どのファイルも除外しなかった「子どもが遊べる場所」では、選択の分だけ長くなりました。
- 方式Cの候補保持率の中央値は、どの質問も 100% でした。ただし札幌市では、3 回のうち 1 回だけ、1 件ずつ取りこぼしました。
  - 食料品: 手稲区の文化・公共施設ファイルにあったアイン薬局。目録の上位 8 タグに薬局が無く、このファイルは 3 回中 2 回「除外」になりました。
  - 歴史・文化: 厚別区の商業施設ファイルにあった「インフォーメーションセンター」（`tourism=information`）。
- 方式Bはいちばん速く、トークンも少ない一方で、候補保持率は北広島市で 75〜98%、札幌市で 84〜99% でした。取りこぼしの例を挙げます。
  - 子どもが遊べる場所: 児童会館、幼稚園、保育園（文化・公共施設のファイル）。札幌市で 268 件。
  - 雨の日に屋内で過ごせる場所: 体育館、ネットカフェ、水族館など（スポーツ、その他のファイル）。

## 目録の書き方の比較（札幌）

目録の版を4つ用意し、方式C を比べました。ファイル選択だけを質問ごとに各10回、地物の判定まで含めた方式C を各3回くり返しています。方式A は、同じ日（2026-11-23）に測り直した値です（11/22 の値とほぼ同じでした）。方式C・m1 は 11/22 の値です。候補保持率は、11/22 に測った方式A（3回）で supported になった地物を基準にした最小値です。

| 版 | Jev に見せるもの |
|---|---|
| m1 | ファイルごとに、カテゴリ・行数・多いタグの上位 8 件・名前の例 6 件 |
| m2 | ファイルごとに、すべてのタグと件数・タグごとに選んだ名前の例（最大 30 件）・名前や詳しい属性がある行の割合（`pipeline/manifest_m2.py`） |
| m3 | ファイルではなくタグごとに判断させる（タグ → ファイルの索引。`pipeline/manifest_m3.py`） |
| m4 | m3 に、タグごとの名前の例（よく出る名前 4 件と、珍しい名前 8 件）を添える（`pipeline/manifest_m4.py`） |

| 質問 | 方式・目録 | 読んだファイル（50中） | 総時間（秒） | 入力トークン | 候補保持率（方式C 3回の最小） | 候補保持率（選択のみ 10回の最小） | 選択が変わったファイル（10回） |
|---|---|---:|---:|---:|---:|---:|---:|
| 子どもが遊べる場所 | 方式A（全ファイル） | 50 | 13.36 | 1,449,239 | 100.0% | - | - |
| 子どもが遊べる場所 | 方式C・m1 | 50 | 12.78 | 1,463,886 | 100.0% | 100.0% | 4 |
| 子どもが遊べる場所 | 方式C・m2 | 50 | 13.70 | 1,486,878 | 100.0% | 100.0% | 1 |
| 子どもが遊べる場所 | 方式C・m3 | 50 | 13.49 | 1,524,063 | 100.0% | 100.0% | 3 |
| 子どもが遊べる場所 | 方式C・m4 | 50 | 12.98 | 1,554,577 | 100.0% | 100.0% | 4 |
| 雨の日に屋内で過ごせる場所 | 方式A（全ファイル） | 50 | 12.61 | 1,497,015 | 100.0% | - | - |
| 雨の日に屋内で過ごせる場所 | 方式C・m1 | 42 | 10.87 | 1,309,756 | 100.0% | 100.0% | 3 |
| 雨の日に屋内で過ごせる場所 | 方式C・m2 | 41 | 11.81 | 1,312,474 | 100.0% | 100.0% | 2 |
| 雨の日に屋内で過ごせる場所 | 方式C・m3 | 42 | 11.25 | 1,387,350 | 100.0% | 100.0% | 1 |
| 雨の日に屋内で過ごせる場所 | 方式C・m4 | 47 | 12.48 | 1,557,290 | 100.0% | 100.0% | 6 |
| 食料品や日用品を買える場所 | 方式A（全ファイル） | 50 | 12.42 | 1,473,127 | 100.0% | - | - |
| 食料品や日用品を買える場所 | 方式C・m1 | 31 | 10.45 | 1,240,853 | 99.9% | 99.7% | 15 |
| 食料品や日用品を買える場所 | 方式C・m2 | 20 | 6.91 | 790,827 | 99.2% | 99.2% | 11 |
| 食料品や日用品を買える場所 | 方式C・m3 | 14 | 6.62 | 799,140 | 99.2% | 99.5% | 3 |
| 食料品や日用品を買える場所 | 方式C・m4 | 29 | 10.53 | 1,307,855 | 100.0% | 100.0% | 13 |
| 地域の歴史や文化を学べる場所 | 方式A（全ファイル） | 50 | 12.54 | 1,485,071 | 100.0% | - | - |
| 地域の歴史や文化を学べる場所 | 方式C・m1 | 39 | 11.98 | 1,448,048 | 99.6% | 99.2% | 11 |
| 地域の歴史や文化を学べる場所 | 方式C・m2 | 29 | 9.38 | 1,117,057 | 98.8% | 98.8% | 5 |
| 地域の歴史や文化を学べる場所 | 方式C・m3 | 25 | 10.13 | 1,232,324 | 98.5% | 98.5% | 8 |
| 地域の歴史や文化を学べる場所 | 方式C・m4 | 38 | 12.34 | 1,559,341 | 100.0% | 100.0% | 0 |

- 要約の情報を増やす（m2）か、タグ単位で判断させる（m3）と、読むファイルが減り、食料品では方式A の約半分の時間とトークンで済んだ。一方で、候補保持率は 98.5〜99.5% に下がった。
- m2 では、文化・公共施設のファイルの要約に薬局が載っていても、ファイル全体の性格で「除外」と判断された。m3 では、`amenity=pharmacy` や `leisure=park` のタグだけでは「除外」になった。地物の判定で「該当」になったのは、名前（「ツルハドラッグ」「札幌手稲記念館」など）が決め手の地物だった。
- タグに名前の例を添えた m4 は、どの質問でも候補保持率 100%（選択のみ 10 回・方式C 3 回）だった。その代わり、読むファイルは m1 と同じ程度に戻り、短縮は食料品で約 15% にとどまった。

## Cloudflare 上の時間の内訳

Cloudflare 上の API（`container/`）で全件判定（方式A、子どもが遊べる場所）を 3 回呼び、API が返す内訳の中央値をとりました（2026-11-24）。

| 地域 | 読み込み（R2 から読み、市の範囲で絞る） | Jev の判定 | 合計 |
|---|---:|---:|---:|
| 北広島市（20 ファイル・589 件） | 6.7 秒 | 0.2 秒 | 6.9 秒 |
| 札幌市（50 ファイル・16,610 件） | 21.6 秒 | 4.5 秒 | 25.8 秒 |

同じ読み込みの SQL を、手元のファイルと R2 のファイルにかけた時間です（作業用の環境から測定。Jev は呼ばない。3 回の中央値）。

| 地域 | 手元のファイル | R2 のファイル | R2：各ファイルの目次（フッター）を読むだけ |
|---|---:|---:|---:|
| 北広島市（約 106KB） | 0.01 秒 | 3.00 秒 | 2.11 秒 |
| 札幌市（約 0.9MB） | 0.20 秒 | 5.37 秒 | 4.41 秒 |

- Cloudflare 上では、時間の大半が R2 からの読み込みでした。DuckDB の計算は、手元のファイルなら札幌でも約 0.2 秒です。
- R2 から読む時間の大半は、ファイルを 1 つずつ開いて目次を読む部分で、データ量より開くファイルの数で決まります。
- Cloudflare 上の読み込みは、作業用の環境から R2 を読むよりさらに遅く、理由は確認していません。
- データをコンテナの中に置けば読み込みは大きく縮む見込みですが、Cloudflare 上では未計測です。
- 「結果」の表の時間は、API キーを渡す中継プログラムを通して測ったため、Jev の判定は Cloudflare 上より長くなっています。

## 発展課題（未検証）

- Cloud Optimized GeoParquet（COGP）の詳細度（LoD）：ズームに応じて表示する地物を段階的に増やす仕組み。地図アプリで引いた画面では少ない地物だけを Jev が判定し、ズームインに合わせて判定を足していく場面、数件見つかればよい検索で途中で止める場面、見つかった地物から先に地図に出す場面で使えそうです。
- DuckDB の VSS（ベクトル検索）：名前・属性と質問の意味の近さで並べる仕組み。地物が多い地域で、質問に近い順の上位だけを Jev が判定して問い合わせの件数を減らす場面、自由文の質問で候補を先に集める場面で使えそうです。

## 注記

- 判定は、各地物の OpenStreetMap の属性だけに基づきます。実際の安全性、営業状況、適否を保証しません。
- データ: OpenStreetMap の北海道の抽出データ `hokkaido-latest.osm.pbf`（2026-11-21T00:15:44Z 時点）。取得元は OpenStreetMap France の extracts です（`data/city=<地域>/source.json`）。© OpenStreetMap contributors, ODbL 1.0。
- 背景地図: 地理院タイル（淡色地図、国土地理院）。
- Jev の出力の扱いは、TypeSafe の Master Customer Agreement に従います。

## 再現手順

```bash
pip install -r requirements.txt
curl -LO https://download.openstreetmap.fr/extracts/asia/japan/hokkaido-latest.osm.pbf
python pipeline/extract.py hokkaido-latest.osm.pbf work/sapporo sapporo
python pipeline/partition.py work/sapporo "data/city=sapporo" Sapporo
cp work/sapporo/boundary.geojson "data/city=sapporo/"
python pipeline/run_compare.py "data/city=sapporo" pipeline/questions.json results/sapporo/runs.json --reps 3
python pipeline/summarize.py "data/city=sapporo" pipeline/questions.json results/sapporo/runs.json web/public/data/sapporo
python pipeline/manifest_m2.py "data/city=sapporo"
python pipeline/manifest_m3.py "data/city=sapporo"
python pipeline/manifest_m4.py "data/city=sapporo"
python pipeline/run_compare.py "data/city=sapporo" pipeline/questions.json results/sapporo/runs_c_m4.json --reps 3 --methods C --manifest manifest.m4.json
python pipeline/selection_compare.py "data/city=sapporo" pipeline/questions.json results/sapporo/runs.json results/sapporo/selection_m4.json --manifests manifest.m4.json --reps 10
python pipeline/compare_manifests.py "data/city=sapporo" results/sapporo
python pipeline/input_experiments.py "data/city=kitahiroshima" results/kitahiroshima/input_experiments.json
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... python pipeline/r2_read_timing.py "r2://geo-opendata/osm-poi/parquet/2026-11-21/city=sapporo" "data/city=sapporo/manifest.m1.json" results/sapporo/r2_read_timing.json
R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... python pipeline/local_vs_r2_timing.py "data/city=sapporo" "r2://geo-opendata/osm-poi/parquet/2026-11-21/city=sapporo" results/sapporo/local_vs_r2_timing.json
python pipeline/cloudflare_timing.py <API の URL> sapporo A kids_play results/sapporo/cloudflare_timing.json
cd web && npm ci && npm run build && npx vite preview
```

- 北広島市は `sapporo` / `Sapporo` を `kitahiroshima` / `Kitahiroshima` に置き換えて実行します。
- `run_compare.py` と `selection_compare.py` は Jev の API を呼びます。先に環境変数 `TYPESAFE_API_KEY` を設定してください（`read -rs TYPESAFE_API_KEY && export TYPESAFE_API_KEY`）。
- `compare_manifests.py` は、`runs.json`・`runs_a_20261123.json`・`runs_c_m2.json`〜`runs_c_m4.json`・`selection_*.json` がそろっている前提で集計します（API は呼びません）。
- `input_experiments.py` は、Jev への送り方（空の列も含めるか、まとめる件数）による答えの違いを測ります。`r2_read_timing.py` と `local_vs_r2_timing.py` は、R2 から読む時間を測ります（Jev は呼びません。R2 の読み取り用のキーが要ります）。`cloudflare_timing.py` は、配信した API を呼んで時間の内訳を記録します（Jev の費用がかかります。札幌の全件判定 3 回で約 $0.18）。
- Jev の答えは毎回少し揺れるので、測り直した数字は完全には一致しません。
- Geofabrik の抽出データ（`https://download.geofabrik.de/asia/japan/hokkaido-latest.osm.pbf`）も同じ形式なので、そのまま使えます。
- 抽出データの時点が違うと、地物の件数や結果が変わります。

## チュートリアル

手を動かして確かめる手順は [`tutorial/README.md`](tutorial/README.md) にあります。

- Google Colab：DuckDB から Jev を呼ぶ処理と、jev 拡張の仕組みを、1 段ずつ確かめる（[Colab で開く](https://colab.research.google.com/github/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet/blob/main/tutorial/jev_geoparquet_colab.ipynb)）
- Docker：Cloudflare Containers で動かすのと同じ検索 API を、手元で動かす

同じ検索を Cloudflare Containers + R2 で動かす構成は [`container/README.md`](container/README.md) にあります。

## API キーの扱い

- API キーは、リポジトリにも配信物にも入れません。
- 通常は、環境変数 `TYPESAFE_API_KEY` に設定してから `run_compare.py` を実行します。jev 拡張はこの環境変数を読みます。
- API キーをプロキシが付ける環境（キーの値をプログラムに渡さない環境）では、次の手順で実行します。この経路では、キーの値はスクリプトから見えません。
  1. `python pipeline/jev_relay.py 8787` で中継を起動します。
  2. `run_compare.py` に `--api-url http://127.0.0.1:8787/v1/systemone` を付けて実行します。

  中継は、jev 拡張のリクエストをプロキシ経由でそのまま転送します。
- `.env` は `.gitignore` に入れてあります。

## ライセンス

コードは MIT License（`LICENSE`）です。データは ODbL 1.0 に従います。
