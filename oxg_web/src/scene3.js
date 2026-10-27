"use strict";
// The 3D scenes' frame loop (main routine 0x15BD0 for scenebis.3dm) and the engine's face drawing (0x14164).
const { trig } = require("./tables"), { readGif } = require("./gif"), { fadeTable } = require("./fade"), { loadScene } = require("./scene3d");
const { lookAt } = require("./camera"), { objectMatrix } = require("./objmat"), { setupHierarchy } = require("./hier"), { prepare } = require("./prepare");
const { collect, sortList } = require("./faces"), fill = require("./fill");
const fillTri = (env, kind, X, Y, ...rest) => { if (env.log) env.log.push([kind, X.slice(), Y.slice()]); fill.fillTri(env, kind, X, Y, ...rest); };

/** the loader's last step (0x13AD0..): parent pointers, first child / next sibling links; returns the root (first object without a parent) */
function linkObjects(objs) {
  let root = null;
  for (const o of objs) {
    o.child = o.sibling = null;
    if (o.parent === -1) { if (!root) root = o; o.parentObj = null; } else { o.parentObj = objs.find(p => p.id === o.parent); if (!o.parentObj) throw new Error("no parent " + o.parent); }
  }
  const append = (first, o) => { let l = first; while (l.sibling) l = l.sibling; l.sibling = o; };
  for (const o of objs) {
    if (o.parent !== -1) { const p = o.parentObj; if (!p.child) p.child = o; else append(p.child, o); }
    else if (o !== root) append(root, o);
  }
  return root;
}

/** 0x14164: draw the sorted face list into fb */
function drawFaces(env, list, materials) {
  const X = [0, 0, 0], Y = [0, 0, 0];
  for (const e of list) {
    const o = e.o, f = o.f, v = o.v, a = e.face * 0x18, i1 = f.getInt16(a, true), i2 = f.getInt16(a + 2, true), i3 = f.getInt16(a + 4, true), mt = materials[f.getInt16(a + 6, true)];
    const q1 = i1 * 0x2E, q2 = i2 * 0x2E, q3 = i3 * 0x2E;
    X[0] = v.getInt32(q1 + 0x10, true); X[1] = v.getInt32(q2 + 0x10, true); X[2] = v.getInt32(q3 + 0x10, true);
    Y[0] = v.getInt32(q1 + 0x14, true); Y[1] = v.getInt32(q2 + 0x14, true); Y[2] = v.getInt32(q3 + 0x14, true);
    if (!mt.tex) { fillTri(env, 0, X, Y, null, null, null, mt.index); continue; }
    env.tex = mt.tex;
    const U = [o.uv.getInt16(i1 * 4, true), o.uv.getInt16(i2 * 4, true), o.uv.getInt16(i3 * 4, true)], V = [o.uv.getInt16(i1 * 4 + 2, true), o.uv.getInt16(i2 * 4 + 2, true), o.uv.getInt16(i3 * 4 + 2, true)];
    if ((mt.flags & 3) === 2) fillTri(env, 2, X, Y, U, V, [v.getInt16(q1 + 0x2C, true) + 0x20, v.getInt16(q2 + 0x2C, true) + 0x20, v.getInt16(q3 + 0x2C, true) + 0x20], 0);
    else fillTri(env, 1, X, Y, U, V, null, 0);
  }
}

/** one frame of a 3D scene into env.fb for the animation frame `frame` */
function renderFrame(sc, env, frame) {
  const M = lookAt(sc.ss, frame, sc.t), c = sc.ss.cur;
  const light = { x: (c.px + c.tx) | 0, y: (c.pz + c.tz) | 0, z: (c.py + c.ty) | 0 };
  for (const o of sc.objects) o.local = objectMatrix(o, frame);
  setupHierarchy(sc.root, M);
  const list = [], st = { light, zoff: 0, materials: sc.materials };
  for (const o of sc.objects) { prepare(o, st); collect(o, sc.cfg.mode, list); }
  drawFaces(env, sortList(list), sc.materials);
}

