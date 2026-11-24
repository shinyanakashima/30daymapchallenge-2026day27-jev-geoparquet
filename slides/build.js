// Build the FOSS4G Hokkaido 2026 deck (4:3) from the measured results in web/public/data.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const ROOT = path.join(__dirname, "..");
const R = (city) => JSON.parse(fs.readFileSync(path.join(ROOT, `web/public/data/${city}/results.json`), "utf8"));
const KH = R("kitahiroshima");
const SP = R("sapporo");
const OUT = path.join(__dirname, "FOSS4G_Hokkaido_2026_jev_geoparquet.pptx");

const THEME = {
  name: "JevGeoParquet",
  headFontFace: "Meiryo UI",
  bodyFontFace: "Meiryo UI",
  colors: {
    dk1: "1D2124", lt1: "FFFFFF", dk2: "0B4F3D", lt2: "EEF3F0",
    accent1: "0F7B5F", accent2: "D49A12", accent3: "7D8894", accent4: "D1342F",
    accent5: "2B63B0", accent6: "5D666E", hlink: "0F7B5F", folHlink: "0B4F3D",
  },
};
const HEX = THEME.colors;
const COL = { A: "9AA3AD", B: "D49A12", C: "0F7B5F" };

const pres = new pptxgen();
pres.layout = "LAYOUT_4x3"; // 10 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "意思決定特化型AIで地理空間データを「解釈」して検索する";
pres.author = "Shinya Nakashima";
const C = {
  text1: HEX.dk1, background1: HEX.lt1, lt2: "CFE3DA", accent1: HEX.accent1, accent2: "A87508", accent6: HEX.accent6,
};

pres.defineSlideMaster({
  title: "DARK",
  background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 2.0, w: 8.8, h: 1.9, fontSize: 30, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.lt1 },
  margin: [0.5, 0.5, 0.5, 0.5],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.35, w: 9.0, h: 0.85, fontSize: 24, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "FOSS4G Hokkaido 2026", options: { x: 0.5, y: 7.05, w: 4, h: 0.3, fontSize: 9, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 9.0, y: 7.05, w: 0.5, h: 0.3, fontSize: 9, color: HEX.accent6, align: "right" },
});

const T = { isTextBox: true, margin: 0, color: C.text1, fontSize: 14, valign: "top" };
const muted = { color: C.accent6 };
const pct = (a, b) => Math.round(((b - a) / a) * 1000) / 10;
const med = (city, q, m) => city.questions.find((x) => x.id === q).methods[m].median;
const qs = (city) => city.questions.map((q) => q.ja);

function dashedBox(slide, x, y, w, h, color, fill, name) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: fill || HEX.lt1 }, line: { color, width: 1.5, dashType: "dash" }, objectName: name,
  });
}
function label(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, { ...T, x, y, w, h, ...opts });
}
function arrow(slide, x1, y1, x2, y2) {
  slide.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: HEX.accent6, width: 1.5, endArrowType: "triangle" } });
}
const chartBase = {
  catAxisLabelColor: HEX.dk1, valAxisLabelColor: HEX.accent6, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
  catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt",
  valGridLine: { color: "E3E6E8", size: 0.75 }, catGridLine: { style: "none" },
  showLegend: true, legendPos: "t", legendFontSize: 11, showValue: true, dataLabelFontSize: 9, dataLabelColor: HEX.dk1,
  dataLabelPosition: "outEnd", barGapWidthPct: 60,
};


const SPq = (id) => SP.questions.find((q) => q.id === id);
const MC = JSON.parse(fs.readFileSync(path.join(ROOT, "results/sapporo/manifest_comparison_summary.json"), "utf8"));
const CALL = JSON.parse(fs.readFileSync(path.join(ROOT, "results/examples/jev_call_20261123.json"), "utf8"));
const INP = JSON.parse(fs.readFileSync(path.join(ROOT, "results/kitahiroshima/input_experiments.json"), "utf8"));
const R2T = JSON.parse(fs.readFileSync(path.join(ROOT, "results/sapporo/r2_read_timing.json"), "utf8"));
const RJ = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const LVR = { kh: RJ("results/kitahiroshima/local_vs_r2_timing.json"), sp: RJ("results/sapporo/local_vs_r2_timing.json") };
const CF = { kh: RJ("results/kitahiroshima/cloudflare_timing.json"), sp: RJ("results/sapporo/cloudflare_timing.json") };
const KH4 = JSON.parse(fs.readFileSync(path.join(ROOT, "results/kitahiroshima/runs_a_c_m4_20261123.json"), "utf8"));
const MAN = (v) => JSON.parse(fs.readFileSync(path.join(ROOT, `data/city=sapporo/manifest.${v}.json`), "utf8"));
const M1 = MAN("m1"), M2 = MAN("m2"), M4 = MAN("m4");
const QUESTIONS_ALL = ["kids_play", "rainy_day", "groceries", "local_history"];
const QN = { kids_play: "子どもが遊べる場所", rainy_day: "雨の日に屋内で過ごせる場所", groceries: "食料品や日用品を買える場所", local_history: "地域の歴史や文化を学べる場所" };
const QS = { kids_play: "子ども", rainy_day: "雨の日", groceries: "食料品", local_history: "歴史・文化" };
const RULE = { kids_play: "公園・遊び場", rainy_day: "商業施設、公共・文化施設", groceries: "商業施設", local_history: "公共・文化施設" };
const head = (t, al) => ({ text: t, options: { bold: true, fill: { color: HEX.lt2 }, align: al || "left" } });
const rng = (city, m, key) => { const v = city.questions.map((q) => q.methods[m].median[key]); return [Math.min(...v), Math.max(...v)]; };
const pctf = (v) => `${(v * 100).toFixed(1)}%`;
const medianOf = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const tableOpts = (x, y, w, colW, extra = {}) => ({ x, y, w, colW, fontSize: 11, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, valign: "middle", ...extra });
const repro = (s, text) => label(s, `再現：${text}`, 0.5, 6.55, 9.0, 0.4, { fontSize: 9, fontFace: "Courier New", color: C.accent6 });
const code = (s, lines, x, y, w, h, fs = 10) => {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "code" });
  label(s, lines.join("\n"), x + 0.15, y + 0.08, w - 0.3, h - 0.16, { fontSize: fs, fontFace: "Courier New", valign: "middle" });
};
const content = (title, section) => { const sl = pres.addSlide({ masterName: "CONTENT", sectionTitle: section }); sl.addText(title, { placeholder: "title" }); return sl; };
const bullets = (s, items, x, y, w, h, fs = 13, gap = 6) => label(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })), x, y, w, h, { fontSize: fs, paraSpaceAfter: gap });
const keyline = (s, t, y = 5.85, h = 0.6) => label(s, t, 0.5, y, 9.0, h, { fontSize: 15, bold: true, color: C.accent1 });
const missRate = (q) => SPq(q).methods.B.runs.map((p) => p.missed.length / p.reference_candidates);
const supportedCount = (q) => SPq(q).methods.B.runs[0].reference_candidates;
const kh4 = (q, m) => KH4.runs.filter((r) => r.question === q && r.method === m);
const BASIS = "取りこぼしは、正解に対してではなく、Jev で全件を判定して「当てはまる」になった地物に対して数えた";

// 1 表紙 ---------------------------------------------------------------------------------------
pres.addSection({ title: "導入" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "導入" });
s.addText("意思決定特化型AIで\n地理空間データを「解釈」して検索する", { placeholder: "title" });
label(s, "意思決定特化型AI＝選択肢の中から答えを選ぶ AI。今回は TypeSafe AI 社の Jev を使い、地物の名前と属性を読ませて、条件に合うかを判定させて絞り込んだ", 0.6, 4.05, 8.8, 1.0, { color: C.lt2, fontSize: 15 });
label(s, "FOSS4G Hokkaido 2026　2026年11月28日", 0.6, 5.7, 8.8, 0.35, { color: C.background1, fontSize: 13 });
label(s, "Shinya Nakashima（株式会社ズコーシャ）", 0.6, 6.1, 8.8, 0.35, { color: C.background1, fontSize: 13 });
dashedBox(s, 7.6, 0.6, 1.8, 1.0, HEX.lt2, HEX.dk2, "motif-file-1");
dashedBox(s, 8.0, 0.9, 1.8, 1.0, HEX.accent2, HEX.dk2, "motif-file-2");
s.addNotes("選択肢の中から答えを選ぶタイプの AI モデル Jev を使って、曖昧な条件で地図上の場所を絞り込めるかを試しました。");

