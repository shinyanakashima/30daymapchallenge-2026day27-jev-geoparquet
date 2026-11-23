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
const supportedCount = (q) => [...SPq(q).methods.A.runs[0].j].filter((c) => c === "s").length;
const short = { kids_play: "子どもが遊べる場所", rainy_day: "雨の日に屋内で過ごせる場所", groceries: "食料品や日用品を買える場所", local_history: "地域の歴史や文化を学べる場所" };
const head = (t, al) => ({ text: t, options: { bold: true, fill: { color: HEX.lt2 }, align: al || "left" } });
const rng = (city, key) => { const v = city.questions.map((q) => q.methods.A.median[key]); return [Math.min(...v), Math.max(...v)]; };

// 1 ------------------------------------------------------------------------------------------
pres.addSection({ title: "導入" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "導入" });
s.addText("意思決定特化型AIで\n地理空間データを「解釈」して検索する", { placeholder: "title" });
label(s, "Jev × DuckDB × GeoParquet で、曖昧な条件の検索を試す", 0.6, 4.05, 8.8, 0.5, { color: C.lt2, fontSize: 16 });
label(s, "FOSS4G Hokkaido 2026　2026年11月28日", 0.6, 5.7, 8.8, 0.35, { color: C.background1, fontSize: 13 });
label(s, "Shinya Nakashima（株式会社ズコーシャ）", 0.6, 6.1, 8.8, 0.35, { color: C.background1, fontSize: 13 });
dashedBox(s, 7.6, 0.6, 1.8, 1.0, HEX.lt2, HEX.dk2, "motif-file-1");
dashedBox(s, 8.0, 0.9, 1.8, 1.0, HEX.accent2, HEX.dk2, "motif-file-2");
s.addNotes("意思決定に特化したAIモデル Jev を使って、曖昧な条件で地図上の場所を探せるかを試しました。");

// 2 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "導入" });
s.addText("今日の問い", { placeholder: "title" });
[["1", "「子どもが遊べる場所」のような曖昧な条件で、地図上の場所を検索できるか"],
 ["2", "従来のやり方と比べて、どれだけ多くの候補を拾えるか。代わりに何がかかるか"]].forEach(([n, t], i) => {
  const y = 1.7 + i * 1.6;
  label(s, n, 0.6, y, 0.6, 0.8, { fontSize: 40, bold: true, color: C.accent1 });
  label(s, t, 1.4, y + 0.1, 8.0, 1.2, { fontSize: 20, bold: true });
});
label(s, "対象：札幌市と北広島市の OpenStreetMap（OSM）の地物。施設・店・公園など", 0.6, 5.3, 8.8, 0.5, { fontSize: 14, ...muted });
s.addNotes("問いは2つです。曖昧な条件で場所を検索できるか。そして従来のやり方と比べて、どれだけ多く拾えて、代わりに何がかかるか。対象は札幌市と北広島市の OpenStreetMap のデータです。");

