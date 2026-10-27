"use strict";
// Per-object, per-frame preparation (routines 0x14DE0 and 0x15690): the object's centroid in camera space, a visibility test, every vertex projected to the screen,
// and, depending on the material, either reflection-map coordinates (from the camera-space normals) or a per-vertex light level.
// The vertex transform uses the identity (m0 + b)(m1 + a) - a*b - m0*m1 = m0*a + m1*b to spend one multiply per two terms (the products a*b are stored in the vertex: +0xC, +0x28).
const idiv = (a, b) => Math.trunc(a / b) | 0;
const isqrt = n => Math.trunc(Math.sqrt(n));

/** 0x15690: 1 when the bounding sphere (radius o.radius at the camera-space centroid o.sx,sy,sz) is certainly off the 320x200 view */
function culled(o, zoff) {
  let z = (o.sz + zoff) | 0, x = o.sx << 8, r = o.radius << 8;
  if (z < 0x10) z = 0x10;
  const rp = idiv(r, z);
  if (rp < 5 && z > 0x800) return 1;
  x = idiv(x, z);
  if (x - rp > 0xA0) return 1;
  if (x + rp < -0xA0) return 1;
  const y = idiv(o.sy << 8, z);
  if (y - rp > 0x64) return 1;
  if (y + rp < -0x64) return 1;
  return 0;
}

/**
 * @param o object with local/world/camw matrices already set (world = parent . local, camw = camera . world)
 * @param st { light:{x,y,z}, zoff, materials }
 */
function prepare(o, st) {
  const W = o.world, M = o.camw, L0 = st.light;
  const cx = o.cx, cz = o.cz, cy = o.cy;
  // centroid in the world, vector from the light, normalised to about 256
  const wx = (W[3] + ((Math.imul(W[0], cx) + Math.imul(W[1], cz) + Math.imul(W[2], cy)) >> 15)) | 0;
  const wy = (W[7] + ((Math.imul(W[4], cx) + Math.imul(W[5], cz) + Math.imul(W[6], cy)) >> 15)) | 0;
  const wz = (W[11] + ((Math.imul(W[8], cx) + Math.imul(W[9], cz) + Math.imul(W[10], cy)) >> 15)) | 0;
  let lx = (wx - L0.x) | 0, ly = (wy - L0.y) | 0, lz = (wz - L0.z) | 0;
  const len = isqrt((Math.imul(lx, lx) + Math.imul(ly, ly) + Math.imul(lz, lz)) | 0);
  ly <<= 8; lz <<= 8; lx <<= 8;
  if (len !== 0) { lx = idiv(lx, len); ly = idiv(ly, len); lz = idiv(lz, len); } else { lx = 0xFFFF; ly = 0; lz = 0; }
  // centroid in camera space
  o.sx = (M[3] + ((Math.imul(M[0], cx) + Math.imul(M[1], cz) + Math.imul(M[2], cy)) >> 15)) | 0;
  o.sy = (M[7] + ((Math.imul(M[4], cx) + Math.imul(M[5], cz) + Math.imul(M[6], cy)) >> 15)) | 0;
  o.sz = (M[11] + ((Math.imul(M[8], cx) + Math.imul(M[9], cz) + Math.imul(M[10], cy)) >> 15)) | 0;
  if (culled(o, st.zoff)) { o.visible = 0; return; }
  o.visible = 1;
  // the light direction in the object's own axes
  const ox = (-((Math.imul(W[0], lx) + Math.imul(W[4], ly) + Math.imul(W[8], lz)) | 0)) >> 15;          // (negated first, then shifted)
  const oy = (-((Math.imul(W[1], lx) + Math.imul(W[5], ly) + Math.imul(W[9], lz)) | 0)) >> 15;
  const oz = (-((Math.imul(W[2], lx) + Math.imul(W[6], ly) + Math.imul(W[10], lz)) | 0)) >> 15;
  const m00m01 = Math.imul(M[0], M[1]), m10m11 = Math.imul(M[4], M[5]), m20m21 = Math.imul(M[8], M[9]), v = o.v;
  for (let k = 0; k < o.nv; k++) {
    const q = k * 0x2E, x = v.getInt32(q, true), z = v.getInt32(q + 4, true), y = v.getInt32(q + 8, true), xz = v.getInt32(q + 0xC, true);
    const X = (((Math.imul((M[0] + z) | 0, (M[1] + x) | 0) - xz - m00m01 + Math.imul(M[2], y)) | 0) >> 7) + (M[3] << 8) | 0;
    const Y = (((Math.imul((M[4] + z) | 0, (M[5] + x) | 0) - xz - m10m11 + Math.imul(M[6], y)) | 0) >> 7) + (M[7] << 8) | 0;
    let Z = (((Math.imul((z + M[8]) | 0, (x + M[9]) | 0) - xz - m20m21 + Math.imul(M[10], y)) | 0) >> 15) + M[11] + st.zoff | 0;
    v.setInt32(q + 0x18, Z, true);                                  // the stored depth is the raw one; only the divisor is clamped
    if (Z < 0x40) Z = 0x40;
    v.setInt32(q + 0x10, (idiv(X, Z) + 0xA0) | 0, true); v.setInt32(q + 0x14, (idiv(Y, -Z) + 0x64) | 0, true);
  }
  const mi = o.f.getInt16(6, true);
  if (o.nf && (o.f.getUint16(6, true) & 0x4000)) return;           // flag in the material word: leave the mapping and shading alone
  const mt = st.materials[mi] || { flags: 0 };                  // (the original reads flags from address 0 + 0x22 when the index is outside the table: 0)
  if (mt.flags & 0x80) {                                           // reflection map: the normal in camera space picks the pixel of a 256x256 image
    for (let k = 0; k < o.nv; k++) {
      const q = k * 0x2E, nx = v.getInt32(q + 0x1C, true), ny = v.getInt32(q + 0x20, true), nz = v.getInt32(q + 0x24, true), nxy = v.getInt32(q + 0x28, true);
      const u = (((Math.imul((M[0] + ny) | 0, (M[1] + nx) | 0) - nxy - m00m01 + Math.imul(M[2], nz)) | 0) >> 16) + 0x7F;
      const w = (((Math.imul((M[4] + ny) | 0, (M[5] + nx) | 0) - nxy - m10m11 + Math.imul(M[6], nz)) | 0) >> 16) + 0x7F;
      o.uv.setInt16(k * 4, u, true); o.uv.setInt16(k * 4 + 2, w, true);
    }
  } else if ((mt.flags & 3) === 2) {                               // lit: the normal . the light direction, scaled, in -31..31
    for (let k = 0; k < o.nv; k++) {
      const q = k * 0x2E; let s = ((Math.imul(v.getInt32(q + 0x1C, true), ox) + Math.imul(v.getInt32(q + 0x20, true), oy) + Math.imul(v.getInt32(q + 0x24, true), oz)) | 0) >> 11;
      if (s < -31) s = -31; else if (s > 31) s = 31;
      v.setInt16(q + 0x2C, s, true);
    }
  }
}
module.exports = { prepare, culled };
