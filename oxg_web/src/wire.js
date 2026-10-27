"use strict";
// The wireframe scene (main routine 0x16644, line3.3dm): thick lines drawn with the 3D engine's face list, then a feedback filter that makes the previous picture glow away.
const { trig } = require("./tables"), { readGif } = require("./gif"), { loadScene } = require("./scene3d");
const { lookAt } = require("./camera"), { objectMatrix } = require("./objmat"), { setupHierarchy } = require("./hier"), { prepare } = require("./prepare");
const { collect, sortList } = require("./faces"), { linkObjects } = require("./scene3");
const idiv = (a, b) => Math.trunc(a / b) | 0;
const MARGIN = 0x280, SIZE = 0x14000;           // two rows above the 320x200 picture, 54 below

/** 0x145F4: a line made of plus-shaped 5-pixel dabs, from its right end to its left end, clipped to the screen; buf[base + y*320 + x] */
function line(buf, base, x1, y1, x2, y2, col) {
  let xt = x1, yt = y1, xb = x2, yb = y2;
  if (y1 > y2) { xt = x2; yt = y2; xb = x1; yb = y1; }
  if (yb < 0 || yt > 0xC7) return;
  const dy = yb - yt, dx = xb - xt;
  if (yt < 0) { xt -= idiv(Math.imul(yt, dx), dy); yt = 0; }
  if (yb > 0xC7) { xb -= idiv(Math.imul(yb - 0xC7, dx), dy); yb = 0xC7; }
  let xl = xt, yl = yt, xr = xb, yr = yb;
  if (xb < xt) { xl = xb; yl = yb; xr = xt; yr = yt; }
  if (xr < 0 || xl > 0x13E) return;
  const dx2 = xr - xl, dy2 = yr - yl;
  if (xl < 0) { yl -= idiv(Math.imul(xl, dy2), dx2); xl = 0; }
  if (xr > 0x13E) { yr -= idiv(Math.imul(xr - 0x13E, dy2), dx2); xr = 0x13E; }
  let step = 320, ady = yl - yr; const adx = xr - xl;
  if (ady < 0) { ady = -ady; step = -320; }
  let p = base + yr * 320 + xr, err, n;
  if (adx > ady) {
    if (adx < 0) return;
    err = adx >> 1; n = adx;
    while (n > 0) {
      n--; p--;
      buf[p + 1] = col; buf[p + 2] = col; buf[p] = col; buf[p + 0x141] = col; buf[p - 0x13F] = col;
      err -= ady; if (err > 0) continue;
      err += adx; p += step;
    }
  } else {
    if (ady < 0) return;
    err = ady >> 1; n = ady;
    while (n > 0) {
      n--;
      buf[p] = col; buf[p + 1] = col; buf[p - 1] = col; buf[p + 0x140] = col; buf[p - 0x140] = col;
      err -= adx; p += step;
      if (err > 0) continue;
      p--; err += ady;
    }
  }
}

class Wire {
  constructor(files) {
    this.t = trig();
    const g = readGif(files["bump9.gif"]); this.gpal = g.pal;
    const L = loadScene(files["line3.3dm"], files, g.pal);
    this.ss = L.ss; this.objects = L.objects; this.materials = L.materials; this.root = linkObjects(this.objects);
    this.bufA = new Uint8Array(SIZE); this.bufB = new Uint8Array(SIZE);
    this.cur = this.bufA; this.other = this.bufB;                     // [0x44E38] / the buffer the filter writes into
    // the filter's lookup: two packed 7-bit intensities, each lowered by 5 (not below 0)
    this.lut = new Uint16Array(0x8000);
    for (let hi = 0; hi < 128; hi++) for (let lo = 0; lo < 256; lo++) this.lut[hi * 256 + lo] = (Math.max(hi - 5, 0) << 8) | Math.max(lo - 5, 0);
    // the filter's block table: 10 x 16 blocks of 20x20 pixels, each read from a position moved towards the centre (offset = -(row*320) - column)
    this.tab = new Int32Array(320); let q = 0, rowBase = 0;
    for (let k = -5; k < 5; k++, rowBase += 0x1900) for (let j = -7; j < 9; j++) { this.tab[q++] = rowBase + 20 * (j + 7); this.tab[q++] = -k * 320 - j; }
    this.shown = new Uint8Array(64000); this.pal = new Uint8Array(768); for (let i = 0; i < 768; i++) this.pal[i] = g.pal[i] >> 2;
    this.state = "wait"; this.tick = 0; this.frame = 0; this.done = false;
  }
  filter() {
    const src = this.cur, dst = this.other, lut = this.lut;
    for (let blk = 0; blk < 160; blk++) {
      const off1 = this.tab[2 * blk], off2 = this.tab[2 * blk + 1];
      let s = MARGIN + off1 + off2, d = MARGIN + off1;
      for (let r = 0; r < 20; r++, s += 300, d += 300) for (let c = 0; c < 10; c++, s += 2, d += 2) {
        const w = ((src[s] | src[s + 1] << 8) + (src[s - 0x13F] | src[s - 0x13E] << 8)) & 0xFFFF, v = lut[((w >> 1) & 0x7F7F)];
        dst[d] = v & 0xFF; dst[d + 1] = v >> 8;
      }
    }
    this.cur = dst; this.other = src;
  }
  step(sync) {
    const out = () => ({ frame: this.shown, pal: this.pal });
    if (this.state === "wait") { if (sync === 7) { this.state = "run"; this.tick = 0; } return out(); }
    this.tick++; const tick = this.tick;
    this.pal[0] = this.pal[1] = this.pal[2] = 0;
    this.shown.set(this.cur.subarray(MARGIN, MARGIN + 64000));
    const M = lookAt(this.ss, this.frame, this.t), c = this.ss.cur;
    const light = { x: (c.px + c.tx) | 0, y: (c.pz + c.tz) | 0, z: (c.py + c.ty) | 0 };
    for (const o of this.objects) o.local = objectMatrix(o, this.frame);
    setupHierarchy(this.root, M);
    const list = [], st = { light, zoff: 0, materials: this.materials };
    for (const o of this.objects) { prepare(o, st); collect(o, 0, list); }
    for (const e of sortList(list)) {
      const o = e.o, a = e.face * 0x18, i1 = o.f.getInt16(a, true) * 0x2E, i2 = o.f.getInt16(a + 2, true) * 0x2E, i3 = o.f.getInt16(a + 4, true) * 0x2E, fl = o.f.getUint8(a + 6), v = o.v;
      const x1 = v.getInt32(i1 + 0x10, true), y1 = v.getInt32(i1 + 0x14, true), x2 = v.getInt32(i2 + 0x10, true), y2 = v.getInt32(i2 + 0x14, true), x3 = v.getInt32(i3 + 0x10, true), y3 = v.getInt32(i3 + 0x14, true);
      if (fl & 4) line(this.cur, MARGIN, x1, y1, x2, y2, 0x7F);
      if (fl & 2) line(this.cur, MARGIN, x3, y3, x2, y2, 0x7F);
      if (fl & 1) line(this.cur, MARGIN, x1, y1, x3, y3, 0x7F);
    }
    this.filter();
    this.frame++;
    if (tick >= 0x672) this.done = true;
    return out();
  }
}
module.exports = { Wire, line };