// 3 ------------------------------------------------------------------------------------------
pres.addSection({ title: "前提" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "前提" });
s.addText("OSM の地物には、種類を表す属性（タグ）が付いている", { placeholder: "title" });
label(s, "OpenStreetMap（OSM）は、世界中の人が編集できる地図データ。OSM では属性を「タグ」と呼び、地物ごとに「キー=値」の形で付ける。GIS の属性テーブルのように列が決まっているのではなく、必要な属性を地物ごとに足していく", 0.5, 1.3, 9.0, 1.0, { fontSize: 14 });
s.addTable([
  [head("名前（name）"), head("種類を表す属性（タグ）"), head("意味")],
  ["のびのび公園", { text: "leisure=park", options: { fontFace: "Courier New" } }, "公園"],
  ["もみじ台幼稚園", { text: "amenity=kindergarten", options: { fontFace: "Courier New" } }, "幼稚園"],
  ["ツルハドラッグ", { text: "amenity=pharmacy\nshop=chemist", options: { fontFace: "Courier New" } }, "薬局・ドラッグストア"],
], { x: 0.5, y: 2.45, w: 9.0, colW: [2.6, 3.6, 2.8], fontSize: 14, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.55, valign: "middle" });
label(s, "札幌市の実データ（2026年11月21日時点の OSM）。今回は、よく使うキー（name・amenity・leisure・shop など）を属性の列にして扱った", 0.5, 4.85, 9.0, 0.5, { fontSize: 11, ...muted });
label(s, "GIS で場所を探すときは、ふつうこの種類の属性で絞り込む（例：amenity が kindergarten の地物）", 0.5, 5.55, 9.0, 0.7, { fontSize: 16, bold: true, color: C.accent1 });
s.addNotes("OpenStreetMap は誰でも編集できる地図データです。OSM では属性のことをタグと呼び、キーと値の組で付けます。GIS の属性テーブルと違って列は決まっておらず、地物ごとに必要な属性を足していきます。公園なら leisure=park、幼稚園なら amenity=kindergarten です。検索は、ふつうこのタグで絞り込みます。");

// 4 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "前提" });
s.addText("「子どもが遊べる場所」という属性は無い", { placeholder: "title" });
label(s, "従来のやり方：条件に合いそうな種類の属性（タグ）を、人が選んで対応表にする", 0.5, 1.35, 9.0, 0.5, { fontSize: 15, bold: true });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.95, w: 4.2, h: 1.5, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "rule" });
label(s, "子どもが遊べる場所\n→ 公園・遊び場の地物だけを見る", 0.7, 2.05, 3.9, 1.3, { fontSize: 17, bold: true, valign: "middle" });
label(s, [
  { text: "対応表に入れなかった種類の地物は、検索にかからない", options: { bullet: true, breakLine: true } },
  { text: "幼稚園、児童会館、子ども向けの屋内施設……をどこまで入れるかは、人の判断", options: { bullet: true, breakLine: true } },
  { text: "「雨の日に屋内で過ごせる場所」のように、いくつもの種類にまたがる条件ほど難しい", options: { bullet: true } },
], 5.0, 1.95, 4.5, 3.0, { fontSize: 14, paraSpaceAfter: 8 });
label(s, "今回の試み：AI に地物の名前と属性（タグ）を読ませ、条件に合うかを1件ずつ判定させる", 0.5, 5.3, 9.0, 0.8, { fontSize: 16, bold: true, color: C.accent1 });
s.addNotes("子どもが遊べる場所、という属性はありません。従来は、合いそうな種類の属性を人が選んで対応表を作ります。対応表に無いものは漏れますし、どこまで入れるかは人の判断です。今回は、AI に地物の名前とタグを読ませて、1件ずつ判定させました。");

// 5 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "前提" });
s.addText("Jev（TypeSafe AI）に送るもの、返ってくるもの", { placeholder: "title" });
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
label(s, `${CALL.called_at} に札幌の「${CALL.feature.name}」で実際に呼んだ結果。応答したモデル ${CALL.response.model}、入力 ${CALL.response.usage.input_tokens} トークン、${CALL.elapsed_s} 秒`, 0.5, 5.15, 9.0, 0.5, { fontSize: 11, ...muted });
label(s, "答えは、こちらが決めた選択肢のどれか（今回は supported など3つ）で返る。そのため SQL で「判定が supported の地物だけ」のように絞り込める", 0.5, 5.75, 9.0, 0.8, { fontSize: 15, bold: true, color: C.accent1 });
s.addNotes("Jev に実際に送ったものと、返ってきたものです。地物の情報、質問、選択肢を送ると、選択肢の中から答えを1つ返し、選択肢ごとの確率も返します。文章ではなく決まった選択肢で返るので、SQL の条件として扱えます。");

