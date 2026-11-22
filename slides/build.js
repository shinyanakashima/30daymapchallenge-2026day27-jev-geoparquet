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

// 1 ------------------------------------------------------------------------------------------
pres.addSection({ title: "導入" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "導入" });
s.addText("意思決定特化型AIで\n地理空間データを「解釈」して検索する", { placeholder: "title" });
label(s, "読む前に、AIがファイルを選ぶ ― Jev × DuckDB × GeoParquet", 0.6, 4.05, 8.8, 0.5, { color: C.lt2, fontSize: 16 });
label(s, "FOSS4G Hokkaido 2026　2026年11月28日", 0.6, 5.7, 8.8, 0.35, { color: C.background1, fontSize: 13 });
label(s, "Shinya Nakashima（株式会社ズコーシャ）", 0.6, 6.1, 8.8, 0.35, { color: C.background1, fontSize: 13 });
dashedBox(s, 7.6, 0.6, 1.8, 1.0, HEX.lt2, HEX.dk2, "motif-file-1");
dashedBox(s, 8.0, 0.9, 1.8, 1.0, HEX.accent2, HEX.dk2, "motif-file-2");
s.addNotes("意思決定に特化したAIモデル Jev を、SQL の検索条件として使った検証です。地物の属性を自然言語の条件で解釈して絞り込みます。今日の主題は、読む前にAIが読むファイルを選ぶ、という使い方です。");

// 2 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "導入" });
s.addText("曖昧な条件で地物を探したい", { placeholder: "title" });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.45, w: 4.3, h: 1.0, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "example-question" });
label(s, "「子どもが遊べる場所」", 0.7, 1.6, 4.0, 0.7, { fontSize: 20, bold: true, valign: "middle" });
label(s, [
  { text: "OSM のタグに、この条件そのものは無い", options: { bullet: true, breakLine: true } },
  { text: "leisure=park、amenity=kindergarten、児童会館の名称……をどう組み合わせるかは人が考えるしかない", options: { bullet: true, breakLine: true } },
  { text: "Jev に属性を読ませれば地物ごとに判定できる", options: { bullet: true, breakLine: true } },
  { text: "ただし全件に問い合わせると、件数に比例して時間と費用がかかる", options: { bullet: true } },
], 0.5, 2.75, 4.3, 3.6, { fontSize: 14, paraSpaceAfter: 8 });
dashedBox(s, 5.2, 1.45, 4.3, 4.9, HEX.accent1, HEX.lt1, "question-box");
label(s, "検証の問い", 5.45, 1.65, 3.8, 0.4, { fontSize: 13, bold: true, color: C.accent1 });
label(s, "自然言語の条件から、読む GeoParquet を先に絞ると、候補の取りこぼしをどの程度に抑え、どれだけ速く・安く検索できるか", 5.45, 2.15, 3.8, 2.2, { fontSize: 17, bold: true });
label(s, "ファイルを選ぶ時間と費用も含めた合計で比べる", 5.45, 4.6, 3.8, 1.2, { fontSize: 13, ...muted });
s.addNotes("OSM のタグには『子どもが遊べる』という項目はありません。タグの組み合わせを人が考える代わりに、Jev に属性を読ませて判定させます。ただ、全件を判定すると件数に比例して遅く高くなります。そこで、読むファイルを先に絞れるかを確かめました。比較はファイル選択の時間と費用も含めた合計です。");

