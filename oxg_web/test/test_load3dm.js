"use strict";
const fs = require("fs"), path = require("path");
const { load } = require("./vec"), { loadScene } = require("../src/scene3d"), { parseArchive } = require("../src/archive"), { readGif } = require("../src/gif");
const files = parseArchive(fs.readFileSync(path.join(__dirname, "../../oxg_cont/CONTRAST.BIN")));
const v = load(path.join(__dirname, "../../oxg_out/vec_load3dm.bin")), a = v.after, arr = v.rregs[0];
const pal = readGif(files["scene2.gif"]).pal;
const sc = loadScene(files["scenebis.3dm"], files, pal);
let bad = 0, checked = 0; const fail = (what, i, k, got, want) => { if (bad++ < 12) console.log("DIFF", what, "obj", i, "idx", k, got, want); };
console.log("objects", sc.objects.length, "vs", a.u32(0x62924));
sc.objects.forEach((o, i) => {
  const p = a.u32(arr + 4 * i);
  if (o.nv !== a.u16(p) || o.nf !== a.u16(p + 2)) fail("counts", i, 0, [o.nv, o.nf], [a.u16(p), a.u16(p + 2)]);
  const V = a.u32(p + 8), F = a.u32(p + 0xC), C = a.u32(p + 0x10), D = a.u32(p + 0x1C), UV = a.u32(p + 0x18);
  for (let k = 0; k < o.nv; k++) {
    for (const off of [0, 4, 8, 0xC, 0x1C, 0x20, 0x24, 0x28]) { checked++; const g = o.v.getInt32(k * 0x2E + off, true), w = a.u32(V + k * 0x2E + off) | 0; if (g !== w) fail("vertex+" + off.toString(16), i, k, g, w); }
  }
  for (let k = 0; k < o.uv.byteLength / 4; k++) for (let q = 0; q < 2; q++) { checked++; if (o.uv.getInt16(k * 4 + 2 * q, true) !== (a.u16(UV + 4 * k + 2 * q) << 16 >> 16)) fail("uv", i, k, 0, 0); }
  for (let k = 0; k < o.nf; k++) for (const [off, sz] of [[0, 2], [2, 2], [4, 2], [6, 2], [0xA, 2], [0xC, 4], [0x10, 4], [0x14, 4]]) {
    checked++; const g = sz === 2 ? o.f.getInt16(k * 0x18 + off, true) : o.f.getInt32(k * 0x18 + off, true), w = sz === 2 ? (a.u16(F + k * 0x18 + off) << 16 >> 16) : (a.u32(F + k * 0x18 + off) | 0); if (g !== w) fail("face+" + off.toString(16), i, k, g, w);
  }
  for (let k = 0; k < o.nc; k++) for (const off of [0, 4, 8]) { checked++; if (o.c.getInt32(k * 0x2E + off, true) !== (a.u32(C + k * 0x2E + off) | 0)) fail("C", i, k, 0, 0); }
  for (let k = 0; k < o.nd; k++) for (const off of [0, 4, 8, 0xC]) { checked++; if (o.d.getInt32(k * 0x10 + off, true) !== (a.u32(D + k * 0x10 + off) | 0)) fail("D", i, k, 0, 0); }
  for (const [name, got, want] of [["id", o.id, a.u16(p + 0xE0) << 16 >> 16], ["parent", o.parent, a.u16(p + 0xE2) << 16 >> 16], ["cx", o.cx, a.u32(p + 0xF6) | 0], ["cz", o.cz, a.u32(p + 0xFA) | 0], ["cy", o.cy, a.u32(p + 0xFE) | 0], ["radius", o.radius, a.u16(p + 0xF0)], ["radius2", o.radius2, a.u32(p + 0xF2) | 0]]) { checked++; if (got !== want) fail(name, i, 0, got, want); }
});
sc.materials.forEach((m, i) => {
  const p = a.u32(0x593B4 + 4 * i); checked += 4;
  if ((a.u16(p + 0x22) & 0xFF) !== m.flags) fail("mat flags", i, 0, m.flags, a.u16(p + 0x22)); if ((a.u32(p + 0x24) & 0xFFFFFF) !== m.colour) fail("mat colour", i, 0, m.colour, a.u32(p + 0x24));
  if ((a.u32(p + 0x28) & 0xFF) !== m.index) fail("mat index", i, 0, m.index, a.u32(p + 0x28));
  if (m.tex) { const t = a.bytes(a.u32(p + 0x2C), 65536); for (let k = 0; k < 65536; k++) if (t[k] !== m.tex[k]) { fail("mat texture", i, k, 0, 0); break; } }
});
const ssA = 0x6292C; const P = a.u32(ssA + 4), T = a.u32(ssA + 8), R = a.u32(ssA + 0xC); checked += sc.ss.nrec * 7;
for (let k = 0; k < sc.ss.nrec; k++) {
  if (sc.ss.pos.x[k] !== (a.u32(P + 0x2E * k) | 0) || sc.ss.pos.z[k] !== (a.u32(P + 0x2E * k + 4) | 0) || sc.ss.pos.y[k] !== (a.u32(P + 0x2E * k + 8) | 0)) fail("camera pos", 0, k, 0, 0);
  if (sc.ss.tgt.x[k] !== (a.u32(T + 0x2E * k) | 0) || sc.ss.tgt.z[k] !== (a.u32(T + 0x2E * k + 4) | 0) || sc.ss.tgt.y[k] !== (a.u32(T + 0x2E * k + 8) | 0)) fail("camera target", 0, k, 0, 0);
  if (sc.ss.roll[k] !== (a.u16(R + 2 * k) << 16 >> 16)) fail("roll", 0, k, 0, 0);
}
console.log(bad ? bad + " of " + checked + " checked values differ" : "scene load: all " + checked + " checked values identical to the original (vertices, faces, normals, centroids)"); process.exit(bad ? 1 : 0);