// 6 ------------------------------------------------------------------------------------------
pres.addSection({ title: "仕組み" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "仕組み" });
s.addText("SQL の中で Jev を呼ぶ（DuckDB の jev 拡張）", { placeholder: "title" });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.4, w: 9.0, h: 1.9, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "sql" });
label(s, [
  "SELECT name,",
  "  jev_choice({attributes: 'name: もみじ台幼稚園; amenity: kindergarten'},",
  "    'Does this place match the request \"A place where children can play\"?',",
  "    ['supported', 'contradicted', 'insufficient_information']) AS 判定",
  "FROM read_parquet('…/*.parquet')            -- GeoParquet のファイル群",
  "WHERE ST_Within(geometry, <札幌市の範囲>);     -- 空間条件はいつもどおり",
].join("\n"), 0.7, 1.5, 8.6, 1.7, { fontSize: 11, fontFace: "Courier New", valign: "middle" });
label(s, [
  { text: "地物は GeoParquet（空間データを扱える列指向のファイル形式）で、カテゴリ・区域ごとのファイルに分けて保存", options: { bullet: true, breakLine: true } },
  { text: "DuckDB（ファイルを直接 SQL で読めるデータベース）で読み、地物1件ごとに jev_choice で判定", options: { bullet: true, breakLine: true } },
  { text: "Jev に送るのは、名前と種類の属性（タグ）など、値の入っている属性だけ。位置（ジオメトリ）は送らない", options: { bullet: true } },
], 0.5, 3.6, 9.0, 2.2, { fontSize: 14, paraSpaceAfter: 8 });
label(s, "空間条件などはいつもの SQL のまま書き、Jev の判定は列を1つ足す形で加えられる", 0.5, 5.9, 9.0, 0.6, { fontSize: 15, bold: true, color: C.accent1 });
s.addNotes("DuckDB の jev 拡張を使うと、SQL の中で Jev を呼べます。地物は GeoParquet のファイルに保存してあり、DuckDB で読みながら、1件ずつ jev_choice で判定します。空間条件はいつもの SQL のままです。");

// 7 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "仕組み" });
s.addText("jev 拡張の4つの仕組み", { placeholder: "title" });
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
label(s, "モデル jev-1.14.0（指定は jev-latest）・DuckDB 1.5.5・jev 拡張 0.1.0", 0.5, 5.85, 9.0, 0.35, { fontSize: 11, ...muted });
s.addNotes("jev 拡張には4つの仕組みがあります。20件をまとめて問い合わせる、16回分を同時に送る、同じ内容への答えを覚えておく、使った量を SQL で集計できる。今日の数字は、すべて jev_stats から取っています。");

// 8 ------------------------------------------------------------------------------------------
pres.addSection({ title: "結果" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "結果" });
s.addText("結果①：従来のやり方では拾えない候補を拾えた", { placeholder: "title" });
label(s, "従来のやり方として、地物を種類の属性（タグ）で5つのカテゴリに分け、条件ごとに見るカテゴリを人が決めて検索した。その結果と、Jev で全件を判定した結果を比べた", 0.5, 1.3, 9.0, 0.65, { fontSize: 13 });
const ex = { kids_play: "幼稚園・児童会館・学童クラブ", rainy_day: "プール・銭湯・ジム・ネットカフェ", groceries: "ドラッグストア", local_history: "博物館・郷土資料館" };
const rule = { kids_play: "公園・遊び場", rainy_day: "商業施設、公共・文化施設", groceries: "商業施設", local_history: "公共・文化施設" };
s.addTable([
  [head("条件"), head("従来のやり方で見たカテゴリ"), head("Jev が当てはまると判定", "right"), head("うち従来のやり方では見つからない", "right"), head("見つからなかった地物の例")],
  ...SP.questions.map((q) => { const n = supportedCount(q.id), m = q.methods.B.runs[0].missed.length;
    return [short[q.id], rule[q.id], { text: `${n.toLocaleString()}件`, options: { align: "right" } }, { text: `${m}件（${Math.round(m / n * 100)}%）`, options: { align: "right", bold: m / n > 0.1 } }, ex[q.id]]; }),
], { x: 0.5, y: 2.05, w: 9.0, colW: [1.9, 1.9, 1.5, 1.75, 1.95], fontSize: 11, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.55, valign: "middle" });
label(s, `札幌市の OSM の地物 ${SP.meta.features.toLocaleString()}件。Jev で全件を判定した1回目の結果`, 0.5, 5.0, 9.0, 0.3, { fontSize: 10, ...muted });
label(s, "いくつもの種類にまたがる条件ほど、従来のやり方では見つからない地物が多い（子どもが遊べる場所で16%、雨の日に屋内で過ごせる場所で20%）", 0.5, 5.5, 9.0, 0.9, { fontSize: 15, bold: true, color: C.accent1 });
s.addNotes("結果です。子どもが遊べる場所では、Jev が該当とした1,726件のうち268件、16%は、公園の属性を持つ地物だけを見る従来のやり方では拾えませんでした。幼稚園や児童会館です。雨の日では20%がプールや銭湯などでした。条件が曖昧でタグをまたぐほど、差が大きくなります。");