// 3 ------------------------------------------------------------------------------------------
pres.addSection({ title: "仕組み" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "仕組み" });
s.addText("仕組み：目録を見て、読むファイルを選ぶ", { placeholder: "title" });
// step 1: manifest
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.5, w: 2.6, h: 2.3, fill: { color: HEX.lt2 }, line: { type: "none" }, objectName: "manifest" });
label(s, "目録（manifest.json）", 0.65, 1.6, 2.3, 0.35, { fontSize: 13, bold: true });
label(s, "ファイルごとに\nカテゴリ・行数・bbox\n多いタグの上位8件\n名称の例", 0.65, 2.0, 2.3, 1.6, { fontSize: 12, ...muted });
arrow(s, 3.15, 2.65, 3.6, 2.65);
// step 2: file selection
label(s, "① Jev がファイルを選ぶ", 3.65, 1.5, 3.0, 0.35, { fontSize: 13, bold: true });
const st = [["候補", HEX.accent1, "EAF3EF"], ["判断材料不足", HEX.accent2, "FBF3E0"], ["除外", HEX.accent3, "F3F3F1"]];
st.forEach(([t, c, f], i) => {
  dashedBox(s, 3.65, 1.95 + i * 0.6, 2.4, 0.48, c, f, `file-${i}`);
  label(s, t, 3.8, 1.95 + i * 0.6, 2.2, 0.48, { fontSize: 12, valign: "middle", color: i === 2 ? C.accent6 : C.text1 });
});
label(s, "判断材料不足は読む側に残す", 3.65, 3.8, 3.0, 0.35, { fontSize: 11, ...muted });
arrow(s, 6.15, 2.65, 6.6, 2.65);
// step 3: read + judge
label(s, "② DuckDB で読む", 6.65, 1.5, 2.85, 0.35, { fontSize: 13, bold: true });
label(s, "read_parquet(候補と\n判断材料不足のファイル)\nWHERE ST_Within(…)", 6.65, 1.95, 2.85, 1.0, { fontSize: 11, fontFace: "Courier New" });
label(s, "③ Jev が地物ごとに判定", 6.65, 3.05, 2.85, 0.35, { fontSize: 13, bold: true });
label(s, "supported\ncontradicted\ninsufficient_information", 6.65, 3.45, 2.85, 0.9, { fontSize: 11, fontFace: "Courier New" });
// bottom notes
s.addShape(pres.shapes.LINE, { x: 0.5, y: 4.75, w: 9.0, h: 0, line: { color: "DEDBD3", width: 0.75 } });
label(s, [
  { text: "空間条件・SQL・地物の判定は、どの方式でも同じ。違うのは「どのファイルを読むか」だけ", options: { bullet: true, breakLine: true } },
  { text: "目録は、この検索のために用意する補助のメタデータ（事前準備が要らないわけではない）", options: { bullet: true, breakLine: true } },
  { text: "Jev に送るのは値のある属性だけ。ジオメトリは送らない", options: { bullet: true } },
], 0.5, 4.95, 9.0, 1.8, { fontSize: 14, paraSpaceAfter: 6 });
s.addNotes("流れは3段です。①目録の各項目を Jev が読み、候補・判断材料不足・除外に分けます。判断材料不足は取りこぼしを避けるため読む側に残します。②DuckDB が残ったファイルだけを読み、市の範囲で絞ります。③地物ごとに Jev が判定します。目録は補助のメタデータなので、準備は要ります。");

// 4 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "仕組み" });
s.addText("Jev を SQL の検索条件として使う（DuckDB jev 拡張）", { placeholder: "title" });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.4, w: 9.0, h: 1.75, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "sql" });
label(s, [
  "SELECT osm_id,",
  "  jev_choice({attributes: 'name: のびのび公園; leisure: park'},",
  "    'Does this place match the request \"A place where children can play\"?',",
  "    ['supported', 'contradicted', 'insufficient_information']) AS j",
  "FROM read_parquet([...]) WHERE ST_Within(geometry, <市の範囲>);",
].join("\n"), 0.7, 1.5, 8.6, 1.55, { fontSize: 11, fontFace: "Courier New", valign: "middle" });
const kgA = KH.questions[0].methods.A.runs[0];
const feats = [
  ["20行をまとめて1リクエスト", "jev_batch_size = 20", `北広島 589行 → 25リクエスト（同じ内容の行を除いた492行）`],
  ["同時に16リクエスト", "jev_concurrency = 16", "589行なら1〜2往復で終わる。行を減らしても時間は縮みにくい"],
  ["同じ入力の答えはキャッシュ", "jev_cache_clear() で消去", "札幌 16,610行のうち API で評価したのは 11,944行。計測では毎回消した"],
  ["使用量を SQL で集計", "jev_stats()", "リクエスト数・トークン・推定費用。今回の数値はすべてこれで取得"],
];
feats.forEach(([h, sub, body], i) => {
  const x = 0.5 + (i % 2) * 4.6, y = 3.45 + Math.floor(i / 2) * 1.75;
  dashedBox(s, x, y, 4.4, 1.55, HEX.accent1, HEX.lt1, `feature-${i}`);
  label(s, h, x + 0.2, y + 0.12, 4.0, 0.35, { fontSize: 14, bold: true });
  label(s, sub, x + 0.2, y + 0.5, 4.0, 0.3, { fontSize: 11, fontFace: "Courier New", color: C.accent1 });
  label(s, body, x + 0.2, y + 0.85, 4.0, 0.65, { fontSize: 12, ...muted });
});
s.addNotes("SQL の中で jev_choice を呼び、地物の属性を選択肢のどれかに分類します。jev 拡張には4つの仕組みがあります。20行をまとめて1リクエストにする。16リクエストを同時に送る。同じ入力への答えをキャッシュする。jev_stats でリクエスト数やトークン、推定費用を SQL で取れる。今回の数字は jev_stats から取っています。計測のたびにキャッシュは消しました。");

