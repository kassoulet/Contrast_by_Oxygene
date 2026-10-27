"use strict";
// Loading a 3DM scene the way routine 0x133B0 does, plus the set-up it ends with: per-object centroid and radius (0x15580), face normals (0x15760), vertex normals (0x15A10).
const { readGif } = require("./gif"), { mulRecipTrunc } = require("./x87");
const isqrt = n => Math.trunc(Math.sqrt(n));
const idiv = (a, b) => Math.trunc(a / b) | 0;

/** the nearest palette entry (1..255) to a 24-bit colour: routine 0x10E40 */
function nearestColour(pal, rgb) {
  const r = (rgb >> 16) & 0xFF, g = (rgb >> 8) & 0xFF, b = rgb & 0xFF; let best = 0x2FFFD, idx = 0;
  for (let c = 1; c < 256; c++) {
    const dr = r - pal[3 * c], dg = g - pal[3 * c + 1], db = b - pal[3 * c + 2], d = dr * dr + dg * dg + db * db;
    if (d < best) { best = d; idx = c; if (d === 0) break; }
  }
  return idx;
}

class Obj {
  constructor(nv, nf, nc, nd, nuv) {
    this.nv = nv; this.nf = nf;
    this.v = new DataView(new ArrayBuffer(nv * 0x2E));       // vertex records, 46 bytes: +0 x, +4 z, +8 y, +0xC x*z, +0x10 sx, +0x14 sy, +0x18 depth, +0x1C/+0x20/+0x24 normal, +0x28 nx*ny, +0x2C shade (i16)
    this.f = new DataView(new ArrayBuffer(nf * 0x18));       // faces, 24 bytes: +0 v1, +2 v2, +4 v3 (i16), +6 material (i16), +0xA object id, +0xC/+0x10/+0x14 normal (i32)
    this.c = new DataView(new ArrayBuffer(nc * 0x2E));       // array C (pivot positions), same record layout as vertices
    this.d = new DataView(new ArrayBuffer(nd * 0x10));       // array D (orientation keys), 4 dwords each
    this.uv = new DataView(new ArrayBuffer(Math.max(nuv, nv) * 4));        // per-vertex mapping (u, v) as two i16
    this.nc = nc; this.nd = nd; this.id = 0; this.parent = -1; this.cx = 0; this.cz = 0; this.cy = 0; this.radius = 0; this.radius2 = 0;
  }
}

