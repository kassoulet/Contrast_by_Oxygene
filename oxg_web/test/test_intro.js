"use strict";
const fs = require("fs"), path = require("path");
const { parseArchive } = require("../src/archive"), { Intro } = require("../src/intro"), { loadRec, sync } = require("./rec");
const files = parseArchive(fs.readFileSync(path.join(__dirname, "../../oxg_cont/CONTRAST.BIN")));
const recs = loadRec((process.argv[2] && process.argv[2] !== "-") ? process.argv[2] : path.join(__dirname, "../../oxg_out/rec_a.rawz")), N = Math.min(+process.argv[3] || 600, recs.length - 4);
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
let best = null;
for (let off = 0; off <= 8; off++) for (let so = -2; so <= 6; so++) {
  const intro = new Intro(files); let bad = 0, firstBad = -1;
  for (let i = 0; i < N; i++) {
    const r = intro.step(sync(recs[Math.max(0, i + so)])); const t = recs[i + off];
    const d = diff(r.frame, t.frame) + diff(r.pal, t.pal); if (d) { bad++; if (firstBad < 0) firstBad = i; }
  }
  if (!best || bad < best.bad) best = { off, so, bad, firstBad };
}
console.log("best alignment: record offset", best.off, "sync offset", best.so, "->", best.bad, "of", N, "ticks differ; first at", best.firstBad);