// 5 ------------------------------------------------------------------------------------------
pres.addSection({ title: "検証" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "検証" });
s.addText("データ：OSM の地物をカテゴリ × 区域で分割", { placeholder: "title" });
s.addTable([
  [{ text: "地域", options: { bold: true, fill: { color: HEX.lt2 } } }, { text: "地物", options: { bold: true, fill: { color: HEX.lt2 }, align: "right" } }, { text: "ファイル", options: { bold: true, fill: { color: HEX.lt2 }, align: "right" } }, { text: "区域", options: { bold: true, fill: { color: HEX.lt2 } } }],
  ["北広島市", { text: KH.meta.features.toLocaleString(), options: { align: "right" } }, { text: String(KH.meta.files), options: { align: "right" } }, "経度・緯度の中央値で4区分"],
  ["札幌市", { text: SP.meta.features.toLocaleString(), options: { align: "right" } }, { text: String(SP.meta.files), options: { align: "right" } }, "10区（OSM の区界）"],
], { x: 0.5, y: 1.45, w: 9.0, colW: [1.6, 1.3, 1.3, 4.8], fontSize: 13, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.42 });
label(s, "カテゴリ：公園・遊び場／スポーツ／商業施設／文化・公共施設／その他・分類不明", 0.5, 2.95, 9.0, 0.35, { fontSize: 13 });
label(s, "OSM の amenity・leisure・shop などのタグから機械的に分類。GeoParquet 1.0（点・zstd）", 0.5, 3.3, 9.0, 0.35, { fontSize: 12, ...muted });
label(s, "目録の1項目（北広島・公園／北西）", 0.5, 3.95, 4.3, 0.35, { fontSize: 13, bold: true });
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 4.35, w: 5.2, h: 2.4, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: "manifest-entry" });
label(s, ['"category": "Parks and play areas",', '"rows": 19,', '"bbox": [141.4731, 42.9794, 141.5069, 43.0225],', '"tag_counts": {"leisure=park": 19},', '"sample_names": ["東部緑地", "のびのび公園",', '                 "大曲東公園", ...]'].join("\n"),
  0.65, 4.45, 4.95, 2.2, { fontSize: 10.5, fontFace: "Courier New", valign: "middle" });
label(s, [
  { text: "Jev が読むのはこの要約だけ", options: { bullet: true, breakLine: true } },
  { text: "bbox は地図表示用。選択には使わない", options: { bullet: true, breakLine: true } },
  { text: "出典：OpenStreetMap 北海道抽出（2026-11-21 時点）", options: { bullet: true } },
], 5.95, 4.35, 3.55, 2.4, { fontSize: 13, paraSpaceAfter: 6 });
s.addNotes("北広島市589件を20ファイル、札幌市16,610件を50ファイルに分けました。カテゴリはタグから機械的に決めています。目録には各ファイルの要約が入っていて、Jev が読むのはこの要約だけです。");