/** @returns { ss, objects[], materials[], light:{x,y,z} } */
function loadScene(file, files, pal) {
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength), W = o => dv.getUint16(o, true), S = o => dv.getInt16(o, true), U = o => dv.getUint32(o, true);
  if (String.fromCharCode(file[0], file[1], file[2], file[3]) !== "3DM!") throw new Error("not a 3DM file");
  const offAnim = U(4), light = { x: S(8), y: S(10), z: S(12) }, nobj = W(14);
  const ss = { nrec: W(offAnim), roll: null, pos: null, tgt: null, light };
  const n = ss.nrec; ss.pos = { x: new Int32Array(n), z: new Int32Array(n), y: new Int32Array(n) }; ss.tgt = { x: new Int32Array(n), z: new Int32Array(n), y: new Int32Array(n) }; ss.roll = new Int16Array(n);
  for (let k = 0; k < n; k++) {
    const o = offAnim + 2 + 14 * k;                          // 7 i16: position x y z, target x y z, roll; the engine keeps (x, z, y)
    ss.pos.x[k] = S(o); ss.pos.y[k] = S(o + 2); ss.pos.z[k] = S(o + 4); ss.tgt.x[k] = S(o + 6); ss.tgt.y[k] = S(o + 8); ss.tgt.z[k] = S(o + 10); ss.roll[k] = S(o + 12);
  }
  const objects = [];
  for (let i = 0; i < nobj; i++) {
    const b = U(16 + 4 * i), hdr = [0, 1, 2, 3, 4].map(k => U(b + 4 * k)), id = S(b + 20), parent = S(b + 22);
    const nv = W(b + hdr[0]), nf = W(b + hdr[1]), nc = W(b + hdr[2]), nd = W(b + hdr[3]), nuv = W(b + hdr[4]);
    const o = new Obj(nv, nf, nc, nd, nuv); o.id = id; o.parent = parent;
    for (let k = 0; k < nv; k++) {                           // vertices: x, then the file's y and z swapped
      const s = b + hdr[0] + 2 + 6 * k, x = S(s), y = S(s + 2), z = S(s + 4);
      o.v.setInt32(k * 0x2E, x, true); o.v.setInt32(k * 0x2E + 8, y, true); o.v.setInt32(k * 0x2E + 4, z, true); o.v.setInt32(k * 0x2E + 0xC, Math.imul(x, z), true);
    }
    for (let k = 0; k < nf; k++) {
      const s = b + hdr[1] + 2 + 8 * k, a = k * 0x18;
      o.f.setInt16(a, S(s), true); o.f.setInt16(a + 2, S(s + 2), true); o.f.setInt16(a + 4, S(s + 4), true); o.f.setInt16(a + 6, S(s + 6), true); o.f.setInt16(a + 0xA, i, true);
    }
    for (let k = 0; k < nc; k++) {                           // array C: three coordinates as dwords (+0, +8, +4 like the vertices)
      const s = b + hdr[2] + 2 + 6 * k; o.c.setInt32(k * 0x2E, S(s), true); o.c.setInt32(k * 0x2E + 8, S(s + 2), true); o.c.setInt32(k * 0x2E + 4, S(s + 4), true);
    }
    for (let k = 0; k < nd; k++) {                           // array D: four i16 scaled by 64
      const s = b + hdr[3] + 2 + 8 * k; for (let q = 0; q < 4; q++) o.d.setInt32(k * 0x10 + 4 * q, S(s + 2 * q) << 6, true);
    }
    for (let k = 0; k < nuv; k++) { const s = b + hdr[4] + 2 + 4 * k; o.uv.setInt16(k * 4, S(s), true); o.uv.setInt16(k * 4 + 2, S(s + 2), true); }
    objects.push(o);
  }
  // materials
  const p = 16 + 4 * nobj, nmat = W(p), materials = [];
  for (let m = 0; m < nmat; m++) {
    const s = U(p + 2 + 4 * m), cstr = (a, n) => { let t = ""; for (let i = 0; i < n && file[a + i]; i++) t += String.fromCharCode(file[a + i]); return t; };
    const mat = { name: cstr(s, 16), texture: cstr(s + 16, 16), flags: file[s + 32], colour: (file[s + 33] << 16) | (file[s + 34] << 8) | file[s + 35], index: 0, tex: null };
    mat.index = nearestColour(pal, mat.colour);
    if (mat.texture) mat.tex = readGif(files[mat.texture.toLowerCase()]).pix;
    materials.push(mat);
  }
  for (const o of objects) { centroid(o); faceNormals(o); }
  for (const o of objects) vertexNormals(o);
  return { ss, objects, materials, light };
}

/** 0x15580: the centroid of the vertices (truncating means) and the largest distance to it */
function centroid(o) {
  let sx = 0, sy = 0, sz = 0;
  for (let k = 0; k < o.nv; k++) { sx = (sx + o.v.getInt32(k * 0x2E, true)) | 0; sy = (sy + o.v.getInt32(k * 0x2E + 4, true)) | 0; sz = (sz + o.v.getInt32(k * 0x2E + 8, true)) | 0; }
  const n = o.nv; o.cx = idiv(sx, n); o.cz = idiv(sy, n); o.cy = idiv(sz, n);
  let best = 0;
  for (let k = 0; k < n; k++) {
    const dx = (o.v.getInt32(k * 0x2E, true) - o.cx) | 0, dz = (o.v.getInt32(k * 0x2E + 4, true) - o.cz) | 0, dy = (o.v.getInt32(k * 0x2E + 8, true) - o.cy) | 0;
    const d = (Math.imul(dx, dx) + Math.imul(dz, dz) + Math.imul(dy, dy)) | 0; if (d > best) best = d;      // (signed compare: jng)
  }
  o.radius = isqrt(best) + 1; o.radius2 = Math.imul(o.radius, o.radius);
}

