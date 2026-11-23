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
const KHq = (id) => KH.questions.find((q) => q.id === id);
const MC = JSON.parse(fs.readFileSync(path.join(ROOT, "results/sapporo/manifest_comparison_summary.json"), "utf8"));
const CALL = JSON.parse(fs.readFileSync(path.join(ROOT, "results/examples/jev_call_20261123.json"), "utf8"));
const MAN = (v) => JSON.parse(fs.readFileSync(path.join(ROOT, `data/city=sapporo/manifest.${v}.json`), "utf8"));
const M1 = MAN("m1"), M2 = MAN("m2"), M4 = MAN("m4");
const supportedCount = (q) => [...SPq(q).methods.A.runs[0].j].filter((c) => c === "s").length;
const QUESTIONS_ALL = ["kids_play", "rainy_day", "groceries", "local_history"];
const QN = { kids_play: "子どもが遊べる場所", rainy_day: "雨の日に屋内で過ごせる場所", groceries: "食料品や日用品を買える場所", local_history: "地域の歴史や文化を学べる場所" };
const QS = { kids_play: "子ども", rainy_day: "雨の日", groceries: "食料品", local_history: "歴史・文化" };
const RULE = { kids_play: "公園・遊び場", rainy_day: "商業施設、公共・文化施設", groceries: "商業施設", local_history: "公共・文化施設" };
const head = (t, al) => ({ text: t, options: { bold: true, fill: { color: HEX.lt2 }, align: al || "left" } });
const rng = (city, m, key) => { const v = city.questions.map((q) => q.methods[m].median[key]); return [Math.min(...v), Math.max(...v)]; };
const pctf = (v) => `${(v * 100).toFixed(1)}%`;
const tableOpts = (x, y, w, colW, extra = {}) => ({ x, y, w, colW, fontSize: 11, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, valign: "middle", ...extra });
const repro = (s, text) => label(s, `再現：${text}`, 0.5, 6.55, 9.0, 0.4, { fontSize: 9, fontFace: "Courier New", color: C.accent6 });
const code = (s, lines, x, y, w, h, fs = 10) => {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "code" });
  label(s, lines.join("\n"), x + 0.15, y + 0.08, w - 0.3, h - 0.16, { fontSize: fs, fontFace: "Courier New", valign: "middle" });
};
const content = (title, section) => { const sl = pres.addSlide({ masterName: "CONTENT", sectionTitle: section }); sl.addText(title, { placeholder: "title" }); return sl; };

// 1 表紙 ---------------------------------------------------------------------------------------
pres.addSection({ title: "導入" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "導入" });
s.addText("意思決定特化型AIで\n地理空間データを「解釈」して検索する", { placeholder: "title" });
label(s, "Jev × DuckDB × GeoParquet で、曖昧な条件の検索を試す", 0.6, 4.05, 8.8, 0.5, { color: C.lt2, fontSize: 16 });
label(s, "FOSS4G Hokkaido 2026　2026年11月28日", 0.6, 5.7, 8.8, 0.35, { color: C.background1, fontSize: 13 });
label(s, "Shinya Nakashima（株式会社ズコーシャ）", 0.6, 6.1, 8.8, 0.35, { color: C.background1, fontSize: 13 });
dashedBox(s, 7.6, 0.6, 1.8, 1.0, HEX.lt2, HEX.dk2, "motif-file-1");
dashedBox(s, 8.0, 0.9, 1.8, 1.0, HEX.accent2, HEX.dk2, "motif-file-2");
s.addNotes("意思決定に特化したAIモデル Jev を使って、曖昧な条件で地図上の場所を探せるかを試しました。");

// 2 問い ---------------------------------------------------------------------------------------
s = content("今日の問い", "導入");
[["1", "「子どもが遊べる場所」のような曖昧な条件で、地図上の場所を検索できるか"],
 ["2", "従来のやり方と比べて、どれだけ多くの候補を拾えるか。代わりに何がかかるか"],
 ["3", "かかる時間を減らす工夫は、どこまで効くか"]].forEach(([n, t], i) => {
  const y = 1.5 + i * 1.3;
  label(s, n, 0.6, y, 0.6, 0.8, { fontSize: 36, bold: true, color: C.accent1 });
  label(s, t, 1.4, y + 0.1, 8.0, 1.0, { fontSize: 19, bold: true });
});
label(s, "対象：札幌市と北広島市の OpenStreetMap（OSM）の地物。施設・店・公園など", 0.6, 5.6, 8.8, 0.5, { fontSize: 14, ...muted });
s.addNotes("問いは3つです。曖昧な条件で検索できるか。従来のやり方と比べてどれだけ拾えて、何がかかるか。かかる時間を減らす工夫はどこまで効くか。");

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
label(s, "GIS で場所を探すときは、ふつうこの種類の属性で絞り込む（例：amenity が kindergarten の地物）", 0.5, 5.55, 9.0, 0.7, { fontSize: 16, bold: true, color: C.accent1 });
s.addNotes("OSM では属性のことをタグと呼び、キーと値の組で付けます。GIS の属性テーブルと違って列は決まっておらず、地物ごとに必要な属性を足していきます。");

// 4 属性が無い ---------------------------------------------------------------------------------
s = content("「子どもが遊べる場所」という属性は無い", "前提");
label(s, "従来のやり方：条件に合いそうな種類の属性（タグ）を、人が選んで対応表にする", 0.5, 1.35, 9.0, 0.5, { fontSize: 15, bold: true });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.95, w: 4.2, h: 1.5, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "rule" });
label(s, "子どもが遊べる場所\n→ 公園・遊び場の地物だけを見る", 0.7, 2.05, 3.9, 1.3, { fontSize: 17, bold: true, valign: "middle" });
label(s, [
  { text: "対応表に入れなかった種類の地物は、検索にかからない", options: { bullet: true, breakLine: true } },
  { text: "幼稚園、児童会館、子ども向けの屋内施設……をどこまで入れるかは、人の判断", options: { bullet: true, breakLine: true } },
  { text: "「雨の日に屋内で過ごせる場所」のように、いくつもの種類にまたがる条件ほど難しい", options: { bullet: true } },
], 5.0, 1.95, 4.5, 3.0, { fontSize: 14, paraSpaceAfter: 8 });
label(s, "今回の試み：AI に地物の名前と属性（タグ）を読ませ、条件に合うかを1件ずつ判定させる", 0.5, 5.3, 9.0, 0.8, { fontSize: 16, bold: true, color: C.accent1 });
s.addNotes("子どもが遊べる場所、という属性はありません。従来は、合いそうな種類の属性を人が選んで対応表を作ります。今回は AI に1件ずつ判定させました。");

