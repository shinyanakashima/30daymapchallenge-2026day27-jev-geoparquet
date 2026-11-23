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


const KHq = (id) => KH.questions.find((q) => q.id === id);
const SPq = (id) => SP.questions.find((q) => q.id === id);
const MC = JSON.parse(fs.readFileSync(path.join(ROOT, "results/sapporo/manifest_comparison_summary.json"), "utf8"));
const SPF = JSON.parse(fs.readFileSync(path.join(ROOT, "web/public/data/sapporo/features.geojson"), "utf8")).features;
const supportedCount = (q) => [...SPq(q).methods.A.runs[0].j].filter((c) => c === "s").length;
const kidsByTag = (() => {
  const c = {}; [...SPq("kids_play").methods.A.runs[0].j].forEach((ch, i) => {
    if (ch !== "s") return; const a = SPF[i].properties.attrs;
    const t = a.leisure === "park" || a.leisure === "playground" ? "公園・遊び場" : a.amenity === "kindergarten" ? "幼稚園・こども園"
      : a.amenity === "community_centre" ? "児童会館・学童など" : a.amenity === "childcare" ? "保育所" : a.amenity === "school" ? "学校" : "その他";
    c[t] = (c[t] || 0) + 1; }); return c; })();
const pctf = (v) => `${(v * 100).toFixed(1)}%`;
const fmtS = (v) => `${v.toFixed(1)}秒`;

// 1 ------------------------------------------------------------------------------------------
pres.addSection({ title: "導入" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "導入" });
s.addText("意思決定特化型AIで\n地理空間データを「解釈」して検索する", { placeholder: "title" });
label(s, "Jev × DuckDB × GeoParquet で、曖昧な条件の検索を試す", 0.6, 4.05, 8.8, 0.5, { color: C.lt2, fontSize: 16 });
label(s, "FOSS4G Hokkaido 2026　2026年11月28日", 0.6, 5.7, 8.8, 0.35, { color: C.background1, fontSize: 13 });
label(s, "Shinya Nakashima（株式会社ズコーシャ）", 0.6, 6.1, 8.8, 0.35, { color: C.background1, fontSize: 13 });
dashedBox(s, 7.6, 0.6, 1.8, 1.0, HEX.lt2, HEX.dk2, "motif-file-1");
dashedBox(s, 8.0, 0.9, 1.8, 1.0, HEX.accent2, HEX.dk2, "motif-file-2");
s.addNotes("意思決定に特化したAIモデル Jev を、DuckDB の SQL の条件として使い、曖昧な条件で地物を検索できるかを試しました。結論は、課題と対策の形で整理します。");

// 2 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "導入" });
s.addText("曖昧な条件は、タグや SQL では書きにくい", { placeholder: "title" });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.45, w: 4.3, h: 0.9, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "example-question" });
label(s, "「子どもが遊べる場所」", 0.7, 1.55, 4.0, 0.7, { fontSize: 20, bold: true, valign: "middle" });
label(s, [
  { text: "OSM のタグに、この条件そのものは無い", options: { bullet: true, breakLine: true } },
  { text: "従来は、タグとの対応表を人が作る（例：子ども → 公園・遊び場）", options: { bullet: true, breakLine: true } },
  { text: "対応表に無い地物は検索にかからない", options: { bullet: true } },
], 0.5, 2.6, 4.3, 2.4, { fontSize: 14, paraSpaceAfter: 8 });
label(s, `札幌で Jev が「該当」とした ${supportedCount("kids_play").toLocaleString()} 件の内訳`, 5.2, 1.45, 4.3, 0.4, { fontSize: 13, bold: true });
const kOrder = ["公園・遊び場", "幼稚園・こども園", "児童会館・学童など", "保育所", "学校", "その他"];
s.addChart(pres.charts.BAR, [{ name: "件数", labels: kOrder, values: kOrder.map((k) => kidsByTag[k] || 0) }], {
  x: 5.1, y: 1.85, w: 4.4, h: 3.3, barDir: "bar", ...chartBase, showLegend: false, chartColors: [COL.C],
  catAxisOrientation: "maxMin", dataLabelFormatCode: "#,##0", valAxisHidden: true, valGridLine: { style: "none" },
});
label(s, "Jev は地物の属性（名前・タグ）を読み、条件に合うかを地物ごとに判定する。公園以外の候補も拾える", 0.5, 5.45, 9.0, 0.8, { fontSize: 14 });
label(s, "札幌市・OSM 16,610件・全件判定（方式A）の1回目", 5.2, 5.15, 4.3, 0.3, { fontSize: 10, ...muted });
s.addNotes("OSM のタグに『子どもが遊べる』という項目はありません。従来はタグとの対応表を人が作るしかなく、対応表に無い地物は漏れます。Jev に属性を読ませると、公園だけでなく幼稚園や児童会館も該当として拾えました。");