/** 0x15760: a normal per face (cross product of two edges, halved until it is small, then scaled to about 256) */
function faceNormals(o) {
  const i16 = v => (v << 16) >> 16;
  for (let k = 0; k < o.nf; k++) {
    const a = k * 0x18, ia = o.f.getInt16(a, true), ib = o.f.getInt16(a + 2, true), ic = o.f.getInt16(a + 4, true);
    for (const i of [ia, ib, ic]) { o.v.setInt32(i * 0x2E + 0x1C, 0, true); o.v.setInt32(i * 0x2E + 0x20, 0, true); o.v.setInt32(i * 0x2E + 0x24, 0, true); }
    const P = i => [o.v.getInt16(i * 0x2E, true), o.v.getInt16(i * 0x2E + 4, true), o.v.getInt16(i * 0x2E + 8, true)], A = P(ia), B = P(ib), C = P(ic);
    const e1x = i16(B[0] - A[0]), e1y = i16(B[1] - A[1]), e1z = i16(B[2] - A[2]), e2x = i16(B[0] - C[0]), e2y = i16(B[1] - C[1]), e2z = i16(B[2] - C[2]);
    let nx = (Math.imul(e1y, e2z) - Math.imul(e2y, e1z)) | 0, ny = (Math.imul(e1z, e2x) - Math.imul(e1x, e2z)) | 0, nz = (Math.imul(e1x, e2y) - Math.imul(e2x, e1y)) | 0;
    while (Math.abs(nx) > 0x4000 || Math.abs(ny) > 0x4000 || Math.abs(nz) > 0x4000) { nx = Math.trunc(nx / 2); ny = Math.trunc(ny / 2); nz = Math.trunc(nz / 2); }
    const len = isqrt((Math.imul(nx, nx) + Math.imul(ny, ny) + Math.imul(nz, nz)) | 0);
    nx <<= 8; ny <<= 8; nz <<= 8;
    if (len !== 0) { nx = idiv(nx, len); ny = idiv(ny, len); nz = idiv(nz, len); }
    o.f.setInt32(a + 0xC, nx, true); o.f.setInt32(a + 0x10, ny, true); o.f.setInt32(a + 0x14, nz, true);
  }
}

/** 0x15A10: vertex normals = the sum of the normals of the faces around the vertex, renormalised with the x87 (single-precision partial sums) */
function vertexNormals(o) {
  for (let k = 0; k < o.nf; k++) {
    const a = k * 0x18, fx = o.f.getInt32(a + 0xC, true), fy = o.f.getInt32(a + 0x10, true), fz = o.f.getInt32(a + 0x14, true);
    for (const i of [o.f.getInt16(a, true), o.f.getInt16(a + 2, true), o.f.getInt16(a + 4, true)]) {
      const q = i * 0x2E; o.v.setInt32(q + 0x1C, (o.v.getInt32(q + 0x1C, true) + fx) | 0, true); o.v.setInt32(q + 0x20, (o.v.getInt32(q + 0x20, true) + fy) | 0, true); o.v.setInt32(q + 0x24, (o.v.getInt32(q + 0x24, true) + fz) | 0, true);
    }
  }
  const f = Math.fround;
  for (let k = 0; k < o.nv; k++) {
    const q = k * 0x2E, x = o.v.getInt32(q + 0x1C, true), y = o.v.getInt32(q + 0x20, true), z = o.v.getInt32(q + 0x24, true);
    let t = f(x * x); t = f(y * y + t); const len = f(Math.sqrt(z * z + t));   // fild/fmul/fstp dword, then the sum in extended precision, sqrt, stored as a float
    const X = x << 8, Y = y << 8, Z = z << 8;
    o.v.setInt32(q + 0x1C, X, true); o.v.setInt32(q + 0x20, Y, true); o.v.setInt32(q + 0x24, Z, true);
    if (len !== 0) {
      o.v.setInt32(q + 0x1C, mulRecipTrunc(X, len), true); o.v.setInt32(q + 0x20, mulRecipTrunc(Y, len), true); o.v.setInt32(q + 0x24, mulRecipTrunc(Z, len), true);
      o.v.setInt32(q + 0x28, Math.imul(o.v.getInt32(q + 0x1C, true), o.v.getInt32(q + 0x20, true)), true);
    }
  }
}
module.exports = { loadScene, nearestColour, Obj };