// 5 Jev の入出力 --------------------------------------------------------------------------------
s = content("Jev（TypeSafe AI）に送るもの、返ってくるもの", "前提");
label(s, "送ったもの", 0.5, 1.35, 4.3, 0.35, { fontSize: 13, bold: true });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.75, w: 4.3, h: 3.2, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "request" });
label(s, [
  { text: "地物の情報", options: { bold: true, breakLine: true } },
  { text: CALL.request.state.attributes, options: { fontFace: "Courier New", breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "質問", options: { bold: true, breakLine: true } },
  { text: "この場所は「子どもが遊べる場所」に当てはまるか（実際は英文）", options: { breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "選択肢", options: { bold: true, breakLine: true } },
  { text: "supported（当てはまる）／ contradicted（当てはまらない）／ insufficient_information（判断材料不足）", options: {} },
], 0.65, 1.85, 4.0, 3.0, { fontSize: 12 });
arrow(s, 4.9, 3.35, 5.3, 3.35);
label(s, "返ってきたもの", 5.4, 1.35, 4.1, 0.35, { fontSize: 13, bold: true });
s.addShape(pres.shapes.RECTANGLE, { x: 5.4, y: 1.75, w: 4.1, h: 3.2, fill: { color: "EAF3EF" }, line: { type: "none" }, objectName: "response" });
const ans = CALL.response.answers.q;
label(s, [
  { text: "選んだ答え", options: { bold: true, breakLine: true } },
  { text: ans.choice, options: { fontFace: "Courier New", fontSize: 18, bold: true, color: C.accent1, breakLine: true } },
  { text: " ", options: { breakLine: true } },
  { text: "選択肢ごとの確率", options: { bold: true, breakLine: true } },
  { text: `supported ${ans.probabilities.supported} ／ contradicted ${ans.probabilities.contradicted} ／ insufficient_information ${ans.probabilities.insufficient_information}`, options: {} },
], 5.55, 1.85, 3.8, 3.0, { fontSize: 12 });
label(s, `${CALL.called_at} に札幌の「${CALL.feature.name}」で実際に呼んだ結果。応答したモデル ${CALL.response.model}、入力 ${CALL.response.usage.input_tokens} トークン、${CALL.elapsed_s} 秒`, 0.5, 5.1, 9.0, 0.45, { fontSize: 11, ...muted });
label(s, "答えは、こちらが決めた選択肢のどれかで返る。そのため SQL で「判定が supported の地物だけ」のように絞り込める", 0.5, 5.6, 9.0, 0.8, { fontSize: 15, bold: true, color: C.accent1 });
repro(s, "results/examples/jev_call_20261123.json の request を POST https://api.typesafe.ai/v1/systemone に送る");
s.addNotes("Jev に実際に送ったものと、返ってきたものです。地物の情報、質問、選択肢を送ると、選択肢の中から答えを1つ返し、選択肢ごとの確率も返します。");

// 6 SQL ----------------------------------------------------------------------------------------
pres.addSection({ title: "仕組み" });
s = content("SQL の中で Jev を呼ぶ（DuckDB の jev 拡張）", "仕組み");
code(s, [
  "SELECT name,",
  "  jev_choice({attributes: 'name: もみじ台幼稚園; amenity: kindergarten'},",
  "    'Does this place match the request \"A place where children can play\"?',",
  "    ['supported', 'contradicted', 'insufficient_information']) AS 判定",
  "FROM read_parquet('…/*.parquet')            -- GeoParquet のファイル群",
  "WHERE ST_Within(geometry, <札幌市の範囲>);     -- 空間条件はいつもどおり",
], 0.5, 1.4, 9.0, 1.9, 11);
label(s, [
  { text: "地物は GeoParquet（空間データを扱える列指向のファイル形式）に保存した", options: { bullet: true, breakLine: true } },
  { text: "DuckDB（ファイルを直接 SQL で読めるデータベース）で読み、地物1件ごとに jev_choice で判定する", options: { bullet: true, breakLine: true } },
  { text: "Jev に送るのは、名前と種類の属性（タグ）など、値の入っている属性だけ。位置（ジオメトリ）は送らない", options: { bullet: true } },
], 0.5, 3.6, 9.0, 2.0, { fontSize: 14, paraSpaceAfter: 8 });
label(s, "空間条件などはいつもの SQL のまま書き、Jev の判定は列を1つ足す形で加えられる", 0.5, 5.75, 9.0, 0.6, { fontSize: 15, bold: true, color: C.accent1 });
repro(s, "pipeline/run_compare.py の run_once()（DuckDB 1.5.5、INSTALL jev FROM community）");
s.addNotes("DuckDB の jev 拡張を使うと、SQL の中で Jev を呼べます。空間条件はいつもの SQL のままです。");

// 7 jev 拡張 ------------------------------------------------------------------------------------
s = content("jev 拡張の4つの仕組み", "仕組み");
const feats = [
  ["20件をまとめて1回で問い合わせる", "jev_batch_size = 20", "北広島は589件のうち、名前と属性が互いに違う492件を問い合わせ、問い合わせは25回だった"],
  ["16回分の問い合わせを同時に送る", "jev_concurrency = 16", "北広島の25回分なら、同時に送るので、待ち時間は約2回分で済む"],
  ["同じ内容への答えは覚えておく", "jev_cache_clear() で消去", "名前も属性も全く同じ地物（名前の無い公園など）は、1回だけ問い合わせる。札幌は16,610件のうち11,944件だった。計測では毎回消した"],
  ["使った量を SQL で集計できる", "jev_stats()", "問い合わせ回数・トークン数・推定費用。今日の数字はすべてこれで取得"],
];
feats.forEach(([h, sub, b], i) => {
  const x = 0.5 + (i % 2) * 4.6, y = 1.5 + Math.floor(i / 2) * 2.1;
  dashedBox(s, x, y, 4.4, 1.85, HEX.accent1, HEX.lt1, `feature-${i}`);
  label(s, h, x + 0.2, y + 0.15, 4.0, 0.4, { fontSize: 15, bold: true });
  label(s, sub, x + 0.2, y + 0.6, 4.0, 0.3, { fontSize: 11, fontFace: "Courier New", color: C.accent1 });
  label(s, b, x + 0.2, y + 0.95, 4.0, 0.85, { fontSize: 12, ...muted });
});
label(s, "モデル jev-1.14.0（指定は jev-latest）・DuckDB 1.5.5・jev 拡張 0.1.0。設定はすべて既定値のまま", 0.5, 5.85, 9.0, 0.35, { fontSize: 11, ...muted });
repro(s, "results/kitahiroshima/runs.json・results/sapporo/runs.json の usage_judge（jev_stats の差分）");
s.addNotes("jev 拡張には4つの仕組みがあります。今日の数字は、すべて jev_stats から取っています。");

// 8 データの作り方 -------------------------------------------------------------------------------
s = content("データの作り方：OSM から GeoParquet へ", "仕組み");
[["1", "OSM の北海道のデータを取得", "hokkaido-latest.osm.pbf（2026-11-21 時点）"],
 ["2", "市の範囲と施設などの地物を取り出す", "札幌市 16,610件・北広島市 589件"],
 ["3", "種類の属性で5つのカテゴリに分け、区域でも分けて GeoParquet にする", "札幌 50ファイル（5×10区）、北広島 20ファイル（5×4区分）"],
 ["4", "ファイルごとの中身の一覧を作る", "どの種類の地物が何件あるか、名前の例など"],
 ["5", "Cloudflare R2 に置く", "バケット geo-opendata"]].forEach(([n, h, b], i) => {
  const y = 1.4 + i * 0.75;
  label(s, n, 0.5, y, 0.4, 0.6, { fontSize: 20, bold: true, color: C.accent1 });
  label(s, h, 1.0, y + 0.02, 4.6, 0.6, { fontSize: 13, bold: true, valign: "middle" });
  label(s, b, 5.7, y + 0.02, 3.8, 0.6, { fontSize: 12, ...muted, valign: "middle" });
});
code(s, ["geo-opendata/osm-poi/parquet/2026-11-21/city=sapporo/category=commercial/area=chuo/part-0.parquet"], 0.5, 5.25, 9.0, 0.55, 10);
label(s, "カテゴリ：公園・遊び場／スポーツ／商業施設／公共・文化施設／その他。パスの「キー=値」は Hive 形式で、DuckDB では列として読める", 0.5, 5.85, 9.0, 0.6, { fontSize: 11, ...muted });
repro(s, "pipeline/extract.py → partition.py → manifest_m2.py・m3・m4 → upload_r2.py（手順は再現のスライド）");
s.addNotes("OSM の北海道のデータから、市の範囲の施設などを取り出し、種類の属性でカテゴリに、さらに区域で分けて GeoParquet にしました。ファイルごとの中身の一覧も作り、Cloudflare R2 に置いています。");

// 9 比べた3つのやり方 ------------------------------------------------------------------------------
s = content("比べた3つのやり方", "仕組み");
const ways = [
  ["全件判定", "すべてのファイルを読み、全地物を Jev が判定する", "取りこぼしが無い。比べるときの基準", "スクリプトの記号 A"],
  ["従来のやり方", "条件ごとに見るカテゴリを人が決め（対応表）、そのファイルの地物だけを Jev が判定する", "例：子どもが遊べる場所 → 公園・遊び場のファイルだけ", "記号 B"],
  ["AI が先にファイルを選ぶ", "ファイルごとの中身の一覧を Jev に読ませ、当てはまる地物がありそうなファイルだけを読んで判定する", "読まないファイルの地物は判定しないので、速くなりうる", "記号 C"],
];
ways.forEach(([h, d, n, k], i) => {
  const y = 1.4 + i * 1.5;
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y, w: 9.0, h: 1.35, fill: { color: i === 2 ? "EAF3EF" : "F4F5F6" }, line: { type: "none" }, objectName: `way-${i}` });
  label(s, h, 0.7, y + 0.1, 2.6, 0.5, { fontSize: 15, bold: true, color: i === 2 ? C.accent1 : C.text1 });
  label(s, k, 0.7, y + 0.75, 2.6, 0.4, { fontSize: 10, ...muted });
  label(s, d, 3.4, y + 0.1, 5.9, 0.65, { fontSize: 13 });
  label(s, n, 3.4, y + 0.8, 5.9, 0.45, { fontSize: 11, ...muted });
});
label(s, "取りこぼし＝全件判定で当てはまった地物のうち、そのやり方では読まなかったファイルにあったもの。4条件 × 各3回測り、中央値で比べた", 0.5, 5.95, 9.0, 0.55, { fontSize: 11, ...muted });
repro(s, "pipeline/questions.json（4条件と、従来のやり方の対応表）、pipeline/run_compare.py --methods A,B,C");
s.addNotes("比べたのは3つのやり方です。全件判定、従来のやり方、そして AI が先にファイルを選ぶやり方です。取りこぼしは、全件判定で当てはまった地物を基準に数えます。");

