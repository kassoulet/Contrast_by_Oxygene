// Reader for the compressed frame files written by oxg_tools/export_rec2.py ('RAWZ'): records are decompressed block by block on access.
"use strict";
const fs = require("fs"), zlib = require("zlib");
const R = 8 + 64000 + 768 + 0x120;
function loadRec(path) {
  const b = fs.readFileSync(path), n = b.readUInt32LE(4), B = b.readUInt32LE(8), nb = b.readUInt32LE(12), off = [];
  let p = 16 + 4 * nb; for (let i = 0; i < nb; i++) { off.push([p, b.readUInt32LE(16 + 4 * i)]); p += b.readUInt32LE(16 + 4 * i); }
  let cacheK = -1, cache = null;
  const rec = i => {
    const k = Math.floor(i / B); if (k !== cacheK) { cache = zlib.inflateSync(b.subarray(off[k][0], off[k][0] + off[k][1])); cacheK = k; }
    const o = (i - k * B) * R;
    return { t: cache.readDoubleLE(o), frame: cache.subarray(o + 8, o + 8 + 64000), pal: cache.subarray(o + 8 + 64000, o + 8 + 64000 + 768), g: cache.subarray(o + 8 + 64000 + 768, o + R) };
  };
  return new Proxy({ length: n }, { get: (t, k) => k === "length" ? n : rec(+k) });   // recs[i] (valid until the block changes)
}
const sync = r => r.g.readInt32LE(0xE0 + 0x14), row = r => r.g.readUInt32LE(0xE0 + 8), order = r => r.g.readUInt32LE(0xE0), pattern = r => r.g.readUInt32LE(0xE0 + 4);
module.exports = { loadRec, sync, row, order, pattern };
