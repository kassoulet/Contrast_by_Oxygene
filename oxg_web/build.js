// Bundle src/*.js into site/oxg.js (a tiny CommonJS loader; exposes globalThis.OXG = { chain, parseArchive }) and copy the data the page needs.   usage: node build.js
"use strict";
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "src"), mods = fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort();
let out = '"use strict";\n(function () {\nconst defs = {}, cache = {};\nfunction req(from) { return function require(n) { const k = n.replace(/^\\.\\//, "").replace(/\\.js$/, ""); if (!(k in defs)) throw new Error("module " + n + " not bundled"); if (!cache[k]) { const m = { exports: {} }; cache[k] = m; defs[k](m, m.exports, req(k)); } return cache[k].exports; }; }\n';
for (const f of mods) out += `defs[${JSON.stringify(f.replace(/\.js$/, ""))}] = function (module, exports, require) {\n${fs.readFileSync(path.join(dir, f), "utf8")}\n};\n`;
out += 'const r = req(""); globalThis.OXG = { chain: r("sequence").chain, CHAPTERS: r("sequence").CHAPTERS, parseArchive: r("archive").parseArchive };\n})();\n';
fs.writeFileSync(path.join(__dirname, "site/oxg.js"), out);
fs.copyFileSync(path.join(__dirname, "data/trig16.bin"), path.join(__dirname, "site/assets/trig16.bin"));
const bin = path.join(__dirname, "../oxg_cont/CONTRAST.BIN");
if (fs.existsSync(bin)) fs.copyFileSync(bin, path.join(__dirname, "site/assets/CONTRAST.BIN"));
console.log("site/oxg.js", Math.round(out.length / 1024), "KiB");

// ---- the write-ups: oxg_out/*.md -> site/docs/*.html (a small converter for the subset of Markdown they use)
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = s => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function inline(s) {
  const codes = []; s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(`<code>${esc(c)}</code>`); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u.replace(/\.md(#|$)/, ".html$1")}">${t}</a>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i]);
}
function md2html(src) {
  const L = src.replace(/\r/g, "").split("\n"), out = []; let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (/^```/.test(l)) { const b = []; i++; while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]); i++; out.push(`<pre><code>${esc(b.join("\n"))}</code></pre>`); continue; }
    let m;
    if ((m = /^(#{1,4}) (.*)/.exec(l))) { out.push(`<h${m[1].length} id="${slug(m[2])}">${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^\|/.test(l) && /^\|[-| :]+\|?\s*$/.test(L[i + 1] || "")) {
      const row = r => r.replace(/^\||\|\s*$/g, "").split("|").map(c => c.trim()); const head = row(l); i += 2; const rows = [];
      while (i < L.length && /^\|/.test(L[i])) rows.push(row(L[i++]));
      out.push(`<div class="tw"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`); continue;
    }
    if (/^([*-]|\d+\.) /.test(l)) {
      const ord = /^\d/.test(l), items = [];
      while (i < L.length && /^([*-]|\d+\.) /.test(L[i])) { let t = L[i++].replace(/^([*-]|\d+\.) /, ""); while (i < L.length && /^ {2,}\S/.test(L[i])) t += " " + L[i++].trim(); items.push(t); }
      out.push(`<${ord ? "ol" : "ul"}>${items.map(t => `<li>${inline(t)}</li>`).join("")}</${ord ? "ol" : "ul"}>`); continue;
    }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < L.length && L[i].trim() && !/^(```|#{1,4} |\||([*-]|\d+\.) )/.test(L[i])) p.push(L[i++]);
    out.push(`<p>${inline(p.join(" "))}</p>`);
  }
  return out.join("\n");
}
const DOCS = [["effects", "EFFECTS.md", "Effects, 3D engine, tricks"], ["reverse", "REVERSE.md", "The release and the assembly"], ["scenes", "scenes.md", "3D scene tables"]];
const nav = cur => `<nav><a href="../index.html">&larr; the demo</a>${DOCS.map(d => d[0] === cur ? `<b>${d[2]}</b>` : `<a href="${d[0]}.html">${d[2]}</a>`).join("")}</nav>`;
fs.mkdirSync(path.join(__dirname, "site/docs"), { recursive: true });
for (const [name, file, title] of DOCS) {
  const f = path.join(__dirname, "../oxg_out", file); if (!fs.existsSync(f)) continue;
  const body = md2html(fs.readFileSync(f, "utf8").replace(/^### (\S+\.3dm)/gm, "### $1"));
  fs.writeFileSync(path.join(__dirname, "site/docs", name + ".html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} (CONTRAST, Oxygene 1996)</title>
<style>:root{color-scheme:dark light}body{margin:0;font:16px/1.55 system-ui,sans-serif;background:#111;color:#ddd}main{max-width:62rem;margin:0 auto;padding:0 16px 48px}
nav{display:flex;gap:16px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #333;position:sticky;top:0;background:#111;font-size:14px}nav b{color:#fff}a{color:#8ab}
h1,h2,h3{line-height:1.25;color:#fff}h2{border-bottom:1px solid #333;padding-bottom:.2em;margin-top:2em}code{font:13px ui-monospace,Menlo,Consolas,monospace;background:#1d1d1d;padding:1px 4px;border-radius:3px}
pre{background:#181818;padding:12px;border-radius:6px;overflow-x:auto}pre code{background:none;padding:0}.tw{overflow-x:auto}table{border-collapse:collapse;font-size:14px;margin:1em 0}th,td{border:1px solid #333;padding:3px 8px;text-align:left}th{background:#1d1d1d}
@media (prefers-color-scheme:light){body{background:#fafafa;color:#222}nav{background:#fafafa;border-color:#ccc}nav b,h1,h2,h3{color:#000}code{background:#eee}pre{background:#f0f0f0}th{background:#eee}th,td{border-color:#ccc}a{color:#245}h2{border-color:#ccc}}</style></head>
<body>${nav(name)}<main>${body}</main></body></html>`);
}
console.log("site/docs:", DOCS.map(d => d[0]).join(", "));