// 10 結果① --------------------------------------------------------------------------------------
pres.addSection({ title: "結果" });
s = content("結果①：従来のやり方では見つからない候補を拾えた", "結果");
label(s, "札幌市 16,610件で、従来のやり方の結果と、Jev で全件を判定した結果を比べた（全件判定の1回目）", 0.5, 1.3, 9.0, 0.5, { fontSize: 13 });
const ex = { kids_play: "幼稚園・児童会館・学童クラブ", rainy_day: "プール・銭湯・ジム・ネットカフェ", groceries: "ドラッグストア", local_history: "博物館・郷土資料館" };
s.addTable([
  [head("条件"), head("従来のやり方で見たカテゴリ"), head("Jev が当てはまると判定", "right"), head("うち従来のやり方では見つからない", "right"), head("見つからなかった地物の例")],
  ...SP.questions.map((q) => { const n = supportedCount(q.id), m = q.methods.B.runs[0].missed.length;
    return [QN[q.id], RULE[q.id], { text: `${n.toLocaleString()}件`, options: { align: "right" } }, { text: `${m}件（${Math.round(m / n * 100)}%）`, options: { align: "right", bold: m / n > 0.1 } }, ex[q.id]]; }),
], tableOpts(0.5, 1.9, 9.0, [1.9, 1.9, 1.5, 1.75, 1.95], { rowH: 0.55 }));
label(s, "いくつもの種類にまたがる条件ほど、従来のやり方では見つからない地物が多い（子どもが遊べる場所で16%、雨の日に屋内で過ごせる場所で20%）", 0.5, 5.0, 9.0, 0.9, { fontSize: 15, bold: true, color: C.accent1 });
repro(s, "results/sapporo/runs.json → pipeline/summarize.py → web/public/data/sapporo/results.json（missed の件数）");
s.addNotes("子どもが遊べる場所では、Jev が当てはまるとした1,726件のうち268件、16%は、従来のやり方では見つかりませんでした。雨の日では20%です。");

