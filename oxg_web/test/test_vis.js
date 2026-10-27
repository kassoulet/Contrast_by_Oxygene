"use strict";
const path = require("path"), { load } = require("./vec"), { culled } = require("../src/prepare");
const v = load(path.join(__dirname, "../../oxg_out/v_vis.bin")), m = v.before, P = v.regs[0], zoff = (m.u16(0x5A878) << 16) >> 16;
const o = { sx: m.i32(P + 0x106), sy: m.i32(P + 0x10A), sz: m.i32(P + 0x10E), radius: m.u16(P + 0xF0) };
const got = culled(o, zoff), want = v.rregs[0];
console.log("visibility test:", got === want ? "identical (" + (want ? "culled" : "visible") + ")" : "differs: " + got + " vs " + want); process.exit(got === want ? 0 : 1);
