import { relative, extname } from "node:path";
import { formatBytes, gzipEstimate, brotliEstimate, getFileCategory, CATEGORY_COLORS } from "./utils";
import type { ReportData } from "./types";

const ROOT = process.cwd();

function fmtBStatic(bytes: number): string {
  return formatBytes(bytes);
}

function renderDiffTable(d: ReportData): string {
  const changed = d.diffEntries.filter((e) => e.status !== "unchanged");
  if (changed.length === 0) return '<p style="color:#94a3b8;font-size:13px">\u65E0\u53D8\u5316</p>';
  return `<table><thead><tr><th>\u72B6\u6001</th><th>\u6587\u4EF6</th><th style="text-align:right">\u65E7\u4F53\u79EF</th><th style="text-align:right">\u65B0\u4F53\u79EF</th><th style="text-align:right">\u53D8\u5316</th></tr></thead><tbody>${changed.map((e) => {
    const cls = e.status === "added" ? "diff-add" : e.status === "removed" ? "diff-rm" : "diff-ch";
    const label = e.status === "added" ? "\u65B0\u589E" : e.status === "removed" ? "\u5220\u9664" : "\u53D8\u66F4";
    const delta = e.delta ? (e.delta > 0 ? `+${formatBytes(e.delta)}` : `-${formatBytes(Math.abs(e.delta))}`) : "-";
    return `<tr><td class="${cls}">${label}</td><td>${e.file}</td><td style="text-align:right">${e.oldSize !== undefined ? formatBytes(e.oldSize) : "-"}</td><td style="text-align:right">${e.newSize !== undefined ? formatBytes(e.newSize) : "-"}</td><td style="text-align:right" class="${cls}">${delta}</td></tr>`;
  }).join("")}</tbody></table>`;
}