// 11 地図 ----------------------------------------------------------------------------------------
s = content("結果①の地図：札幌・子どもが遊べる場所", "結果");
s.addImage({ path: path.join(__dirname, "img/sapporo_kids_fixed_rule.png"), x: 0.5, y: 1.3, w: 5.4, h: 4.85, objectName: "map-fixed-rule", altText: "札幌・子どもが遊べる場所。従来のやり方では見つからない地物を赤い輪で示した地図" });
label(s, [
  { text: "赤い輪：Jev が当てはまると判定したが、従来のやり方（公園・遊び場のファイルだけ見る）では見つからない地物", options: { bullet: true, breakLine: true } },
  { text: "緑の点：当てはまる（読んだファイルの中）", options: { bullet: true, breakLine: true } },
  { text: "白い点：従来のやり方では読まないファイルの地物", options: { bullet: true, breakLine: true } },
  { text: "破線の四角：ファイルが受け持つ範囲（データの範囲で、地物の位置そのものではない）", options: { bullet: true } },
], 6.1, 1.4, 3.4, 4.6, { fontSize: 12, paraSpaceAfter: 8 });
repro(s, "作品の画面 …/?lang=ja&city=sapporo&q=0&m=B（shinyanakashima.github.io/30daymapchallenge-2026day27-jev-geoparquet/）");
s.addNotes("赤い輪が、従来のやり方では見つからなかった地物です。市街地の全体に散らばっています。");

// 12 結果② --------------------------------------------------------------------------------------
s = content("結果②：代わりに、時間と費用がかかる", "結果");
const [kt0, kt1] = rng(KH, "A", "total_s"), [st0, st1] = rng(SP, "A", "total_s"), [kr0, kr1] = rng(KH, "A", "read_s"), [sr0, sr1] = rng(SP, "A", "read_s");
const [kc0] = rng(KH, "A", "estimated_cost_usd"), [sc0, sc1] = rng(SP, "A", "estimated_cost_usd");
s.addTable([
  [head(""), head("北広島市（589件）", "right"), head("札幌市（16,610件）", "right")],
  ["Jev で全件を判定（1回の検索）", { text: `${kt0.toFixed(1)}〜${kt1.toFixed(1)}秒`, options: { align: "right", bold: true } }, { text: `${st0.toFixed(1)}〜${st1.toFixed(1)}秒`, options: { align: "right", bold: true } }],
  ["推定費用（1回の検索）", { text: `$${kc0.toFixed(4)}`, options: { align: "right" } }, { text: `$${sc0.toFixed(3)}〜${sc1.toFixed(3)}`, options: { align: "right" } }],
  ["参考：ファイルを読み、市の範囲で絞るまで（AI の判定なし）", { text: `${kr0.toFixed(2)}〜${kr1.toFixed(2)}秒`, options: { align: "right" } }, { text: `${sr0.toFixed(2)}〜${sr1.toFixed(2)}秒`, options: { align: "right" } }],
], tableOpts(0.5, 1.45, 9.0, [3.8, 2.6, 2.6], { fontSize: 14, rowH: 0.6 }));
label(s, "4条件 × 各3回の中央値の範囲（2026-11-22 計測）。推定費用は jev 拡張の推定値（入力100万トークンあたり $0.042）", 0.5, 4.0, 9.0, 0.4, { fontSize: 10, ...muted });
label(s, [
  { text: "時間と費用は、件数にほぼ比例して増える（札幌は北広島の約28倍の件数で、約18倍の時間がかかった）", options: { bullet: true, breakLine: true } },
  { text: "費用は小さい。札幌の全件でも1回あたり約 $0.06（1ドル150円で約9円）", options: { bullet: true, breakLine: true } },
  { text: "問題になるのは待ち時間。札幌の全件では、1回の検索に約12秒かかった", options: { bullet: true } },
], 0.5, 4.6, 9.0, 1.7, { fontSize: 14, paraSpaceAfter: 8 });
repro(s, "results/kitahiroshima/runs.json・results/sapporo/runs.json の method A（time_s・usage_judge）");
s.addNotes("北広島の589件なら1秒弱ですが、札幌の16,610件では約12秒かかりました。費用は小さく、問題は待ち時間です。");

