"use strict";
const path = require("path"), { load } = require("./vec"), { collect, sortList } = require("../src/faces"), { memObj } = require("./memobj");
const v = load(path.join(__dirname, "../../oxg_out/v_collect.bin")), m = v.before, a = v.after, P = v.regs[0], mode = v.regs[3] & 0xFFFF;
const o = memObj(m, P); o.visible = m.u16(P + 0x126) ? 1 : 0;
const n0 = m.u32(0x593B0), list = []; collect(o, mode, list);
const n1 = a.u32(0x593B0); let bad = 0;
if (n1 - n0 !== list.length) { bad++; console.log("count", list.length, n1 - n0); }
const F = m.u32(P + 0xC);
for (let i = 0; i < Math.min(list.length, n1 - n0); i++) {
  const e = 0x4CC5C + 10 * (n0 + i), ptr = a.u32(e), key = a.u16(e + 4), face = (ptr - F) / 0x18;
  if (face !== list[i].face || key !== list[i].key) { if (bad++ < 5) console.log("entry", i, "face", list[i].face, face, "key", list[i].key, key); }
}
console.log("collect (mode " + mode + ", " + o.nf + " faces):", bad ? bad + " differences" : list.length + " faces listed, identical to the original"); process.exit(bad ? 1 : 0);