export function generateHTML(d: ReportData): string {
  const now = new Date().toLocaleString("zh-CN");
  const buildTime = (d.buildTimeMs / 1000).toFixed(2);
  const chunks = d.files.filter((f) => f.type === "chunk");
  const cssFiles = d.files.filter((f) => f.type === "asset" && f.name.endsWith(".css"));
  const otherAssets = d.files.filter((f) => f.type === "asset" && !f.name.endsWith(".css"));
  const largestFile = d.files.length ? d.files.reduce((a, b) => (a.size > b.size ? a : b)) : null;
  const smallestFile = d.files.length ? d.files.reduce((a, b) => (a.size < b.size ? a : b)) : null;
  const avgSize = d.files.length ? d.totalSize / d.files.length : 0;

  const categories = new Map<string, { size: number; count: number }>();
  for (const f of d.files) {
    const cat = getFileCategory(f.name);
    const p = categories.get(cat) || { size: 0, count: 0 };
    categories.set(cat, { size: p.size + f.size, count: p.count + 1 });
  }

  const networkSpeeds = [
    { label: "5G (100 Mbps)", speed: 100 * 1024 * 1024 / 8 },
    { label: "4G (10 Mbps)", speed: 10 * 1024 * 1024 / 8 },
    { label: "3G (1.5 Mbps)", speed: 1.5 * 1024 * 1024 / 8 },
    { label: "\u6162\u901F 3G (400 Kbps)", speed: 400 * 1024 / 8 },
    { label: "2G (50 Kbps)", speed: 50 * 1024 / 8 },
  ];

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Lite Vite \u6784\u5EFA\u62A5\u544A</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex}
.sidebar{width:220px;background:#1e293b;border-right:1px solid #334155;padding:20px 0;position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:10}
.sidebar h2{font-size:16px;padding:0 20px 16px;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800}
.sidebar .nav-item{display:block;padding:10px 20px;color:#94a3b8;font-size:13px;cursor:pointer;border-left:3px solid transparent;transition:all .15s}
.sidebar .nav-item:hover{background:#263348;color:#e2e8f0}
.sidebar .nav-item.active{color:#38bdf8;border-left-color:#38bdf8;background:rgba(56,189,248,.08)}
.main{margin-left:220px;flex:1;padding:28px 32px;min-width:0}
.page{display:none}
.page.active{display:block}
h1{font-size:26px;font-weight:800;margin-bottom:4px;background:linear-gradient(135deg,#38bdf8,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub-title{color:#64748b;font-size:13px;margin-bottom:24px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.card{background:#1e293b;border-radius:10px;padding:16px;border:1px solid #334155;transition:transform .15s}
.card:hover{transform:translateY(-1px)}
.card .lb{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
.card .vl{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.card .sm{font-size:10px;color:#64748b;margin-top:2px}
.sec{background:#1e293b;border-radius:10px;padding:20px;border:1px solid #334155;margin-bottom:16px}
.sec h3{font-size:14px;font-weight:600;margin-bottom:12px;color:#f1f5f9}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:900px){.grid-2{grid-template-columns:1fr}.sidebar{display:none}.main{margin-left:0}}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;padding:7px 8px;border-bottom:1px solid #334155}
td{padding:7px 8px;border-bottom:1px solid rgba(51,65,85,.4);font-size:12px}
tr:hover td{background:rgba(38,51,72,.5)}
.tag{padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;margin-left:3px}
.tag-e{background:#10b981;color:#fff}
.tag-d{background:#8b5cf6;color:#fff}
.bar-h{height:20px;background:#0f172a;border-radius:5px;overflow:hidden;display:flex;margin-bottom:6px}
.bar-h div{height:100%;transition:width .5s}
.legend{display:flex;gap:14px;font-size:11px;color:#94a3b8;flex-wrap:wrap}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:3px;vertical-align:middle}
.fbar{height:6px;background:#0f172a;border-radius:3px;overflow:hidden}
.fbar div{height:100%;border-radius:3px}
.mod-list{margin-top:4px;max-height:180px;overflow-y:auto}
.mod-row{display:flex;gap:6px;padding:2px 0;font-size:10px}
.mod-row .mn{flex:1;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mod-row .ms{color:#94a3b8;font-variant-numeric:tabular-nums;min-width:55px;text-align:right}
.sug{padding:8px 12px;background:#0f172a;border-radius:6px;margin-bottom:6px;font-size:12px;line-height:1.5;border-left:3px solid #475569}
.dup-card{background:#0f172a;border-radius:8px;padding:14px;margin-bottom:10px;border:1px solid #334155}
.dup-card h4{font-size:13px;margin-bottom:6px;color:#fb923c}
.diff-add{color:#34d399}
.diff-rm{color:#ef4444}
.diff-ch{color:#fbbf24}
.diff-un{color:#64748b}
.ctrl{display:flex;gap:10px;align-items:center;margin-bottom:12px;font-size:12px;color:#94a3b8}
.ctrl select,.ctrl input{background:#0f172a;border:1px solid #334155;color:#e2e8f0;border-radius:5px;padding:4px 8px;font-size:12px}
.env-td{color:#94a3b8;width:160px}
.footer{text-align:center;color:#475569;font-size:11px;margin-top:28px;padding-top:16px;border-top:1px solid #1e293b}
</style>
</head>
<body>
<div class="sidebar">
  <h2>\u26A1 Lite Vite</h2>
  <div class="nav-item active" onclick="switchTab('overview')">\uD83D\uDCCA \u603B\u89C8</div>
  <div class="nav-item" onclick="switchTab('analysis')">\uD83D\uDD0D \u4EA7\u7269\u5206\u6790</div>
  <div class="nav-item" onclick="switchTab('optimize')">\u26A1 \u4F18\u5316\u5EFA\u8BAE</div>
  <div class="nav-item" onclick="switchTab('diff')">\uD83D\uDD04 Diff \u5BF9\u6BD4</div>
</div>
<div class="main">

<!-- ====== \u603B\u89C8\u9875 ====== -->
<div id="page-overview" class="page active">
<h1>\u26A1 \u6784\u5EFA\u62A5\u544A</h1>
<p class="sub-title">\u751F\u6210\u65F6\u95F4\uFF1A${now} \u00B7 Lite Vite v2.0.1</p>

<div class="cards">
  <div class="card"><div class="lb">\u6784\u5EFA\u8017\u65F6</div><div class="vl" style="color:#34d399">${buildTime}s</div><div class="sm">${d.buildTimeMs}ms</div></div>
  <div class="card"><div class="lb">\u603B\u4F53\u79EF</div><div class="vl" style="color:#60a5fa">${formatBytes(d.totalSize)}</div><div class="sm">gzip \u2248 ${formatBytes(gzipEstimate(d.totalSize))}</div></div>
  <div class="card"><div class="lb">JS \u4F53\u79EF</div><div class="vl" style="color:#fb923c">${formatBytes(d.jsSize)}</div><div class="sm">${chunks.length} \u4E2A chunk</div></div>
  <div class="card"><div class="lb">CSS \u4F53\u79EF</div><div class="vl" style="color:#a78bfa">${formatBytes(d.cssSize)}</div><div class="sm">${cssFiles.length} \u4E2A\u6587\u4EF6</div></div>
  <div class="card"><div class="lb">\u5176\u4ED6\u8D44\u6E90</div><div class="vl" style="color:#f472b6">${formatBytes(d.otherSize)}</div><div class="sm">${otherAssets.length} \u4E2A\u6587\u4EF6</div></div>
  <div class="card"><div class="lb">\u6A21\u5757\u603B\u6570</div><div class="vl" style="color:#2dd4bf">${d.totalModules}</div><div class="sm">${d.totalExports} \u4E2A\u5BFC\u51FA</div></div>
  <div class="card"><div class="lb">\u8F93\u51FA\u683C\u5F0F</div><div class="vl" style="font-size:16px">${d.format.toUpperCase()}</div><div class="sm">${d.files.length} \u4E2A\u6587\u4EF6</div></div>
  <div class="card"><div class="lb">\u91CD\u590D\u4F9D\u8D56</div><div class="vl" style="color:${d.duplicates.length ? "#fb923c" : "#34d399"}">${d.duplicates.length}</div><div class="sm">${d.duplicates.length ? "\u6D6A\u8D39 " + formatBytes(d.duplicates.reduce((a, x) => a + x.totalWaste, 0)) : "\u65E0\u91CD\u590D"}</div></div>
</div>

<div class="sec">
  <h3>\uD83D\uDCCF \u4F53\u79EF\u5206\u5E03</h3>
  <div class="bar-h">
    <div style="width:${d.totalSize ? (d.jsSize / d.totalSize * 100) : 0}%;background:linear-gradient(90deg,#fbbf24,#f59e0b)"></div>
    <div style="width:${d.totalSize ? (d.cssSize / d.totalSize * 100) : 0}%;background:linear-gradient(90deg,#38bdf8,#0ea5e9)"></div>
    <div style="width:${d.totalSize ? (d.otherSize / d.totalSize * 100) : 0}%;background:linear-gradient(90deg,#a78bfa,#8b5cf6)"></div>
  </div>
  <div class="legend">
    <span><i style="background:#f59e0b"></i>JS ${d.totalSize ? (d.jsSize / d.totalSize * 100).toFixed(1) : 0}% (${formatBytes(d.jsSize)})</span>
    <span><i style="background:#0ea5e9"></i>CSS ${d.totalSize ? (d.cssSize / d.totalSize * 100).toFixed(1) : 0}% (${formatBytes(d.cssSize)})</span>
    <span><i style="background:#8b5cf6"></i>\u5176\u4ED6 ${d.totalSize ? (d.otherSize / d.totalSize * 100).toFixed(1) : 0}% (${formatBytes(d.otherSize)})</span>
  </div>
</div>

<div class="grid-2">
  <div class="sec">
    <h3>\uD83C\uDF10 \u7F51\u7EDC\u4F20\u8F93\u4F30\u7B97</h3>
    <table>
      <thead><tr><th>\u8FDE\u63A5\u7C7B\u578B</th><th style="text-align:right">\u539F\u59CB</th><th style="text-align:right">Gzip</th></tr></thead>
      <tbody>${networkSpeeds.map((n) => `<tr><td>${n.label}</td><td style="text-align:right">${(d.totalSize / n.speed).toFixed(2)}s</td><td style="text-align:right;color:#34d399">${(gzipEstimate(d.totalSize) / n.speed).toFixed(2)}s</td></tr>`).join("")}</tbody>
    </table>
    <div style="margin-top:8px;font-size:10px;color:#64748b">Brotli \u2248 ${formatBytes(brotliEstimate(d.totalSize))} \u00B7 Gzip \u2248 ${formatBytes(gzipEstimate(d.totalSize))} \u00B7 \u539F\u59CB ${formatBytes(d.totalSize)}</div>
  </div>
  <div class="sec">
    <h3>\uD83D\uDCCB \u6784\u5EFA\u914D\u7F6E</h3>
    <table>
      <tr><td class="env-td">\u5165\u53E3\u6587\u4EF6</td><td>${esc(relative(ROOT, d.entry))}</td></tr>
      <tr><td class="env-td">\u8F93\u51FA\u76EE\u5F55</td><td>${esc(relative(ROOT, d.outputDir))}</td></tr>
      <tr><td class="env-td">\u6A21\u5757\u683C\u5F0F</td><td>${d.format}</td></tr>
      <tr><td class="env-td">Sourcemap</td><td>${d.hasSourcemap ? "\u2705 \u5DF2\u5F00\u542F" : "\u274C \u672A\u5F00\u542F"}</td></tr>
      <tr><td class="env-td">\u6700\u5927\u6587\u4EF6</td><td>${largestFile ? `${esc(largestFile.name)} (${formatBytes(largestFile.size)})` : "-"}</td></tr>
      <tr><td class="env-td">\u6700\u5C0F\u6587\u4EF6</td><td>${smallestFile ? `${esc(smallestFile.name)} (${formatBytes(smallestFile.size)})` : "-"}</td></tr>
      <tr><td class="env-td">\u5E73\u5747\u6587\u4EF6\u5927\u5C0F</td><td>${formatBytes(avgSize)}</td></tr>
      <tr><td class="env-td">Node.js</td><td>${process.version}</td></tr>
      <tr><td class="env-td">\u5E73\u53F0</td><td>${process.platform} ${process.arch}</td></tr>
    </table>
  </div>
</div>

<div class="sec">
  <h3>\uD83D\uDCE6 \u4EA7\u7269\u6587\u4EF6 (${d.files.length})</h3>
  <table>
    <thead><tr><th>\u6587\u4EF6</th><th style="text-align:right">\u5927\u5C0F</th><th style="text-align:right">\u5360\u6BD4</th><th style="text-align:right">Gzip</th><th style="text-align:right">Brotli</th><th>\u5360\u6BD4\u56FE</th><th>\u8BE6\u60C5</th></tr></thead>
    <tbody>${d.files.sort((a, b) => b.size - a.size).map((f) => {
      const icon = f.type === "chunk" ? "\uD83D\uDCE6" : f.name.endsWith(".css") ? "\uD83C\uDFA8" : f.name.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/) ? "\uD83D\uDDBC\uFE0F" : "\uD83D\uDCCE";
      const tags = [f.isEntry ? '<span class="tag tag-e">\u5165\u53E3</span>' : "", f.isDynamicEntry ? '<span class="tag tag-d">\u52A8\u6001</span>' : ""].filter(Boolean).join("");
      const pct = d.totalSize ? (f.size / d.totalSize * 100).toFixed(1) : "0";
      const gz = f.type === "chunk" ? formatBytes(gzipEstimate(f.size)) : "-";
      const br = f.type === "chunk" ? formatBytes(brotliEstimate(f.size)) : "-";
      const bw = d.totalSize ? (f.size / d.totalSize * 100) : 0;
      const bc = f.type === "chunk" ? "#f59e0b" : f.name.endsWith(".css") ? "#0ea5e9" : "#8b5cf6";
      const mods = f.modules?.length ? `<details><summary style="cursor:pointer;color:#94a3b8;font-size:11px">${f.modules.length} \u4E2A\u6A21\u5757</summary><div class="mod-list">${f.modules.sort((a, b) => b.size - a.size).map((m) => `<div class="mod-row"><span class="mn">${esc(m.name)}</span><span class="ms">${formatBytes(m.size)}</span></div>`).join("")}</div></details>` : "";
      const imp = f.imports?.length ? `<div style="font-size:10px;color:#64748b;margin-top:2px">\u5F15\u7528: ${f.imports.join(", ")}</div>` : "";
      const exp = f.exports?.length ? `<div style="font-size:10px;color:#64748b">\u5BFC\u51FA: ${f.exports.length} \u4E2A</div>` : "";
      return `<tr><td>${icon} <b>${esc(f.name)}</b>${tags}</td><td style="text-align:right;font-weight:600">${formatBytes(f.size)}</td><td style="text-align:right;color:#94a3b8">${pct}%</td><td style="text-align:right;color:#94a3b8">${gz}</td><td style="text-align:right;color:#94a3b8">${br}</td><td style="min-width:80px"><div class="fbar"><div style="width:${bw}%;background:${bc}"></div></div></td><td>${mods}${imp}${exp}</td></tr>`;
    }).join("")}</tbody>
  </table>
</div>

<div class="sec">
  <h3>\uD83D\uDCC8 \u538B\u7F29\u5BF9\u6BD4</h3>
  <table>
    <thead><tr><th>\u6307\u6807</th><th style="text-align:right">\u539F\u59CB</th><th style="text-align:right">Gzip</th><th style="text-align:right">Brotli</th></tr></thead>
    <tbody>
      <tr><td>\u603B\u4F53</td><td style="text-align:right">${formatBytes(d.totalSize)}</td><td style="text-align:right;color:#34d399">${formatBytes(gzipEstimate(d.totalSize))}</td><td style="text-align:right;color:#2dd4bf">${formatBytes(brotliEstimate(d.totalSize))}</td></tr>
      <tr><td>JavaScript</td><td style="text-align:right">${formatBytes(d.jsSize)}</td><td style="text-align:right;color:#34d399">${formatBytes(gzipEstimate(d.jsSize))}</td><td style="text-align:right;color:#2dd4bf">${formatBytes(brotliEstimate(d.jsSize))}</td></tr>
      <tr><td>CSS</td><td style="text-align:right">${formatBytes(d.cssSize)}</td><td style="text-align:right;color:#34d399">${formatBytes(gzipEstimate(d.cssSize))}</td><td style="text-align:right;color:#2dd4bf">${formatBytes(brotliEstimate(d.cssSize))}</td></tr>
    </tbody>
  </table>
</div>
</div>

<!-- ====== \u5206\u6790\u9875 ====== -->
<div id="page-analysis" class="page">
<h1>\uD83D\uDD0D \u4EA7\u7269\u7EC4\u6210\u4E0E\u6A21\u5757\u5206\u6790</h1>
<p class="sub-title">\u5217\u51FA\u6240\u6709 JS\u3001CSS\u3001\u56FE\u7247\u3001\u5B57\u4F53\u7B49\u8D44\u6E90\uFF0C\u67E5\u770B chunk \u5305\u542B\u7684\u6A21\u5757\u53CA\u4F9D\u8D56\u5173\u7CFB</p>

<div class="sec">
  <h3>\u6587\u4EF6\u7C7B\u578B\u5206\u5E03</h3>
  <table>
    <thead><tr><th>\u7C7B\u578B</th><th style="text-align:right">\u6570\u91CF</th><th style="text-align:right">\u4F53\u79EF</th><th style="text-align:right">\u5360\u6BD4</th><th>\u5206\u5E03</th></tr></thead>
    <tbody>${[...categories.entries()].sort((a, b) => b[1].size - a[1].size).map(([cat, { size, count }]) => {
      const pct = d.totalSize ? (size / d.totalSize * 100) : 0;
      const color = CATEGORY_COLORS[cat] || "#64748b";
      return `<tr><td><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};margin-right:6px;vertical-align:middle"></i>${cat}</td><td style="text-align:right">${count}</td><td style="text-align:right;font-weight:600">${formatBytes(size)}</td><td style="text-align:right">${pct.toFixed(1)}%</td><td style="min-width:100px"><div class="fbar"><div style="width:${pct}%;background:${color}"></div></div></td></tr>`;
    }).join("")}</tbody>
  </table>
</div>

<div class="sec">
  <h3>\u6700\u5927\u6A21\u5757\u6392\u884C</h3>
  <div class="ctrl">
    <label>\u663E\u793A\u6570\u91CF: <select id="modLimit" onchange="filterModules()">
      <option value="20" selected>20</option><option value="50">50</option><option value="100">100</option><option value="999">\u5168\u90E8</option>
    </select></label>
    <label>\u6392\u5E8F: <select id="modSort" onchange="filterModules()">
      <option value="size" selected>\u4F53\u79EF</option><option value="name">\u540D\u79F0</option>
    </select></label>
    <label>\u987A\u5E8F: <select id="modOrder" onchange="filterModules()">
      <option value="desc" selected>\u964D\u5E8F</option><option value="asc">\u5347\u5E8F</option>
    </select></label>
    <label>\u641C\u7D22: <input id="modSearch" placeholder="\u6A21\u5757\u540D\u79F0..." oninput="filterModules()"></label>
  </div>
  <table><thead><tr><th style="width:30px">#</th><th>\u6A21\u5757</th><th style="text-align:right">\u5927\u5C0F</th><th style="text-align:right">\u5360\u603B\u4F53\u79EF</th><th>\u6240\u5C5E Chunk</th></tr></thead>
  <tbody id="modTableBody"></tbody></table>
</div>

<div class="sec">
  <h3>\u6A21\u5757\u4F9D\u8D56\u5173\u7CFB</h3>
  <p style="font-size:12px;color:#94a3b8;margin-bottom:10px">\u5C55\u793A\u6BCF\u4E2A chunk \u7684 import/export \u5173\u7CFB</p>
  ${chunks.map((c) => {
    const imp = c.imports?.length ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">\u5F15\u7528\uFF1A${c.imports.map((i) => `<span style="color:#60a5fa">${esc(i)}</span>`).join(", ")}</div>` : "";
    const exp = c.exports?.length ? `<div style="font-size:11px;color:#94a3b8">\u5BFC\u51FA\uFF1A${c.exports.map((e) => `<code style="color:#34d399;font-size:10px">${esc(e)}</code>`).join(", ")}</div>` : "";
    const modCount = c.modules?.length || 0;
    return `<div class="dup-card"><h4>\uD83D\uDCE6 ${esc(c.name)} <span style="font-size:11px;font-weight:400;color:#64748b">(${formatBytes(c.size)}, ${modCount} \u4E2A\u6A21\u5757)</span></h4>${imp}${exp}</div>`;
  }).join("")}
</div>
</div>

<!-- ====== \u4F18\u5316\u9875 ====== -->
<div id="page-optimize" class="page">
<h1>\u26A1 \u4F18\u5316\u5EFA\u8BAE</h1>
<p class="sub-title">\u91CD\u590D\u4F9D\u8D56\u68C0\u6D4B\u3001\u4F18\u5316\u5EFA\u8BAE</p>

<div class="sec">
  <h3>\uD83D\uDCA1 \u4F18\u5316\u5EFA\u8BAE</h3>
  ${d.suggestions.map((s) => {
    const icon = s.includes("\u826F\u597D") ? "\u2705" : s.includes("Sourcemap") ? "\u2139\uFE0F" : "\u26A0\uFE0F";
    return `<div class="sug">${icon} ${s}</div>`;
  }).join("")}
</div>

<div class="sec">
  <h3>\uD83D\uDD01 \u91CD\u590D\u4F9D\u8D56\u68C0\u6D4B</h3>
  ${d.duplicates.length === 0 ? '<p style="color:#34d399;font-size:13px">\u2705 \u672A\u68C0\u6D4B\u5230\u91CD\u590D\u4F9D\u8D56\uFF0C\u975E\u5E38\u597D\uFF01</p>' : d.duplicates.map((dup) => `<div class="dup-card">
    <h4>${esc(dup.packageName)} <span style="font-size:11px;font-weight:400;color:#64748b">\u00B7 \u6D6A\u8D39 ${formatBytes(dup.totalWaste)}</span></h4>
    <table style="margin-top:6px"><thead><tr><th>\u6A21\u5757\u8DEF\u5F84</th><th>\u6240\u5C5E Chunk</th><th style="text-align:right">\u5927\u5C0F</th></tr></thead>
    <tbody>${dup.instances.map((inst) => `<tr><td style="font-size:11px;color:#cbd5e1;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(inst.module)}</td><td style="font-size:11px">${esc(inst.chunk)}</td><td style="text-align:right;font-size:11px">${formatBytes(inst.size)}</td></tr>`).join("")}</tbody></table>
  </div>`).join("")}
</div>
</div>

<!-- ====== Diff \u9875 ====== -->
<div id="page-diff" class="page">
<h1>\uD83D\uDD04 \u6784\u5EFA Diff \u5BF9\u6BD4</h1>
<p class="sub-title">\u5BF9\u6BD4\u4EFB\u610F\u4E24\u6B21\u6784\u5EFA\u7684\u4EA7\u7269\u5DEE\u5F02\uFF0C\u67E5\u770B\u4F53\u79EF\u968F\u65F6\u95F4\u53D8\u5316\u8D8B\u52BF</p>

<div class="sec">
  <h3>\uD83D\uDCC8 \u4EA7\u7269\u4F53\u79EF\u8D8B\u52BF</h3>
  ${d.history.records.length > 1 ? `
  <div style="position:relative;height:280px">
    <canvas id="trendChart"></canvas>
  </div>
  ` : '<p style="color:#94a3b8;font-size:13px">\u9700\u8981\u81F3\u5C11 2 \u6B21\u6784\u5EFA\u8BB0\u5F55\u624D\u80FD\u751F\u6210\u8D8B\u52BF\u56FE\u3002</p>'}
</div>

<div class="sec">
  <h3>\uD83D\uDDC2\uFE0F \u6784\u5EFA\u5386\u53F2 (${d.history.records.length} \u6B21)</h3>
  ${d.history.records.length > 0 ? `
  <div class="ctrl">
    <label>\u5BF9\u6BD4\u76EE\u6807: <select id="diffSelect" onchange="renderDiff()">
      ${d.history.records.slice().reverse().map((r, i) => `<option value="${r.id}" ${i === 0 ? "selected" : ""}>#${d.history.records.length - i} ${r.timestamp} (${fmtBStatic(r.totalSize)})</option>`).join("")}
    </select></label>
  </div>
  <table>
    <thead><tr><th>#</th><th>\u65F6\u95F4</th><th style="text-align:right">\u603B\u4F53\u79EF</th><th style="text-align:right">JS</th><th style="text-align:right">CSS</th><th style="text-align:right">\u8017\u65F6</th><th style="text-align:right">\u6587\u4EF6\u6570</th><th style="text-align:right">\u6A21\u5757\u6570</th></tr></thead>
    <tbody>${d.history.records.slice().reverse().map((r, i) => `<tr><td style="color:#64748b">${d.history.records.length - i}</td><td>${r.timestamp}</td><td style="text-align:right;font-weight:600">${fmtBStatic(r.totalSize)}</td><td style="text-align:right;color:#fb923c">${fmtBStatic(r.jsSize)}</td><td style="text-align:right;color:#a78bfa">${fmtBStatic(r.cssSize)}</td><td style="text-align:right">${(r.buildTimeMs / 1000).toFixed(2)}s</td><td style="text-align:right">${r.fileCount}</td><td style="text-align:right">${r.moduleCount}</td></tr>`).join("")}</tbody>
  </table>
  ` : '<p style="color:#94a3b8;font-size:13px">\u6682\u65E0\u5386\u53F2\u8BB0\u5F55\u3002</p>'}
</div>

<div class="sec">
  <h3>\uD83D\uDD0D \u6587\u4EF6\u53D8\u66F4\u660E\u7EC6</h3>
  <div id="diffDetail">
    ${d.diffEntries.length > 0 ? renderDiffTable(d) : '<p style="color:#94a3b8;font-size:13px">\u2139\uFE0F \u672A\u627E\u5230\u4E0A\u6B21\u6784\u5EFA\u6570\u636E\u3002\u518D\u6B21\u6784\u5EFA\u540E\u5373\u53EF\u67E5\u770B\u5DEE\u5F02\u5BF9\u6BD4\u3002</p>'}
  </div>
</div>
</div>

<div class="footer">\u26A1 Lite Vite v2.0.1 \u00B7 \u6784\u5EFA\u8017\u65F6 ${buildTime}s \u00B7 ${d.files.length} \u4E2A\u6587\u4EF6 \u00B7 ${formatBytes(d.totalSize)} \u00B7 ${d.totalModules} \u4E2A\u6A21\u5757</div>
</div>

<script>
var ALL_MODULES = ${JSON.stringify(d.allModules.map((m) => ({ n: m.name, s: m.size, c: m.chunk })))};
var TOTAL_SIZE = ${d.totalSize};
var HISTORY = ${JSON.stringify(d.history.records.map((r) => ({ id: r.id, ts: r.timestamp, total: r.totalSize, js: r.jsSize, css: r.cssSize, time: r.buildTimeMs, files: r.files })))};
var CURRENT_FILES = ${JSON.stringify(d.files.map((f) => ({ name: f.name, size: f.size })))};

function switchTab(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelector('[onclick="switchTab(\\'' + id + '\\')"]').classList.add('active');
}

function filterModules() {
  var limit = parseInt(document.getElementById('modLimit').value) || 20;
  var sort = document.getElementById('modSort').value;
  var order = document.getElementById('modOrder').value;
  var search = document.getElementById('modSearch').value.toLowerCase();
  var mods = ALL_MODULES.filter(function(m) { return !search || m.n.toLowerCase().includes(search); });
  mods.sort(function(a, b) {
    var r = sort === 'name' ? a.n.localeCompare(b.n) : b.s - a.s;
    return order === 'asc' ? -r : r;
  });
  mods = mods.slice(0, limit);
  var html = '';
  mods.forEach(function(m, i) {
    var pct = TOTAL_SIZE ? (m.s / TOTAL_SIZE * 100).toFixed(1) : '0';
    html += '<tr><td style="color:#64748b;text-align:center">' + (i+1) + '</td><td style="font-size:11px">' + m.n + '</td><td style="text-align:right;font-weight:600">' + fmtB(m.s) + '</td><td style="text-align:right;color:#94a3b8">' + pct + '%</td><td style="font-size:10px;color:#64748b">' + m.c + '</td></tr>';
  });
  document.getElementById('modTableBody').innerHTML = html;
}

function fmtB(b) {
  if (b === 0) return '0 B';
  var k = 1024, s = ['B','KB','MB','GB'], i = Math.floor(Math.log(b)/Math.log(k));
  return (b/Math.pow(k,i)).toFixed(2) + ' ' + s[i];
}

function initTrendChart() {
  var canvas = document.getElementById('trendChart');
  if (!canvas || HISTORY.length < 2) return;
  var labels = HISTORY.map(function(r, i) { return '#' + (i + 1); });
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: '\u603B\u4F53\u79EF', data: HISTORY.map(function(r) { return r.total; }), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#60a5fa' },
        { label: 'JS', data: HISTORY.map(function(r) { return r.js; }), borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,0.08)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#fb923c' },
        { label: 'CSS', data: HISTORY.map(function(r) { return r.css; }), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#a78bfa' },
        { label: '\u8017\u65F6(ms)', data: HISTORY.map(function(r) { return r.time; }), borderColor: '#64748b', borderDash: [4, 4], fill: false, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#64748b', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          callbacks: {
            label: function(ctx) {
              if (ctx.dataset.yAxisID === 'y1') return ctx.dataset.label + ': ' + ctx.parsed.y + 'ms';
              return ctx.dataset.label + ': ' + fmtB(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(51,65,85,0.4)' } },
        y: { type: 'linear', position: 'left', ticks: { color: '#64748b', font: { size: 10 }, callback: function(v) { return fmtB(v); } }, grid: { color: 'rgba(51,65,85,0.4)' } },
        y1: { type: 'linear', position: 'right', ticks: { color: '#64748b', font: { size: 10 }, callback: function(v) { return v + 'ms'; } }, grid: { display: false } }
      }
    }
  });
}

function renderDiff() {
  var sel = document.getElementById('diffSelect');
  if (!sel) return;
  var targetId = parseInt(sel.value);
  var record = HISTORY.find(function(r) { return r.id === targetId; });
  if (!record) return;
  var prevMap = {};
  record.files.forEach(function(f) { prevMap[f.name] = f.size; });
  var newMap = {};
  CURRENT_FILES.forEach(function(f) { newMap[f.name] = f.size; });

  var entries = [];
  CURRENT_FILES.forEach(function(f) {
    var old = prevMap[f.name];
    if (old === undefined) entries.push({ file: f.name, st: 'added', os: null, ns: f.size, d: f.size });
    else if (old !== f.size) entries.push({ file: f.name, st: 'changed', os: old, ns: f.size, d: f.size - old });
  });
  record.files.forEach(function(f) {
    if (newMap[f.name] === undefined) entries.push({ file: f.name, st: 'removed', os: f.size, ns: null, d: -f.size });
  });
  entries.sort(function(a, b) {
    var ord = { added: 0, removed: 1, changed: 2 };
    return (ord[a.st] || 3) - (ord[b.st] || 3) || Math.abs(b.d) - Math.abs(a.d);
  });

  var html = '';
  if (entries.length === 0) { html = '<p style="color:#94a3b8;font-size:13px">\u65E0\u53D8\u5316</p>'; }
  else {
    html = '<table><thead><tr><th>\u72B6\u6001</th><th>\u6587\u4EF6</th><th style="text-align:right">\u65E7\u4F53\u79EF</th><th style="text-align:right">\u65B0\u4F53\u79EF</th><th style="text-align:right">\u53D8\u5316</th></tr></thead><tbody>';
    entries.forEach(function(e) {
      var cls = e.st === 'added' ? 'diff-add' : e.st === 'removed' ? 'diff-rm' : 'diff-ch';
      var label = e.st === 'added' ? '\u65B0\u589E' : e.st === 'removed' ? '\u5220\u9664' : '\u53D8\u66F4';
      var delta = e.d > 0 ? '+' + fmtB(e.d) : '-' + fmtB(Math.abs(e.d));
      html += '<tr><td class="' + cls + '">' + label + '</td><td>' + e.file + '</td><td style="text-align:right">' + (e.os !== null ? fmtB(e.os) : '-') + '</td><td style="text-align:right">' + (e.ns !== null ? fmtB(e.ns) : '-') + '</td><td style="text-align:right" class="' + cls + '">' + delta + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  document.getElementById('diffDetail').innerHTML = html;
}

filterModules();
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
<script>initTrendChart();</script>
</body>
</html>`;
}