// 9 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "結果" });
s.addText("結果②：代わりに、時間と費用がかかる", { placeholder: "title" });
const [kt0, kt1] = rng(KH, "total_s"), [st0, st1] = rng(SP, "total_s"), [kr0, kr1] = rng(KH, "read_s"), [sr0, sr1] = rng(SP, "read_s");
const [kc0, kc1] = rng(KH, "estimated_cost_usd"), [sc0, sc1] = rng(SP, "estimated_cost_usd");
s.addTable([
  [head(""), head("北広島市（589件）", "right"), head("札幌市（16,610件）", "right")],
  ["Jev で全件を判定", { text: `${kt0.toFixed(1)}〜${kt1.toFixed(1)}秒`, options: { align: "right", bold: true } }, { text: `${st0.toFixed(1)}〜${st1.toFixed(1)}秒`, options: { align: "right", bold: true } }],
  ["推定費用（1回）", { text: `$${kc0.toFixed(4)}`, options: { align: "right" } }, { text: `$${sc0.toFixed(3)}〜${sc1.toFixed(3)}`, options: { align: "right" } }],
  ["参考：ファイルを読み、市の範囲で絞るまで（AI の判定なし）", { text: `${kr0.toFixed(2)}〜${kr1.toFixed(2)}秒`, options: { align: "right" } }, { text: `${sr0.toFixed(2)}〜${sr1.toFixed(2)}秒`, options: { align: "right" } }],
], { x: 0.5, y: 1.45, w: 9.0, colW: [3.8, 2.6, 2.6], fontSize: 14, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.6, valign: "middle" });
label(s, "4条件 × 各3回の中央値の範囲。推定費用は jev 拡張の推定値（入力100万トークンあたり $0.042）", 0.5, 4.0, 9.0, 0.4, { fontSize: 10, ...muted });
label(s, [
  { text: "時間と費用は、件数にほぼ比例して増える（札幌は北広島の約28倍の件数で、約18倍の時間がかかった）", options: { bullet: true, breakLine: true } },
  { text: "費用は小さい。札幌の全件でも1回あたり約 $0.06（1ドル150円で約9円）", options: { bullet: true, breakLine: true } },
  { text: "問題になるのは待ち時間。札幌の全件では、1回の検索に約12秒かかった", options: { bullet: true } },
], 0.5, 4.6, 9.0, 1.2, { fontSize: 14, paraSpaceAfter: 8 });
s.addNotes("代わりに時間と費用がかかります。北広島の589件なら1秒弱ですが、札幌の16,610件では約12秒かかりました。費用は札幌の全件でも1回6円ほどで、問題は待ち時間の方です。");