// 2 問い ---------------------------------------------------------------------------------------
s = content("今日の問い", "導入");
[["1", "「子どもが遊べる場所」のような曖昧な条件で、地図上の場所を絞り込めるか"],
 ["2", "従来のやり方と比べて、どれだけ多くの候補を拾えるか。代わりに何がかかるか"],
 ["3", "データは種類と区域ごとにたくさんのファイルに分けてある（札幌は50ファイル）。Jev に、先に読むファイルを選ばせると、かかる時間はどれだけ減るか"]].forEach(([n, t], i) => {
  const y = 1.5 + i * 1.3;
  label(s, n, 0.6, y, 0.6, 0.8, { fontSize: 36, bold: true, color: C.accent1 });
  label(s, t, 1.4, y + 0.1, 8.0, 1.0, { fontSize: 19, bold: true });
});
label(s, "対象：札幌市と北広島市の OpenStreetMap（OSM）の地物。施設・店・公園など", 0.6, 5.6, 8.8, 0.5, { fontSize: 14, ...muted });
s.addNotes("問いは3つです。曖昧な条件で絞り込めるか。従来のやり方と比べてどれだけ拾えて、何がかかるか。Jev に先に読むファイルを選ばせると、時間はどれだけ減るか。");

// 3 OSM の属性 ----------------------------------------------------------------------------------
pres.addSection({ title: "前提" });
s = content("OSM の地物には、種類を表す属性（タグ）が付いている", "前提");
label(s, "OpenStreetMap（OSM）は、世界中の人が編集できる地図データ。OSM では属性を「タグ」と呼び、地物ごとに「キー=値」の形で付ける。GIS の属性テーブルのように列が決まっているのではなく、必要な属性を地物ごとに足していく", 0.5, 1.3, 9.0, 1.0, { fontSize: 14 });
s.addTable([
  [head("名前（name）"), head("種類を表す属性（タグ）"), head("意味")],
  ["のびのび公園", { text: "leisure=park", options: { fontFace: "Courier New" } }, "公園"],
  ["もみじ台幼稚園", { text: "amenity=kindergarten", options: { fontFace: "Courier New" } }, "幼稚園"],
  ["ツルハドラッグ", { text: "amenity=pharmacy\nshop=chemist", options: { fontFace: "Courier New" } }, "薬局・ドラッグストア"],
], tableOpts(0.5, 2.45, 9.0, [2.6, 3.6, 2.8], { fontSize: 14, rowH: 0.55 }));
label(s, "札幌市の実データ（2026年11月21日時点の OSM）。今回は、よく使うキー（name・amenity・leisure・shop など）を属性の列にして扱った", 0.5, 4.85, 9.0, 0.5, { fontSize: 11, ...muted });
keyline(s, "GIS で場所を探すときは、ふつうこの種類の属性で絞り込む（例：amenity が kindergarten の地物）", 5.55, 0.7);
s.addNotes("OSM では属性のことをタグと呼び、キーと値の組で付けます。GIS の属性テーブルと違って列は決まっておらず、地物ごとに必要な属性を足していきます。");

// 4 属性が無い ---------------------------------------------------------------------------------
s = content("「子どもが遊べる場所」という属性は無い", "前提");
label(s, "従来のやり方：条件に合いそうな種類の属性（タグ）を、人が選んで対応表にする", 0.5, 1.35, 9.0, 0.5, { fontSize: 15, bold: true });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.95, w: 4.2, h: 1.5, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "rule" });
label(s, "子どもが遊べる場所\n→ 公園・遊び場の地物だけを見る", 0.7, 2.05, 3.9, 1.3, { fontSize: 17, bold: true, valign: "middle" });
bullets(s, ["対応表に入れなかった種類の地物は、検索にかからない", "幼稚園、児童会館、子ども向けの屋内施設……をどこまで入れるかは、人の判断", "「雨の日に屋内で過ごせる場所」のように、いくつもの種類にまたがる条件ほど難しい"], 5.0, 1.95, 4.5, 3.0, 14, 8);
keyline(s, "今回の試み：Jev に地物の名前と属性（タグ）を読ませ、条件に合うかを1件ずつ判定させる", 5.3, 0.8);
s.addNotes("子どもが遊べる場所、という属性はありません。従来は、合いそうな種類の属性を人が選んで対応表を作ります。今回は Jev に1件ずつ判定させました。");