// 3 ------------------------------------------------------------------------------------------
pres.addSection({ title: "仕組み" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "仕組み" });
s.addText("Jev を SQL の検索条件として使う", { placeholder: "title" });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.4, w: 9.0, h: 1.75, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "sql" });
label(s, [
  "SELECT osm_id,",
  "  jev_choice({attributes: 'name: のびのび公園; leisure: park'},",
  "    'Does this place match the request \"A place where children can play\"?',",
  "    ['supported', 'contradicted', 'insufficient_information']) AS j",
  "FROM read_parquet([...]) WHERE ST_Within(geometry, <市の範囲>);",
].join("\n"), 0.7, 1.5, 8.6, 1.55, { fontSize: 11, fontFace: "Courier New", valign: "middle" });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 3.5, w: 2.6, h: 2.0, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "manifest" });
label(s, "目録（manifest）", 0.65, 3.6, 2.3, 0.35, { fontSize: 13, bold: true });
label(s, "ファイルごとの要約\nカテゴリ・行数・タグ・名前の例", 0.65, 4.0, 2.3, 1.3, { fontSize: 12, ...muted });
arrow(s, 3.15, 4.5, 3.6, 4.5);
label(s, "① Jev が読むファイルを選ぶ", 3.65, 3.5, 3.0, 0.35, { fontSize: 13, bold: true });
[["候補", HEX.accent1, "EAF3EF"], ["判断材料不足", HEX.accent2, "FBF3E0"], ["除外", HEX.accent3, "F3F3F1"]].forEach(([t, c, f], i) => {
  dashedBox(s, 3.65, 3.95 + i * 0.52, 2.4, 0.42, c, f, `file-${i}`);
  label(s, t, 3.8, 3.95 + i * 0.52, 2.2, 0.42, { fontSize: 12, valign: "middle", color: i === 2 ? C.accent6 : C.text1 });
});
arrow(s, 6.15, 4.5, 6.6, 4.5);
label(s, "② DuckDB で読み\n③ Jev が地物ごとに判定", 6.65, 3.5, 2.85, 0.8, { fontSize: 13, bold: true });
label(s, "空間条件と SQL は同じ。違うのは、どのファイルを読むかだけ", 6.65, 4.4, 2.85, 1.1, { fontSize: 12, ...muted });
label(s, "判断材料不足は読む側に残す／Jev に送るのは値のある属性だけ（ジオメトリは送らない）／目録はこの検索のために作る補助のメタデータ", 0.5, 5.85, 9.0, 0.8, { fontSize: 12, ...muted });
s.addNotes("SQL の中で jev_choice を呼び、地物の属性を、該当・非該当・判断材料不足のどれかに分けます。件数が多いと全件の判定は重いので、読む前にファイルを選ぶ仕組みも試しました。目録を Jev に読ませ、候補・判断材料不足・除外に分けて、除外以外を読みます。");

