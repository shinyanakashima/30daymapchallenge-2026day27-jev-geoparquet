import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { T } from './i18n.js';

const COLORS = {
  supported: '#0f7b5f',
  insufficient_information: '#d49a12',
  contradicted: '#7d8894',
  notread: '#ffffff',
  missed: '#d1342f',
  candidate: '#0f7b5f',
  exclude: '#7d8894',
  read: '#2b63b0',
  skipped: '#7d8894',
};
const CATS = ['parks_play', 'sports', 'commercial', 'public_culture', 'other_unknown'];
const ZONES = ['nw', 'ne', 'sw', 'se'];
const ROWS = ['files_read', 'bytes_read', 'rows_read', 'features_sent', 'total_s', 'select_s', 'judge_s',
  'input_tokens', 'requests', 'estimated_cost_usd', 'retention'];

const state = { lang: 'en', q: 0, method: 'C', run: 0, hoverFile: null };
try {
  const saved = localStorage.getItem('lang');
  if (saved === 'ja' || saved === 'en') state.lang = saved;
} catch (e) { /* storage unavailable */ }
const params = new URLSearchParams(location.search);
if (params.get('lang') === 'ja') state.lang = 'ja';
if (['A', 'B', 'C'].includes(params.get('m'))) state.method = params.get('m');
if (params.get('q')) state.q = Math.max(0, Number(params.get('q')) || 0);

const [results, features, manifest, boundary] = await Promise.all(
  ['results.json', 'features.geojson', 'manifest.json', 'boundary.geojson'].map((f) =>
    fetch(`${import.meta.env.BASE_URL}data/${f}`).then((r) => r.json())),
);
state.q = Math.min(state.q, results.questions.length - 1);
const fileById = Object.fromEntries(manifest.files.map((f) => [f.id, f]));
const t = () => T[state.lang];
const cur = () => results.questions[state.q];
const curRun = () => cur().methods[state.method].runs[state.run];

function boundsOf(geo) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = (c) => {
    if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]); x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1]); return; }
    c.forEach(walk);
  };
  walk((geo.geometry || geo.features[0].geometry).coordinates);
  return [[x0, y0], [x1, y1]];
}

function bboxFeatures() {
  return {
    type: 'FeatureCollection',
    features: manifest.files.map((f) => {
      const [x0, y0, x1, y1] = f.bbox;
      return {
        type: 'Feature', id: manifest.files.indexOf(f),
        properties: { id: f.id },
        geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
      };
    }),
  };
}

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      gsi: {
        type: 'raster', tileSize: 256, maxzoom: 18,
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a> | © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
      },
    },
    layers: [{ id: 'gsi', type: 'raster', source: 'gsi', paint: { 'raster-saturation': -0.6, 'raster-opacity': 0.85 } }],
  },
  bounds: [141.47, 42.9, 141.66, 43.03],
  fitBoundsOptions: { padding: 24 },
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

function fileStatusColorExpr(fileStatus) {
  const expr = ['match', ['get', 'id']];
  for (const [fid, s] of Object.entries(fileStatus)) expr.push(fid, COLORS[s] || '#999');
  expr.push('#999');
  return expr;
}

function pointData() {
  const run = curRun();
  const read = new Set(Object.entries(run.file_status).filter(([, s]) => s !== 'exclude' && s !== 'skipped').map(([f]) => f));
  const missed = new Set(run.missed);
  return {
    type: 'FeatureCollection',
    features: features.features.map((f) => {
      const p = f.properties;
      let j = run.judgments[p.id];
      if (!read.has(p.file)) j = missed.has(p.id) ? 'missed' : 'notread';
      return { ...f, properties: { id: p.id, file: p.file, j } };
    }),
  };
}

map.on('load', () => {
  map.addSource('boundary', { type: 'geojson', data: boundary });
  map.addSource('bbox', { type: 'geojson', data: bboxFeatures() });
  map.addSource('pts', { type: 'geojson', data: pointData() });
  map.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': '#333', 'line-width': 1.4, 'line-opacity': 0.7 } });
  map.addLayer({
    id: 'bbox-fill', type: 'fill', source: 'bbox',
    paint: { 'fill-color': '#999', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.16, 0.03] },
  });
  map.addLayer({
    id: 'bbox-line', type: 'line', source: 'bbox',
    paint: {
      'line-color': '#999',
      'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.6, 1.1],
      'line-dasharray': [3, 2],
      'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.55],
    },
  });
  map.addLayer({
    id: 'pts', type: 'circle', source: 'pts',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11,
        ['match', ['get', 'j'], 'supported', 5, 'missed', 5.5, 'notread', 2.6, 3.2],
        15, ['match', ['get', 'j'], 'supported', 9, 'missed', 9, 'notread', 5, 6]],
      'circle-color': ['match', ['get', 'j'],
        'supported', COLORS.supported, 'insufficient_information', COLORS.insufficient_information,
        'contradicted', COLORS.contradicted, 'missed', '#ffffff', '#ffffff'],
      'circle-stroke-color': ['match', ['get', 'j'], 'missed', COLORS.missed, 'notread', '#9aa3ad', '#ffffff'],
      'circle-stroke-width': ['match', ['get', 'j'], 'missed', 3, 'notread', 1, 1],
      'circle-opacity': ['match', ['get', 'j'], 'notread', 0.8, 1],
    },
  });
  map.on('mouseenter', 'pts', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'pts', () => { map.getCanvas().style.cursor = ''; });
  map.on('click', 'pts', (e) => {
    const f = e.features[0];
    const src = features.features.find((x) => x.properties.id === f.properties.id);
    showPopup(e.lngLat, src.properties, f.properties.j);
  });
  map.resize();
  map.fitBounds(boundsOf(boundary), { padding: 24, duration: 0 });
  updateMap();
  map.once('idle', () => { window.__mapReady = true; });
});

