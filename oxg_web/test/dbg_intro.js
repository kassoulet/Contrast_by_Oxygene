"use strict";
const fs = require("fs"), path = require("path");
const { parseArchive } = require("../src/archive"), { Intro } = require("../src/intro"), { loadRec, sync } = require("./rec");
const files = parseArchive(fs.readFileSync(path.join(__dirname, "../../oxg_cont/CONTRAST.BIN")));
const recs = loadRec(path.join(__dirname, "../../oxg_out/rec_a.rawz")), OFF = +process.argv[2] || 3, SO = +process.argv[3] || -2, FROM = +process.argv[4] || 495, TO = +process.argv[5] || 512;
const intro = new Intro(files);
for (let i = 0; i < TO; i++) {
  const r = intro.step(sync(recs[Math.max(0, i + SO)])); const t = recs[i + OFF]; if (i < FROM) continue;
  let fd = 0, minx = 999, maxx = -1, miny = 999, maxy = -1; for (let k = 0; k < 64000; k++) if (r.frame[k] !== t.frame[k]) { fd++; const x = k % 320, y = (k / 320) | 0; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  let pd = 0; for (let k = 0; k < 768; k++) if (r.pal[k] !== t.pal[k]) pd++;
  console.log(i, "state", intro.state, "tick", intro.tick, "sync", sync(recs[i + SO]), "rec-sync", sync(t), "framediff", fd, fd ? `[${minx}-${maxx} x ${miny}-${maxy}]` : "", "paldiff", pd);
}
