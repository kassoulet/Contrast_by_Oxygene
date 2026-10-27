"use strict";
const fs = require("fs"), path = require("path");
const { parseArchive } = require("../src/archive"), { Intro } = require("../src/intro"), { Scene2 } = require("../src/scene2"), { loadRec, sync } = require("./rec");
const files = parseArchive(fs.readFileSync(path.join(__dirname, "../../oxg_cont/CONTRAST.BIN")));
const recs = loadRec(path.join(__dirname, "../../oxg_out/rec_a.rawz")), FROM = +process.argv[2], TO = +process.argv[3], OFF = +(process.argv[4] ?? 3), SO = +(process.argv[5] ?? 3);
let scene = new Intro(files), name = "intro";
const nz = a => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i]) n++; return n; };
for (let i = 0; i < TO; i++) {
  const sy = sync(recs[Math.min(recs.length - 1, i + SO)]); const r = scene.step(sy);
  if (scene.done) { if (name === "intro") { scene = new Scene2(files, { angle: scene.angle, o8c: 0x800000, o90: 0x800000 }); name = "scene2"; r.frame = scene.shown; r.pal = scene.pal; } }
  if (i < FROM) continue; const t = recs[i + OFF]; let d = 0; for (let k = 0; k < 64000; k++) if (r.frame[k] !== t.frame[k]) d++;
  let pd = 0; for (let k = 0; k < 768; k++) if (r.pal[k] !== t.pal[k]) pd++;
  console.log(i, name, "sync", sy, "ours nonzero", nz(r.frame), "rec nonzero", nz(t.frame), "diff", d, "paldiff", pd, "waiting", scene.waiting, "state", scene.state, "tick", scene.tick);
}
