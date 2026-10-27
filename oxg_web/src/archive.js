// CONTRAST.BIN: 24-byte directory records (16-byte name, u32 offset, u32 size), data after 0xC00.
"use strict";
function parseArchive(buf) {            // buf: Uint8Array
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), files = {};
  for (let i = 0; i < 0xC00; i += 24) {
    let n = ""; for (let k = 0; k < 16 && buf[i + k]; k++) n += String.fromCharCode(buf[i + k]);
    if (!n) break; const off = dv.getUint32(i + 16, true), size = dv.getUint32(i + 20, true); files[n.toLowerCase()] = buf.subarray(off, off + size);
  }
  return files;
}
module.exports = { parseArchive };