// 4 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "仕組み" });
s.addText("DuckDB の jev 拡張が持つ4つの仕組み", { placeholder: "title" });
const feats = [
  ["20行をまとめて1リクエスト", "jev_batch_size = 20", "北広島 589行 → 25リクエスト（同じ内容の行を除いた492行）"],
  ["同時に16リクエスト", "jev_concurrency = 16", "589行なら1〜2往復で終わる。行を減らしても時間は縮みにくい"],
  ["同じ入力の答えはキャッシュ", "jev_cache_clear() で消去", "札幌 16,610行のうち API で評価したのは 11,944行。計測では毎回消した"],
  ["使用量を SQL で集計", "jev_stats()", "リクエスト数・トークン・推定費用。今回の数値はすべてこれで取得"],
];
feats.forEach(([h, sub, b], i) => {
  const x = 0.5 + (i % 2) * 4.6, y = 1.5 + Math.floor(i / 2) * 2.1;
  dashedBox(s, x, y, 4.4, 1.85, HEX.accent1, HEX.lt1, `feature-${i}`);
  label(s, h, x + 0.2, y + 0.15, 4.0, 0.4, { fontSize: 15, bold: true });
  label(s, sub, x + 0.2, y + 0.6, 4.0, 0.3, { fontSize: 11, fontFace: "Courier New", color: C.accent1 });
  label(s, b, x + 0.2, y + 0.95, 4.0, 0.8, { fontSize: 12, ...muted });
});
label(s, "モデル jev-1.14.0（指定は jev-latest）・DuckDB 1.5.5・jev 拡張 0.1.0", 0.5, 5.85, 9.0, 0.35, { fontSize: 11, ...muted });
s.addNotes("jev 拡張には4つの仕組みがあります。20行まとめて送る、16リクエストを同時に送る、同じ入力の答えをキャッシュする、jev_stats で使用量を SQL で取れる。今回の数字はすべて jev_stats から取り、計測のたびにキャッシュは消しました。");

// 5 ------------------------------------------------------------------------------------------
pres.addSection({ title: "検証" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "検証" });
s.addText("データと比べ方", { placeholder: "title" });
s.addTable([
  [{ text: "地域", options: { bold: true, fill: { color: HEX.lt2 } } }, { text: "地物", options: { bold: true, fill: { color: HEX.lt2 }, align: "right" } }, { text: "ファイル", options: { bold: true, fill: { color: HEX.lt2 }, align: "right" } }, { text: "区域", options: { bold: true, fill: { color: HEX.lt2 } } }],
  ["北広島市", { text: KH.meta.features.toLocaleString(), options: { align: "right" } }, { text: String(KH.meta.files), options: { align: "right" } }, "経度・緯度の中央値で4区分"],
  ["札幌市", { text: SP.meta.features.toLocaleString(), options: { align: "right" } }, { text: String(SP.meta.files), options: { align: "right" } }, "10区（OSM の区界）"],
], { x: 0.5, y: 1.4, w: 9.0, colW: [1.6, 1.3, 1.3, 4.8], fontSize: 13, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.4 });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 2.85, w: 9.0, h: 0.75, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "layout" });
label(s, "geo-opendata/osm-poi/parquet/2026-11-21/city=sapporo/category=commercial/area=chuo/part-0.parquet", 0.65, 2.85, 8.7, 0.75, { fontSize: 11, fontFace: "Courier New", valign: "middle" });
label(s, "OSM（2026-11-21 時点）の地物を、カテゴリ5種 × 区域で GeoParquet に分割（Hive 形式）。R2 に配置", 0.5, 3.7, 9.0, 0.35, { fontSize: 12, ...muted });
const methods = [["A", "全件判定", "すべて読み、全地物を Jev が判定"], ["B", "固定ルール", "質問ごとに読むカテゴリを対応表で決める"], ["C", "Jev が選ぶ", "目録を Jev が読み、読むファイルを決める"]];
methods.forEach(([k, h, b], i) => {
  const x = 0.5 + i * 3.05;
  s.addShape(pres.shapes.RECTANGLE, { x, y: 4.3, w: 2.85, h: 1.55, fill: { color: i === 2 ? "EAF3EF" : "F4F5F6" }, line: { type: "none" }, objectName: `method-${k}` });
  label(s, k, x + 0.2, 4.4, 0.5, 0.5, { fontSize: 24, bold: true, color: i === 2 ? C.accent1 : C.text1 });
  label(s, h, x + 0.75, 4.45, 2.0, 0.4, { fontSize: 14, bold: true, valign: "middle" });
  label(s, b, x + 0.2, 5.0, 2.5, 0.8, { fontSize: 12 });
});
label(s, "質問4つ（子ども・雨の日・食料品・歴史文化）× 各3回。候補保持率＝方式A で該当になった地物のうち、読んだファイルに含まれていた割合", 0.5, 6.05, 9.0, 0.7, { fontSize: 12, ...muted });
s.addNotes("北広島市と札幌市の OSM の地物を、カテゴリと区域で GeoParquet に分けました。読み方を3通り比べます。Aは全件判定、Bは固定の対応表、Cは Jev が目録を読んで選ぶ方式です。取りこぼしは候補保持率で測ります。");

