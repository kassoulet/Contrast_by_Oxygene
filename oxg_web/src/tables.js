// Tables the program builds at start-up (0x107AC) and the intro's polar map (0x11864).
"use strict";
/** 4096-step circle: cos/sin scaled by 32768 and truncated toward zero (the FPU is put in truncating mode by Watcom's __CHP), and trunc(sqrt(i)). */
function trig() {
  const cos = new Int32Array(4096), sin = new Int32Array(4096), sqrt = new Uint16Array(4096);
  for (let i = 0; i < 4096; i++) {
    const a = (2 * i) * 3.141592654 * 0.000244140625;
    cos[i] = Math.trunc(Math.cos(a) * 32768); sin[i] = Math.trunc(Math.sin(a) * 32768); sqrt[i] = Math.trunc(Math.sqrt(i));
  }
  return { cos, sin, sqrt };
}
/** The intro swirl's map: a 256x256 grid of u16 entries, each (radius-dependent texture row << 8) + a column that follows the angle; later radii overwrite earlier ones. */
function polarMap(t) {
  const map = new Uint16Array(65536); let d = 10;
  for (let r = 0; r < 180; r++, d++) {
    for (let a = 0; a < 4096; a++) {
      const x = (((t.cos[a] * 2 * r) >> 16) + 0x80), y = (((t.sin[a] * 2 * r) >> 16) + 0x80);   // (the products stay below 2^31 for r < 180)
      if (x < 0 || x > 255 || y < 0 || y > 255) continue;
      const q = Math.trunc(4000 / d);
      map[(y << 8) + x] = ((q << 8) + ((((q >> 1) & 0xFF) + (a >> 4)) & 0xFF)) & 0xFFFF;
    }
  }
  return map;
}
module.exports = { trig, polarMap };
