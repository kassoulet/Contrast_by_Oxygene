"use strict";
// The matrix of an object for an animation frame (routine 0x14AA0): its orientation key (a quaternion in 1.15, from array D) turned into a rotation,
// and its position (from array C).  Both arrays are indexed by the frame, clamped to their length.
const { mat } = require("./mat");
/** @returns Int32Array(16) in the layout of mat.js */
function objectMatrix(o, frame) {
  const f16 = (frame << 16) >> 16;
  const ic = Math.min(f16, o.nc - 1), id = Math.min(f16, o.nd - 1);
  const W = o.d.getInt32(id * 0x10, true), A = o.d.getInt32(id * 0x10 + 4, true), B = o.d.getInt32(id * 0x10 + 8, true), D = o.d.getInt32(id * 0x10 + 12, true);
  const AB = Math.imul(A, B) >> 15, DA = Math.imul(D, A) >> 15, AW = Math.imul(A, W) >> 15, BB = Math.imul(B, B) >> 15;
  const DW = Math.imul(D, W) >> 15, DD = Math.imul(D, D) >> 15, DB = Math.imul(D, B) >> 15, BW = Math.imul(B, W) >> 15, AA = Math.imul(A, A) >> 15;
  const m = mat();
  m[0] = (0x8000 - 2 * (BB + DD)) | 0; m[1] = 2 * (DA - BW); m[2] = 2 * (AB + DW);
  m[4] = 2 * (DA + BW); m[5] = (0x8000 - 2 * (AA + BB)) | 0; m[6] = 2 * (DB - AW);
  m[8] = 2 * (AB - DW); m[9] = 2 * (DB + AW); m[10] = (0x8000 - 2 * (DD + AA)) | 0;
  m[3] = o.c.getInt32(ic * 0x2E, true); m[7] = o.c.getInt32(ic * 0x2E + 4, true); m[11] = o.c.getInt32(ic * 0x2E + 8, true);
  m[12] = m[13] = m[14] = 0; m[15] = 0x8000;
  return m;
}
module.exports = { objectMatrix };
