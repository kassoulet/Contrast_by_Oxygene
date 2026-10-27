"""Minimal GIF reader returning the colour indices and the palette exactly as stored (PIL turns grey palettes into 'L' images and loses them).
usage: gif_raw.py FILE.gif -> prints size; as a module: read(path) -> (w, h, indices uint8[h*w], palette bytes[768])"""
import struct, sys
import numpy as np
def read(path):
    d = open(path, 'rb').read(); assert d[:3] == b'GIF'
    w, h, flags = struct.unpack_from('<HHB', d, 6); p = 13; pal = bytearray(768)
    if flags & 0x80: n = 3 * (2 << (flags & 7)); pal[:n] = d[p:p + n]; p += n
    while True:
        b = d[p]; p += 1
        if b == 0x21: p += 1; 
        elif b == 0x2C: break
        else: raise ValueError('unexpected block %x' % b)
        if b == 0x21:
            while d[p]: p += d[p] + 1
            p += 1
    ix, iy, iw, ih, f2 = struct.unpack_from('<HHHHB', d, p); p += 9
    if f2 & 0x80: n = 3 * (2 << (f2 & 7)); pal[:n] = d[p:p + n]; p += n
    mcs = d[p]; p += 1; data = bytearray()
    while d[p]: data += d[p + 1:p + 1 + d[p]]; p += d[p] + 1
    clear = 1 << mcs; eoi = clear + 1; size = mcs + 1; table = [bytes([i]) for i in range(clear)] + [b'', b'']; out = bytearray(); prev = None; bits = 0; nb = 0; pos = 0
    for byte in data:
        bits |= byte << nb; nb += 8
        while nb >= size:
            code = bits & ((1 << size) - 1); bits >>= size; nb -= size
            if code == clear: table = table[:clear + 2]; size = mcs + 1; prev = None; continue
            if code == eoi: break
            if prev is None: ent = table[code]
            else:
                ent = table[code] if code < len(table) else prev + prev[:1]
                table.append(prev + ent[:1])
                if len(table) == (1 << size) and size < 12: size += 1
            out += ent; prev = ent
    img = np.frombuffer(bytes(out[:iw * ih]), np.uint8)
    if f2 & 0x40: raise ValueError('interlaced')
    return iw, ih, img.copy(), bytes(pal)
if __name__ == '__main__':
    w, h, im, pal = read(sys.argv[1]); print(w, h, im.max())