// the ripple's tables: a triangular weight per row (200 values, peak 100) and per column (320 values, peak 160), and a sine of 1024 words (256 sin(pi k/128), truncated)
const tabA = Uint8Array.from({ length: 200 }, (_, i) => 100 - Math.abs(i - 100)), tabB = Uint8Array.from({ length: 320 }, (_, i) => 160 - Math.abs(i - 160));
const sine = Int16Array.from({ length: 1024 }, (_, k) => Math.trunc(Math.sin(k * Math.PI / 128 * (3.141592654 / Math.PI)) * 256));
const s16 = v => (v << 16) >> 16;
/** 0x100B5: every 2x2 block of dst is copied from src at an offset that depends on a sine of the row and of the column, scaled by amp and by triangular weights (zero at the edges) */
function ripple(dst, src, amp, ph, ph2) {
  for (let r = 0; r < 100; r++) {
    const w = s16(tabA[2 * r] * amp), s2 = s16(sine[(ph + 2 * r) & 0xFF] * amp);
    for (let c = 0; c < 160; c++) {
      const dx1 = (Math.imul(sine[ph2 + c], w)) >> 16, dx2 = (Math.imul(tabB[2 * c], s2)) >> 16;
      const pos = r * 640 + 2 * c, from = pos + s16(dx1 * 320 + dx2);
      dst[pos] = src[from]; dst[pos + 1] = src[from + 1]; dst[pos + 320] = src[from + 320]; dst[pos + 321] = src[from + 321];
    }
  }
}

class Scene3 {
  /** cfg: { gif, cpl, model, sync (music sync that starts it), ripple (tick the ripple starts), fadeOut (tick - 0x?? of the fade-out), end } */
  constructor(files, cfg) {
    this.cfg = cfg; this.t = trig();
    const g = readGif(files[cfg.gif]); this.gpal = g.pal;
    this.fade = fadeTable(null, g.pal);
    // the shade table is followed in memory by a 4-byte heap header and the fade table: a shade index beyond 63 (an interpolation that wrapped) reads those bytes
    this.cpl = new Uint8Array(0x4004 + this.fade.length); this.cpl.set(files[cfg.cpl].subarray(0, 0x4000)); this.cpl.set([0x0D, 0x10, 0x18, 0x0A], 0x4000); this.cpl.set(this.fade, 0x4004);
    const L = loadScene(files[cfg.model], files, g.pal);
    this.ss = L.ss; this.objects = L.objects; this.materials = L.materials; this.root = linkObjects(this.objects);
    this.fb = new Uint8Array(64000); this.back = new Uint8Array(64000); this.amp = 0; this.ph = 0; this.ph2 = 0; this.shown = new Uint8Array(64000); this.pal = new Uint8Array(768);
    this.env = { fb: this.fb, tex: null, cpl: this.cpl };
    this.waiting = cfg.sync != null; this.tick = 0; this.frame = 0; this.done = false;
  }
  setPalette(idx) { for (let i = 0; i < 768; i++) this.pal[i] = this.fade[idx * 768 + i] >> 2; }
  step(sync) {
    if (this.waiting) { if (sync === this.cfg.sync) { this.waiting = false; this.tick = 0; } return { frame: this.shown, pal: this.pal }; }
    this.tick++; const tick = this.tick;
    this.pal[0] = this.pal[1] = this.pal[2] = 0;
    if (tick < 0x3F) this.setPalette(tick);
    const late = tick > this.cfg.ripple;                               // after this tick the picture is drawn into a second buffer and rippled into the one shown
    if (late) { const j = tick - this.cfg.fadeOut; if (j >= 0 && j < 0x3F) this.setPalette(0x3F - j); this.shown.set(this.fb); this.back.fill(0); this.env.fb = this.back; }
    else { this.shown.set(this.fb); this.fb.fill(0); this.env.fb = this.fb; }
    renderFrame(this, this.env, this.frame);
    if (late) { ripple(this.fb, this.back, this.amp, this.ph, this.ph2); if (this.amp < 0x3F) this.amp++; }
    this.ph2 = (this.ph2 + 2) & 0xFF; this.ph = (this.ph + 1) & 0xFF;
    this.frame++;
    if (tick >= this.cfg.end || sync === this.cfg.endSync) this.done = true;
    return { frame: this.shown, pal: this.pal };
  }
}
const SCENEBIS = { gif: "scene2.gif", cpl: "scene2.cpl", model: "scenebis.3dm", sync: 3, ripple: 0x166C, fadeOut: 0x16F9, end: 0x173E, mode: 2 };
const CIRK4 = { gif: "ref01.gif", cpl: "ref01.cpl", model: "cirk4.3dm", sync: 5, ripple: 0x1784, fadeOut: 0x1811, end: 0x18E2, mode: 0 };
const POTO4 = { gif: "centre.gif", cpl: "centre.cpl", model: "poto4.3dm", sync: 8, ripple: Infinity, fadeOut: Infinity, end: 0xD20, mode: 2 };
const MEDUSE = { gif: "meduse.gif", cpl: "meduse.cpl", model: "meduse2.3dm", sync: null, endSync: 9, ripple: Infinity, fadeOut: Infinity, end: Infinity, mode: 0 };
module.exports = { MEDUSE, SCENEBIS, CIRK4, POTO4, Scene3, linkObjects, drawFaces, renderFrame };