// 6 ------------------------------------------------------------------------------------------
pres.addSection({ title: "結果" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "結果" });
s.addText("結果①：対応表の外にある候補も拾えた", { placeholder: "title" });
s.addImage({ path: path.join(__dirname, "img/sapporo_kids_fixed_rule.png"), x: 0.5, y: 1.35, w: 4.0, h: 3.59, objectName: "map-fixed-rule", altText: "札幌・子どもが遊べる場所。固定ルールでは読まないファイルにあった該当地物を赤い輪で示した地図" });
label(s, "赤い輪：Jev が該当としたが、固定ルール（公園・遊び場だけ読む）では読まない地物", 0.5, 5.0, 4.0, 0.6, { fontSize: 11, ...muted });
const ex = { kids_play: "幼稚園・児童会館・学童クラブ", rainy_day: "プール・銭湯・ジム・ネットカフェ", groceries: "薬局（ドラッグストア）", local_history: "博物館・郷土資料館の緑地" };
const short = { kids_play: "子ども", rainy_day: "雨の日", groceries: "食料品", local_history: "歴史・文化" };
s.addTable([
  [{ text: "質問", options: { bold: true, fill: { color: HEX.lt2 } } }, { text: "該当", options: { bold: true, align: "right", fill: { color: HEX.lt2 } } }, { text: "対応表の外", options: { bold: true, align: "right", fill: { color: HEX.lt2 } } }, { text: "対応表の外の例", options: { bold: true, fill: { color: HEX.lt2 } } }],
  ...SP.questions.map((q) => [short[q.id], { text: supportedCount(q.id).toLocaleString(), options: { align: "right" } }, { text: String(q.methods.B.runs[0].missed.length), options: { align: "right" } }, ex[q.id]]),
], { x: 4.75, y: 1.4, w: 4.75, colW: [0.95, 0.7, 1.1, 2.0], fontSize: 11, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.5 });
label(s, "札幌・方式A の1回目。「対応表の外」は、固定ルール（方式B）では読まないファイルにあった該当地物", 4.75, 4.05, 4.75, 0.7, { fontSize: 10, ...muted });
label(s, [
  { text: "自然言語の条件を Jev が地物ごとに解釈し、タグの組み合わせを人が考えなくても候補を集められた", options: { bullet: true, breakLine: true } },
  { text: "固定ルールの候補保持率は、北広島 75〜98%、札幌 84〜99%", options: { bullet: true } },
], 0.5, 5.75, 9.0, 1.0, { fontSize: 13, paraSpaceAfter: 5 });
s.addNotes("曖昧検索の結果です。子どもが遊べる場所では、固定ルールでは読まないファイルに、幼稚園や児童会館など268件の候補がありました。雨の日では、プールや銭湯など356件です。Jev は条件を地物ごとに解釈するので、対応表を作らなくても候補を集められました。");