// 13 結果③ AI が先に選ぶ（最初の一覧） ------------------------------------------------------------------
s = content("結果③：AI が先にファイルを選んだ場合の速さ", "結果");
const twoCharts = (city, x, title, fmt) => s.addChart(pres.charts.BAR, ["A", "C"].map((m) => ({ name: m === "A" ? "全件判定" : "AI が先にファイルを選ぶ", labels: city.questions.map((q) => QS[q.id]), values: city.questions.map((q) => q.methods[m].median.total_s) })), {
  x, y: 1.35, w: 4.4, h: 3.7, barDir: "bar", ...chartBase, chartColors: [COL.A, COL.C],
  showTitle: true, title, titleFontSize: 12, titleColor: HEX.dk1, titleFontFace: "+mn-lt", dataLabelFormatCode: fmt, valAxisMinVal: 0, catAxisOrientation: "maxMin",
});
twoCharts(KH, 0.5, `北広島 ${KH.meta.features}件：1回の検索の時間（秒）`, "0.00");
twoCharts(SP, 5.1, `札幌 ${SP.meta.features.toLocaleString()}件：1回の検索の時間（秒）`, "0.0");
label(s, [
  { text: "589件では、ファイルを選ぶ時間（約0.25秒）の分だけ、どの条件でも遅くなった", options: { bullet: true, breakLine: true } },
  { text: "16,610件では、読まないファイルがあった条件で速くなった（食料品 12.5 → 10.5秒）。どのファイルも読んだ「子ども」は遅くなった", options: { bullet: true, breakLine: true } },
  { text: `このときの一覧は、後で説明する「簡易な一覧（m1）」。札幌の検索3回で、全件判定で当てはまった地物の最大${(100 - Math.min(...QUESTIONS_ALL.map((q) => MC.full.m1[q].ret_min)) * 100).toFixed(1)}%を取りこぼした`, options: { bullet: true } },
], 0.5, 5.15, 9.0, 1.35, { fontSize: 12, paraSpaceAfter: 4 });
repro(s, "results/*/runs.json の method A と C（pipeline/run_compare.py --methods A,B,C、一覧は manifest.m1.json）");
s.addNotes("AI が先にファイルを選ぶと、北広島の589件ではかえって遅くなり、札幌の16,610件では、読まないファイルがあった条件で速くなりました。");

// 14 ファイルの中身の一覧とは ---------------------------------------------------------------------------
pres.addSection({ title: "一覧の改良" });
s = content("ファイルの中身の一覧：AI がファイルを選ぶ材料", "一覧の改良");
label(s, "AI はファイルの中の地物を見ずに、この一覧だけを読んで「当てはまる地物がありそうか」を判断する。一覧に何を書くかで、選び方が変わる", 0.5, 1.3, 9.0, 0.8, { fontSize: 14 });
const t1 = M1.files.find((f) => f.id === "public_culture__teine");
code(s, [
  `ファイル：手稲区・公共・文化施設（${t1.rows}件）`,
  `多い種類の上位8件：${Object.entries(t1.tag_counts).slice(0, 4).map(([k, v]) => `${k} ${v}件`).join("、")}、…`,
  `名前の例：${t1.sample_names.slice(0, 4).join("、")}、…`,
], 0.5, 2.2, 9.0, 1.3, 10);
label(s, "札幌の実際の一覧（最初に使った簡易な一覧 m1）の1項目。このファイルには薬局が4件あるが、上位8件には入っていない", 0.5, 3.6, 9.0, 0.6, { fontSize: 11, ...muted });
label(s, [
  { text: "AI は、一覧の各項目について「候補」「除外」「判断材料不足」のどれかを選ぶ", options: { bullet: true, breakLine: true } },
  { text: "「除外」以外のファイルを読む。判断材料不足のファイルも、取りこぼしを避けるため読む", options: { bullet: true, breakLine: true } },
  { text: "一覧を作るには、事前の準備（集計）が要る", options: { bullet: true } },
], 0.5, 4.3, 9.0, 1.6, { fontSize: 14, paraSpaceAfter: 6 });
repro(s, "data/city=sapporo/manifest.m1.json（pipeline/partition.py が作る）");
s.addNotes("AI がファイルを選ぶときに読むのは、この中身の一覧だけです。一覧に何を書くかで、選び方が変わります。");

// 15 一覧の4つの版 ----------------------------------------------------------------------------------
s = content("一覧の書き方を4通り試した（m1〜m4）", "一覧の改良");
label(s, "m1〜m4 は、一覧のファイル名（manifest.m1.json〜m4.json）に合わせた呼び名。手稲区の公共・文化施設のファイル（薬局4件を含む）を例にすると、AI に見せる内容は次のとおり", 0.5, 1.3, 9.0, 0.75, { fontSize: 12 });
const pharm = M4.tags.find((t) => t.tag === "amenity=pharmacy");
const t2 = M2.files.find((f) => f.id === "public_culture__teine");
s.addTable([
  [head("版"), head("AI に見せるもの"), head("このファイルの場合")],
  ["m1\n簡易な一覧", "ファイルごとに、カテゴリ・件数・多い種類の上位8件・名前の例6件", "薬局は上位8件に入らず、見えない"],
  ["m2\n詳しい一覧", "ファイルごとに、すべての種類と件数・種類ごとに選んだ名前の例（最大30件）・名前がある割合", `${Object.keys(t2.tag_counts).length}種類の中に amenity=pharmacy（薬局）4件が見える`],
  ["m3\n種類ごとの一覧", "ファイルではなく種類（タグ）ごとに AI に聞く。当てはまりうる種類を含むファイルを読む", `「amenity=pharmacy（札幌全体で${pharm.rows}件）」という種類だけを見て判断する`],
  ["m4\n種類ごとの一覧\n＋名前の例", "m3 に、種類ごとの名前の例（よく出る名前4件と、珍しい名前8件）を添える", `「amenity=pharmacy：${pharm.example_names.slice(0, 3).join("、")}、…」と見せる`],
], tableOpts(0.5, 2.15, 9.0, [1.5, 4.0, 3.5], { rowH: [0.4, 0.85, 0.85, 0.85, 0.95] }));
repro(s, "pipeline/manifest_m2.py・manifest_m3.py・manifest_m4.py \"data/city=sapporo\"");
s.addNotes("一覧の書き方を4通り試しました。m1 は最初に使った簡易な一覧、m2 は詳しい一覧、m3 は種類ごとに聞く一覧、m4 は種類ごとに名前の例を添えた一覧です。");