// 6 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "検証" });
s.addText("比べ方：読むファイルの決め方を3通り", { placeholder: "title" });
const methods = [
  ["A", "全ファイル", "すべて読み、全地物を Jev に送る。比較の基準"],
  ["B", "固定ルール", "計測前に作った対応表で、質問ごとに読むカテゴリを決める（例：子ども→公園・遊び場）"],
  ["C", "Jev が選ぶ", "目録の各項目を Jev が候補／除外／判断材料不足に分け、除外以外を読む"],
];
methods.forEach(([k, h, b], i) => {
  const x = 0.5 + i * 3.05;
  s.addShape(pres.shapes.RECTANGLE, { x, y: 1.45, w: 2.85, h: 2.5, fill: { color: i === 2 ? "EAF3EF" : "F4F5F6" }, line: { type: "none" }, objectName: `method-${k}` });
  label(s, k, x + 0.2, 1.55, 0.6, 0.6, { fontSize: 28, bold: true, color: i === 2 ? C.accent1 : C.text1 });
  label(s, h, x + 0.85, 1.65, 1.9, 0.45, { fontSize: 15, bold: true, valign: "middle" });
  label(s, b, x + 0.2, 2.3, 2.45, 1.55, { fontSize: 12 });
});
label(s, "候補保持率", 0.5, 4.25, 3.0, 0.35, { fontSize: 14, bold: true, color: C.accent1 });
label(s, "方式Aで supported になった地物のうち、その方式が読んだファイルに含まれていた割合（同じ回の方式Aと比べる）", 0.5, 4.65, 9.0, 0.7, { fontSize: 13 });
label(s, [
  { text: "質問4つ × 方式3つ × 各3回。値は中央値。回ごとに方式の順番を入れ替え、Jev のキャッシュを消去", options: { bullet: true, breakLine: true } },
  { text: "jev-1.14.0（指定は jev-latest）、DuckDB 1.5.5、jev 拡張 0.1.0。2026-11-22 にクラウドのコンテナから計測", options: { bullet: true } },
], 0.5, 5.5, 9.0, 1.3, { fontSize: 12, paraSpaceAfter: 6, ...muted });
s.addNotes("方式Aは全ファイル、Bは事前に作った対応表、Cは Jev が目録から選びます。取りこぼしは候補保持率で測ります。方式Aで該当になった地物のうち、読んだファイルに入っていた割合です。地物の判定は回によって揺れるので、同じ回の方式Aと比べ、ファイル選択による取りこぼしだけを数えています。");

// 7 ------------------------------------------------------------------------------------------
pres.addSection({ title: "結果" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "結果" });
s.addText("北広島（589件）：選ぶ時間を取り戻せない", { placeholder: "title" });
s.addChart(pres.charts.BAR, ["A", "B", "C"].map((m) => ({ name: `方式${m}`, labels: qs(KH), values: KH.questions.map((q) => q.methods[m].median.total_s) })), {
  x: 0.5, y: 1.35, w: 6.0, h: 5.4, barDir: "bar", ...chartBase, chartColors: [COL.A, COL.B, COL.C],
  showTitle: true, title: "総時間（秒、3回の中央値）", titleFontSize: 12, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
  dataLabelFormatCode: "0.00", valAxisMinVal: 0, catAxisOrientation: "maxMin", catAxisLabelFontSize: 10,
});
const khSel = Math.round(KH.questions.reduce((a, q) => a + q.methods.C.median.select_s, 0) / 4 * 100) / 100;
label(s, "ファイル選択", 6.8, 1.5, 2.7, 0.35, { fontSize: 12, ...muted });
label(s, `約${khSel.toFixed(2)}秒`, 6.8, 1.85, 2.7, 0.6, { fontSize: 26, bold: true, color: C.accent1 });
label(s, "589行の判定は、同時リクエスト1〜2往復で終わる。読む行を減らしても判定時間はほとんど縮まない", 6.8, 2.55, 2.7, 1.6, { fontSize: 12 });
label(s, "入力トークン", 6.8, 4.35, 2.7, 0.35, { fontSize: 12, ...muted });
label(s, `${pct(med(KH, "groceries", "A").input_tokens, med(KH, "groceries", "C").input_tokens)}%`, 6.8, 4.7, 2.7, 0.6, { fontSize: 26, bold: true, color: C.accent1 });
label(s, "減ったのは「食料品」だけ。ほかの3問は選択の分（約5,500）だけ増えた", 6.8, 5.4, 2.7, 1.2, { fontSize: 12 });
s.addNotes("北広島の589件では、方式Cはどの質問でも方式Aより遅くなりました。ファイル選択に約0.25秒かかり、判定は同時リクエスト1〜2往復で終わるので、読む行を減らしても取り戻せません。トークンが減ったのは食料品の質問だけです。");