// 7 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "結果" });
s.addText("結果②：読む前に選ぶ効果は、件数が多いほど出る", { placeholder: "title" });
const twoCharts = (city, x, title, fmt) => s.addChart(pres.charts.BAR, ["A", "C"].map((m) => ({ name: m === "A" ? "方式A 全件" : "方式C Jev が選ぶ", labels: city.questions.map((q) => short[q.id]), values: city.questions.map((q) => q.methods[m].median.total_s) })), {
  x, y: 1.35, w: 4.4, h: 4.0, barDir: "bar", ...chartBase, chartColors: [COL.A, COL.C],
  showTitle: true, title, titleFontSize: 12, titleColor: HEX.dk1, titleFontFace: "+mn-lt", dataLabelFormatCode: fmt, valAxisMinVal: 0, catAxisOrientation: "maxMin",
});
twoCharts(KH, 0.5, `北広島 ${KH.meta.features}件：総時間（秒）`, "0.00");
twoCharts(SP, 5.1, `札幌 ${SP.meta.features.toLocaleString()}件：総時間（秒）`, "0.0");
label(s, [
  { text: "589件では、ファイル選択（約0.25秒）を取り戻せず、どの質問でも方式C が遅い", options: { bullet: true, breakLine: true } },
  { text: "16,610件では、ファイルを除外できた質問で方式C が速い（食料品 12.5 → 10.5秒、トークン 16%減）", options: { bullet: true, breakLine: true } },
  { text: "除外できない質問（子ども）では、選ぶ分だけ遅くなる", options: { bullet: true } },
], 0.5, 5.5, 9.0, 1.3, { fontSize: 13, paraSpaceAfter: 5 });
s.addNotes("速さです。北広島の589件では、ファイル選択の時間を取り戻せず、方式Cの方が遅くなりました。札幌の16,610件では、ファイルを除外できた質問で方式Cの方が速くなりました。効果は件数と質問次第です。");

// 8 ------------------------------------------------------------------------------------------
pres.addSection({ title: "課題と対策" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "課題と対策" });
s.addText("課題：4つに整理", { placeholder: "title" });
const agr = [...KH.questions, ...SP.questions].map((q) => q.a_judgment_agreement);
const spA = MC.full.A.groceries;
const issues = [
  ["時間と費用が件数に比例する", `札幌の全件判定は1回 ${spA.total.toFixed(1)}秒・入力 ${Math.round(spA.tok / 10000)}万トークン（推定 $${spA.cost.toFixed(3)}）。13万件の東京23区なら約8倍になる見込み（未計測）`],
  ["読む前に絞ると、候補を取りこぼす", "固定ルールは候補保持率 75〜99%。Jev がファイルを選んでも 98.5〜100%（目録の書き方による）"],
  ["判定が回によって揺れる", `同じ地物の判定が3回とも一致したのは ${(Math.min(...agr) * 100).toFixed(1)}〜${(Math.max(...agr) * 100).toFixed(1)}%。ファイルの選択も回によって変わる`],
  ["判定に誤りがあり、正しさを測れていない", "食料品で「旧武井商店酒造部」（歴史的建造物）、歴史・文化で薬局と歯科医院が該当になった。正解データが無く、適合率・再現率は未計測"],
];
issues.forEach(([h, b], i) => {
  const y = 1.4 + i * 1.3;
  label(s, String(i + 1), 0.5, y, 0.5, 0.55, { fontSize: 26, bold: true, color: C.accent1 });
  label(s, h, 1.1, y + 0.03, 8.4, 0.4, { fontSize: 16, bold: true });
  label(s, b, 1.1, y + 0.47, 8.4, 0.75, { fontSize: 12, ...muted });
});
s.addNotes("課題は4つです。全件判定は件数に比例して時間と費用がかかる。読む前に絞ると候補を取りこぼす。判定が回によって揺れる。そして判定に誤りがあり、正しさを測れていない。ここからは、課題ごとの対策を複数案で整理します。");

