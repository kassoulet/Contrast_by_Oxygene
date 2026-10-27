"use strict";
// 3x4 matrices in the engine's layout: 16 dwords (64 bytes); row r at +16r, element (r, c) at +16r+4c, 1.15 fixed point, the translation in column 3 in plain units.
// (Routines 0x14C18 copy, 0x14C7C multiply, 0x14D24/0x14D44 multiply-into.)  A "matrix" here is an Int32Array(16).
const mat = () => new Int32Array(16);
function copy(dst, src) { for (let i = 0; i < 16; i++) dst[i] = src[i]; }
/** C = A . B  (0x14C7C): rotation part >> 15, translation = (A.R * B.t >> 15) + A.t */
function mul(C, A, B) {
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++)
    C[4 * r + c] = (Math.imul(A[4 * r + 0], B[c]) + Math.imul(A[4 * r + 1], B[4 + c]) + Math.imul(A[4 * r + 2], B[8 + c])) >> 15;
  C[3] = (C[3] + A[3]) | 0; C[7] = (C[7] + A[7]) | 0; C[11] = (C[11] + A[11]) | 0; C[15] = 1;
}
/** 0x14D24: A = A . B through a temporary */
function mulInto(A, B) { const t = mat(); mul(t, A, B); copy(A, t); }
module.exports = { mat, copy, mul, mulInto };