// 8 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "結果" });
s.addText("札幌（16,610件）：除外できた質問では速く・安くなる", { placeholder: "title" });
s.addChart(pres.charts.BAR, ["A", "B", "C"].map((m) => ({ name: `方式${m}`, labels: qs(SP), values: SP.questions.map((q) => q.methods[m].median.total_s) })), {
  x: 0.5, y: 1.35, w: 5.6, h: 5.4, barDir: "bar", ...chartBase, chartColors: [COL.A, COL.B, COL.C],
  showTitle: true, title: "総時間（秒、3回の中央値）", titleFontSize: 12, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
  dataLabelFormatCode: "0.0", valAxisMinVal: 0, catAxisOrientation: "maxMin", catAxisLabelFontSize: 10,
});
label(s, "方式A → 方式C", 6.4, 1.45, 3.1, 0.35, { fontSize: 12, bold: true });
s.addTable([
  [{ text: "", options: { fill: { color: HEX.lt2 } } }, { text: "時間", options: { bold: true, align: "right", fill: { color: HEX.lt2 } } }, { text: "トークン", options: { bold: true, align: "right", fill: { color: HEX.lt2 } } }],
  ...SP.questions.map((q) => {
    const a = q.methods.A.median, c = q.methods.C.median;
    const f = (v) => `${v > 0 ? "+" : ""}${v}%`;
    const short = { kids_play: "子ども", rainy_day: "雨の日", groceries: "食料品", local_history: "歴史・文化" };
    return [short[q.id],
      { text: f(pct(a.total_s, c.total_s)), options: { align: "right" } }, { text: f(pct(a.input_tokens, c.input_tokens)), options: { align: "right" } }];
  }),
], { x: 6.4, y: 1.85, w: 3.1, colW: [1.3, 0.9, 0.9], fontSize: 11, color: HEX.dk1, border: { type: "solid", color: "DEDBD3", pt: 0.75 }, rowH: 0.4 });
label(s, `読んだファイル（50中）：子ども ${med(SP, "kids_play", "C").files_read}、雨の日 ${med(SP, "rainy_day", "C").files_read}、食料品 ${med(SP, "groceries", "C").files_read}、歴史・文化 ${med(SP, "local_history", "C").files_read}`, 6.4, 4.1, 3.1, 0.9, { fontSize: 12 });
label(s, "1つも除外しなかった「子ども」は、選択の分だけ遅くなった", 6.4, 5.1, 3.1, 0.9, { fontSize: 12, ...muted });
s.addNotes("札幌の16,610件では、ファイルを除外できた3問で方式Cが方式Aより短くなりました。食料品で約16%、雨の日で約14%の短縮です。一つも除外しなかった子どもの質問は、選択の分だけ遅くなりました。効果は規模と質問次第です。");