// 9 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "課題と対策" });
s.addText("対策（課題1・2）：読むファイルの選び方", { placeholder: "title" });
const head = (t, al) => ({ text: t, options: { bold: true, fill: { color: HEX.lt2 }, align: al || "left" } });
const optRows = [
  ["A 全件判定", "取りこぼし無し", "件数に比例して遅く高い", fmtS(MC.full.A.groceries.total), "100%"],
  ["B 固定ルール（Hive の刈り込み）", "最速。Jev の選択が要らない", "対応表の外を落とす", fmtS(SPq("groceries").methods.B.median.total_s), "84〜99%"],
  ["C・m1 ファイルの要約（上位8タグ）", "対応表が要らない", "短縮が小さい", fmtS(MC.full.m1.groceries.total), "99.2%〜"],
  ["C・m2 要約を詳しく（全タグ）", "読む量が大きく減る", "少数派を落とす", fmtS(MC.full.m2.groceries.total), "98.8%〜"],
  ["C・m3 タグごとに判断", "読む量が最も減り、揺れも少ない", "名前が決め手の地物を落とす", fmtS(MC.full.m3.groceries.total), "98.5%〜"],
  ["C・m4 タグ＋名前の例", "取りこぼし無し", "短縮は約15%。選択の費用が増える", fmtS(MC.full.m4.groceries.total), "100%"],
];
s.addTable([
  [head("案"), head("メリット"), head("デメリット"), head("食料品", "right"), head("候補保持率", "right")],
  ...optRows.map((r, i) => r.map((c, j) => ({ text: c, options: { align: j >= 3 ? "right" : "left", bold: i === 5 && j === 0 } }))),
], { x: 0.5, y: 1.4, w: 9.0, colW: [2.75, 2.2, 2.05, 0.9, 1.1], fontSize: 11, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.55, valign: "middle" });
label(s, "札幌。「食料品」は食料品の質問の総時間で、3回測った中央値。候補保持率は4問の最小値（方式B は方式Bの3回、C は選択のみ10回）", 0.5, 5.4, 9.0, 0.5, { fontSize: 10, ...muted });
label(s, "決め手になる情報（今回は名前）を目録に残すかどうかで、速さと取りこぼしが入れ替わる", 0.5, 5.95, 9.0, 0.7, { fontSize: 14, bold: true, color: C.accent1 });
s.addNotes("課題1と2への対策は、読むファイルの選び方です。全件判定は確実ですが遅い。固定ルールは最速ですが対応表の外を落とす。Jevに選ばせる場合は、目録の書き方で性格が変わります。要約を詳しくしたりタグ単位にしたりすると速くなるが少数派を落とし、名前の例を添えると取りこぼしは無くなるが短縮は小さくなります。");

// 10 -----------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "課題と対策" });
s.addText("目録の書き方で、速さと取りこぼしが入れ替わる", { placeholder: "title" });
const vers = ["A", "m1", "m2", "m3", "m4"];
const vlab = { A: "方式A", m1: "C・m1", m2: "C・m2", m3: "C・m3", m4: "C・m4" };
s.addChart(pres.charts.BAR, [{ name: "総時間", labels: vers.map((v) => vlab[v]), values: vers.map((v) => MC.full[v].groceries.total) }], {
  x: 0.5, y: 1.35, w: 4.4, h: 3.6, barDir: "col", ...chartBase, showLegend: false,
  chartColors: [COL.A, "7FB8A4", "4E9C81", "2E8667", COL.C], invertedColors: [COL.A, "7FB8A4", "4E9C81", "2E8667", COL.C],
  showTitle: true, title: "札幌・食料品の総時間（秒、3回の中央値）", titleFontSize: 12, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
  dataLabelFormatCode: "0.0", valAxisMinVal: 0,
});
s.addTable([
  [head("版"), head("Jev に見せるもの"), head("食料品", "right"), head("歴史・文化", "right")],
  ["m1", "ファイル要約・上位8タグ", { text: pctf(MC.selection["m1|groceries"].ret_min), options: { align: "right" } }, { text: pctf(MC.selection["m1|local_history"].ret_min), options: { align: "right" } }],
  ["m2", "ファイル要約・全タグ", { text: pctf(MC.selection["m2|groceries"].ret_min), options: { align: "right" } }, { text: pctf(MC.selection["m2|local_history"].ret_min), options: { align: "right" } }],
  ["m3", "タグごとに判断", { text: pctf(MC.selection["m3|groceries"].ret_min), options: { align: "right" } }, { text: pctf(MC.selection["m3|local_history"].ret_min), options: { align: "right" } }],
  ["m4", "タグ＋名前の例", { text: pctf(MC.selection["m4|groceries"].ret_min), options: { align: "right", bold: true } }, { text: pctf(MC.selection["m4|local_history"].ret_min), options: { align: "right", bold: true } }],
], { x: 5.1, y: 1.45, w: 4.4, colW: [0.5, 1.9, 0.95, 1.05], fontSize: 11, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.42 });
label(s, "数値は候補保持率（ファイル選択のみ10回の最小値）", 5.1, 3.85, 4.4, 0.3, { fontSize: 10, ...muted });
label(s, [
  { text: "要約を詳しくする（m2）・タグ単位にする（m3）と、Jev は大胆に除外する。食料品は方式A の約半分の時間とトークンで済んだ", options: { bullet: true, breakLine: true } },
  { text: "落ちたのは少数派。薬局（ドラッグストア）や「記念館」の公園など、決め手がタグではなく名前にある地物", options: { bullet: true, breakLine: true } },
  { text: "名前の例を添えた m4 は保持率 100%。その代わり短縮は約15%に縮んだ", options: { bullet: true } },
], 0.5, 5.15, 9.0, 1.7, { fontSize: 13, paraSpaceAfter: 5 });
s.addNotes("目録の書き方を4通り比べました。要約を詳しくしたりタグ単位で判断させたりすると、食料品では方式Aの約半分の時間で済みました。ただし落ちたのは、ドラッグストアの薬局や、公園のタグが付いた記念館など、決め手が名前にある地物でした。名前の例を添えると取りこぼしは無くなりましたが、短縮は約15%に縮みました。");