// 5 Jev の入出力 --------------------------------------------------------------------------------
s = content("AI モデル Jev に送るもの、返ってくるもの", "前提");
label(s, "Jev は TypeSafe AI 社の AI モデル。インターネット経由（API）で呼び出す", 0.5, 1.25, 9.0, 0.35, { fontSize: 12, ...muted });
label(s, "送ったもの", 0.5, 1.65, 4.3, 0.35, { fontSize: 13, bold: true });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 2.0, w: 4.3, h: 2.95, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "request" });
label(s, [
  { text: "地物の情報", options: { bold: true, breakLine: true } },
  { text: CALL.request.state.attributes, options: { fontFace: "Courier New", breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "質問", options: { bold: true, breakLine: true } },
  { text: "この場所は「子どもが遊べる場所」に当てはまるか。属性だけから判断すること（実際は英文）", options: { breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "選択肢", options: { bold: true, breakLine: true } },
  { text: "supported（当てはまる）／ contradicted（当てはまらない）／ insufficient_information（判断材料不足）", options: {} },
], 0.65, 2.1, 4.0, 2.8, { fontSize: 12 });
arrow(s, 4.9, 3.45, 5.3, 3.45);
label(s, "返ってきたもの", 5.4, 1.65, 4.1, 0.35, { fontSize: 13, bold: true });
s.addShape(pres.shapes.RECTANGLE, { x: 5.4, y: 2.0, w: 4.1, h: 2.95, fill: { color: "EAF3EF" }, line: { type: "none" }, objectName: "response" });
const ans = CALL.response.answers.q;
label(s, [
  { text: "選んだ答え", options: { bold: true, breakLine: true } },
  { text: ans.choice, options: { fontFace: "Courier New", fontSize: 18, bold: true, color: C.accent1, breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "選択肢ごとの確率", options: { bold: true, breakLine: true } },
  { text: `supported ${ans.probabilities.supported} ／ contradicted ${ans.probabilities.contradicted} ／ insufficient_information ${ans.probabilities.insufficient_information}`, options: {} },
], 5.55, 2.1, 3.8, 2.8, { fontSize: 12 });
label(s, `${CALL.called_at} に札幌の「${CALL.feature.name}」で実際に呼んだ結果。jev-latest（最新版）を指定し、実際に答えたのは ${CALL.response.model}。読んだ量は ${CALL.response.usage.input_tokens} トークン（トークン＝Jev が読む文字量の単位。費用はこれで決まる）。${CALL.elapsed_s} 秒`, 0.5, 5.05, 9.0, 0.6, { fontSize: 11, ...muted });
keyline(s, "答えは、こちらが決めた選択肢のどれかで返る。そのため SQL で「判定が supported の地物だけ」のように絞り込める", 5.7, 0.75);
repro(s, "results/examples/jev_call_20261123.json の request を POST https://api.typesafe.ai/v1/systemone に送る");
s.addNotes("Jev は TypeSafe AI 社の AI モデルです。地物の情報、質問、選択肢を送ると、選択肢の中から答えを1つ返し、選択肢ごとの確率も返します。");

// 9 データの作り方 -------------------------------------------------------------------------------
pres.addSection({ title: "仕組み" });
s = content("データの作り方：OSM から GeoParquet へ", "仕組み");
[["1", "OSM の北海道のデータを取得", "hokkaido-latest.osm.pbf（2026-11-21 時点）"],
 ["2", "市の範囲と、施設・店・公園などの地物を取り出す", "札幌市 16,610件・北広島市 589件"],
 ["3", "種類の属性で5つのカテゴリに分け、さらに区域で分けて、GeoParquet のファイルにする", "札幌は10区で 50ファイル。北広島は区が無いので、地物の経度・緯度の中央値で北西・北東・南西・南東の4つに分け、20ファイル"],
 ["4", "ファイルごとの中身の一覧を作る", "どの種類の地物が何件あるか、名前の例など（後で説明）"],
 ["5", "Cloudflare R2（クラウドのファイル置き場）に置く", "バケット（置き場の名前）geo-opendata"]].forEach(([n, h, b], i) => {
  const y = 1.35 + i * 0.78;
  label(s, n, 0.5, y, 0.4, 0.65, { fontSize: 20, bold: true, color: C.accent1 });
  label(s, h, 1.0, y + 0.02, 4.5, 0.65, { fontSize: 12, bold: true, valign: "middle" });
  label(s, b, 5.6, y + 0.02, 3.9, 0.7, { fontSize: 11, ...muted, valign: "middle" });
});
code(s, ["geo-opendata/osm-poi/parquet/2026-11-21/city=sapporo/category=commercial/area=chuo/part-0.parquet"], 0.5, 5.3, 9.0, 0.5, 10);
label(s, "フォルダ名を「キー=値」にしておく（Hive 形式）と、DuckDB がそれを列として読める。カテゴリ：parks_play＝公園・遊び場、sports＝スポーツ、commercial＝商業施設、public_culture＝公共・文化施設、other_unknown＝その他", 0.5, 5.85, 9.0, 0.65, { fontSize: 10, ...muted });
repro(s, "pipeline/extract.py → partition.py → manifest_m2.py・m3・m4 → upload_r2.py（手順は再現のスライド）");
s.addNotes("OSM の北海道のデータから、市の範囲の施設などを取り出し、種類の属性でカテゴリに、さらに区域で分けて GeoParquet にしました。");

// 6 SQL ----------------------------------------------------------------------------------------
s = content("SQL の中で Jev を呼ぶ（DuckDB の jev 拡張）", "仕組み");
code(s, [
  "SELECT name,",
  "  jev_choice({attributes: concat_ws('; ', 'name: ' || name, 'amenity: ' || amenity,",
  "                                     'leisure: ' || leisure, …)},   -- 属性の列から文字列を作る",
  "    'Does this place match the request \"A place where children can play\"? …',",
  "    ['supported', 'contradicted', 'insufficient_information']) AS 判定",
  "FROM read_parquet('…/*.parquet')            -- GeoParquet のファイル群",
  "WHERE ST_Within(geometry, <札幌市の範囲>);     -- 空間条件はいつもどおり",
], 0.5, 1.4, 9.0, 2.1, 10);
bullets(s, [
  "地物は GeoParquet（空間データを扱える列指向のファイル形式）に保存した",
  "DuckDB（ファイルを直接 SQL で読めるデータベース）で読み、地物1件ごとに jev_choice で判定する。jev 拡張は、DuckDB のコミュニティ（有志）が配布する拡張機能で、INSTALL jev FROM community で入る",
  "Jev に送るのは、名前と種類の属性（タグ）など、値の入っている属性だけ。位置（ジオメトリ）は送らない",
], 0.5, 3.7, 9.0, 2.1, 13, 6);
keyline(s, "空間条件などはいつもの SQL のまま書き、Jev の判定は列を1つ足す形で加えられる", 5.9);
repro(s, "pipeline/run_compare.py の run_once()・attributes_text()（DuckDB 1.5.5）");
s.addNotes("DuckDB の jev 拡張を使うと、SQL の中で Jev を呼べます。属性の列から文字列を作って渡します。空間条件はいつもの SQL のままです。");

// 7 jev 拡張 ------------------------------------------------------------------------------------
s = content("jev 拡張の4つの仕組み", "仕組み");
label(s, "問い合わせ＝Jev の API を1回呼ぶこと。設定はすべて既定値のまま使った", 0.5, 1.25, 9.0, 0.35, { fontSize: 12, ...muted });
const feats = [
  ["20件をまとめて1回で問い合わせる", "jev_batch_size = 20", "北広島は589件のうち、名前と属性が互いに違う492件を、25回の問い合わせで判定した"],
  ["16回分の問い合わせを同時に送る", "jev_concurrency = 16", "北広島の25回分なら、同時に送るので、待ち時間は約2回分で済む"],
  ["同じ内容への答えを記憶する（答えの記憶）", "jev_cache_clear() で消去", "名前も属性も全く同じ地物（名前の無い公園など）は1回だけ問い合わせる。札幌では16,610件のうち、互いに違う11,944件だけを問い合わせた。記憶した答えは1回の検索の中だけで使い、次の検索の前に消した"],
  ["使った量を SQL で集計できる", "jev_stats()", "問い合わせ回数・トークン数・推定費用を返す。今日の回数・トークン・費用の数字はこれで取得（時間はスクリプトで測った）"],
];
feats.forEach(([h, sub, b], i) => {
  const x = 0.5 + (i % 2) * 4.6, y = 1.7 + Math.floor(i / 2) * 2.25;
  dashedBox(s, x, y, 4.4, 2.05, HEX.accent1, HEX.lt1, `feature-${i}`);
  label(s, h, x + 0.2, y + 0.12, 4.0, 0.4, { fontSize: 14, bold: true });
  label(s, sub, x + 0.2, y + 0.55, 4.0, 0.3, { fontSize: 11, fontFace: "Courier New", color: C.accent1 });
  label(s, b, x + 0.2, y + 0.9, 4.0, 1.1, { fontSize: 11, ...muted });
});
label(s, "モデル jev-1.14.0（jev-latest を指定）・DuckDB 1.5.5・jev 拡張 0.1.0", 0.5, 6.25, 9.0, 0.3, { fontSize: 10, ...muted });
repro(s, "results/*/runs.json の usage_judge（jev_stats の差分）");
s.addNotes("jev 拡張には4つの仕組みがあります。まとめて問い合わせる、同時に送る、同じ内容の答えを記憶する、使った量を集計できる。");

// 8 送り方で答えが変わる（NEW） ---------------------------------------------------------------------
s = content("Jev への送り方で、答えが変わる", "仕組み");
const fA = INP.experiments.format_struct_all_columns, fB = INP.experiments.format_text_non_empty;
const b1 = INP.experiments.batch_1, b20 = INP.experiments.batch_20;
label(s, "北広島の地物で、「子どもが遊べる場所」を2回ずつ判定した（jev 拡張の答えの記憶は毎回消した）", 0.5, 1.25, 9.0, 0.4, { fontSize: 12 });
label(s, "① 何を送るか（589件・20件ずつ）", 0.5, 1.75, 9.0, 0.35, { fontSize: 13, bold: true });
s.addTable([
  [head("送り方"), head("当てはまる", "right"), head("当てはまらない", "right"), head("判断材料不足", "right"), head("読んだ量（トークン）", "right")],
  ["空の列も含めて、全部の列をそのまま送る", { text: `${fA.runs[0].counts.supported}件`, options: { align: "right" } }, { text: `${fA.runs[0].counts.contradicted || 0}件`, options: { align: "right" } }, { text: `${fA.runs[0].counts.insufficient_information}件`, options: { align: "right" } }, { text: fA.runs[0].input_tokens.toLocaleString(), options: { align: "right" } }],
  ["値の入っている属性だけを「キー: 値」の文字列にして送る（今回の方法）", { text: `${fB.runs[0].counts.supported}件`, options: { align: "right", bold: true } }, { text: `${fB.runs[0].counts.contradicted || 0}件`, options: { align: "right" } }, { text: `${fB.runs[0].counts.insufficient_information}件`, options: { align: "right" } }, { text: fB.runs[0].input_tokens.toLocaleString(), options: { align: "right", bold: true } }],
], tableOpts(0.5, 2.1, 9.0, [4.0, 1.1, 1.3, 1.2, 1.4], { rowH: [0.38, 0.5, 0.6] }));
label(s, "② 何件ずつまとめて送るか（北広島の地物のうち、ID 順の先頭60件）", 0.5, 3.75, 9.0, 0.35, { fontSize: 13, bold: true });
s.addTable([
  [head("まとめる件数"), head("問い合わせ回数", "right"), head("読んだ量（トークン）", "right"), head("2回の答えの一致", "right")],
  ["1件ずつ", { text: `${b1.runs[0].requests}回`, options: { align: "right" } }, { text: b1.runs[0].input_tokens.toLocaleString(), options: { align: "right" } }, { text: pctf(b1.agreement_between_runs), options: { align: "right" } }],
  ["20件ずつ（既定値）", { text: `${b20.runs[0].requests}回`, options: { align: "right" } }, { text: b20.runs[0].input_tokens.toLocaleString(), options: { align: "right" } }, { text: pctf(b20.agreement_between_runs), options: { align: "right" } }],
], tableOpts(0.5, 4.08, 9.0, [3.0, 2.0, 2.0, 2.0], { rowH: 0.36 }));
bullets(s, [
  "空の列も送ると、ほとんどが「判断材料不足」になった。値のある属性だけを送ると「当てはまる」が増え、読む量も半分以下になった",
  `まとめる件数で答えが変わることがある。20件ずつでは60件中${b20.runs[0].counts.insufficient_information}件が「判断材料不足」で、2回の一致が高いのはそのため。1件ずつでは2回の一致がかえって下がった。1件ずつと20件ずつで同じ答えだったのは ${INP.batch_1_vs_batch_20_same_answer}件／60件（2回ずつの小さな試し）`,
], 0.5, 5.25, 9.0, 0.98, 11, 3);
label(s, "この実験はファイルを読む順番が本番の計測と違い、まとめ方が変わるため、件数は本番（当てはまる52〜55件・問い合わせ25回）と一致しない。名前と属性が全く同じ地物は1回にまとめて送るので、1件ずつでも問い合わせは58回", 0.5, 6.3, 9.0, 0.33, { fontSize: 8, ...muted });
repro(s, "python pipeline/input_experiments.py \"data/city=kitahiroshima\" results/kitahiroshima/input_experiments.json");
s.addNotes("送り方で答えが変わります。空の列も含めて送ると、ほとんどが判断材料不足になりました。値のある属性だけを文字列にして送ると、当てはまる地物が8件から64件に増え、読む量も半分以下になりました。また、まとめて送る件数を変えると、答えが変わる地物がありました。");

// 10 比べた3つのやり方 ------------------------------------------------------------------------------
s = content("比べた3つのやり方", "仕組み");
const ways = [
  ["全件判定", "すべてのファイルを読み、全地物を Jev が判定する", "取りこぼしが無い。比べるときの基準"],
  ["従来のやり方", "条件ごとに見るカテゴリを人が決め（対応表）、そのカテゴリのファイルだけを読んで、Jev が判定する", "例：子どもが遊べる場所 → 公園・遊び場のファイルだけ。比べやすくするため、最後の判定は Jev で行った"],
  ["Jev が先にファイルを選ぶ", "ファイルごとの中身の一覧を Jev に読ませ、当てはまる地物がありそうなファイルだけを読んで、Jev が判定する", "読まないファイルの地物は判定しないので、速くなりうる"],
];
ways.forEach(([h, d, n], i) => {
  const y = 1.35 + i * 1.45;
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y, w: 9.0, h: 1.3, fill: { color: i === 2 ? "EAF3EF" : "F4F5F6" }, line: { type: "none" }, objectName: `way-${i}` });
  label(s, h, 0.7, y + 0.1, 2.6, 0.5, { fontSize: 15, bold: true, color: i === 2 ? C.accent1 : C.text1 });
  label(s, d, 3.4, y + 0.1, 5.9, 0.6, { fontSize: 12 });
  label(s, n, 3.4, y + 0.75, 5.9, 0.5, { fontSize: 11, ...muted });
});
label(s, "3つのやり方の差は「どのファイルを読むか」だけ。4条件 × 各3回測った", 0.5, 5.75, 9.0, 0.35, { fontSize: 12 });
label(s, `${BASIS}。Jev の判定に誤りがあっても、それは数に含まれる`, 0.5, 6.1, 9.0, 0.45, { fontSize: 11, ...muted });
repro(s, "pipeline/questions.json（4条件と対応表）、run_compare.py --methods A,B,C（A＝全件、B＝従来、C＝Jev が選ぶ）");
s.addNotes("比べたのは3つのやり方です。違いはどのファイルを読むかだけで、最後の判定はどれも Jev です。取りこぼしは、正解ではなく、Jev の全件判定を基準に数えます。");

// 11 結果① --------------------------------------------------------------------------------------
pres.addSection({ title: "結果" });
s = content("結果①：従来のやり方では見つからない候補を拾えた", "結果");
label(s, "札幌市 16,610件。Jev が全件判定で「当てはまる」とした地物のうち、従来のやり方で見るカテゴリの外にあったものを数えた", 0.5, 1.25, 9.0, 0.6, { fontSize: 13 });
const ex = { kids_play: "幼稚園・児童会館・学童クラブ", rainy_day: "プール・銭湯・ジム・ネットカフェ", groceries: "ドラッグストア", local_history: "博物館・郷土資料館" };
s.addTable([
  [head("条件"), head("従来のやり方で見たカテゴリ"), head("当てはまる（1回目）", "right"), head("カテゴリの外（1回目）", "right"), head("外の割合（3回）", "right"), head("外にあった地物の例")],
  ...SP.questions.map((q) => { const n = supportedCount(q.id), m = q.methods.B.runs[0].missed.length, r = missRate(q.id);
    const lo = Math.round(Math.min(...r) * 100), hi = Math.round(Math.max(...r) * 100);
    return [QN[q.id], RULE[q.id], { text: `${n.toLocaleString()}件`, options: { align: "right" } }, { text: `${m}件`, options: { align: "right" } }, { text: lo === hi ? `${lo}%` : `${lo}〜${hi}%`, options: { align: "right", bold: hi >= 10 } }, ex[q.id]]; }),
], tableOpts(0.5, 1.95, 9.0, [1.65, 1.55, 1.15, 1.15, 1.05, 2.45], { fontSize: 10, rowH: [0.5, 0.55, 0.55, 0.55, 0.55] }));
label(s, "当てはまるとした地物は Jev の判定なので、誤りも含む（正しさは未確認）", 0.5, 4.8, 9.0, 0.35, { fontSize: 11, ...muted });
keyline(s, "今回の4条件では、種類が多岐にわたる「子ども」（16%）と「雨の日」（14〜20%）で、従来のやり方では見つからない地物が多かった", 5.3, 0.9);
repro(s, "results/sapporo/runs.json → pipeline/summarize.py → web/public/data/sapporo/results.json の method B の missed");
s.addNotes("子どもが遊べる場所では、Jev が当てはまるとした地物の16%が、従来のやり方では見るカテゴリの外にありました。雨の日では3回で14から20%です。");

// 12 地図 ----------------------------------------------------------------------------------------
s = content("結果①の地図：札幌・子どもが遊べる場所", "結果");
s.addImage({ path: path.join(__dirname, "img/sapporo_kids_fixed_rule.png"), x: 0.5, y: 1.3, w: 5.4, h: 4.85, objectName: "map-fixed-rule", altText: "札幌・子どもが遊べる場所。従来のやり方では見つからない地物を赤い輪で示した地図" });
bullets(s, [
  "赤い輪：全件判定で当てはまるとされたが、従来のやり方（公園・遊び場のファイルだけ見る）では読まないファイルにあった地物",
  "緑・黄・灰の点：従来のやり方で読んだファイルの地物。緑＝当てはまる、黄＝判断材料不足、灰＝当てはまらない",
  "白い点：従来のやり方では読まないファイルの地物のうち、取りこぼし以外",
  "破線の四角：ファイルが受け持つ範囲（データの範囲で、地物の位置そのものではない）",
], 6.1, 1.4, 3.4, 4.7, 11, 8);
repro(s, "作品の画面（shinyanakashima.github.io/30daymapchallenge-2026day27-jev-geoparquet/?lang=ja&city=sapporo&q=0&m=B）");
s.addNotes("赤い輪が、従来のやり方では読まないファイルにあった地物です。市街地の全体に散らばっています。");

// 13 結果② --------------------------------------------------------------------------------------
s = content("結果②：代わりに、時間と費用がかかる", "結果");
const [kt0, kt1] = rng(KH, "A", "total_s"), [st0, st1] = rng(SP, "A", "total_s"), [kr0, kr1] = rng(KH, "A", "read_s"), [sr0, sr1] = rng(SP, "A", "read_s");
const [kc0, kc1] = rng(KH, "A", "estimated_cost_usd"), [sc0, sc1] = rng(SP, "A", "estimated_cost_usd");
s.addTable([
  [head(""), head("北広島市（589件）", "right"), head("札幌市（16,610件）", "right")],
  ["Jev で全件を判定（1回の検索）", { text: `${kt0.toFixed(1)}〜${kt1.toFixed(1)}秒`, options: { align: "right", bold: true } }, { text: `${st0.toFixed(1)}〜${st1.toFixed(1)}秒`, options: { align: "right", bold: true } }],
  ["推定費用（1回の検索）", { text: `$${kc0.toFixed(4)}〜${kc1.toFixed(4)}`, options: { align: "right" } }, { text: `$${sc0.toFixed(3)}〜${sc1.toFixed(3)}`, options: { align: "right" } }],
  ["参考：ファイルを読み、市の範囲で絞るまで（Jev の判定なし。手元のファイル）", { text: `${kr0.toFixed(2)}〜${kr1.toFixed(2)}秒`, options: { align: "right" } }, { text: `${sr0.toFixed(2)}〜${sr1.toFixed(2)}秒`, options: { align: "right" } }],
], tableOpts(0.5, 1.4, 9.0, [3.8, 2.6, 2.6], { fontSize: 13, rowH: 0.6 }));
label(s, "4条件 × 各3回の中央値の範囲（2026-11-22 計測）。推定費用は jev 拡張の推定値（読んだ量100万トークンあたり $0.042）", 0.5, 3.95, 9.0, 0.4, { fontSize: 10, ...muted });
bullets(s, [
  "件数が増えると、時間も費用も増える。札幌は北広島の約28倍の件数で、時間は約18倍だった（北広島は問い合わせが25回分しかなく、同時に送るぶん、件数のわりに早く終わる）",
  "費用は小さい。札幌の全件でも1回あたり約 $0.06（1ドル150円で約9円）",
  "問題になるのは待ち時間。札幌の全件では、1回の検索に約12秒かかった",
], 0.5, 4.5, 9.0, 1.95, 13, 6);
repro(s, "results/kitahiroshima/runs.json・results/sapporo/runs.json の method A（time_s・usage_judge）");
s.addNotes("北広島の589件なら1秒弱ですが、札幌の16,610件では約12秒かかりました。費用は小さく、問題は待ち時間です。");

// 14 ファイルの中身の一覧 ---------------------------------------------------------------------------
s = content("Jev がファイルを選ぶ材料：ファイルの中身の一覧", "結果");
label(s, "Jev はファイルの中の地物を見ずに、この一覧だけを読んで「当てはまる地物がありそうか」を判断する。一覧に何を書くかで、選び方が変わる", 0.5, 1.3, 9.0, 0.8, { fontSize: 14 });
const t1 = M1.files.find((f) => f.id === "public_culture__teine");
code(s, [
  `ファイル：手稲区・公共・文化施設（${t1.rows}件）`,
  `多い種類の上位8件：${Object.entries(t1.tag_counts).slice(0, 4).map(([k, v]) => `${k} ${v}件`).join("、")}、…`,
  `名前の例：${t1.sample_names.slice(0, 4).join("、")}、…`,
], 0.5, 2.2, 9.0, 1.3, 10);
label(s, "札幌の実際の一覧（最初に使った「簡易な一覧（m1）」）の1項目。このファイルには薬局が4件あるが、種類の上位8件には入らず、名前の例に1件（なの花薬局）だけ出ている", 0.5, 3.6, 9.0, 0.6, { fontSize: 11, ...muted });
bullets(s, [
  "Jev は、一覧の各ファイルについて「候補（読む）」「除外（読まない）」「判断材料不足（念のため読む）」のどれかを選ぶ",
  "「除外」以外のファイルを読み、中の地物を Jev が判定する",
  "一覧を作るには、事前の準備（ファイルごとの集計）が要る",
], 0.5, 4.35, 9.0, 1.6, 13, 6);
repro(s, "data/city=sapporo/manifest.m1.json（pipeline/partition.py が作る）");
s.addNotes("Jev がファイルを選ぶときに読むのは、この中身の一覧だけです。一覧に何を書くかで、選び方が変わります。");

// 15 結果③ ---------------------------------------------------------------------------------------
s = content("結果③：Jev が先にファイルを選んだ場合の速さ", "結果");
const twoCharts = (city, x, title, fmt) => s.addChart(pres.charts.BAR, ["A", "C"].map((m) => ({ name: m === "A" ? "全件判定" : "Jev が先にファイルを選ぶ", labels: city.questions.map((q) => QS[q.id]), values: city.questions.map((q) => q.methods[m].median.total_s) })), {
  x, y: 1.3, w: 4.4, h: 3.6, barDir: "bar", ...chartBase, chartColors: [COL.A, COL.C],
  showTitle: true, title, titleFontSize: 12, titleColor: HEX.dk1, titleFontFace: "+mn-lt", dataLabelFormatCode: fmt, valAxisMinVal: 0, catAxisOrientation: "maxMin",
});
twoCharts(KH, 0.5, `北広島 ${KH.meta.features}件：1回の検索の時間（秒）`, "0.00");
twoCharts(SP, 5.1, `札幌 ${SP.meta.features.toLocaleString()}件：1回の検索の時間（秒）`, "0.0");
const lossFull = 100 - Math.min(...QUESTIONS_ALL.map((q) => MC.full.m1[q].ret_min)) * 100;
const lossSel = 100 - Math.min(...QUESTIONS_ALL.map((q) => MC.selection[`m1|${q}`].ret_min)) * 100;
bullets(s, [
  "北広島の589件では、ファイルを選ぶ時間（約0.25秒）の分だけ、どの条件でも遅くなった",
  "札幌の16,610件では、読まないファイルがあった条件で速くなった（食料品 12.5 → 10.5秒）。どのファイルも読んだ「子ども」は遅くなった",
  `一覧は簡易な一覧（m1）。札幌の取りこぼしは、検索3回で最大${lossFull.toFixed(1)}%、ファイル選択だけを10回くり返すと最大${lossSel.toFixed(1)}%`,
], 0.5, 5.0, 9.0, 1.5, 12, 4);
repro(s, "results/*/runs.json の method A と C（2026-11-22。pipeline/run_compare.py、一覧は manifest.m1.json）");
s.addNotes("Jev が先にファイルを選ぶと、北広島の589件ではかえって遅くなり、札幌の16,610件では、読まないファイルがあった条件で速くなりました。");

// 17 一覧の4つの版 ----------------------------------------------------------------------------------
pres.addSection({ title: "一覧の改良" });
s = content("一覧の書き方を4通り試した（m1〜m4）", "一覧の改良");
label(s, "m1〜m4 は、一覧のファイル名（manifest.m1.json〜m4.json）に合わせた呼び名。手稲区の公共・文化施設のファイル（薬局4件を含む）を例にすると、Jev に見せる内容は次のとおり", 0.5, 1.25, 9.0, 0.7, { fontSize: 12 });
const pharm = M4.tags.find((t) => t.tag === "amenity=pharmacy");
const t2 = M2.files.find((f) => f.id === "public_culture__teine");
s.addTable([
  [head("版"), head("Jev に見せるもの"), head("このファイルの場合")],
  ["m1\n簡易な一覧", "ファイルごとに、カテゴリ・件数・多い種類の上位8件・名前の例6件", "薬局は上位8件に入らない。名前の例に1件だけ出る"],
  ["m2\n詳しい一覧", "ファイルごとに、すべての種類と件数・種類ごとに選んだ名前の例（最大30件）・名前がある割合", `${Object.keys(t2.tag_counts).length}種類の中に amenity=pharmacy（薬局）4件が見える`],
  ["m3\n種類ごとの一覧", `ファイルではなく種類（タグ）ごとに Jev に聞く（札幌は ${M4.tags.length}種類）。当てはまりうる種類を含むファイルを読む`, `「amenity=pharmacy（札幌全体で${pharm.rows}件）」という種類だけを見て判断する`],
  ["m4\n種類ごとの一覧\n＋名前の例", "m3 に、種類ごとの名前の例（よく出る名前4件と、珍しい名前8件）を添える", `「amenity=pharmacy：${pharm.example_names.slice(0, 3).join("、")}、…」と見せる`],
], tableOpts(0.5, 2.05, 9.0, [1.5, 4.0, 3.5], { rowH: [0.4, 0.8, 0.85, 0.85, 0.95] }));
label(s, `m3・m4 は種類の数だけ判定するので、ファイル選択に約${MC.full.m3.groceries.sel.toFixed(1)}秒かかる（m1 は約${MC.full.m1.groceries.sel.toFixed(1)}秒）。m2 → m3 → m4 の順に作る`, 0.5, 6.0, 9.0, 0.45, { fontSize: 11, ...muted });
repro(s, "pipeline/manifest_m2.py・manifest_m3.py・manifest_m4.py \"data/city=sapporo\"");
s.addNotes("一覧の書き方を4通り試しました。m1 は最初に使った簡易な一覧、m2 は詳しい一覧、m3 は種類ごとに聞く一覧、m4 は種類ごとに名前の例を添えた一覧です。");

// 18 一覧の比較結果 ----------------------------------------------------------------------------------
s = content("一覧の書き方ごとの、速さと取りこぼし", "一覧の改良");
const vers = ["A", "m1", "m2", "m3", "m4"];
const vlab = { A: "全件判定", m1: "m1", m2: "m2", m3: "m3", m4: "m4" };
s.addChart(pres.charts.BAR, [{ name: "時間", labels: vers.map((v) => vlab[v]), values: vers.map((v) => MC.full[v].groceries.total) }], {
  x: 0.5, y: 1.3, w: 4.4, h: 3.4, barDir: "col", ...chartBase, showLegend: false,
  chartColors: [COL.A, "7FB8A4", "4E9C81", "2E8667", COL.C], invertedColors: [COL.A, "7FB8A4", "4E9C81", "2E8667", COL.C],
  showTitle: true, title: "札幌・食料品：1回の検索の時間（秒、3回の中央値）", titleFontSize: 11, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
  dataLabelFormatCode: "0.0", valAxisMinVal: 0,
});
s.addTable([
  [head("版"), head("読んだファイル（食料品、50中）", "right"), head("拾えた割合：食料品", "right"), head("同：歴史・文化", "right")],
  ...["m1", "m2", "m3", "m4"].map((v) => [v, { text: String(MC.full[v].groceries.files), options: { align: "right" } },
    { text: pctf(MC.selection[`${v}|groceries`].ret_min), options: { align: "right", bold: v === "m4" } }, { text: pctf(MC.selection[`${v}|local_history`].ret_min), options: { align: "right", bold: v === "m4" } }]),
], tableOpts(5.1, 1.35, 4.4, [0.5, 1.3, 1.4, 1.2], { fontSize: 10, rowH: [0.6, 0.42, 0.42, 0.42, 0.42] }));
label(s, `拾えた割合：全件判定で当てはまった地物のうち、読んだファイルに入っていた割合。ファイル選択だけを10回くり返した最小値。${BASIS}`, 5.1, 3.85, 4.4, 0.85, { fontSize: 9, ...muted });
const sp = (v, q) => Math.round((1 - MC.full[v][q].total / MC.full.A[q].total) * 1000) / 10;
bullets(s, [
  "m2・m3 は、食料品で全件判定の約半分の時間（12.4 → 6.6〜6.9秒）で済んだが、少数の地物を取りこぼした（98.5〜99.5%）",
  `m4 は、4条件すべてで1件も取りこぼさなかった（ファイル選択だけ10回、検索全体3回とも）。速さは m1 とほぼ同じで、食料品で全件判定より約${Math.round(sp("m4", "groceries"))}%速くなり、ほかの3条件はほぼ変わらなかった（${Math.min(sp("m4", "kids_play"), sp("m4", "rainy_day"), sp("m4", "local_history")).toFixed(0)}〜${Math.max(sp("m4", "kids_play"), sp("m4", "rainy_day"), sp("m4", "local_history")).toFixed(0)}%）`,
], 0.5, 4.85, 9.0, 1.3, 12, 5);
label(s, "全件判定と m2〜m4 は 2026-11-23、m1 は 11/22 に測った（そのため前のスライドの全件判定 12.5秒と少し違う）", 0.5, 6.15, 9.0, 0.35, { fontSize: 9, ...muted });
repro(s, "pipeline/selection_compare.py（10回）・run_compare.py --methods C --manifest manifest.m4.json（3回）→ compare_manifests.py");
s.addNotes("一覧を詳しくしたり、種類ごとに聞いたりすると、食料品では約半分の時間で済みましたが、少数の地物を取りこぼしました。名前の例を添えた m4 では取りこぼしが無くなりましたが、速くなったのは食料品の約15%で、ほかの条件はほぼ変わりませんでした。");

// 19 なぜ落ちたか ------------------------------------------------------------------------------------
s = content("取りこぼした地物：名前を見れば分かるものがあった", "一覧の改良");
s.addTable([
  [head("条件"), head("m3 で取りこぼした地物"), head("種類（タグ）"), head("Jev が選んだ答え")],
  ["食料品や日用品を買える場所", "19件。ツルハドラッグ、サツドラ、アイン薬局など", { text: "amenity=pharmacy", options: { fontFace: "Courier New" } }, "薬局という種類に「除外」（10回とも）。そのため薬局を含む公共・文化施設のファイルを読まなかった"],
  ["地域の歴史や文化を学べる場所", "4件。札幌手稲記念館、本郷新記念札幌彫刻美術館、つきさっぷ郷土資料館緑地、二中公園", { text: "leisure=park\nleisure=garden", options: { fontFace: "Courier New" } }, "公園・庭園という種類に「除外」（10回とも）"],
], tableOpts(0.5, 1.35, 9.0, [2.0, 2.4, 1.8, 2.8], { fontSize: 10, rowH: [0.4, 1.0, 1.1] }));
bullets(s, [
  "食料品の19件の内訳：名前でドラッグストアと分かるもの6件、調剤薬局（アイン薬局など）9件、名前の無い薬局4件。調剤薬局を「食料品を買える」とした全件判定のほうが誤りの可能性もある",
  "歴史・文化の4件のうち3件は、名前に記念館・美術館・資料館が入っている。全件判定では、地物ごとに名前も読んで「当てはまる」になっていた",
  "m2 では、一覧に薬局が載っていても、このファイル（大半は学校・病院）に「除外」が選ばれた。名前の例を入れた m4 では、取りこぼしは0件だった",
], 0.5, 4.15, 9.0, 1.6, 11, 4);
keyline(s, "Jev に選ばせる材料には、判断の決め手になる情報（今回は名前）を残す必要がある", 5.8);
repro(s, "results/sapporo/selection_m1_m2.json・selection_m3.json の missed（どの地物を取りこぼしたか）");
s.addNotes("取りこぼした地物の中には、名前を見ればドラッグストアや記念館だと分かるものがありました。種類だけの一覧では、薬局や公園という種類に除外が選ばれました。");

// 20 課題 ---------------------------------------------------------------------------------------
pres.addSection({ title: "課題と対策" });
s = content("課題", "課題と対策");
const spAgr = SP.questions.map((q) => q.a_judgment_agreement);
[["判定に誤りがある", "食料品で「旧武井商店酒造部」（歴史的建造物）、歴史・文化で薬局と歯科医院が「当てはまる」と判定された。判定の正しさ（適合率＝当てはまるとした中に正しいものがどれだけあるか、再現率＝正しいものをどれだけ見つけたか）は、人が付けた正解が無いので未計測"],
 ["判定が回によって揺れる", `札幌で、同じ地物の判定が3回とも一致したのは ${(Math.min(...spAgr) * 100).toFixed(1)}〜${(Math.max(...spAgr) * 100).toFixed(1)}%。一緒に送る地物によっても答えが変わる。Jev が選ぶファイルも、回によって変わることがある`],
 ["件数が増えると時間がかかる", "札幌の全件で1回約12秒。件数がさらに多い地域では、もっとかかる見込み（未計測）"]].forEach(([h, b], i) => {
  const y = 1.4 + i * 1.65;
  label(s, String(i + 1), 0.5, y, 0.5, 0.55, { fontSize: 26, bold: true, color: C.accent1 });
  label(s, h, 1.1, y + 0.03, 8.4, 0.4, { fontSize: 17, bold: true });
  label(s, b, 1.1, y + 0.5, 8.4, 1.1, { fontSize: 12, ...muted });
});
repro(s, "誤りの例：results/*/runs.json の judgments。揺れ：web/public/data/*/results.json の a_judgment_agreement");
s.addNotes("課題は3つです。判定に誤りがあること、判定が揺れること、件数が増えると時間がかかることです。");

// 21 対策 ---------------------------------------------------------------------------------------
s = content("対策", "課題と対策");
const khA = medianOf(QUESTIONS_ALL.flatMap((q) => kh4(q, "A").map((r) => r.time_s.total))), khC = medianOf(QUESTIONS_ALL.flatMap((q) => kh4(q, "C").map((r) => r.time_s.total)));
s.addTable([
  [head("課題"), head("対策"), head("良い点"), head("気になる点"), head("状況")],
  ["判定に誤りがある", "人が正解を付けて、正しさを評価する", "適合率・再現率を数字で示せる。質問文の改善にも使える", "人手がかかる", "未実施"],
  ["判定が揺れる", "判定結果をファイルに保存し、次の検索でも使う（モデルの版・質問・地物の情報ごと。jev 拡張の答えの記憶は検索ごとに消えるので、それとは別に持つ）", "同じ入力には同じ答えを返せる。2回目以降は費用がかからない", "揺れそのものが減るわけではない。モデルの版が変わると作り直し", "未実装"],
  ["判定が揺れる", "1件ずつ送る", "一緒に送る地物の影響を受けない", "60件で試すと、2回の一致はかえって下がり（88%）、問い合わせは約19倍", "試したが効果なし"],
  ["時間がかかる", "Jev が先にファイルを選ぶ。一覧には名前の例を入れる（m4）", "札幌で取りこぼし無し", `速くなったのは食料品の約15%。北広島では4条件とも遅くなった（11/23 計測、4条件×3回の中央値で全件 ${khA.toFixed(2)}秒 → ${khC.toFixed(2)}秒）`, "試した"],
  ["時間がかかる（速さを優先）", "一覧を詳しくする（m2）か、種類ごとに聞く（m3）", "食料品で約半分の時間", "少数の地物を取りこぼす（98.5〜99.5%）", "試した"],
  ["Cloudflare 上では R2 からの読み込みに時間がかかる", "データをコンテナの中に置く（起動時に R2 から1回だけ取る）", `手元のファイルと同じ読み方になる（札幌で約${LVR.sp.tests.local_search_read.median_s.toFixed(1)}秒）`, "データを更新したらコンテナの起動し直しが要る。Cloudflare 上の効果は未計測", "未実装"],
], tableOpts(0.5, 1.3, 9.0, [1.5, 2.2, 2.0, 2.3, 1.0], { fontSize: 9.5, rowH: [0.34, 0.75, 0.82, 0.75, 0.85, 0.7, 0.8] }));
repro(s, "results/sapporo/manifest_comparison_summary.json、results/kitahiroshima/input_experiments.json・runs_a_c_m4_20261123.json");
s.addNotes("対策です。誤りには、人が正解を付けて評価する。揺れには、判定結果を保存して同じ答えを返せるようにする。1件ずつ送る方法は試しましたが効果がありませんでした。時間には、Jev が先にファイルを選ぶ方法があり、一覧に名前の例を入れれば取りこぼしなく少し速くなりますが、小さいデータでは遅くなります。");

// 22 動かす構成 -----------------------------------------------------------------------------------
s = content("動かす構成：Cloudflare で API として動かす", "課題と対策");
[["ブラウザ／curl", 0.5, 1.7], ["Cloudflare の入口\n（Worker）", 2.6, 1.7], ["コンテナの管理\n（Durable Object）", 4.7, 1.8]].forEach(([t, x, w], i) => {
  s.addShape(pres.shapes.RECTANGLE, { x, y: 2.0, w, h: 0.9, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: `arch-${i}` });
  label(s, t, x, 2.0, w, 0.9, { fontSize: 11, align: "center", valign: "middle" });
});
arrow(s, 2.2, 2.45, 2.6, 2.45); arrow(s, 4.3, 2.45, 4.7, 2.45); arrow(s, 6.5, 2.45, 6.8, 2.45);
dashedBox(s, 6.8, 1.6, 2.7, 1.7, HEX.accent1, "EAF3EF", "arch-container");
label(s, "コンテナ（Container）\nPython ＋ DuckDB 1.5.5\n＋ jev 拡張", 6.9, 1.7, 2.5, 1.5, { fontSize: 11, align: "center", valign: "middle" });
s.addShape(pres.shapes.RECTANGLE, { x: 6.8, y: 3.9, w: 1.25, h: 1.0, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "arch-r2" });
label(s, "R2\nGeoParquet\nと一覧", 6.8, 3.9, 1.25, 1.0, { fontSize: 10, align: "center", valign: "middle" });
s.addShape(pres.shapes.RECTANGLE, { x: 8.25, y: 3.9, w: 1.25, h: 1.0, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "arch-jev" });
label(s, "Jev の API\n（TypeSafe AI）", 8.25, 3.9, 1.25, 1.0, { fontSize: 10, align: "center", valign: "middle" });
arrow(s, 7.42, 3.3, 7.42, 3.9); arrow(s, 8.87, 3.3, 8.87, 3.9);
bullets(s, [
  "地域・やり方・質問を送ると、ファイル選択・読み込み・判定の結果と、使った量を返す。自由文の質問も受け付ける",
  "コンテナ＝プログラムを動かす環境一式。DuckDB と jev 拡張は普通の Worker では動かないので、コンテナで動かす",
  "地図の作品は GitHub Pages で公開（計算済みの結果を表示）。Cloudflare 上での時間は次のスライド",
], 0.5, 5.1, 9.0, 1.4, 12, 5);
repro(s, "container/（README.md に配信手順）、tutorial/README.md の「2. Docker」で手元でも動かせる");
s.addNotes("同じ処理を Cloudflare で API として動かす構成です。DuckDB と jev 拡張はコンテナの中で動かします。");

// 22b Cloudflare 上の時間 -------------------------------------------------------------------------
s = content("Cloudflare 上の時間の大半は R2 からの読み込み", "課題と対策");
const sec = (v) => `${v.toFixed(1)}秒`, sec2 = (v) => `${v < 0.1 ? v.toFixed(2) : v.toFixed(1)}秒`;
label(s, "① Cloudflare 上の API で全件判定（全ファイルを読む）。3回の中央値", 0.5, 1.25, 9.0, 0.35, { fontSize: 13, bold: true });
s.addTable([
  [head("地域"), head("読み込み（R2 から読み、市の範囲で絞る）", "right"), head("Jev の判定", "right"), head("合計", "right")],
  [`北広島（${LVR.kh.files}ファイル・${LVR.kh.tests.local_search_read.rows}件）`, { text: sec(CF.kh.median_read_s), options: { align: "right", bold: true } }, { text: sec(CF.kh.median_judge_s), options: { align: "right" } }, { text: sec(CF.kh.median_total_s), options: { align: "right" } }],
  [`札幌（${LVR.sp.files}ファイル・${LVR.sp.tests.local_search_read.rows.toLocaleString()}件）`, { text: sec(CF.sp.median_read_s), options: { align: "right", bold: true } }, { text: sec(CF.sp.median_judge_s), options: { align: "right" } }, { text: sec(CF.sp.median_total_s), options: { align: "right" } }],
], tableOpts(0.5, 1.6, 9.0, [3.0, 2.8, 1.6, 1.6], { rowH: 0.38 }));
label(s, "② 同じ読み込みの SQL を、手元と R2 のファイルで比べた（Jev なし。3回の中央値）", 0.5, 2.9, 9.0, 0.35, { fontSize: 13, bold: true });
s.addTable([
  [head("地域"), head("手元のファイル", "right"), head("R2 のファイル", "right"), head("R2：各ファイルの目次を読むだけ", "right")],
  [`北広島（${LVR.kh.files}ファイル・約${Math.round(LVR.kh.bytes_total / 1000)}KB）`, { text: sec2(LVR.kh.tests.local_search_read.median_s), options: { align: "right", bold: true } }, { text: sec2(LVR.kh.tests.r2_search_read.median_s), options: { align: "right" } }, { text: sec2(LVR.kh.tests.r2_footers_only.median_s), options: { align: "right" } }],
  [`札幌（${LVR.sp.files}ファイル・約${(LVR.sp.bytes_total / 1e6).toFixed(1)}MB）`, { text: sec2(LVR.sp.tests.local_search_read.median_s), options: { align: "right", bold: true } }, { text: sec2(LVR.sp.tests.r2_search_read.median_s), options: { align: "right" } }, { text: sec2(LVR.sp.tests.r2_footers_only.median_s), options: { align: "right" } }],
], tableOpts(0.5, 3.25, 9.0, [3.0, 1.8, 1.8, 2.4], { rowH: 0.38 }));
bullets(s, [
  "DuckDB の計算（読み込みと市の範囲での絞り込み）は、手元のファイルなら札幌でも0.2秒。時間がかかるのは R2 とのやり取り",
  "R2 から読むときは、データの中身に入る前の「ファイルを1つずつ開いて目次を読む」だけで大半の時間を使う。データ量より、開くファイルの数で決まる",
  "Cloudflare 上の読み込みは、作業用のパソコンから R2 を読むよりさらに遅かった（理由は未確認）",
], 0.5, 4.55, 9.0, 1.4, 11, 4);
keyline(s, "データをコンテナの中に置けば、読み込みは大きく縮む見込み（Cloudflare 上では未計測）", 5.9, 0.4);
label(s, "②は作業用のパソコンから測った。結果②の手元の計測（札幌の全件で約12秒）は、API キーを渡す中継プログラムを通しているので、Jev の判定は Cloudflare 上より遅い", 0.5, 6.28, 9.0, 0.3, { fontSize: 8, color: C.accent6 });
repro(s, "pipeline/local_vs_r2_timing.py → results/*/local_vs_r2_timing.json、pipeline/cloudflare_timing.py → results/*/cloudflare_timing.json");
s.addNotes("Cloudflare で動かすと、時間の大半は R2 からの読み込みでした。同じ SQL を手元のファイルにかけると、札幌でも0.2秒です。R2 では、ファイルを開いて目次を読むだけで大半の時間を使います。データをコンテナの中に置けば、大きく縮む見込みです。");

// 16 補足 R2（NEW） ---------------------------------------------------------------------------------
s = content("補足：R2 では、開くファイルが少ないほど速い", "課題と対策");
const RT = R2T.tests;
s.addTable([
  [head("読み方（札幌、Jev の判定なし）"), head("開いたファイル", "right"), head("時間（3回の中央値）", "right")],
  ["フォルダ全体（*.parquet）を指定して全50ファイルを読む", { text: "50", options: { align: "right" } }, { text: `${RT.all_files_glob.median_s.toFixed(2)}秒`, options: { align: "right" } }],
  ["全50ファイルを名前で並べて指定する", { text: "50", options: { align: "right" } }, { text: `${RT.all_files_listed.median_s.toFixed(2)}秒`, options: { align: "right" } }],
  ["フォルダ全体（*.parquet）を指定し、SQL で category = 'commercial'（商業施設）の条件を付ける", { text: "10", options: { align: "right" } }, { text: `${RT.all_files_glob_where_category_commercial.median_s.toFixed(2)}秒`, options: { align: "right", bold: true } }],
  ["商業施設の10ファイルを名前で並べて指定する", { text: "10", options: { align: "right" } }, { text: `${RT.commercial_files_listed.median_s.toFixed(2)}秒`, options: { align: "right" } }],
  ["参考：フォルダ名を列として読まない設定（全50ファイル）", { text: "50", options: { align: "right" } }, { text: `${RT.all_files_glob_without_hive.median_s.toFixed(2)}秒`, options: { align: "right" } }],
], tableOpts(0.5, 1.35, 9.0, [5.4, 1.6, 2.0], { fontSize: 11, rowH: [0.38, 0.4, 0.4, 0.55, 0.4, 0.4] }));
label(s, "件数を数えるだけ（SELECT count(*)）の軽い読み込みで測った。実際の検索は地物の列も読むので読む量はもっと多く、手元のファイルでの時間（約0.26秒）とは比べられない", 0.5, 4.0, 9.0, 0.45, { fontSize: 10, ...muted });
bullets(s, [
  "フォルダ名のカテゴリ（Hive 形式）を SQL の条件にすると、DuckDB は条件に合わないファイルを開かずに飛ばした（DuckDB が実行前に示す処理の予定で、50ファイル中10ファイル）",
  "開くファイルが少ないほど速かった。ただし、同じ50ファイルでも指定の仕方で約1秒違う。フォルダ名を列として読むかどうかの差（4.22秒と3.94秒）は、ばらつきの範囲",
  "Jev が選んだファイルだけを読むやり方は、R2 から読むとこの分も速くなる見込み。ただし Jev の判定を含めた R2 での時間は未計測",
], 0.5, 4.5, 9.0, 1.9, 11, 5);
repro(s, "python pipeline/r2_read_timing.py \"r2://…/city=sapporo\" data/city=sapporo/manifest.m1.json results/sapporo/r2_read_timing.json");
s.addNotes("補足です。R2 から読むと、開くファイルを減らすほど速くなりました。フォルダ名のカテゴリを条件にすると、DuckDB は合わないファイルを開かずに飛ばしました。");

// 23 再現：データの準備 -------------------------------------------------------------------------------
pres.addSection({ title: "再現" });
s = content("再現の手順①：データを作る", "再現");
code(s, [
  "git clone https://github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet.git",
  "cd 30daymapchallenge-2026day27-jev-geoparquet && pip install -r requirements.txt",
  "curl -LO https://download.openstreetmap.fr/extracts/asia/japan/hokkaido-latest.osm.pbf",
  "python pipeline/extract.py hokkaido-latest.osm.pbf work/sapporo sapporo",
  "python pipeline/partition.py work/sapporo \"data/city=sapporo\" Sapporo",
  "cp work/sapporo/boundary.geojson \"data/city=sapporo/\"",
  "python pipeline/manifest_m2.py \"data/city=sapporo\"     # 続けて manifest_m3.py、manifest_m4.py",
  "R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \\",
  "    python pipeline/upload_r2.py --bucket <自分のバケット> --dry-run",
], 0.5, 1.35, 9.0, 3.0, 9);
bullets(s, [
  "北広島は、sapporo を kitahiroshima に、Sapporo を Kitahiroshima に変える。リポジトリの data/ には、この手順で作ったものが入っている",
  "取得したのは 2026-11-21 時点のデータ。時点が違うと件数や結果が変わる。取得元は OpenStreetMap France の extracts（Geofabrik は今回の環境から接続できなかった。同じ形式なので差し替えられる）",
  "upload_r2.py は2市分をまとめて送る。出典の情報は data/city=kitahiroshima/source.json（リポジトリにある）を使う。--dry-run を外すと実際に送る",
], 0.5, 4.5, 9.0, 2.0, 11, 4);
s.addNotes("データを作る手順です。リポジトリのスクリプトで、OSM のデータから GeoParquet と一覧を作り、R2 に置けます。");

// 24 再現：計測 ------------------------------------------------------------------------------------
s = content("再現の手順②：計測する", "再現");
code(s, [
  "read -rs TYPESAFE_API_KEY && export TYPESAFE_API_KEY       # API キーを画面に出さずに設定",
  "D=\"data/city=sapporo\"; Q=pipeline/questions.json; R=results/sapporo",
  "python pipeline/run_compare.py $D $Q $R/runs.json --reps 3                  # 3つのやり方（一覧 m1）",
  "python pipeline/run_compare.py $D $Q $R/runs_a_20261123.json --reps 3 --methods A",
  "python pipeline/run_compare.py $D $Q $R/runs_c_m2.json --reps 3 --methods C --manifest manifest.m2.json",
  "#   m3・m4 も同じ形（runs_c_m3.json・runs_c_m4.json）",
  "python pipeline/selection_compare.py $D $Q $R/runs.json $R/selection_m1_m2.json --reps 10",
  "python pipeline/selection_compare.py $D $Q $R/runs.json $R/selection_m3.json --manifests manifest.m3.json",
  "#   m4 も同じ形（selection_m4.json）",
  "python pipeline/compare_manifests.py $D $R                 # 一覧の版の比較をまとめる（API は呼ばない）",
  "python pipeline/summarize.py $D $Q $R/runs.json web/public/data/sapporo",
  "python pipeline/local_vs_r2_timing.py $D r2://geo-opendata/osm-poi/parquet/2026-11-21/city=sapporo $R/local_vs_r2_timing.json",
  "python pipeline/cloudflare_timing.py <API の URL> sapporo A kids_play $R/cloudflare_timing.json   # 約 $0.18",
], 0.5, 1.35, 9.0, 3.65, 8);
bullets(s, [
  "札幌で1行目（4条件 × 3つのやり方 × 3回）は約6分・約 $1.7。m4 の検索3回分は約 $0.75。北広島は全部で約30秒・約 $0.07",
  "出力先のファイル名を変えると、リポジトリにある元の結果を残せる（同じ名前だと上書きする）",
  "Jev の答えは毎回少し揺れるので、測り直した数字は完全には一致しない。比較のまとめは、リポジトリにある結果ファイルからも作り直せる",
], 0.5, 5.1, 9.0, 1.45, 11, 4);
s.addNotes("計測の手順です。TypeSafe の API キーを環境変数に入れて、スクリプトを実行します。");

// 25 再現：手元で試す・計測の条件 -----------------------------------------------------------------------
s = content("再現の手順③：手元で試す／計測の条件", "再現");
label(s, "手元で1段ずつ試す", 0.5, 1.35, 4.3, 0.4, { fontSize: 14, bold: true });
bullets(s, [
  "Google Colab または手元の Jupyter：tutorial/jev_geoparquet_colab.ipynb",
  "DATA_SOURCE = \"r2\" にすると R2 から読む（R2 の読み取り用のキーが要る）",
  "Docker：tutorial/README.md の「2」。Cloudflare で動かすのと同じ検索 API を手元で動かせる",
  "北広島で最後まで実行して、推定 $0.01 前後",
], 0.5, 1.8, 4.3, 3.6, 12, 6);
label(s, "今日の数字の計測条件", 5.2, 1.35, 4.3, 0.4, { fontSize: 14, bold: true });
s.addTable([
  ["モデル", "jev-1.14.0（jev-latest を指定）"],
  ["ソフト", "DuckDB 1.5.5・jev 拡張 0.1.0"],
  ["jev 拡張の設定", "既定値（20件ずつ・同時16回）"],
  ["回数", "各3回。ファイル選択だけは10回"],
  ["jev 拡張の答えの記憶", "1回ごとに jev_cache_clear() で消去"],
  ["日時（UTC）", "3つのやり方：11/22。一覧の比較：11/23"],
  ["場所", "クラウドの作業環境。API キーを渡す都合で、手元の中継プログラム（pipeline/jev_relay.py）を通した。そのぶん時間が長めに出ている可能性がある"],
], tableOpts(5.2, 1.8, 4.3, [1.3, 3.0], { fontSize: 10, rowH: [0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 1.0] }));
repro(s, "計測の日時は各結果ファイルの started_utc、実際に答えたモデルの版は results/*/runs*.json の model_served に記録");
s.addNotes("手元で試すには、Colab か Jupyter のノートブックが一番簡単です。計測の条件は右のとおりです。");

// 26 まとめ ---------------------------------------------------------------------------------------
pres.addSection({ title: "まとめ" });
s = pres.addSlide({ masterName: "DARK", sectionTitle: "まとめ" });
s.addText("まとめ", { placeholder: "title" });
label(s, [
  { text: "Jev を SQL の条件に使うと、属性（タグ）として用意されていない曖昧な条件でも、地物を絞り込めた（判定の正しさは未確認）", options: { bullet: true, breakLine: true } },
  { text: "従来のやり方では見るカテゴリの外にあった候補も拾えた（札幌・子どもが遊べる場所で16%、雨の日に屋内で過ごせる場所で14〜20%）", options: { bullet: true, breakLine: true } },
  { text: "代わりに件数に応じた時間がかかる。Jev が先にファイルを選ぶと、名前の例を入れた一覧で、全件判定と比べて取りこぼし無く、札幌・食料品で約15%速くなった。北広島の589件では、かえって遅くなった", options: { bullet: true, breakLine: true } },
  { text: "Cloudflare で動かすと、時間の大半は Jev の判定ではなく R2 からの読み込みだった", options: { bullet: true, breakLine: true } },
  { text: "判定には誤りと揺れがある。正しさを確かめることが次の一歩", options: { bullet: true } },
], 0.6, 2.7, 8.8, 3.15, { fontSize: 12.5, color: C.background1, paraSpaceAfter: 8 });
label(s, "作品：shinyanakashima.github.io/30daymapchallenge-2026day27-jev-geoparquet/", 0.6, 5.95, 8.8, 0.3, { fontSize: 11, color: C.lt2 });
label(s, "コード：github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet", 0.6, 6.25, 8.8, 0.3, { fontSize: 11, color: C.lt2 });
label(s, "データ © OpenStreetMap contributors（ODbL）／背景地図：地理院タイル／Jev は TypeSafe AI のモデル", 0.6, 6.6, 8.8, 0.3, { fontSize: 10, color: C.lt2 });
s.addNotes("まとめです。属性として用意されていない曖昧な条件でも、Jev で地物を絞り込めました。従来のやり方では見つからない候補も拾えました。時間はかかりますが、Jev が先にファイルを選ぶ工夫で、大きいデータでは少し短くできます。判定の正しさは、これから確かめます。");

(async () => {
  await pres.writeFile({ fileName: OUT });
  // Remove directory entries from the ZIP; some cloud services refuse files that contain them.
  try { require("child_process").execSync(`zip -dq "${OUT}" '*/'`); } catch (e) { /* none present */ }
  console.log("wrote", OUT);
})();
