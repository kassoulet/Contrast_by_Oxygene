"use strict";
const path = require("path"), { load } = require("./vec"), { lookAt } = require("../src/camera"), { trig } = require("../src/tables");
const v = load(path.join(__dirname, "../../oxg_out/v_cam.bin")), m = v.before, a = v.after, SS = 0x6292C, frame = v.regs[3] & 0xFFFF;
const nrec = m.u16(SS), P = m.u32(SS + 4), T = m.u32(SS + 8), R = m.u32(SS + 0xC);
const arr3 = base => ({ x: Int32Array.from({ length: nrec }, (_, k) => m.i32(base + 0x2E * k)), z: Int32Array.from({ length: nrec }, (_, k) => m.i32(base + 0x2E * k + 4)), y: Int32Array.from({ length: nrec }, (_, k) => m.i32(base + 0x2E * k + 8)) });
const ss = { nrec, pos: arr3(P), tgt: arr3(T), roll: Int16Array.from({ length: nrec }, (_, k) => (m.u16(R + 2 * k) << 16) >> 16) };
const M = lookAt(ss, frame, trig());
let bad = 0; for (let i = 0; i < 16; i++) if (i % 4 !== 3 || i < 12) { if (i === 15) continue; if (M[i] !== a.i32(0x5A838 + 4 * i)) { bad++; console.log("m[" + i + "]", M[i], a.i32(0x5A838 + 4 * i)); } }
console.log("frame", frame, bad ? bad + " matrix elements differ" : "camera matrix identical to the original (15 elements)"); process.exit(bad ? 1 : 0);
