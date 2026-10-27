"use strict";
const path = require("path"), { load } = require("./vec"), { sortList } = require("../src/faces");
const v = load(path.join(__dirname, "../../oxg_out/v_sort.bin")), m = v.before, a = v.after, n = m.u32(0x593B0), list = [];
for (let i = 0; i < n; i++) list.push({ ptr: m.u32(0x4CC5C + 10 * i), key: m.u16(0x4CC60 + 10 * i) });
const got = sortList(list).map(e => e.ptr), want = [];
for (let h = 0; h < 256; h++) for (let p = a.u32(0x4C85C + 4 * h); p; p = a.u32(p + 6)) want.push(a.u32(p));
let bad = got.length !== want.length ? 1 : 0; for (let i = 0; i < want.length; i++) if (got[i] !== want[i]) bad++;
console.log("depth sort of", n, "faces:", bad ? bad + " differences" : "identical order"); process.exit(bad ? 1 : 0);