// 16 一覧の比較結果 ----------------------------------------------------------------------------------
s = content("一覧の書き方で、速さと取りこぼしが入れ替わる", "一覧の改良");
const vers = ["A", "m1", "m2", "m3", "m4"];
const vlab = { A: "全件判定", m1: "m1", m2: "m2", m3: "m3", m4: "m4" };
s.addChart(pres.charts.BAR, [{ name: "時間", labels: vers.map((v) => vlab[v]), values: vers.map((v) => MC.full[v].groceries.total) }], {
  x: 0.5, y: 1.35, w: 4.4, h: 3.5, barDir: "col", ...chartBase, showLegend: false,
  chartColors: [COL.A, "7FB8A4", "4E9C81", "2E8667", COL.C], invertedColors: [COL.A, "7FB8A4", "4E9C81", "2E8667", COL.C],
  showTitle: true, title: "札幌・食料品：1回の検索の時間（秒）", titleFontSize: 12, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
  dataLabelFormatCode: "0.0", valAxisMinVal: 0,
});
s.addTable([
  [head("版"), head("読んだファイル（50中）", "right"), head("取りこぼし無しの割合 食料品", "right"), head("同 歴史・文化", "right")],
  ...["m1", "m2", "m3", "m4"].map((v) => [v, { text: String(MC.full[v].groceries.files), options: { align: "right" } },
    { text: pctf(MC.selection[`${v}|groceries`].ret_min), options: { align: "right", bold: v === "m4" } }, { text: pctf(MC.selection[`${v}|local_history`].ret_min), options: { align: "right", bold: v === "m4" } }]),
], tableOpts(5.1, 1.45, 4.4, [0.5, 1.2, 1.4, 1.3], { rowH: 0.5 }));
label(s, "取りこぼし無しの割合＝全件判定で当てはまった地物のうち、読んだファイルに入っていた割合（ファイル選択だけを10回くり返した最小値）", 5.1, 4.1, 4.4, 0.8, { fontSize: 9, ...muted });
label(s, [
  { text: "m2・m3 は、食料品で全件判定の約半分の時間（12.4 → 6.6〜6.9秒）で済んだが、少数の地物を落とした（98.5〜99.5%）", options: { bullet: true, breakLine: true } },
  { text: "m4 は、4条件すべてで1件も落とさなかった（ファイル選択だけ10回、検索全体3回とも）。代わりに、速くなったのは食料品の約15%だけ", options: { bullet: true } },
], 0.5, 5.0, 9.0, 1.45, { fontSize: 13, paraSpaceAfter: 6 });
repro(s, "pipeline/selection_compare.py（10回）・run_compare.py --methods C --manifest manifest.m4.json（3回）→ compare_manifests.py");
s.addNotes("一覧を詳しくしたり、種類ごとに聞いたりすると、食料品では約半分の時間で済みましたが、少数の地物を落としました。名前の例を添えた m4 では落とさなくなりましたが、速くなったのは食料品の約15%だけでした。");

// 17 なぜ落ちたか ------------------------------------------------------------------------------------
s = content("落ちた理由：決め手が種類（タグ）ではなく名前にあった", "一覧の改良");
s.addTable([
  [head("条件"), head("落ちた地物"), head("種類（タグ）"), head("AI の判断")],
  ["食料品や日用品を買える場所", "ツルハドラッグ、サツドラ、アイン薬局", { text: "amenity=pharmacy", options: { fontFace: "Courier New" } }, "m3 では、薬局という種類だけを見て「食料品とは関係ない」と判断し、ファイルを読まなかった（10回とも）"],
  ["地域の歴史や文化を学べる場所", "札幌手稲記念館、本郷新記念札幌彫刻美術館、つきさっぷ郷土資料館緑地", { text: "leisure=park\nleisure=garden", options: { fontFace: "Courier New" } }, "公園・庭園という種類だけでは「除外」と判断した"],
], tableOpts(0.5, 1.4, 9.0, [2.0, 2.4, 1.8, 2.8], { fontSize: 10, rowH: [0.4, 1.0, 1.1] }));
label(s, [
  { text: "どちらも、全件判定で1件ずつ見たときは、名前から「当てはまる」と判定されていた", options: { bullet: true, breakLine: true } },
  { text: "m2 では、一覧に薬局が載っていても、ファイル全体（学校・病院が大半）を見て「除外」と判断された", options: { bullet: true, breakLine: true } },
  { text: "一覧に名前の例を入れた m4 で、ドラッグストアだと分かり、落とさなくなった", options: { bullet: true } },
], 0.5, 4.2, 9.0, 1.45, { fontSize: 12, paraSpaceAfter: 5 });
label(s, "AI に選ばせる材料には、判断の決め手になる情報（今回は名前）を残す必要がある", 0.5, 5.8, 9.0, 0.6, { fontSize: 15, bold: true, color: C.accent1 });
repro(s, "results/sapporo/selection_m1_m2.json・selection_m3.json の missed（どの地物を落としたか）");
s.addNotes("落ちたのは、決め手が名前にある地物でした。薬局という種類だけを見ると食料品と関係ないと判断されますが、名前を見ればドラッグストアだと分かります。");

// 18 課題 ---------------------------------------------------------------------------------------
pres.addSection({ title: "課題と対策" });
s = content("課題", "課題と対策");
const agr = [...KH.questions, ...SP.questions].map((q) => q.a_judgment_agreement);
[["判定に誤りがある", "食料品で「旧武井商店酒造部」（歴史的建造物）、歴史・文化で薬局と歯科医院が「当てはまる」と判定された。判定の正しさ（適合率・再現率）は、人が付けた正解が無いので未計測"],
 ["判定が回によって揺れる", `同じ地物の判定が3回とも一致したのは ${(Math.min(...agr) * 100).toFixed(1)}〜${(Math.max(...agr) * 100).toFixed(1)}%。AI が選ぶファイルも、回によって変わることがある`],
 ["時間と費用が件数に比例する", `札幌の全件で1回約12秒。13万件の東京23区なら約8倍になる見込み（見積もりで、未計測）`]].forEach(([h, b], i) => {
  const y = 1.45 + i * 1.6;
  label(s, String(i + 1), 0.5, y, 0.5, 0.55, { fontSize: 26, bold: true, color: C.accent1 });
  label(s, h, 1.1, y + 0.03, 8.4, 0.4, { fontSize: 17, bold: true });
  label(s, b, 1.1, y + 0.5, 8.4, 0.9, { fontSize: 13, ...muted });
});
repro(s, "誤りの例：results/sapporo/runs.json の judgments。揺れ：web/public/data/*/results.json の a_judgment_agreement");
s.addNotes("課題は3つです。判定に誤りがあること、判定が揺れること、時間と費用が件数に比例することです。");