let popup;
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function showPopup(lngLat, p, j) {
  const L = t();
  const attrs = Object.entries(p.attrs).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const html = `<div class="pop"><strong>${esc(p.attrs.name || L.unnamed)}</strong>
    <div class="pop-j"><span class="dot" style="background:${j === 'missed' ? '#fff' : COLORS[j]};border-color:${j === 'missed' ? COLORS.missed : '#bbb'}"></span>${esc(L.popupJudg)}: ${esc(L.judg[j])}</div>
    <div class="pop-f">${esc(L.popupFile)}: ${esc(p.file)} · <a href="https://www.openstreetmap.org/${esc(p.id)}" target="_blank" rel="noopener">${esc(p.id)}</a></div>
    <div class="pop-h">${esc(L.popupAttrs)}</div><table>${attrs}</table></div>`;
  if (popup) popup.remove();
  popup = new maplibregl.Popup({ maxWidth: '320px' }).setLngLat(lngLat).setHTML(html).addTo(map);
}

function updateMap() {
  if (!map.getSource('pts')) return;
  map.getSource('pts').setData(pointData());
  const fs = curRun().file_status;
  map.setPaintProperty('bbox-line', 'line-color', fileStatusColorExpr(fs));
  map.setPaintProperty('bbox-fill', 'fill-color', fileStatusColorExpr(fs));
  if (popup) popup.remove();
}

function setHover(fid) {
  if (state.hoverFile !== null) map.setFeatureState({ source: 'bbox', id: state.hoverFile }, { hover: false });
  state.hoverFile = fid === null ? null : manifest.files.findIndex((f) => f.id === fid);
  if (state.hoverFile !== null && map.getSource('bbox')) map.setFeatureState({ source: 'bbox', id: state.hoverFile }, { hover: true });
}

function fmt(key, v) {
  const L = t();
  if (v === null || v === undefined || Number.isNaN(v)) return `<span class="nm">${L.notMeasured}</span>`;
  if (key.endsWith('_s')) return `${v.toFixed(2)} s`;
  if (key === 'bytes_read') return `${(v / 1024).toFixed(1)} KB`;
  if (key === 'estimated_cost_usd') return `$${v.toFixed(5)}`;
  if (key === 'retention') return `${(v * 100).toFixed(0)}%`;
  return Math.round(v).toLocaleString('en-US');
}

function renderControls() {
  const L = t();
  document.documentElement.lang = state.lang;
  document.title = L.title;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = L[el.dataset.i18n]; });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));

  const qs = document.getElementById('questions');
  qs.innerHTML = '';
  results.questions.forEach((q, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = state.lang === 'ja' ? q.ja : q.en;
    b.setAttribute('aria-pressed', String(i === state.q));
    b.onclick = () => { state.q = i; render(); };
    qs.appendChild(b);
  });

  const ms = document.getElementById('methods');
  ms.innerHTML = '';
  ['A', 'B', 'C'].forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = L.methods[m][0];
    b.setAttribute('aria-pressed', String(m === state.method));
    b.onclick = () => { state.method = m; render(); };
    ms.appendChild(b);
  });
  let desc = L.methods[state.method][1];
  if (state.method === 'B') {
    const cats = cur().rule_categories.map((c) => L.categories[c]).join(', ');
    desc += state.lang === 'ja' ? `（この質問：${cats}）` : ` (this question: ${cats})`;
  }
  document.getElementById('method-desc').textContent = desc;

  const rs = document.getElementById('runs');
  rs.innerHTML = `<span class="lbl">${L.run}</span>`;
  cur().methods[state.method].runs.forEach((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(i + 1);
    b.setAttribute('aria-pressed', String(i === state.run));
    b.onclick = () => { state.run = i; render(); };
    rs.appendChild(b);
  });
}