// 9 ------------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "結果" });
s.addText("取りこぼし：固定ルールは候補を落とす", { placeholder: "title" });
s.addChart(pres.charts.BAR, ["B", "C"].map((m) => ({ name: `方式${m}`, labels: qs(SP), values: SP.questions.map((q) => Math.round(q.methods[m].median.retention * 1000) / 10) })), {
  x: 0.5, y: 1.35, w: 5.2, h: 4.3, barDir: "bar", ...chartBase, chartColors: [COL.B, COL.C],
  showTitle: true, title: "札幌の候補保持率（%、3回の中央値）", titleFontSize: 12, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
  dataLabelFormatCode: "0.0", valAxisMinVal: 0, valAxisMaxVal: 100, catAxisOrientation: "maxMin", catAxisLabelFontSize: 10,
});
label(s, "北広島でも方式Bは 75〜98%、方式Cは全問 100%", 0.5, 5.8, 5.2, 0.4, { fontSize: 12, ...muted });
label(s, "方式B の取りこぼし（札幌・1回目）", 6.0, 1.45, 3.5, 0.35, { fontSize: 13, bold: true, color: C.accent2 });
label(s, [
  { text: `子ども：児童会館・幼稚園・保育園など ${SP.questions[0].methods.B.runs[0].missed.length}件`, options: { bullet: true, breakLine: true } },
  { text: "雨の日：体育館・ネットカフェ・水族館など", options: { bullet: true } },
], 6.0, 1.85, 3.5, 1.5, { fontSize: 12, paraSpaceAfter: 6 });
label(s, "方式C の取りこぼし（札幌）", 6.0, 3.55, 3.5, 0.35, { fontSize: 13, bold: true, color: C.accent1 });
label(s, [
  { text: "3回中1回だけ、1件ずつ", options: { bullet: true, breakLine: true } },
  { text: "食料品：手稲区の文化・公共施設ファイルの薬局。目録の上位8タグに薬局が無く、3回中2回「除外」", options: { bullet: true, breakLine: true } },
  { text: "歴史・文化：商業施設ファイルの観光案内所", options: { bullet: true } },
], 6.0, 3.95, 3.5, 2.6, { fontSize: 12, paraSpaceAfter: 6 });
s.addNotes("固定ルールの方式Bは最も速く安いのですが、子どもの質問で児童会館や幼稚園など268件を落としました。方式Cは中央値で100%を保ちました。ただ札幌では3回のうち1回、1件ずつ取りこぼしています。薬局は目録の上位8タグに入っておらず、同じファイルの判定も回によって変わりました。");

// 10 -----------------------------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "結果" });
s.addText("見えてきた課題", { placeholder: "title" });
const agr = [...KH.questions, ...SP.questions].map((q) => q.a_judgment_agreement);
const issues = [
  ["地物の判定は回によって揺れる", `同じ地物の判定が3回とも一致した割合は ${(Math.min(...agr) * 100).toFixed(1)}〜${(Math.max(...agr) * 100).toFixed(1)}%。属性が同じ公園でも「該当」と「判断材料不足」に分かれた（北広島：110件中38件が該当）`],
  ["判定の誤りもある", "「地域の歴史や文化を学べる場所」で、薬局と歯科医院が該当になった。図書館や芸術文化ホールは該当にならなかった"],
  ["ファイル選択は目録の書き方しだい", "要約に載らない地物は、ファイルごと除外されうる。同じファイルでも回によって選択が変わった"],
];
issues.forEach(([h, b], i) => {
  const y = 1.45 + i * 1.55;
  label(s, String(i + 1), 0.5, y, 0.6, 0.6, { fontSize: 28, bold: true, color: C.accent1 });
  label(s, h, 1.2, y + 0.05, 8.3, 0.4, { fontSize: 16, bold: true });
  label(s, b, 1.2, y + 0.5, 8.3, 0.9, { fontSize: 13, ...muted });
});
s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 6.1, w: 9.0, h: 0.6, fill: { color: "FBF3E0" }, line: { type: "none" }, objectName: "not-measured" });
label(s, "判定の正しさ（適合率・再現率）は、人が付けた正解が無いため未計測", 0.7, 6.1, 8.6, 0.6, { fontSize: 13, valign: "middle" });
s.addNotes("課題は3つです。判定の揺れ、判定の誤り、目録の書き方への依存です。判定の正しさは、人が付けた正解が無いので測れていません。");

