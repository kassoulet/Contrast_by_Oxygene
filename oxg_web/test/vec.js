// Test vectors captured from the real program (oxg_tools/capture_fn.py): the data and heap memory before and after one routine ran.
"use strict";
const fs = require("fs");
function load(path) {
  const b = fs.readFileSync(path), hl = b.readUInt32LE(0), hdr = JSON.parse(b.slice(4, 4 + hl).toString());
  let p = 4 + hl; const regions = hdr.regions.map(([addr, len]) => ({ addr, len })), before = [], after = [];
  for (const r of regions) { before.push(b.slice(p, p + r.len)); p += r.len; }
  for (const r of regions) { after.push(b.slice(p, p + r.len)); p += r.len; }
  const view = arr => ({
    find(addr, n) { for (let i = 0; i < regions.length; i++) if (addr >= regions[i].addr && addr + n <= regions[i].addr + regions[i].len) return [arr[i], addr - regions[i].addr]; throw new Error("address 0x" + addr.toString(16) + " not captured"); },
    u8(a) { const [m, o] = this.find(a, 1); return m[o]; },
    u16(a) { const [m, o] = this.find(a, 2); return m.readUInt16LE(o); },
    u32(a) { const [m, o] = this.find(a, 4); return m.readUInt32LE(o); },
    i32(a) { const [m, o] = this.find(a, 4); return m.readInt32LE(o); },
    bytes(a, n) { const [m, o] = this.find(a, n); return m.subarray(o, o + n); },
  });
  return { regs: hdr.regs, rregs: hdr.rregs, ret: hdr.ret, before: view(before), after: view(after) };
}
module.exports = { load };
