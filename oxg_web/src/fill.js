"use strict";
// The three triangle fillers of the 3D engine: flat (0x180D0), textured (0x1716F) and textured + shaded through a colour LUT (0x17855). They are one algorithm with 0, 2 or 3 interpolated attributes:
//   rotate the vertices so that v1 has the smallest y; divide the three edge deltas by their heights; build, line by line, a table of the left/right edge positions (16.16, the attributes only on the left edge);
//   then fill each span; the texture coordinates step by constant per-triangle deltas, spent as `add ecx,imm; adc al,imm8` in the original (the carry quirks are kept: see span()).
// The original patches the immediates of its loops (self-modifying code); here they are plain variables.
const idiv = (a, b) => Math.trunc(a / b) | 0;
const T = new Int32Array(8192);      // the edge table (0x597B4)

/**
 * @param env { fb: Uint8Array(64000), tex: Uint8Array(65536), cpl: Uint8Array(16384) }
 * @param kind 0 flat (colour in col), 1 textured, 2 textured + shaded
 * @param X,Y vertex screen positions, U,V texture coordinates, S shade levels (+0x20 already added), each 3 values
 */
function fillTri(env, kind, X, Y, U, V, S, col) {
  const nA = kind === 0 ? 0 : kind === 1 ? 2 : 3, sh = [16, 16, 8];
  const arr = [X.slice(), ...(nA ? [U.slice(), V.slice()] : []), ...(nA === 3 ? [S.slice()] : [])];   // arr[0] = x, arr[1..] = attributes
  const y = Y.slice();
  let c = 0, e = y[0];
  if (e > y[1]) { c = 1; e = y[1]; }
  if (e > y[2]) c = 2;
  while (c-- > 0) { for (const a of arr) a.push(a.shift()); y.push(y.shift()); }   // rotate (v1,v2,v3) -> (v2,v3,v1)
  const n = arr.length;
  const e12 = [], e23 = [], e13 = [];
  for (let k = 0; k < n; k++) {
    const s = k ? sh[k - 1] : 16, a = arr[k];
    e12.push((a[1] - a[0]) << s); e23.push((a[2] - a[1]) << s); e13.push((a[2] - a[0]) << s);
  }
  let H12 = y[1] - y[0], H23 = y[2] - y[1];
  const H13 = y[2] - y[0];
  for (let k = 0; k < n; k++) {
    if (H12) e12[k] = idiv(e12[k], H12);
    if (H23) e23[k] = idiv(e23[k], H23);
    if (H13) e13[k] = idiv(e13[k], H13);
  }
  let L2 = e13.slice(), S2 = e23.slice();           // slopes of the long and the short chain in the second part
  if (H23 < 0) { H23 = -H23; H12 -= H23; L2 = e23.slice(); S2 = e12.slice(); }
  let total = H12 + H23;
  const ex = total + y[0] - 200;
  if (ex > 0) { H23 -= ex; total -= ex; if (H23 < 0) { H12 = total; H23 = 0; } }
  // chains: short (left, x and attributes) and long (right, x only; the attribute copy is only used for the step computation)
  const init = k => k === 0 ? ((arr[0][0] << 16) | 0x8000) : k === 3 ? ((arr[3][0] << 8) | 0x80) : ((arr[k][0] << 16) | 0x8000);
  const sc = [], lc = [];
  for (let k = 0; k < n; k++) { sc.push(init(k)); lc.push(init(k)); }
  lc[0] = (lc[0] + 0x10000) | 0;
  if (H12 === 0) {
    if (y[0] === y[1]) for (let k = 0; k < n; k++) sc[k] = (sc[k] + e12[k]) | 0;
    else for (let k = 0; k < n; k++) lc[k] = (lc[k] + e13[k]) | 0;
  }
  let step = [0, 0, 0], sEnd = null, lEnd = null;
  {
    const b = H12;
    lEnd = lc.map((v, k) => (Math.imul(e13[k], b) + v) | 0);
    sEnd = sc.map((v, k) => (Math.imul(e12[k], b) + v) | 0);
    if (nA) {
      const w = (sEnd[0] - lEnd[0]) >> 16;
      if (w === 0) throw new Error("division by zero in the filler");
      for (let k = 1; k < n; k++) step[k - 1] = idiv((sEnd[k] - lEnd[k]) | 0, w);
    }
  }
  let y1 = y[0];
  if (y1 < 0) {
    let cc = -y1; y1 = 0; total -= cc;
    if (cc <= H12) {
      for (let k = 0; k < n; k++) { lc[k] = (lc[k] + Math.imul(e13[k], cc)) | 0; sc[k] = (sc[k] + Math.imul(e12[k], cc)) | 0; }
      H12 -= cc;
    } else {
      for (let k = 0; k < n; k++) { lc[k] = lEnd[k]; sc[k] = sEnd[k]; }
      cc -= H12; H12 = 0; H23 = total;
      for (let k = 0; k < n; k++) { lc[k] = (lc[k] + Math.imul(L2[k], cc)) | 0; sc[k] = (sc[k] + Math.imul(S2[k], cc)) | 0; }
    }
  }
  // the edge table: for each line the long x, the short x and the attributes of the short chain
  let p = 0;
  for (let i = 0; i < H12; i++) { T[p++] = lc[0]; T[p++] = sc[0]; for (let k = 1; k < n; k++) T[p++] = sc[k]; lc[0] = (lc[0] + e13[0]) | 0; for (let k = 0; k < n; k++) sc[k] = (sc[k] + e12[k]) | 0; }
  for (let i = 0; i < H23; i++) { T[p++] = lc[0]; T[p++] = sc[0]; for (let k = 1; k < n; k++) T[p++] = sc[k]; lc[0] = (lc[0] + L2[0]) | 0; for (let k = 0; k < n; k++) sc[k] = (sc[k] + S2[k]) | 0; }
  const fb = env.fb;
  const tex = env.tex, cpl = env.cpl;
  const Ku = step[0], Kv = step[1], Ks = step[2]; if (env.dbg) console.log("steps", Ku, Kv, Ks);
  // span fill
  const immU = ((Ku << 16) | 0xFFFF) >>> 0, uI = (Ku >> 16) & 0xFF;
  const immV = kind === 2 ? ((((Kv << 16) | (Ks & 0xFFFF))) >>> 0) : ((Kv << 16) >>> 0), vI = (Kv >> 16) & 0xFF;
  let e0 = 0, base = y1 * 320;
  const per = n + 1;     // table dwords per line: x long, x short, attributes
  for (let line = 0; line < total; line++, e0 += per, base += 320) {
    let r = T[e0] >> 16, l = T[e0 + 1] >> 16;
    if (r <= 0 || l >= 320) continue;
    if (r > 0x13F) r = 0x13F;
    if (kind === 0) {
      if (l < 0) l = 0;
      const w = r - l; if (w <= 0) continue;
      fb.fill(col & 0xFF, base + l, base + l + w);
      continue;
    }
    let cu = T[e0 + 2] | 0, cv = T[e0 + 3] | 0, cs = kind === 2 ? T[e0 + 4] | 0 : 0;
    if (l < 0) { const m = -l; cu = (cu + Math.imul(m, Ku)) | 0; cv = (cv + Math.imul(m, Kv)) | 0; if (kind === 2) cs = (cs + Math.imul(m, Ks)) | 0; l = 0; }
    const w = r - l; if (w <= 0) continue;
    let ecx = ((((cu << 16) | (cu >>> 16)) & 0xFFFF0000) | ((w - 1) & 0xFFFF)) >>> 0;   // rol ecx,16: fraction in the high word, count-1 in the low word
    let edx = (((cv << 16) & 0xFFFF0000) >>> 0);                                          // fraction of v in the high word
    let bl = (cu >>> 16) & 0xFF, bh = (cv >>> 16) & 0xFF;                                // integer parts
    if (kind === 2) edx = (edx | (cs & 0xFFFF)) >>> 0;
    let d = base + l, cf;
    for (;;) {
      const texel = tex[(bh << 8) | bl];
      let px = texel;
      if (kind === 2) px = cpl[((((edx >>> 8) & 0xFF) << 8) | texel)];
      let sum = ecx + immU; cf = sum > 0xFFFFFFFF ? 1 : 0; ecx = sum >>> 0; bl = (bl + uI + cf) & 0xFF;
      fb[d++] = px;
      sum = edx + immV; cf = sum > 0xFFFFFFFF ? 1 : 0; edx = sum >>> 0; bh = (bh + vI + cf) & 0xFF;
      if ((ecx >>> 8) & 0x80) break;                       // `or ch,ch; jns`
    }
  }
}
module.exports = { fillTri, T };
