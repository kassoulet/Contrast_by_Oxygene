"use strict";
// Fillers against the real program: the framebuffer after one call (flat 0x180D0, textured 0x1716F, shaded 0x17855), from the same vertex globals.
const path = require("path"), { load } = require("./vec"), { fillTri } = require("../src/fill");
const kinds = { flat: 0, tex: 1, shade: 2 };
let bad = 0;
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(kinds)) {
  let v; try { v = load(path.join(__dirname, "../../oxg_out/v_" + name + ".bin")); } catch (e) { console.log(name, "no vector"); continue; }
  const m = v.before, a = v.after, kind = kinds[name], g = k => m.i32(0x5A7F4 + 4 * k);
  const X = [m.i32(0x5A804), m.i32(0x5A808), m.i32(0x5A80C)], Y = [m.i32(0x5A81C), m.i32(0x5A820), m.i32(0x5A824)];
  const U = [m.i32(0x5A828), m.i32(0x5A82C), m.i32(0x5A830)], V = [m.i32(0x5A7F4), m.i32(0x5A7F8), m.i32(0x5A7FC)], S = [m.i32(0x5A818), m.i32(0x5A810), m.i32(0x5A814)];
  const fbp = m.u32(0x44E38), fb = Uint8Array.from(m.bytes(fbp, 64000)), env = { fb, tex: kind ? m.bytes(m.u32(0x5A7A0), 65536) : null, cpl: kind === 2 ? m.bytes(m.u32(0x4C7F4), 16384) : null };
  fillTri(env, kind, X, Y, U, V, S, m.u32(0x5A834));
  const want = a.bytes(fbp, 64000); let d = 0, first = -1; for (let i = 0; i < 64000; i++) if (fb[i] !== want[i]) { if (first < 0) first = i; d++; }
  const changed = fb.reduce((s, x, i) => s + (x !== m.bytes(fbp, 64000)[i]), 0);
  console.log(name, "X", X.join(), "Y", Y.join(), "->", d ? d + " pixels differ, first " + first + " (" + (first % 320) + "," + Math.floor(first / 320) + ")" : "identical (" + changed + " pixels drawn)"); bad += d ? 1 : 0;
}
process.exit(bad ? 1 : 0);
