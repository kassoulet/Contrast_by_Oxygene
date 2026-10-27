"use strict";
// Build engine objects from a captured memory image (the original's struct layout) so single routines can be tested.
const { mat } = require("../src/mat");
const copyBytes = (m, base, n) => { const dv = new DataView(new ArrayBuffer(n)); const b = m.bytes(base, n); for (let i = 0; i < n; i++) dv.setUint8(i, b[i]); return dv; };
const rdMat = (m, p) => { const x = mat(); for (let i = 0; i < 16; i++) x[i] = m.i32(p + 4 * i); return x; };
function memObj(m, p) {
  const nv = m.u16(p), nf = m.u16(p + 2), nc = (m.u16(p + 4) << 16 >> 16) + 1, nd = (m.u16(p + 6) << 16 >> 16) + 1;
  return { p, nv, nf, nc, nd, v: copyBytes(m, m.u32(p + 8), nv * 0x2E), f: copyBytes(m, m.u32(p + 0xC), nf * 0x18), uv: copyBytes(m, m.u32(p + 0x18), nv * 4),
    local: rdMat(m, p + 0x20), camw: rdMat(m, p + 0x60), world: rdMat(m, p + 0xA0), cx: m.i32(p + 0xF6), cz: m.i32(p + 0xFA), cy: m.i32(p + 0xFE), radius: m.u16(p + 0xF0) };
}
module.exports = { memObj, copyBytes, rdMat };