// 11 -----------------------------------------------------------------------------------------
pres.addSection({ title: "構成" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "構成" });
s.addText("Cloudflare Containers ＋ R2 で動かす構成", { placeholder: "title" });
const boxes = [
  ["ブラウザ／curl", 0.5, 2.0, 1.7],
  ["Worker", 2.6, 2.0, 1.5],
  ["Durable Object", 4.5, 2.0, 1.8],
];
boxes.forEach(([t, x, y, w], i) => {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.8, fill: { color: "F4F5F6" }, line: { type: "none" }, objectName: `arch-${i}` });
  label(s, t, x, y, w, 0.8, { fontSize: 13, align: "center", valign: "middle" });
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
  { text: "POST /search に地域・方式・質問を送ると、ファイル選択・読み込み・判定の結果と jev_stats を返す", options: { bullet: true, breakLine: true } },
  { text: "同梱の質問のほか、自由文の質問も受け付ける（方式A・C）", options: { bullet: true, breakLine: true } },
  { text: "standard-1（1/2 vCPU・4 GiB）。10分間リクエストが無ければ停止", options: { bullet: true, breakLine: true } },
  { text: "Cloudflare 上での実測は未計測", options: { bullet: true } },
], 0.5, 5.2, 9.0, 1.7, { fontSize: 13, paraSpaceAfter: 5 });
s.addNotes("同じ処理を Cloudflare Containers と R2 で動かす構成です。R2 の GeoParquet を、コンテナの中の DuckDB が読み、jev 拡張が判定します。Worker から Durable Object 経由でコンテナに渡します。コードはリポジトリに置いてあります。Cloudflare 上での速さはまだ測っていません。");

// 12 -----------------------------------------------------------------------------------------
pres.addSection({ title: "まとめ" });
s = pres.addSlide({ masterName: "DARK", sectionTitle: "まとめ" });
s.addText("まとめ", { placeholder: "title" });
const spG = med(SP, "groceries", "A"), spGC = med(SP, "groceries", "C");
label(s, [
  { text: "目録を Jev に読ませてファイルを選ぶと、候補保持率はほぼ100%を保てた（札幌で3回中1回、1件ずつの取りこぼし）", options: { bullet: true, breakLine: true } },
  { text: `速く・安くなるかは規模と質問しだい。589件では遅くなり、16,610件では除外できた質問で最大 ${Math.abs(pct(spG.total_s, spGC.total_s))}% 短縮・トークン ${Math.abs(pct(spG.input_tokens, spGC.input_tokens))}% 減`, options: { bullet: true, breakLine: true } },
  { text: "効くのは目録の書き方。要約に載らない地物はファイルごと落ちうる", options: { bullet: true } },
], 0.6, 2.75, 8.8, 2.6, { fontSize: 16, color: C.background1, paraSpaceAfter: 10 });
label(s, "次：正解データでの評価、目録の改善、COGP の詳細度を使った段階的な検索", 0.6, 5.45, 8.8, 0.5, { fontSize: 13, color: C.lt2 });
label(s, "github.com/shinyanakashima/30daymapchallenge-2026day27-jev-geoparquet", 0.6, 6.15, 8.8, 0.35, { fontSize: 11, color: C.lt2 });
label(s, "データ © OpenStreetMap contributors（ODbL）／背景地図：地理院タイル／Jev は TypeSafe AI のモデル", 0.6, 6.55, 8.8, 0.35, { fontSize: 10, color: C.lt2 });
s.addNotes("まとめです。目録を Jev に読ませてファイルを選ぶと、取りこぼしはほぼ抑えられました。速さと費用の効果は規模と質問次第で、小さなデータでは逆効果でした。効くのは目録の書き方です。次は、正解データでの評価、目録の改善、COGP の詳細度を使った段階的な検索です。");

(async () => {
  await pres.writeFile({ fileName: OUT });
  // Remove directory entries from the ZIP; some cloud services refuse files that contain them.
  try { require("child_process").execSync(`zip -dq "${OUT}" '*/'`); } catch (e) { /* none present */ }
  console.log("wrote", OUT);
})();
