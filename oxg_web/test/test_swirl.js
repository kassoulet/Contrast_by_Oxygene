"use strict";
const { load } = require("./vec"), { swirl } = require("../src/swirl");
const v = load(process.argv[2] || require("path").join(__dirname, "../../oxg_out/vec_swirl_a.bin")), m = v.before;
const buf = m.u32(0x44E38), mapAddr = m.u32(0x4C7A0), texAddr = m.u32(0x4C794);
const map = new Uint16Array(65536); { const b = m.bytes(mapAddr, 131072); for (let i = 0; i < 65536; i++) map[i] = b.readUInt16LE(2 * i); }
const tex = Uint8Array.from(m.bytes(texAddr, 65536)), out = Uint8Array.from(m.bytes(buf, 64000));
const s = { a: m.i32(0x4C780), b: m.i32(0x4C7A8), off: m.u16(0x4C7EC), o98: m.i32(0x4C798), o9c: m.i32(0x4C79C) };
swirl(out, map, tex, s);
const want = v.after.bytes(buf, 64000); let bad = 0; for (let i = 0; i < 64000; i++) if (out[i] !== want[i]) bad++;
const ok = bad === 0 && s.o98 === v.after.i32(0x4C798) && s.o9c === v.after.i32(0x4C79C);
console.log(ok ? "swirl: identical to the original (64000 bytes + state)" : "swirl: MISMATCH " + bad + " bytes, o98 " + s.o98 + " vs " + v.after.i32(0x4C798));
process.exit(ok ? 0 : 1);
