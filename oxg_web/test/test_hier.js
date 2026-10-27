"use strict";
const path = require("path"), { load } = require("./vec"), { setupHierarchy } = require("../src/hier"), { mat } = require("../src/mat");
const v = load(path.join(__dirname, "../../oxg_out/v_hier.bin")), m = v.before, a = v.after, rootP = v.regs[0], camP = v.regs[3];
const rd = (mem, p) => { const x = mat(); for (let i = 0; i < 16; i++) x[i] = mem.i32(p + 4 * i); return x; };
const ptrs = {}; function build(p) { if (!p) return null; if (ptrs[p]) return ptrs[p]; const o = ptrs[p] = { p, local: rd(m, p + 0x20) }; o.sibling = build(m.u32(p + 0xEC)); o.child = build(m.u32(p + 0xE8)); return o; }
const root = build(rootP); setupHierarchy(root, rd(m, camP));
let bad = 0, n = 0; for (const p in ptrs) { const o = ptrs[p]; n++; for (let i = 0; i < 16; i++) { if (i % 4 === 3 && i >= 12) continue; if (i >= 12) continue; if (o.world[i] !== a.i32(+p + 0xA0 + 4 * i) || o.camw[i] !== a.i32(+p + 0x60 + 4 * i)) bad++; } }
console.log(n, "objects:", bad ? bad + " matrix elements differ" : "world and camera matrices identical"); process.exit(bad ? 1 : 0);