// 11 -----------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "課題と対策" });
s.addText("対策（課題3・4）：判定の揺れと誤り", { placeholder: "title" });
const opt2 = [
  ["判定結果を保存して使い回す（モデルの版・質問・入力ごと）", "同じ入力に同じ答え。2回目以降は費用がかからない。後から検証できる", "モデルの版が変わると作り直し", "未実装"],
  ["1行ずつ送る（jev_batch_size = 1）", "一緒に送る行の影響を受けない", "60行で 3→58リクエスト、トークン約3倍（7,035→21,527）", "揺れへの効果は未計測"],
  ["確信度で「判断材料不足」の扱いを変える", "取りこぼしと誤りの釣り合いを選べる", "境目を決めるのに正解データが要る", "未計測"],
  ["人が正解を付けて評価する", "適合率・再現率を示せる。質問文の改善に使える", "手間がかかる", "未実施"],
];
s.addTable([
  [head("案"), head("メリット"), head("デメリット"), head("状況")],
  ...opt2.map((r) => r.map((c) => ({ text: c }))),
], { x: 0.5, y: 1.4, w: 9.0, colW: [2.6, 2.6, 2.5, 1.3], fontSize: 11, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.75, valign: "middle" });
label(s, "トークンの数値は北広島の60行で1回ずつ試した値", 0.5, 5.75, 9.0, 0.3, { fontSize: 10, ...muted });
label(s, "判定の正しさを数字で示すことが、次の一歩", 0.5, 6.2, 9.0, 0.5, { fontSize: 14, bold: true, color: C.accent1 });
s.addNotes("課題3と4、判定の揺れと誤りへの対策です。判定結果を保存して使い回す、1行ずつ送る、確信度で扱いを変える、人が正解を付けて評価する、の4案です。どれもまだ測れていません。判定の正しさを数字で示すことが次の一歩です。");

