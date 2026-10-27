// Scene 1 of CONTRAST: the swirl and the OXYGENE lettering (main routine 0x11720 of CONTRAST.EXE).
"use strict";
const { trig, polarMap } = require("./tables"), { swirl } = require("./swirl"), { readGif } = require("./gif"), { fadeTable } = require("./fade");

// the script tables from the program's data (0x3009A..0x300EE): per state a record of three i16
const REC = [-1, 6, 0, 512, 6, 512, 256, 8, 0, 512, 6, 0, 512, -10, 0, 256, 6, 256, -512, 8, -512, -256, 6, -512, -256, 0, 0, -512, 0, 0, -512, 0, 0];
const REVEAL = [[0, 0], [68, 50], [104, 50], [140, 50], [192, 50], [224, 50], [272, 50], [320, 50], [320, 86]];   // (bytes per row, rows) of the lettering shown for 0..8 letters

class Intro {
  /** @param files archive files by name; the palettes textdeb*.bin and images textdeb5.gif / oxygene.gif are read here */
  constructor(files) {
    this.t = trig(); this.map = polarMap(this.t);
    const g = readGif(files["textdeb5.gif"]); this.tex = g.pix; const pal5 = g.pal;
    const o = readGif(files["oxygene.gif"]); this.img = o.pix; this.mask = new Uint8Array(o.pix.length); for (let i = 0; i < o.pix.length; i++) this.mask[i] = o.pix[i] === 0 ? 0xFF : 0;
    const p = n => files[n];       // 768-byte palettes
    // fade tables: [4C7B0]<-textdeb.bin [4C7D4]<-textdeb2 [4C7D0]<-textdeb3 [4C7DC]<-textdeb4 [4C7D8]<-textdeb5.gif palette [4C7E4]<-textdeb6 [4C7E0]<-textdeb7
    this.fade = { b0: fadeTable(null, p("textdeb.bin")), d4: fadeTable(null, p("textdeb2.bin")), d0: fadeTable(null, p("textdeb3.bin")), dc: fadeTable(null, p("textdeb4.bin")), d8: fadeTable(null, pal5), e4: fadeTable(null, p("textdeb6.bin")), e0: fadeTable(null, p("textdeb7.bin")) };
    this.buf = new Uint8Array(64000); this.pal = new Uint8Array(768);       // back buffer and the DAC (6-bit components)
    this.tick = 0; this.prevSync = -1; this.p94 = 0; this.p96 = 0; this.state = 0; this.angle = 0; this.s = { a: 0, b: 0, off: 0, o98: 0, o9c: 0 };
    this.shown = new Uint8Array(64000); this.done = false; this.first = true;
  }
  setPalette(table, idx) { for (let i = 0; i < 768; i++) this.pal[i] = table[idx * 768 + i] >> 2; }
  /** one loop iteration = one displayed tick; `sync` is the music's sync value for this tick.  Returns { frame, pal } as shown during the tick. */
  step(sync) {
    this.tick++;                                                        // the wait for the next tick (0x102CB)
    this.pal[0] = this.pal[1] = this.pal[2] = 0;                        // DAC colour 0 := black
    const st0 = this.state;
    if (this.prevSync === 1 && sync === 0) { this.tick = 0; this.state++; }
    this.prevSync = sync;
    const tick = this.tick, state = this.state, half = tick >> 1;
    if (tick < 0x7F) {
      const F = this.fade;
      if (state === 0) this.setPalette(F.b0, half); else if (state === 1) this.setPalette(F.d4, half); else if (state === 2) this.setPalette(F.e4, half);
      else if (state === 3) this.setPalette(F.dc, half); else if (state === 4) this.setPalette(F.d8, half); else if (state === 5) this.setPalette(F.d0, half);
      else if (state === 6) this.setPalette(F.e0, half); else if (state === 7) this.setPalette(F.b0, half); else if (state === 8) this.setPalette(F.e4, half);
      else if (state === 9) this.setPalette(F.e4, (0x7E - tick) >> 1);
    }
    this.shown.set(this.buf);                                           // 0x10450: the previous frame's back buffer is copied to the screen
    const c = this.t.cos[this.angle & 0xFFF], sn = this.t.sin[this.angle & 0xFFF], s = this.s;
    s.b = (sn << 9); s.off = (this.p96 & 0xFF00) | ((this.p94 >> 8) & 0xFF); s.a = (c << 9);
    s.a = Math.trunc(s.a / 325); s.b = Math.trunc(s.b / 325);
    s.o9c = (0x800000 - s.a * 100) | 0; s.o98 = (0x800000 + s.b * 100) | 0;
    swirl(this.buf, this.map, this.tex, Object.assign(s, { variant: [0, 3, 1, 3, 0, 2, 3, 1][state] ?? 0 }));
    if (state < 9) {
      const [w, h] = REVEAL[Math.min(state, 8)];
      for (let y = 0; y < h; y++) { const o = 0x4740 + y * 320; for (let x = 0; x < w; x++) this.buf[o + x] = (this.buf[o + x] & this.mask[y * 320 + x]) | this.img[y * 320 + x]; }
    } else for (let y = 0; y < 200; y++) { this.buf.fill(0, y * 320, y * 320 + 32); this.buf.fill(0, y * 320 + 288, y * 320 + 320); }
    const n = 1;                                                          // updates per tick (always one on a machine fast enough)
    for (let k = 0; k < n; k++) {
      const r = (REC[3 * this.state + 1]), dx = REC[3 * this.state + 2], ax = REC[3 * this.state + 3] ?? 0;
      this.angle = (this.angle + r) | 0; this.p94 = (this.p94 + dx) << 16 >> 16; this.p96 = (this.p96 - ax) << 16 >> 16;
    }
    if (this.state === 9 && this.tick >= 0x7F) this.done = true;
    return { frame: this.shown, pal: this.pal };
  }
}
module.exports = { Intro };
