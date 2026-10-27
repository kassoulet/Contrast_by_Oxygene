// Bundle src/*.js into site/oxg.js (a tiny CommonJS loader; exposes globalThis.OXG = { chain, parseArchive }) and copy the data the page needs.   usage: node build.js
"use strict";
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "src"), mods = fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort();
let out = '"use strict";\n(function () {\nconst defs = {}, cache = {};\nfunction req(from) { return function require(n) { const k = n.replace(/^\\.\\//, "").replace(/\\.js$/, ""); if (!(k in defs)) throw new Error("module " + n + " not bundled"); if (!cache[k]) { const m = { exports: {} }; cache[k] = m; defs[k](m, m.exports, req(k)); } return cache[k].exports; }; }\n';
for (const f of mods) out += `defs[${JSON.stringify(f.replace(/\.js$/, ""))}] = function (module, exports, require) {\n${fs.readFileSync(path.join(dir, f), "utf8")}\n};\n`;
out += 'const r = req(""); globalThis.OXG = { chain: r("sequence").chain, parseArchive: r("archive").parseArchive };\n})();\n';
fs.writeFileSync(path.join(__dirname, "site/oxg.js"), out);
fs.copyFileSync(path.join(__dirname, "data/trig16.bin"), path.join(__dirname, "site/assets/trig16.bin"));
const bin = path.join(__dirname, "../oxg_cont/CONTRAST.BIN");
if (fs.existsSync(bin)) fs.copyFileSync(bin, path.join(__dirname, "site/assets/CONTRAST.BIN"));
console.log("site/oxg.js", Math.round(out.length / 1024), "KiB");
