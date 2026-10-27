"use strict";
const path = require("path"), { load } = require("./vec"), { prepare } = require("../src/prepare"), { memObj } = require("./memobj");
const v = load(path.join(__dirname, "../../oxg_out/" + (process.argv[2] || "v_prep.bin"))), m = v.before, a = v.after, P = v.regs[0];
const o = memObj(m, P), light = { x: m.i32(0x628BE), y: m.i32(0x628C2), z: m.i32(0x628C6) }, zoff = (m.u16(0x5A878) << 16) >> 16;
const materials = []; for (let i = 0; i < 8; i++) { const mp = m.u32(0x593B4 + 4 * i); materials.push(mp ? { flags: m.u16(mp + 0x22) & 0xFF } : { flags: 0 }); }
prepare(o, { light, zoff, materials });
let bad = 0, n = 0; const chk = (what, got, want) => { n++; if (got !== want) { if (bad++ < 8) console.log("DIFF", what, got, want); } };
chk("visible", o.visible, a.u16(P + 0x126));
chk("sx", o.sx, a.i32(P + 0x106)); chk("sy", o.sy, a.i32(P + 0x10A)); chk("sz", o.sz, a.i32(P + 0x10E));
if (o.visible) {
  const V = a.u32(P + 8), UV = a.u32(P + 0x18);
  for (let k = 0; k < o.nv; k++) { for (const off of [0x10, 0x14, 0x18]) chk("v+" + off.toString(16) + " #" + k, o.v.getInt32(k * 0x2E + off, true), a.i32(V + k * 0x2E + off)); chk("shade #" + k, o.v.getInt16(k * 0x2E + 0x2C, true), (a.u16(V + k * 0x2E + 0x2C) << 16) >> 16); chk("u #" + k, o.uv.getInt16(k * 4, true), (a.u16(UV + k * 4) << 16) >> 16); chk("v #" + k, o.uv.getInt16(k * 4 + 2, true), (a.u16(UV + k * 4 + 2) << 16) >> 16); }
}
console.log("prepare: object", P.toString(16), o.visible ? "visible" : "culled", "-", bad ? bad + " of " + n + " values differ" : "all " + n + " values identical"); process.exit(bad ? 1 : 0);
