// Scene 2: a perspective water floor made of three lookups per pixel pair (routines 0x12F58 / 0x13047 of CONTRAST.EXE).
// For every screen row the floor is walked with a rotated step (a texture of heights, 256x256), a table of precomputed bump displacements picks where in a 256x256
// environment image to look, and a 16 KB colour table turns (environment value, height) into a palette index.  Two pixels share one height.
"use strict";
const idiv = (a, b) => Math.trunc(a / b) | 0;
/**
 * @param {Uint8Array} out    64000-byte frame buffer
 * @param {Uint16Array} disp  65536 displacement entries (the table built at start-up, [0x4C82C])
 * @param {Uint8Array} height 65536 texture ([0x4C794], bump2.gif)
 * @param {Uint8Array} env    65536 environment image ([0x4C820], bumpecla.gif)
 * @param {Uint8Array} lut    colour table ([0x4C7F4], cpalcred.bin, read up to 64 KB: the original indexes past its 16 KB when the environment image does)
 * @param {{trig:object, angle:number, o8c:number, o90:number, p130:number, p134:number}} s
 */
function bumpFrame(out, disp, height, env, lut, s) {
  const { cos, sin } = s.trig, b = s.angle & 0xFFF;
  const A = Math.imul(cos[b], 11520), B = Math.imul(sin[b], 11520);
  let o9c = s.o8c | 0, o98 = s.o90 | 0;
  const e = s.p134 & 0xFFF, f = s.p130 & 0xFFF;
  const base114 = (((cos[e] * 2 + cos[f] * 2) << 5) + 0x400000) | 0, base118 = (((sin[f] * 2 + sin[e] * 2) << 5) + 0x600000) | 0;
  let r83c = (base118 >> 8) & 0xFF00, r850 = 0x780000, edi = 0xF9E0;
  for (let row = 0; row < 200; row++) {
    const d = r850 >> 16;
    const q1 = idiv(A, d), q2 = idiv(q1, d), q3 = idiv(B, d), q4 = idiv(q3, d);
    const a148 = (o98 - q1) | 0, a144 = (o9c - q3) | 0;
    o9c = (o9c + q2) | 0; o98 = (o98 - q4) | 0;
    const s1 = q1 >> 6, s3 = q3 >> 6;
    let ecx = ((((a148 << 16) | ((a144 >>> 8) & 0xFFFF)) >>> 0)), al = (a148 >>> 16) & 0xFF;
    const step = ((((s1 << 16) | ((s3 >>> 8) & 0xFFFF)) >>> 0)), adc = ((s1 >>> 16) & 0xFF);
    let dxb = (r83c + (base114 >> 16)) & 0xFFFF;
    for (let k = 0; k < 128; k++) {
      const pos = ((ecx >>> 8) & 0xFF) << 8 | al, dx = (dxb + disp[pos]) & 0xFFFF, h = height[pos];
      const e1 = env[dx], e2 = env[(dx + 1) & 0xFFFF];
      edi -= 2;
      out[edi] = lut[(e1 << 8) | h]; out[edi + 1] = lut[(e2 << 8) | h];
      dxb = (dxb + 2) & 0xFFFF;
      const sum = ecx + step; ecx = sum >>> 0; al = (al + adc + (sum > 0xFFFFFFFF ? 1 : 0)) & 0xFF;
    }
    r83c += 0x100; r850 -= 0x7530; edi -= 0x40;
  }
}
module.exports = { bumpFrame };

/** The displacement table ([0x4C82C], built at 0x12ABF): for every pixel of the height image the luminance (r^2+g^2+b^2) difference to the pixel four rows below
 *  and to the one four to the right, divided by 768 and scaled by a sine of the row / column phase, plus 0xB0, as two bytes. */
function bumpTable(height, pal, trig) {
  const lum = new Int32Array(256); for (let c = 0; c < 256; c++) lum[c] = pal[3 * c] ** 2 + pal[3 * c + 1] ** 2 + pal[3 * c + 2] ** 2;
  const out = new Uint8Array(131072); let i = 0, rowPhase = 0;
  for (let y = 0; y < 256; y++) {
    rowPhase = (rowPhase + 0x40) & 0xFFF; const sr = trig.sin[rowPhase] * 2; let xp = 0;
    for (let x = 0; x < 256; x++, i++) {
      const a = lum[height[i]], below = lum[height[(i + 0x400) & 0xFFFF]], right = lum[height[(i + 4) & 0xFFFF]];
      out[2 * i] = ((idiv(a - below, 0x300) * sr) >> 15) + 0xB0;
      out[2 * i + 1] = ((idiv(a - right, 0x300) * (trig.sin[xp] * 2)) >> 15) + 0xB0; xp = (xp + 0x40) & 0xFFF;
    }
  }
  return new Uint16Array(out.buffer);
}
module.exports.bumpTable = bumpTable;