// 12 -----------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "課題と対策" });
s.addText("動かす構成：Cloudflare Containers ＋ R2", { placeholder: "title" });
[["ブラウザ／curl", 0.5, 1.7], ["Worker", 2.6, 1.5], ["Durable Object", 4.5, 1.8]].forEach(([t, x, w], i) => {
  s.addShape(pres.shapes.RECTANGLE, { x, y: 2.0, w, h: 0.8, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: `arch-${i}` });
  label(s, t, x, 2.0, w, 0.8, { fontSize: 13, align: "center", valign: "middle" });
});
arrow(s, 2.2, 2.4, 2.6, 2.4); arrow(s, 4.1, 2.4, 4.5, 2.4); arrow(s, 6.3, 2.4, 6.7, 2.4);
dashedBox(s, 6.7, 1.6, 2.8, 1.6, HEX.accent1, "EAF3EF", "arch-container");
label(s, "Container\nPython ＋ DuckDB 1.5.5\nspatial／httpfs／jev", 6.85, 1.7, 2.5, 1.4, { fontSize: 12, align: "center", valign: "middle" });
s.addShape(pres.shapes.RECTANGLE, { x: 6.7, y: 3.9, w: 1.3, h: 1.0, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "arch-r2" });
label(s, "R2\nGeoParquet\n目録", 6.7, 3.9, 1.3, 1.0, { fontSize: 11, align: "center", valign: "middle" });
s.addShape(pres.shapes.RECTANGLE, { x: 8.2, y: 3.9, w: 1.3, h: 1.0, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "arch-jev" });
label(s, "Jev API\n（TypeSafe）", 8.2, 3.9, 1.3, 1.0, { fontSize: 11, align: "center", valign: "middle" });
arrow(s, 7.35, 3.2, 7.35, 3.9); arrow(s, 8.85, 3.2, 8.85, 3.9);
label(s, [
  { text: "POST /search に地域・方式・質問を送ると、選択・読み込み・判定の結果と jev_stats を返す。自由文の質問も受け付ける", options: { bullet: true, breakLine: true } },
  { text: "地図の作品は GitHub Pages（計算済みの結果を表示）", options: { bullet: true, breakLine: true } },
  { text: "Cloudflare 上での実測は未計測", options: { bullet: true } },
], 0.5, 5.2, 9.0, 1.6, { fontSize: 13, paraSpaceAfter: 5 });
s.addNotes("同じ処理を Cloudflare Containers と R2 で動かす構成です。R2 の GeoParquet を、コンテナの中の DuckDB が読み、jev 拡張が判定します。地図の作品は GitHub Pages で公開しています。");

// 13 -----------------------------------------------------------------------------------------
pres.addSection({ title: "まとめ" });
s = pres.addSlide({ masterName: "DARK", sectionTitle: "まとめ" });
s.addText("まとめ", { placeholder: "title" });
label(s, [
  { text: "意思決定AI（Jev）を SQL の条件に使うと、タグの対応表を作らなくても曖昧な条件で地物を検索できた（札幌・子どもでは、対応表の外の候補 268件）", options: { bullet: true, breakLine: true } },
  { text: "課題は、時間と費用・取りこぼし・判定の揺れ・判定の正しさ", options: { bullet: true, breakLine: true } },
  { text: "読む前に選ぶ方法は、目的で選ぶ。取りこぼさない → 全件か m4、速さ優先 → m2・m3（保持率 98.5〜99.5%）", options: { bullet: true } },
], 0.6, 2.75, 8.8, 2.7, { fontSize: 15, color: C.background1, paraSpaceAfter: 10 });
label(s, "次：判定の正しさの評価、判定結果の保存、東京23区（13万件）、COGP の詳細度を使った段階的な検索", 0.6, 5.5, 8.8, 0.45, { fontSize: 12, color: C.lt2 });
label(s, "作品：shinyanakashima.github.io/30daymapchallenge-2026day27-jev-geoparquet/", 0.6, 6.0, 8.8, 0.3, { fontSize: 11, color: C.lt2 });
label(s, "コード：github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet", 0.6, 6.3, 8.8, 0.3, { fontSize: 11, color: C.lt2 });
label(s, "データ © OpenStreetMap contributors（ODbL）／背景地図：地理院タイル／Jev は TypeSafe AI のモデル", 0.6, 6.65, 8.8, 0.3, { fontSize: 10, color: C.lt2 });
s.addNotes("まとめです。意思決定AIを SQL の条件に使うと、対応表を作らなくても曖昧な条件で検索できました。課題は、時間と費用、取りこぼし、判定の揺れ、判定の正しさの4つです。読む前に選ぶ方法は目的で選びます。取りこぼさないなら全件か名前の例を添えた目録、速さ優先なら詳しい要約やタグ単位の目録です。");

(async () => {
  await pres.writeFile({ fileName: OUT });
  // Remove directory entries from the ZIP; some cloud services refuse files that contain them.
  try { require("child_process").execSync(`zip -dq "${OUT}" '*/'`); } catch (e) { /* none present */ }
  console.log("wrote", OUT);
})();
