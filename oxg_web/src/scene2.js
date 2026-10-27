// Scene 2 of CONTRAST: the water floor with the credit labels (main routine 0x127F0 of CONTRAST.EXE).
"use strict";
const { trig } = require("./tables"), { readGif } = require("./gif"), { fadeTable } = require("./fade"), { bumpFrame, bumpTable } = require("./bump");

class Scene2 {
  /** @param files archive files; @param G the globals the previous scene leaves behind: { angle, o8c, o90 } */
  constructor(files, G) {
    this.t = trig();
    const bump = readGif(files["bump2.gif"]); this.height = bump.pix; this.env = readGif(files["bumpecla.gif"]).pix;
    this.lut = new Uint8Array(65536); this.lut.set(files["cpalcred.bin"]);
    this.disp = bumpTable(bump.pix, bump.pal, this.t);
    const pal = n => files[n]; this.logos = [readGif(files["oxbab.gif"]).pix, readGif(files["spiral.gif"]).pix, readGif(files["mon.gif"]).pix, readGif(files["clawz.gif"]).pix];
    this.fade = { a: fadeTable(null, bump.pal), b: fadeTable(bump.pal, pal("bump3.bin")), c: fadeTable(pal("bump3.bin"), pal("bump4.bin")), d: fadeTable(pal("bump4.bin"), pal("bump5.bin")), e: fadeTable(pal("bump5.bin"), null) };
    this.buf = new Uint8Array(64000); this.shown = new Uint8Array(64000); this.pal = new Uint8Array(768);       // black screen until the music's sync 15
    this.s = { trig: this.t, angle: G.angle | 0, o8c: G.o8c | 0, o90: G.o90 | 0, p130: 0, p134: 0 };
    this.waiting = true; this.tick = 0; this.state = -1; this.prevSync = 0; this.label = 0; this.done = false;
  }
  setPalette(table, idx) { for (let i = 0; i < 768; i++) this.pal[i] = table[idx * 768 + i] >> 2; }
  step(sync) {
    if (this.waiting) { if (sync === 0xF) { this.waiting = false; this.tick = 0; } return { frame: this.shown, pal: this.pal }; }   // spin on the music; the loop proper starts at the next tick
    this.tick++; this.pal[0] = this.pal[1] = this.pal[2] = 0;
    const F = this.fade, tick = this.tick, st = this.state;
    if (st === -1 && tick < 0x40) this.setPalette(F.a, tick); if (st === 1 && tick < 0x40) this.setPalette(F.b, tick);
    if (st === 2 && tick < 0x40) this.setPalette(F.c, tick); if (st === 3 && tick < 0x40) this.setPalette(F.d, tick);
    if (st === 4 && tick < 0xFD) this.setPalette(F.e, tick >> 2);
    this.shown.set(this.buf);
    bumpFrame(this.buf, this.disp, this.height, this.env, this.lut, this.s);
    if (this.prevSync === 2 && sync === 0) { this.tick = 0; this.state++; this.label = 1; }
    if (this.prevSync === 3 && sync === 0) this.label = 0;
    this.prevSync = sync;
    if (this.label === 0) { for (let y = 0; y < 32; y++) this.buf.fill(0, 0xD320 + y * 320, 0xD320 + y * 320 + 32); }
    else if (this.state !== 4) {
      const src = this.logos[this.state === 0 ? 0 : this.state === 1 ? 1 : this.state === 2 ? 2 : 3];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 160; x++) { const p = src[y * 160 + x]; if (p) this.buf[0xD2A0 + y * 320 + x] = p; }
    }
    const s = this.s; s.angle = (s.angle + 3) | 0; s.o8c = (s.o8c + 0x8000) | 0; s.o90 = (s.o90 + 0x4000) | 0; s.p130 = (s.p130 + 14) | 0; s.p134 = (s.p134 + 18) | 0;
    if (this.state === 4 && this.tick >= 0xFD) this.done = true;
    return { frame: this.shown, pal: this.pal };
  }
}
module.exports = { Scene2 };
