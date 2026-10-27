"use strict";
const { load } = require("./vec"), { trig, polarMap } = require("../src/tables");
const v = load(require("path").join(__dirname, "../../oxg_out/vec_swirl_a.bin")), m = v.before, t = trig();
let bad = 0;
for (let i = 0; i < 4096; i++) { if (t.cos[i] !== m.i32(0x3AE0C + 4 * i) || t.sin[i] !== m.i32(0x40E0C + 4 * i) || t.sqrt[i] !== m.u16(0x3EE0C + 2 * i)) bad++; }
console.log("trig tables:", bad ? bad + " entries differ" : "identical");
const map = polarMap(t), mem = m.bytes(m.u32(0x4C7A0), 131072); let badm = 0; for (let i = 0; i < 65536; i++) if (map[i] !== mem.readUInt16LE(2 * i)) badm++;
console.log("polar map:", badm ? badm + " entries differ" : "identical (65536 entries)");
process.exit(bad || badm ? 1 : 0);