// 19 対策 ---------------------------------------------------------------------------------------
s = content("対策", "課題と対策");
s.addTable([
  [head("課題"), head("対策"), head("良い点"), head("気になる点"), head("状況")],
  ["判定に誤りがある", "人が正解を付けて、正しさを評価する", "適合率・再現率を数字で示せる。質問文の改善にも使える", "人手がかかる", "未実施"],
  ["判定が揺れる", "判定結果を保存して使い回す（モデルの版・質問・地物の情報ごと）", "同じ入力に同じ答え。2回目以降は費用がかからない", "モデルの版が変わると作り直し", "未実装"],
  ["時間と費用", "AI が先にファイルを選ぶ。一覧には名前の例を入れる（m4）", "札幌で取りこぼし無し", "速くなったのは食料品の約15%だけ。小さいデータでは遅くなる", "試した"],
  ["時間と費用（速さを優先する場合）", "一覧を詳しくする（m2）か、種類ごとに聞く（m3）", "食料品で約半分の時間", "少数の地物を落とす（98.5〜99.5%）", "試した"],
], tableOpts(0.5, 1.4, 9.0, [1.6, 2.3, 2.0, 2.1, 1.0], { rowH: [0.4, 0.95, 0.95, 0.95, 0.95] }));
repro(s, "results/sapporo/manifest_comparison_summary.json（pipeline/compare_manifests.py）");
s.addNotes("対策です。誤りには、人が正解を付けて評価する。揺れには、判定結果を保存して使い回す。時間には、AI が先にファイルを選ぶ方法があり、一覧に名前の例を入れれば取りこぼしなく少し速くなり、速さを優先すると少数を落とします。");

// 20 動かす構成 -----------------------------------------------------------------------------------
s = content("動かす構成：Cloudflare Containers ＋ R2", "課題と対策");
[["ブラウザ／curl", 0.5, 1.7], ["Worker", 2.6, 1.5], ["Durable Object", 4.5, 1.8]].forEach(([t, x, w], i) => {
  s.addShape(pres.shapes.RECTANGLE, { x, y: 2.0, w, h: 0.8, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: `arch-${i}` });
  label(s, t, x, 2.0, w, 0.8, { fontSize: 13, align: "center", valign: "middle" });
});
arrow(s, 2.2, 2.4, 2.6, 2.4); arrow(s, 4.1, 2.4, 4.5, 2.4); arrow(s, 6.3, 2.4, 6.7, 2.4);
dashedBox(s, 6.7, 1.6, 2.8, 1.6, HEX.accent1, "EAF3EF", "arch-container");
label(s, "Container\nPython ＋ DuckDB 1.5.5\nspatial／httpfs／jev", 6.85, 1.7, 2.5, 1.4, { fontSize: 12, align: "center", valign: "middle" });
s.addShape(pres.shapes.RECTANGLE, { x: 6.7, y: 3.9, w: 1.3, h: 1.0, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "arch-r2" });
label(s, "R2\nGeoParquet\n一覧", 6.7, 3.9, 1.3, 1.0, { fontSize: 11, align: "center", valign: "middle" });
s.addShape(pres.shapes.RECTANGLE, { x: 8.2, y: 3.9, w: 1.3, h: 1.0, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "arch-jev" });
label(s, "Jev API\n（TypeSafe）", 8.2, 3.9, 1.3, 1.0, { fontSize: 11, align: "center", valign: "middle" });
arrow(s, 7.35, 3.2, 7.35, 3.9); arrow(s, 8.85, 3.2, 8.85, 3.9);
label(s, [
  { text: "POST /search に地域・やり方・質問を送ると、ファイル選択・読み込み・判定の結果と使用量を返す。自由文の質問も受け付ける", options: { bullet: true, breakLine: true } },
  { text: "地図の作品は GitHub Pages で公開（計算済みの結果を表示）", options: { bullet: true, breakLine: true } },
  { text: "Cloudflare 上での実測は未計測", options: { bullet: true } },
], 0.5, 5.15, 9.0, 1.3, { fontSize: 13, paraSpaceAfter: 5 });
repro(s, "container/（README.md に配信手順）、tutorial/README.md の「2. Docker」で手元でも動かせる");
s.addNotes("同じ処理を Cloudflare Containers と R2 で動かす構成です。");

// 21 再現：データの準備 -------------------------------------------------------------------------------
pres.addSection({ title: "再現" });
s = content("再現の手順①：データを作る", "再現");
code(s, [
  "git clone https://github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet.git",
  "cd 30daymapchallenge-2026day27-jev-geoparquet && pip install -r requirements.txt",
  "curl -LO https://download.openstreetmap.fr/extracts/asia/japan/hokkaido-latest.osm.pbf",
  "python pipeline/extract.py hokkaido-latest.osm.pbf work/sapporo sapporo",
  "python pipeline/partition.py work/sapporo \"data/city=sapporo\" Sapporo",
  "cp work/sapporo/boundary.geojson \"data/city=sapporo/\"",
  "python pipeline/manifest_m2.py \"data/city=sapporo\"     # m3・m4 も同じ形",
  "R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… python pipeline/upload_r2.py --dry-run",
], 0.5, 1.4, 9.0, 3.1, 9);
label(s, [
  { text: "北広島は sapporo を kitahiroshima に変える。手元の data/ には、この手順で作ったものが入っている", options: { bullet: true, breakLine: true } },
  { text: "取得したのは 2026-11-21 時点のデータ。時点が違うと件数や結果が変わる", options: { bullet: true, breakLine: true } },
  { text: "取得元は OpenStreetMap France の extracts（Geofabrik は今回の環境から接続できなかった。同じ形式なので差し替えられる）", options: { bullet: true, breakLine: true } },
  { text: "--dry-run を外すと R2 に送る。送り先は geo-opendata/osm-poi/…", options: { bullet: true } },
], 0.5, 4.65, 9.0, 1.9, { fontSize: 12, paraSpaceAfter: 4 });
s.addNotes("データを作る手順です。リポジトリのスクリプトで、OSM のデータから GeoParquet と一覧を作り、R2 に置けます。");

