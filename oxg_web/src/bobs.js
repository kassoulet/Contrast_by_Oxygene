"use strict";
// The particle scene (main routine 0x18BA0): point clouds drawn as shaded balls ("bobs") into a 16-bit depth buffer (low byte = colour, high byte = depth), rotated with 16-bit integer maths.
// Stage 1: a picture dissolves in around the first cloud morphing into the second; stage 2: three flower clouds; stage 3: the final cloud, spinning, fading out.
const { trig } = require("./tables"), { readGif } = require("./gif"), { fadeTable } = require("./fade");
const s16 = v => (v << 16) >> 16;
const idiv = (a, b) => Math.trunc(a / b) | 0;
const ROW = 0x300, BASE = 0xC000, SIZE = 0x3FC00, VIS = 0x6040;      // 384-word rows; the visible 320x200 starts at word (32, 32)
let T16 = null;
/** the two 4096-entry int16 tables (512 cos / 512 sin) of the data section: a browser sets globalThis.OXG_TRIG16 (ArrayBuffer of data/trig16.bin) before the first frame */
function trig16() {
  if (!T16) {
    let a;
    if (globalThis.OXG_TRIG16) a = new Int16Array(globalThis.OXG_TRIG16);
    else { const b = require("fs").readFileSync(require("path").join(__dirname, "../data/trig16.bin")); a = new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
    T16 = { cos: a.subarray(0, 4096), sin: a.subarray(4096) };
  }
  return T16;
}

function readCloud(f) { const dv = new DataView(f.buffer, f.byteOffset, f.byteLength), n = dv.getUint16(0, true), p = new Int16Array(n * 4); for (let i = 0; i < n * 4; i++) p[i] = dv.getInt16(2 + 2 * i, true); return { n, p }; }

/** 0x194A0: `frames` frames from cloud A towards cloud B (24.8 fixed point, the last frame stops one step short of B); returns Int16Array(frames * n * 4) */
function morph(A, B, frames) {
  const n = A.n, out = new Int16Array(frames * n * 4), cur = new Int32Array(n * 3), step = new Int32Array(n * 3);
  for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) { const a = A.p[4 * k + c], b = B.p[4 * k + c]; cur[3 * k + c] = a << 8; step[3 * k + c] = idiv((b - a) << 8, frames); }
  let o = 0;
  for (let f = 0; f < frames; f++) for (let k = 0; k < n; k++) {
    for (let c = 0; c < 3; c++) { out[o++] = cur[3 * k + c] >> 8; cur[3 * k + c] += step[3 * k + c]; }
    out[o++] = A.p[4 * k + 3];
  }
  return out;
}

