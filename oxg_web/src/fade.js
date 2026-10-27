// Palette fade tables: routine 0x10F64 builds 64 palettes (768 bytes of 8-bit components each) stepping from `src` (or black) to `dst` (or black).
"use strict";
function fadeTable(src, dst) {
  const out = new Uint8Array(64 * 768), P = new Int32Array(768), D = new Int32Array(768);
  for (let i = 0; i < 768; i++) {
    if (!src) { P[i] = 0; D[i] = dst[i] << 2; }
    else if (!dst) { P[i] = src[i] << 8; D[i] = (-src[i]) << 2; }
    else { P[i] = src[i] << 8; D[i] = (dst[i] - src[i]) << 2; }
  }
  for (let s = 0; s < 64; s++) for (let i = 0; i < 768; i++) { out[s * 768 + i] = (P[i] >> 8) & 0xFF; P[i] += D[i]; }
  return out;
}
module.exports = { fadeTable };
