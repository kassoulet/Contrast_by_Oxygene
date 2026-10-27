"use strict";
// The greetings scene (main routine 0x184A0): ten glowing blobs orbiting behind the GREETS lettering, then two dissolves (final.gif appears, then disappears) driven by the pixel values of fond7.gif and fond3.gif.
const { trig } = require("./tables"), { readGif } = require("./gif"), { fadeTable } = require("./fade");

/** the 96x96 glow sprite (0x1859D): a float32 profile of the distance to the centre, truncated to a byte */
function makeSprite() {
  const f = Math.fround, spr = new Uint8Array(96 * 96); let o = 0;
  for (let y = -48; y < 48; y++) for (let x = -48; x < 48; x++) {
    const d = f(Math.sqrt(x * x + y * y)), q = f(d / 47);
    let v;
    if (d < f(15.666666984558105)) v = f((1 - q * q * 3) * 50);
    else if (d > 47) v = 0;
    else v = f((1 - q) * (1 - q) * 75);
    spr[o++] = Math.trunc(v) & 0xFF;
  }
  return spr;
}
/** per value 0..255 the list of pixel offsets whose value is that (0x186E7): the order in which a dissolve touches the screen */
function groups(map) {
  const g = Array.from({ length: 256 }, () => []);
  for (let i = 0; i < 64000; i++) g[map[i]].push(i);
  return g;
}
// the ten blobs: four phase accumulators (p0..p3) with their steps, from the data section at 0x3028C
const BLOBS = [[0, 0, 1, 2, 0, 0, 2, 1], [100, 1000, 4, 3, 100, 1000, 8, 2], [200, 2000, -10, -2, 200, 2000, -8, -3], [300, 3000, 5, 1, 300, 3000, -4, -2], [400, 4000, 6, -4, 400, 4000, 5, -2],
  [500, 5000, 7, 5, 500, 5000, 10, 4], [600, 6000, 8, 6, 600, 6000, 9, -3], [700, 7000, 9, 7, 700, 7000, 4, 2], [800, 8000, 10, 1, 800, 8000, -1, -4], [900, 9000, 0, -2, 900, 9000, 2, 0]];

class Greets {
  constructor(files) {
    this.t = trig();
    const g = readGif(files["greets.gif"]); this.img = g.pix; const pal = g.pal.slice(); pal[0] = pal[1] = pal[2] = 0;
    this.fade = fadeTable(null, pal);
    this.spr = makeSprite();
    this.final = readGif(files["final.gif"]); this.g1 = groups(readGif(files["fond7.gif"]).pix); this.g2 = groups(readGif(files["fond3.gif"]).pix);
    this.fb = new Uint8Array(64000); this.dv = new DataView(this.fb.buffer); this.shown = new Uint8Array(64000); this.pal = new Uint8Array(768);
    this.blobs = BLOBS.map(b => Int32Array.from(b)); this.state = "wait"; this.tick = 0; this.group = 0; this.done = false;
  }
  setPalette(table, idx) { for (let i = 0; i < 768; i++) this.pal[i] = table[idx * 768 + i] >> 2; }
  drawBlob(b) {
    const t = this.t, dv = this.dv;
    const y = (Math.imul((t.sin[b[4] & 0xFFF] + t.sin[b[5] & 0xFFF]) | 0, 0x34)) >> 16, x = (Math.imul((t.cos[b[0] & 0xFFF] + t.cos[b[1] & 0xFFF]) | 0, 0x70)) >> 16;
    let a = x + 0x70 + (y + 0x34) * 320, s = 0;
    for (let r = 0; r < 96; r++, a += 320) for (let d = 0; d < 24; d++, s += 4) {
      const p = a + 4 * d; if (p < 0 || p + 4 > 64000) continue;
      dv.setUint32(p, (dv.getUint32(p, true) + (this.spr[s] | this.spr[s + 1] << 8 | this.spr[s + 2] << 16 | this.spr[s + 3] << 24)) >>> 0, true);
    }
  }
  reveal(list, erase) { const src = this.final.pix; for (const p of list) this.fb[p] = erase ? 0 : src[p]; }
  step(sync) {
    const out = () => ({ frame: this.shown, pal: this.pal });
    if (this.state === "wait") { if (sync === 4) { this.state = "A"; this.tick = 0; } return out(); }
    if (this.state === "gap") { if (--this.gap === 0) { this.state = "C"; this.tick = 0; this.group = 0; } return out(); }
    this.tick++; const tick = this.tick;
    if (this.state === "A") {
      this.pal[0] = this.pal[1] = this.pal[2] = 0;
      if (tick <= 0x3F) this.setPalette(this.fade, tick);
      const j = tick - 0x690; if (j >= 0 && j <= 0x3F) this.setPalette(this.fade, 0x3F - j);
      this.shown.set(this.fb); this.fb.fill(0);
      for (const b of this.blobs) this.drawBlob(b);
      for (let y = 0; y < 200; y++) for (let x = 0; x < 128; x++) { const p = this.img[y * 128 + x]; if (p) this.fb[y * 320 + 0x60 + x] = p; }
      for (const b of this.blobs) { b[0] += b[2]; b[1] += b[3]; b[4] += b[6]; b[5] += b[7]; }
      if (tick >= 0x6D6) this.state = "Bhead";
      return out();
    }
    if (this.state === "Bhead") {            // the tick after the scene: black screen, the picture's palette, counters reset
      this.shown.fill(0); this.fb.fill(0); this.pal.set(this.final.pal.map(v => v >> 2)); this.state = "B"; this.tick = 0; this.group = 0; return out();
    }
    this.pal[0] = this.pal[1] = this.pal[2] = 0;
    this.shown.set(this.fb);
    if (this.state === "B") {
      if (tick < 0x104) { this.reveal(this.g1[this.group & 0xFF], false); this.group++; }
      if (tick >= 0x100) { this.state = "gap"; this.gap = 11; }   // building the second dissolve's tables takes about 11 ticks of the original's time; the screen stays as it is
      return out();
    }

    if (tick > 0x226) { this.reveal(this.g2[this.group & 0xFF], true); this.group++; }
    if (tick >= 0x326) this.done = true;
    return out();
  }
}
module.exports = { Greets, makeSprite };