// 10 -----------------------------------------------------------------------------------------
pres.addSection({ title: "課題と対策" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "課題と対策" });
s.addText("課題と対策", { placeholder: "title" });
const agr = [...KH.questions, ...SP.questions].map((q) => q.a_judgment_agreement);
const g = MC.full;
const red = Math.round((1 - g.m4.groceries.total / g.A.groceries.total) * 100);
s.addTable([
  [head("課題"), head("根拠"), head("対策"), head("対策の結果")],
  ["判定に誤りがある", "食料品で「旧武井商店酒造部」（歴史的建造物）が該当になった", "人が正解を付けて、正しさを評価する", "未実施"],
  ["判定が回によって揺れる", `同じ地物の判定が3回とも一致したのは ${(Math.min(...agr) * 100).toFixed(1)}〜${(Math.max(...agr) * 100).toFixed(1)}%`, "判定結果を保存して使い回す", "未実装"],
  ["時間と費用が件数に比例する", `札幌の全件で約${g.A.groceries.total.toFixed(0)}秒`, "先に、読むファイルを AI に選ばせる（ファイルごとの中身の一覧を Jev に読ませる）", `札幌・食料品で約${red}%短縮。取りこぼし無し。効果は条件しだい`],
].map((r, i) => i === 0 ? r : r.map((c) => ({ text: c }))), { x: 0.5, y: 1.4, w: 9.0, colW: [1.9, 2.6, 2.4, 2.1], fontSize: 12, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 1.0, valign: "middle" });
label(s, "「取りこぼし無し」は、札幌の4条件で各3回試した範囲。中身の一覧に地物の名前の例を入れないと、取りこぼしが出た", 0.5, 5.55, 9.0, 0.6, { fontSize: 11, ...muted });
s.addNotes("課題は3つです。判定に誤りがあること、判定が揺れること、時間と費用が件数に比例することです。誤りには、人が正解を付けて正しさを評価する。揺れには、判定結果を保存して使い回す。時間には、先に読むファイルを AI に選ばせる。最後の対策は試していて、札幌の食料品で約15%短くなり、取りこぼしはありませんでした。");

// 11 -----------------------------------------------------------------------------------------
pres.addSection({ title: "まとめ" });
s = pres.addSlide({ masterName: "DARK", sectionTitle: "まとめ" });
s.addText("まとめ", { placeholder: "title" });
label(s, [
  { text: "Jev を SQL の条件に使うと、属性（タグ）として用意されていない曖昧な条件でも、場所を検索できた", options: { bullet: true, breakLine: true } },
  { text: "属性の対応表で絞る従来のやり方では見つからない候補を拾えた（札幌・子どもが遊べる場所で 16%、雨の日で 20%）", options: { bullet: true, breakLine: true } },
  { text: "代わりに件数に比例した時間がかかり、判定には誤りと揺れがある。正しさの評価が次の一歩", options: { bullet: true } },
], 0.6, 2.75, 8.8, 2.6, { fontSize: 16, color: C.background1, paraSpaceAfter: 10 });
label(s, "作品：shinyanakashima.github.io/30daymapchallenge-2026day27-jev-geoparquet/", 0.6, 5.85, 8.8, 0.3, { fontSize: 11, color: C.lt2 });
label(s, "コード：github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet", 0.6, 6.2, 8.8, 0.3, { fontSize: 11, color: C.lt2 });
label(s, "データ © OpenStreetMap contributors（ODbL）／背景地図：地理院タイル／Jev は TypeSafe AI のモデル", 0.6, 6.6, 8.8, 0.3, { fontSize: 10, color: C.lt2 });
s.addNotes("まとめです。Jev を SQL の条件に使うと、属性として用意されていない曖昧な条件でも検索できました。従来の対応表では拾えない候補を、子どもで16%、雨の日で20%拾えました。代わりに件数に比例した時間がかかり、判定には誤りと揺れがあります。正しさの評価が次の一歩です。");

(async () => {
  await pres.writeFile({ fileName: OUT });
  // Remove directory entries from the ZIP; some cloud services refuse files that contain them.
  try { require("child_process").execSync(`zip -dq "${OUT}" '*/'`); } catch (e) { /* none present */ }
  console.log("wrote", OUT);
})();
