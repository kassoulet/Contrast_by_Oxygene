// GIF reader that returns the colour indices and the palette exactly as stored (8 bits per channel).
"use strict";
function readGif(b) {
  const w = b[6] | b[7] << 8, h = b[8] | b[9] << 8, flags = b[10], pal = new Uint8Array(768); let p = 13;
  if (flags & 0x80) { const n = 3 * (2 << (flags & 7)); pal.set(b.subarray(p, p + n)); p += n; }
  for (;;) { const t = b[p++]; if (t === 0x2C) break; if (t !== 0x21) throw new Error("GIF block"); p++; while (b[p]) p += b[p] + 1; p++; }
  const iw = b[p + 4] | b[p + 5] << 8, ih = b[p + 6] | b[p + 7] << 8, f2 = b[p + 8]; p += 9;
  if (f2 & 0x80) { const n = 3 * (2 << (f2 & 7)); pal.set(b.subarray(p, p + n)); p += n; }
  const mcs = b[p++]; const data = []; while (b[p]) { for (let i = 1; i <= b[p]; i++) data.push(b[p + i]); p += b[p] + 1; }
  const clear = 1 << mcs, eoi = clear + 1, out = new Uint8Array(iw * ih); let size = mcs + 1, bits = 0, nb = 0, o = 0;
  const prefix = new Int32Array(4096), suffix = new Uint8Array(4096), first = new Uint8Array(4096), len = new Int32Array(4096); let next = eoi + 1, prev = -1;
  for (let i = 0; i < clear; i++) { suffix[i] = i; first[i] = i; len[i] = 1; prefix[i] = -1; }
  const emit = code => { let n = len[code], q = o + n - 1; for (let c = code; c >= 0 && q >= o; c = prefix[c]) out[q--] = suffix[c]; o += n; };
  for (const byte of data) {
    bits |= byte << nb; nb += 8;
    while (nb >= size) {
      const code = bits & ((1 << size) - 1); bits >>= size; nb -= size;
      if (code === clear) { next = eoi + 1; size = mcs + 1; prev = -1; continue; }
      if (code === eoi) return { w: iw, h: ih, pix: out, pal };
      if (prev < 0) { if (o < out.length) emit(code); prev = code; continue; }
      if (code < next) { if (o + len[code] <= out.length) emit(code); prefix[next] = prev; suffix[next] = first[code]; }
      else { prefix[next] = prev; suffix[next] = first[prev]; if (o + len[prev] + 1 <= out.length) emit(prev), out[o++] = first[prev]; }
      first[next] = first[prev]; len[next] = len[prev] + 1; next++; if (next === (1 << size) && size < 12) size++; prev = code;
    }
  }
  return { w: iw, h: ih, pix: out, pal };
}
module.exports = { readGif };