function renderMatrix() {
  const L = t();
  const run = curRun();
  let html = `<table class="matrix"><thead><tr><th></th>${ZONES.map((z) => `<th>${L.zones[z]}</th>`).join('')}</tr></thead><tbody>`;
  for (const c of CATS) {
    html += `<tr><th>${L.categories[c]}</th>`;
    for (const z of ZONES) {
      const fid = `${c}__${z}`;
      const s = run.file_status[fid];
      const f = fileById[fid];
      if (!s) { html += '<td></td>'; continue; }
      const nMissed = run.missed.filter((id) => features.features.find((x) => x.properties.id === id)?.properties.file === fid).length;
      html += `<td><button type="button" class="cell s-${s}" data-file="${fid}" title="${fid}: ${L.status[s]} · ${f.rows} rows">
        <span class="cell-s">${L.statusShort[s]}</span><span class="cell-n">${f.rows}${nMissed ? ` <b>−${nMissed}</b>` : ''}</span></button></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  const el = document.getElementById('matrix');
  el.innerHTML = html;
  el.querySelectorAll('.cell').forEach((b) => {
    b.addEventListener('mouseenter', () => setHover(b.dataset.file));
    b.addEventListener('mouseleave', () => setHover(null));
    b.addEventListener('focus', () => setHover(b.dataset.file));
    b.addEventListener('blur', () => setHover(null));
    b.addEventListener('click', () => {
      const [x0, y0, x1, y1] = fileById[b.dataset.file].bbox;
      map.fitBounds([[x0, y0], [x1, y1]], { padding: 40, maxZoom: 15 });
    });
  });
}

function renderMetrics() {
  const L = t();
  const q = cur();
  let html = `<thead><tr><th></th>${['A', 'B', 'C'].map((m) => `<th class="${m === state.method ? 'on' : ''}">${m}</th>`).join('')}</tr></thead><tbody>`;
  for (const key of ROWS) {
    html += `<tr class="${key.startsWith('select') || key.startsWith('judge') ? 'subrow' : ''}"><th>${L.rows[key]}</th>`;
    for (const m of ['A', 'B', 'C']) {
      const md = q.methods[m].median;
      let v = md[key];
      if (key === 'select_s' && m !== 'C') v = md[key];
      let extra = '';
      if (key === 'total_s') {
        const [lo, hi] = q.methods[m].range.total_s;
        extra = `<small>${lo.toFixed(2)}–${hi.toFixed(2)}</small>`;
      }
      if (key === 'retention') {
        const r = q.methods[m].runs[state.run];
        extra = `<small>${r.retained}/${r.reference_candidates}</small>`;
      }
      html += `<td class="${m === state.method ? 'on' : ''}">${fmt(key, v)}${extra}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  document.getElementById('metrics').innerHTML = html;

  const run = curRun();
  const box = document.getElementById('missed-box');
  const ul = document.getElementById('missed');
  box.hidden = state.method === 'A';
  if (run.missed.length === 0) {
    ul.innerHTML = `<li class="none">${L.noMissed} (${run.retained}/${run.reference_candidates})</li>`;
  } else {
    ul.innerHTML = run.missed.map((id) => {
      const p = features.features.find((x) => x.properties.id === id).properties;
      const tags = Object.entries(p.attrs).filter(([k]) => k !== 'name').slice(0, 3).map(([k, v]) => `${k}=${v}`).join(', ');
      return `<li><button type="button" data-id="${esc(id)}">${esc(p.attrs.name || L.unnamed)}</button> <span>${esc(tags)} · ${esc(L.categories[p.category])}</span></li>`;
    }).join('');
    ul.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const f = features.features.find((x) => x.properties.id === b.dataset.id);
      map.flyTo({ center: f.geometry.coordinates, zoom: 15 });
      showPopup(f.geometry.coordinates, f.properties, 'missed');
    }));
  }
}

function renderLegend() {
  const L = t();
  const fileKeys = state.method === 'C' ? ['candidate', 'insufficient_information', 'exclude'] : ['read', 'skipped'];
  const ptKeys = ['supported', 'insufficient_information', 'contradicted', 'notread', 'missed'];
  document.getElementById('legend').innerHTML = `
    <div class="lg-h">${L.legendFiles}</div>
    ${fileKeys.map((k) => `<div class="lg-r"><span class="sw-box" style="border-color:${COLORS[k]}"></span>${L.status[k]}</div>`).join('')}
    <div class="lg-h">${L.legendPoints}</div>
    ${ptKeys.map((k) => `<div class="lg-r"><span class="dot" style="background:${k === 'missed' || k === 'notread' ? '#fff' : COLORS[k]};border-color:${k === 'missed' ? COLORS.missed : k === 'notread' ? '#9aa3ad' : '#fff'};${k === 'missed' ? 'border-width:3px' : ''}"></span>${L.judg[k]}</div>`).join('')}`;
}

function shortTime(iso) { return iso.replace('T', ' ').replace(/(:\d\d)\+00:00$/, '$1'); }

function render() {
  state.run = Math.min(state.run, cur().methods[state.method].runs.length - 1);
  renderControls();
  renderMatrix();
  renderMetrics();
  renderLegend();
  const m = { ...results.meta, started_utc: shortTime(results.meta.started_utc), finished_utc: shortTime(results.meta.finished_utc) };
  document.getElementById('versions').textContent = t().versions(m);
  updateMap();
}

document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  state.lang = b.dataset.lang;
  try { localStorage.setItem('lang', state.lang); } catch (e) { /* storage unavailable */ }
  render();
}));

render();