class Bobs {
  constructor(files, screen) {   // screen: what the previous scene left in video memory (nothing clears it until the first display)
    const g = readGif(files["boite21.gif"]); this.fade = fadeTable(null, g.pal); this.t = trig(); this.t16 = trig16(); this.bobz = files["bobz.bin"];
    this.A = new DataView(new ArrayBuffer(SIZE)); this.B = new DataView(new ArrayBuffer(SIZE));
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) this.B.setUint16(BASE + VIS + y * ROW + 2 * x, 0x8100 | g.pix[y * 320 + x], true);
    // the dissolve order: positions grouped by the value of rip3.gif
    const rip = readGif(files["rip3.gif"]).pix; this.groups = Array.from({ length: 256 }, () => []);
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) this.groups[rip[y * 320 + x]].push((y + 32) * 384 + 32 + x);
    this.c1 = readCloud(files["debut.3dm"]); this.c1b = readCloud(files["debut2.3dm"]); this.f1 = morph(this.c1, this.c1b, 0x40);
    this.fl = [readCloud(files["fleur.3dm"]), readCloud(files["fleur2.3dm"]), readCloud(files["fleur3.3dm"])];
    this.fin = readCloud(files["final.3dm"]);
    this.list = new Uint16Array(4 * 800);
    this.shown = new Uint8Array(screen || 64000); this.pal = new Uint8Array(768);
    this.state = "wait"; this.tick = 0; this.done = false;
    this.g = { a0: 0, a1: 0, a2: 0, ya: 0, amp: 0x100, ctr: -1, dist: 0x190, cx: 0xC0, cy: 0x84 };   // [0x303cc], [0x303ce], [0x303d0], [0x6971e], [0x6971c], [0x696bc], [0x696b0], [0x696c8], [0x696c4]
  }
  setPalette(idx) { for (let i = 0; i < 768; i++) this.pal[i] = this.fade[idx * 768 + i] >> 2; }
  /** 0x19BDA / 0x19B85: the colours of the depth buffer go to the screen, then it is reset (to the background picture or to 0x8100) */
  display(fromB) {
    for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
      const p = BASE + VIS + y * ROW + 2 * x; this.shown[y * 320 + x] = this.A.getUint8(p); this.A.setUint16(p, fromB ? this.B.getUint16(p, true) : 0x8100, true);
    }
  }
  /** 0x19768 (to the background) / 0x19718 (to zero): the groups 0..ctr of the dissolve are written into the depth buffer */
  dissolve(fromB) {
    for (let g = this.g.ctr; g >= 0; g--) for (const pos of this.groups[g & 0xFF]) { const p = BASE + 2 * pos; this.A.setUint16(p, fromB ? this.B.getUint16(p, true) : 0, true); }
  }
  /** 0x197C2: rotate and project the n points at pts[off..] with the angles a0, a1, a2 into this.list */
  project(pts, off, n) {
    const { cos, sin } = this.t16, g = this.g;
    const c0 = cos[g.a0 & 0xFFF], s0 = sin[g.a0 & 0xFFF], c1 = cos[g.a1 & 0xFFF], s1 = sin[g.a1 & 0xFFF], c2 = cos[g.a2 & 0xFFF], s2 = sin[g.a2 & 0xFFF];
    const m = Math.imul;
    const M0 = (m(c1, c2) - m(s16((m(s0, s1)) >> 9), s2)) >> 9, M1 = (-m(c0, s2)) >> 9, M2 = (m(s1, c2) + m(s16(m(s0, c1) >> 9), s2)) >> 9;
    const M3 = (m(c1, s2) + m(s16(m(s0, s1) >> 9), c2)) >> 9, M4 = m(c0, c2) >> 9, M5 = (m(s1, s2) - m(s16(m(s0, c1) >> 9), c2)) >> 9;
    const M6 = (-m(c0, s1)) >> 9, M7 = s0, M8 = m(c0, c1) >> 9;
    const P01 = m(s16(M0), s16(M1)), P34 = m(s16(M3), s16(M4)), P67 = m(s16(M6), s16(M7)), N2 = s16(M2), N5 = s16(M5), N8 = s16(M8);
    const L = this.list;
    for (let k = 0; k < n; k++) {
      const p0 = pts[off + 4 * k], p1 = pts[off + 4 * k + 1], p2 = pts[off + 4 * k + 2], p3 = pts[off + 4 * k + 3], pp = m(p0, p1);
      const X = (m(s16(p1 + M0), s16(p0 + M1)) - P01 - pp + m(p2, N2)) | 0;
      const Y = (m(s16(p0 + M4), s16(p1 + M3)) - P34 - pp + m(p2, N5)) | 0;
      const Z = (m(s16(p0 + M7), s16(p1 + M6)) - P67 - pp + m(p2, N8)) | 0;
      const zz = Z >> 9, t = s16(zz) >> 1;
      L[4 * k + 3] = (t & 0xFF) << 8; L[4 * k] = p3 & 0xFFFF;
      const dv = s16((zz * 2 - g.dist) | 0);
      L[4 * k + 1] = (idiv(X, dv) + g.cx) & 0xFFFF; L[4 * k + 2] = (idiv(Y, dv) + g.cy) & 0xFFFF;
    }
  }
  /** 0x19C45: draw the sprites of the projected list into the depth buffer (larger signed word wins) */
  draw(n) {
    const L = this.list, b = this.bobz, A = this.A;
    for (let k = 0; k < n; k++) {
      const id = (L[4 * k] << 11) & 0xFFFF, sp = id, org = b[sp] | b[sp + 1] << 8;
      let rows = b[sp + 2];
      const x = s16(L[4 * k + 1] - org), y = s16(L[4 * k + 2] - org);
      if (x < 0 || x > 0x17F || y < 0 || y > 0xE7) continue;
      let row = BASE + 2 * (y * 384 + x), e = sp + 4; const dep = L[4 * k + 3];
      do {
        let cnt = b[e], dst = row + b[e + 1]; e += 2;
        do { const w = ((b[e] | b[e + 1] << 8) + dep) & 0xFFFF; e += 2; if (dst >= 0 && dst + 2 <= SIZE && !(s16(A.getUint16(dst, true)) >= s16(w))) A.setUint16(dst, w, true); dst += 2; cnt = (cnt - 1) & 0xFF; } while (cnt);
        row += ROW; rows = (rows - 1) & 0xFF;
      } while (rows);
    }
  }
  step(sync) {
    const out = () => ({ frame: this.shown, pal: this.pal }), g = this.g;
    if (this.state === "wait") { if (sync === 6) { this.state = "s1"; this.tick = 0; } return out(); }
    this.tick++; const tick = this.tick; this.pal[0] = this.pal[1] = this.pal[2] = 0;
    if (this.state === "s1") {
      if (tick < 0x40) this.setPalette(tick);
      this.display(true);
      g.cy = 0x84 - ((Math.imul(this.t.cos[g.ya & 0xFFF], g.amp)) >> 15);
      const fi = tick > 0x8C ? Math.min((tick - 0x8C) >> 1, 0x3F) : 0, n = this.c1.n;
      this.project(this.f1, fi * n * 4, n); this.draw(n);
      if (g.ctr > -1 && g.ctr < 0x100) this.dissolve(true);
      g.a2 = (g.a2 + 2) & 0xFFFF;
      if (tick > 0x3F && g.amp > 0) { g.ya = (g.ya + 4) & 0xFFFF; g.amp--; }
      if (tick > 0x348) g.ctr++;
      if (g.ctr >= 0x100) {                                        // end of stage 1: the whole picture, then the second set of clouds is prepared
        g.ctr = 0xFF; this.dissolve(true);
        const [f1, f2, f3] = this.fl; this.f2 = new Int16Array(256 * f1.n * 4); this.f2.set(morph(f1, f2, 0x80)); this.f2.set(morph(f2, f3, 0x80), 128 * f1.n * 4);
        this.display(true);
        Object.assign(g, { dist: 0x12C, cx: 0xC0, cy: 0x84, a2: 0x400, amp: 0x100, a0: 0, a1: 0, ya: 0, ctr: -1 }); this.state = "s2"; this.tick = 0;
      }
      return out();
    }
    if (this.state === "s2") {
      this.display(true);
      g.cy = 0xA4 + ((Math.imul(this.t.cos[g.ya & 0xFFF], g.amp)) >> 15);
      let fi = 0; if (tick >= 0x1A4 && tick < 0x3D4) fi = Math.min(tick - 0x1A4, 0x7F); if (tick >= 0x3D4) fi = Math.min(tick - 0x3D4, 0x7F) + 0x80;
      const n = this.fl[0].n; this.project(this.f2, fi * n * 4, n); this.draw(n);
      if (g.ctr > -1 && g.ctr < 0x100) this.dissolve(false);
      g.a0 = (g.a0 + 4) & 0xFFFF;
      if (tick > 0x3F && g.amp > 0) { g.ya = (g.ya + 4) & 0xFFFF; g.amp--; }
      if (tick > 0x4EC) g.ctr++;
      if (g.ctr >= 0x100) {                                        // end of stage 2: black palette, the last cloud is loaded, the screen is written once more; no tick passes
        this.pal.fill(0); this.display(true);
        Object.assign(g, { a0: 0, a1: 0, a2: 0, cy: 0x84, ctr: -1, dist: 0x12C, ya: 0, amp: 0x100, cx: 0xC0 }); this.state = "s3"; this.tick = 0;
      }
      return out();
    }
    // stage 3
    this.display(false);
    if (tick < 0x40) this.setPalette(tick);
    if (tick >= 0x690) { const j = tick - 0x690; if (j < 0x40) this.setPalette(0x3F - j); }
    this.project(this.fin.p, 0, this.fin.n); this.draw(this.fin.n);
    g.a0 = (g.a0 - 3) & 0xFFFF; g.a1 = (g.a1 - 1) & 0xFFFF; g.a2 = (g.a2 + 2) & 0xFFFF;
    if (tick >= 0x6D6) this.done = true;
    return out();
  }
}
module.exports = { Bobs, morph, readCloud };
