"use strict";
// The camera of the 3D scenes (routine 0x147D0): a look-at matrix from the scene's camera track (position, target, roll per frame).
const { mat, mulInto } = require("./mat");
const idiv = (a, b) => (b === 0 ? 0x80000000 | 0 : Math.trunc(a / b) | 0);
const isqrt = n => Math.trunc(Math.sqrt(n));          // the program truncates (frndint in truncating mode)
/**
 * @param ss scene header: { nrec, pos:{x,z,y: Int32Array}, tgt:{x,z,y}, roll: Int16Array, cur: {...} (updated) }
 * @param trig {cos, sin}
 * @returns Int32Array(16): the camera matrix (rows 0..3 as at 0x5A838)
 */
function lookAt(ss, frame, trig) {
  if (!(frame < ss.nrec)) frame = ss.nrec - 1;
  const r = ss.roll[frame] & 0x0FFF, cosr = trig.cos[r], sinr = trig.sin[r];
  const px = ss.pos.x[frame], pz = ss.pos.z[frame], py = ss.pos.y[frame], tx = ss.tgt.x[frame], tz = ss.tgt.z[frame], ty = ss.tgt.y[frame];
  ss.cur = { px, pz, py, tx, tz, ty };
  const dY = (tz - pz) | 0, dZ = (ty - py) | 0, dX = (tx - px) | 0;                 // (the file's second and third coordinates are swapped)
  const len = isqrt((Math.imul(dZ, dZ) + Math.imul(dX, dX) + Math.imul(dY, dY)) | 0);
  const X = idiv(dX << 15, len), Y = idiv(dY << 15, len), Z = idiv(dZ << 15, len);
  const h = isqrt((Math.imul(Z, Z) + Math.imul(X, X)) | 0);
  const A = idiv((-X) << 15, h), B = idiv(Z << 15, h);
  const t1 = (Math.imul(Y, A)) >> 15, t2 = (Math.imul(B, Y)) >> 15;
  const M = mat();
  M[0] = (Math.imul(B, cosr) - Math.imul(t1, sinr)) >> 15;
  M[1] = (Math.imul(-h, sinr)) >> 15;
  M[2] = (Math.imul(A, cosr) + Math.imul(sinr, t2)) >> 15;
  M[3] = 0;
  M[4] = (Math.imul(t1, cosr) + Math.imul(sinr, B)) >> 15;
  M[5] = (Math.imul(h, cosr)) >> 15;
  M[6] = (Math.imul(sinr, A) - Math.imul(cosr, t2)) >> 15;
  M[7] = 0;
  M[8] = (Math.imul(-A, h)) >> 15; M[9] = Y; M[10] = (Math.imul(B, h)) >> 15; M[11] = 0;
  M[12] = 0; M[13] = 0; M[14] = 0; M[15] = 0x8000;
  const T = new Int32Array([0x8000, 0, 0, -px, 0, 0x8000, 0, -pz, 0, 0, 0x8000, -py, 0, 0, 0, 0x8000]);
  mulInto(M, T);
  for (const i of [4, 5, 6, 7]) M[i] = idiv(M[i] << 9, 0x254);         // the y row is scaled by 512/596
  return M;
}
module.exports = { lookAt, idiv, isqrt };
