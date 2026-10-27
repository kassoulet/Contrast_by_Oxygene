"use strict";
const path = require("path"), { load } = require("./vec"), { objectMatrix } = require("../src/objmat");
const v = load(path.join(__dirname, "../../oxg_out/v_objmat.bin")), m = v.before, a = v.after, O = v.regs[0], frame = v.regs[3] & 0xFFFF;
const nc = (m.u16(O + 4) << 16 >> 16) + 1, nd = (m.u16(O + 6) << 16 >> 16) + 1, C = m.u32(O + 0x10), D = m.u32(O + 0x1C);
const mk = (base, n, rec) => { const dv = new DataView(new ArrayBuffer(n * rec)); for (let i = 0; i < n * rec; i += 4) if (i + 4 <= n * rec) dv.setUint32(i, m.u32(base + i), true); return dv; };
const o = { nc, nd, c: mk(C, nc, 0x2E), d: mk(D, nd, 0x10) };
const M = objectMatrix(o, frame); let bad = 0;
for (let i = 0; i < 16; i++) if (M[i] !== a.i32(O + 0x20 + 4 * i)) { bad++; console.log("m[" + i + "]", M[i], a.i32(O + 0x20 + 4 * i)); }
console.log("object matrix (frame " + frame + ", nc " + nc + ", nd " + nd + "):", bad ? bad + " differ" : "identical (16 dwords)"); process.exit(bad ? 1 : 0);
