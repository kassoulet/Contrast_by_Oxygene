"use strict";
// Run the ported scenes in sequence against the recording of the real program.   usage: node test/test_seq.js [rawfile|-] [maxTicks]   (V=1: list every differing tick)
const fs = require("fs"), path = require("path");
const { parseArchive } = require("../src/archive"), { chain } = require("../src/sequence"), { loadRec, sync } = require("./rec");
const files = parseArchive(fs.readFileSync(path.join(__dirname, "../../oxg_cont/CONTRAST.BIN")));
const recs = loadRec((process.argv[2] && process.argv[2] !== "-") ? process.argv[2] : path.join(__dirname, "../../oxg_out/rec_a.rawz")), N = Math.min(+process.argv[3] || 1e9, recs.length - 4);
const OFF = 3, SO = 3, diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
const seq = chain(files); let bad = 0, first = -1;
for (let i = 0; i < N; i++) {
  const r = seq.step(sync(recs[Math.min(recs.length - 1, i + SO)]));
  if (!r) { console.log("sequence ended at tick", i); break; }
  const t = recs[i + OFF], d = diff(r.frame, t.frame) + diff(r.pal, t.pal);
  if (d) { bad++; if (process.env.V) console.log("tick", i, "scene", seq.name, "px+pal", d); if (first < 0) { first = i; console.log("first mismatch at tick", i, "scene", seq.name, "pixels+pal", d); } }
}
console.log("final scene state:",seq.name,seq.scene.state);console.log("compared", Math.min(N, recs.length - 4), "ticks;", bad, "differ", JSON.stringify(seq.started));
