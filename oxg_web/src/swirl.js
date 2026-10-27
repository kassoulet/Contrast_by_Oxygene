// The opening scene's swirl: a rotating/zooming lookup of a 64K texture through a 64K-entry polar map (routine 0x11FB7 of CONTRAST.EXE; 0x12141 is the same with other
// patched constants).  Pixel-exact port: 256x200 pixels written right to left, bottom to top, four pixels per dword, two rows per computed row.
"use strict";
/**
 * @param {Uint8Array} out   64000-byte frame buffer (320 wide)
 * @param {Uint16Array} map  65536 entries: (u<<8 | v) -> texture offset
 * @param {Uint8Array} tex   65536-byte texture
 * @param {{a:number,b:number,off:number,o98:number,o9c:number,variant:number}} s  a = [4C780], b = [4C7A8], off = [4C7EC], o98 = [4C798], o9c = [4C79C] (updated in place)
 */
function swirl(out, map, tex, s) {
  const A = s.a | 0, B = s.b | 0, off = s.off & 0xFFFF;
  const variant = s.variant | 0;                                       // 0: 0x11FB7, 1: 0x12141 (no u step from B), 2: 0x122CD (adds the position), 3: 0x12459 / 0x1261E (adds the position and a per-pixel shear)
  const As = variant === 2 ? 0 : A;                                     // 0x122CD clears ebx first: the step has no A part
  const step = (((As << 16) | (variant === 1 ? 0 : ((B >>> 8) & 0xFFFF))) >>> 0), ah = (As >>> 16) & 0xFF;
  let esi = 0xF9E0;
  for (let row = 0; row < 100; row++) {
    const Q = (s.o9c - (B << 7)) | 0, P = (s.o98 - (A << 7)) | 0;
    s.o98 = (s.o98 - (B << 1)) | 0; s.o9c = (s.o9c + (A << 1)) | 0;
    let ecx = (((P << 16) | ((Q >>> 8) & 0xFFFF)) >>> 0), al = (P >>> 16) & 0xFF;
    let count = 0;
    for (let g = 0; g < 64; g++) {
      let edx = 0;
      for (let k = 0; k < 4; k++) {
        const pos = ((ecx >>> 8) & 0xFF) << 8 | al; let t = map[pos];
        if (variant >= 2) t = (t + pos) & 0xFFFF;
        t = (t + off) & 0xFFFF;
        if (variant === 3) { count = (count + 1) & 0xFF; t = (t & 0xFF) | ((((t >> 8) + count) & 0xFF) << 8); }
        edx = (edx << 8) | tex[t];
        const sum = ecx + step; ecx = sum >>> 0; al = (al + ah + (sum > 0xFFFFFFFF ? 1 : 0)) & 0xFF;
      }
      esi -= 4;
      out[esi] = edx & 0xFF; out[esi + 1] = (edx >>> 8) & 0xFF; out[esi + 2] = (edx >>> 16) & 0xFF; out[esi + 3] = (edx >>> 24) & 0xFF;
      out[esi - 0x140] = out[esi]; out[esi - 0x13F] = out[esi + 1]; out[esi - 0x13E] = out[esi + 2]; out[esi - 0x13D] = out[esi + 3];
    }
    esi -= 0x180;
  }
}
module.exports = { swirl };
