"use strict";
const { load } = require("./vec"), { bumpFrame } = require("../src/bump"), { trig } = require("../src/tables");
const v = load(require("path").join(__dirname, "../../oxg_out/vec_bump_a.bin")), m = v.before;
const buf = m.u32(0x44E38), u16 = (a, n) => { const b = m.bytes(a, 2 * n), r = new Uint16Array(n); for (let i = 0; i < n; i++) r[i] = b.readUInt16LE(2 * i); return r; };
const disp = u16(m.u32(0x4C82C), 65536), height = Uint8Array.from(m.bytes(m.u32(0x4C794), 65536)), env = Uint8Array.from(m.bytes(m.u32(0x4C820), 65536));
const lut = Uint8Array.from(m.bytes(m.u32(0x4C7F4), 65536)), out = Uint8Array.from(m.bytes(buf, 64000));
bumpFrame(out, disp, height, env, lut, { trig: trig(), angle: m.i32(0x4C784), o8c: m.i32(0x3008C), o90: m.i32(0x30090), p130: m.i32(0x30130), p134: m.i32(0x30134) });
const want = v.after.bytes(buf, 64000); let bad = 0; for (let i = 0; i < 64000; i++) if (out[i] !== want[i]) bad++;
console.log(bad ? "bump: " + bad + " bytes differ" : "bump: identical to the original (64000 bytes)"); process.exit(bad ? 1 : 0);