// 22 再現：計測 ------------------------------------------------------------------------------------
s = content("再現の手順②：計測する", "再現");
code(s, [
  "read -rs TYPESAFE_API_KEY && export TYPESAFE_API_KEY",
  "python pipeline/run_compare.py \"data/city=sapporo\" pipeline/questions.json results/sapporo/runs.json --reps 3",
  "python pipeline/run_compare.py \"data/city=sapporo\" pipeline/questions.json results/sapporo/runs_c_m4.json \\",
  "    --reps 3 --methods C --manifest manifest.m4.json",
  "python pipeline/selection_compare.py \"data/city=sapporo\" pipeline/questions.json results/sapporo/runs.json \\",
  "    results/sapporo/selection_m4.json --manifests manifest.m4.json --reps 10",
  "python pipeline/compare_manifests.py \"data/city=sapporo\" results/sapporo",
  "python pipeline/summarize.py \"data/city=sapporo\" pipeline/questions.json results/sapporo/runs.json web/public/data/sapporo",
], 0.5, 1.4, 9.0, 3.1, 9);
s.addTable([
  [head("スクリプト"), head("何を測るか"), head("札幌での目安")],
  ["run_compare.py", "3つのやり方（--methods A,B,C）で検索し、時間・使用量・判定を記録", "全件判定1回 約12秒・約 $0.06"],
  ["selection_compare.py", "AI のファイル選択だけをくり返し、取りこぼしと揺れを数える", "1回 1秒以内・$0.005 以下"],
  ["compare_manifests.py", "一覧の版ごとの結果をまとめる（API は呼ばない）", "数秒"],
], tableOpts(0.5, 4.65, 9.0, [2.2, 4.6, 2.2], { fontSize: 10, rowH: 0.42 }));
label(s, "記号の対応：A＝全件判定、B＝従来のやり方、C＝AI が先にファイルを選ぶ。Jev の答えは毎回少し揺れるので、数字は完全には一致しない", 0.5, 6.4, 9.0, 0.5, { fontSize: 10, ...muted });
s.addNotes("計測の手順です。TypeSafe の API キーを環境変数に入れて、スクリプトを実行します。");

// 23 再現：手元で試す・計測の条件 -----------------------------------------------------------------------
s = content("再現の手順③：手元で試す／計測の条件", "再現");
label(s, "手元で1段ずつ試す", 0.5, 1.35, 4.3, 0.4, { fontSize: 14, bold: true });
label(s, [
  { text: "Google Colab または手元の Jupyter：tutorial/jev_geoparquet_colab.ipynb", options: { bullet: true, breakLine: true } },
  { text: "DATA_SOURCE = \"r2\" にすると R2 から読む（R2 の読み取り用のキーが要る）", options: { bullet: true, breakLine: true } },
  { text: "Docker：tutorial/README.md の「2」。Cloudflare で動かすのと同じ検索 API", options: { bullet: true, breakLine: true } },
  { text: "北広島で最後まで実行して、推定 $0.01 前後", options: { bullet: true } },
], 0.5, 1.8, 4.3, 3.6, { fontSize: 12, paraSpaceAfter: 6 });
label(s, "今日の数字の計測条件", 5.2, 1.35, 4.3, 0.4, { fontSize: 14, bold: true });
s.addTable([
  ["モデル", "jev-1.14.0（指定は jev-latest）"],
  ["ソフト", "DuckDB 1.5.5・jev 拡張 0.1.0"],
  ["jev 拡張の設定", "既定値（20件ずつ・同時16）"],
  ["回数", "各3回の中央値。ファイル選択だけは10回"],
  ["キャッシュ", "1回ごとに jev_cache_clear() で消去"],
  ["日時（UTC）", "3つのやり方：11/22。一覧の比較：11/23"],
  ["場所", "クラウドのコンテナから。中継を経由した分の遅れを含む"],
], tableOpts(5.2, 1.8, 4.3, [1.4, 2.9], { fontSize: 10, rowH: 0.5 }));
repro(s, "計測の日時と応答したモデルの版は、各 results/*.json の started_utc・model_served に記録");
s.addNotes("手元で試すには、Colab か Jupyter のノートブックが一番簡単です。計測の条件は右のとおりです。");

// 24 まとめ ---------------------------------------------------------------------------------------
pres.addSection({ title: "まとめ" });
s = pres.addSlide({ masterName: "DARK", sectionTitle: "まとめ" });
s.addText("まとめ", { placeholder: "title" });
label(s, [
  { text: "Jev を SQL の条件に使うと、属性（タグ）として用意されていない曖昧な条件でも、場所を検索できた", options: { bullet: true, breakLine: true } },
  { text: "従来のやり方では見つからない候補を拾えた（札幌・子どもが遊べる場所で16%、雨の日に屋内で過ごせる場所で20%）", options: { bullet: true, breakLine: true } },
  { text: "代わりに件数に比例した時間がかかる。AI が先にファイルを選ぶと、名前の例を入れた一覧で取りこぼし無く少し速くなった（札幌・食料品で約15%）", options: { bullet: true, breakLine: true } },
  { text: "判定には誤りと揺れがあり、正しさはまだ確かめていない", options: { bullet: true } },
], 0.6, 2.7, 8.8, 3.0, { fontSize: 15, color: C.background1, paraSpaceAfter: 8 });
label(s, "作品：shinyanakashima.github.io/30daymapchallenge-2026day27-jev-geoparquet/", 0.6, 5.95, 8.8, 0.3, { fontSize: 11, color: C.lt2 });
label(s, "コード：github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet", 0.6, 6.25, 8.8, 0.3, { fontSize: 11, color: C.lt2 });
label(s, "データ © OpenStreetMap contributors（ODbL）／背景地図：地理院タイル／Jev は TypeSafe AI のモデル", 0.6, 6.6, 8.8, 0.3, { fontSize: 10, color: C.lt2 });
s.addNotes("まとめです。曖昧な条件でも検索でき、従来のやり方では見つからない候補を拾えました。時間はかかりますが、AI が先にファイルを選ぶ工夫で少し短くできます。判定の正しさは、これから確かめます。");

(async () => {
  await pres.writeFile({ fileName: OUT });
  // Remove directory entries from the ZIP; some cloud services refuse files that contain them.
  try { require("child_process").execSync(`zip -dq "${OUT}" '*/'`); } catch (e) { /* none present */ }
  console.log("wrote", OUT);
})();
