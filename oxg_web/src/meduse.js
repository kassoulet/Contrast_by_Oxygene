"use strict";
// The last scene (main routine 0x16CF0): the jellyfish (meduse2.3dm) until the music's sync 9, then three title strips (contr, oxyge, tank) shown one per sync and a fade to black.
const { Scene3, MEDUSE } = require("./scene3"), { readGif } = require("./gif"), { fadeTable } = require("./fade");
class Meduse {
  constructor(files) {
    this.s3 = new Scene3(files, MEDUSE);
    const oxyge = readGif(files["oxyge.gif"]); this.pal8 = oxyge.pal;                          // the palette of the last picture loaded with one
    this.strips = { contr: readGif(files["contr.gif"]).pix, oxyge: oxyge.pix, tank: readGif(files["tank.gif"]).pix };
    this.fb = new Uint8Array(64000); this.shown = new Uint8Array(64000); this.pal = new Uint8Array(768);
    this.state = "run"; this.done = false; this.n = 0;
  }
  strip(name) { this.fb.set(this.strips[name].subarray(0, 10240), 0x6900); }
  step(sync) {
    const out = () => ({ frame: this.shown, pal: this.pal });
    if (this.state === "run") {
      const r = this.s3.step(sync);
      this.shown = r.frame; this.pal = r.pal;
      if (this.s3.done) { this.pal = new Uint8Array(768); this.fb.fill(0); this.strip("contr"); this.state = "p1"; }   // black palette, the first strip is put on the screen buffer
      return out();
    }
    const wait = (want, next, fn) => { if (sync === want) { fn(); this.state = next; } };
    switch (this.state) {
      case "p1": this.shown = Uint8Array.from(this.fb); this.pal = Uint8Array.from(this.pal8, v => v >> 2); this.state = "w10"; break;
      case "w10": wait(0xA, "p2", () => this.strip("oxyge")); break;
      case "p2": this.shown = Uint8Array.from(this.fb); this.state = "w11"; break;
      case "w11": wait(0xB, "p3", () => this.strip("tank")); break;
      case "p3": this.shown = Uint8Array.from(this.fb); this.fade = fadeTable(this.pal8, null); this.state = "w12"; break;
      case "w12": wait(0xC, "fade", () => { this.n = 0; }); break;
      case "fade": { const idx = Math.min(this.n >> 1, 0x3F); for (let i = 0; i < 768; i++) this.pal[i] = this.fade[idx * 768 + i] >> 2; if (++this.n >= 0x80) this.state = "w13"; break; }
      case "w13": if (sync === 0xD) this.done = true; break;
    }
    return out();
  }
}
module.exports = { Meduse };
