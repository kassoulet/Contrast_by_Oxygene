"""Header, order list and instrument names of an FastTracker 2 .XM module.   usage: xm_info.py FILE.XM"""
import struct, sys
d = open(sys.argv[1], 'rb').read()
title = d[17:37].decode('latin1').strip(); tracker = d[38:58].decode('latin1').strip()
ver, hs, songlen, restart, nch, npat, ninst, flags, tempo, bpm = struct.unpack_from('<HIHHHHHHHH', d, 58)
order = list(d[80:80 + songlen]); print('title %r tracker %r v%04x channels %d patterns %d instruments %d songlen %d restart %d tempo %d bpm %d freq-table %s' % (title, tracker, ver, nch, npat, ninst, songlen, restart, tempo, bpm, 'linear' if flags & 1 else 'amiga'))
print('order', order)
p = 60 + hs; rows = 0
for i in range(npat):
    hl, ptype, nrows, size = struct.unpack_from('<IBHH', d, p); rows += nrows; p += hl + size
print('pattern rows total', rows)
names = []
for i in range(ninst):
    sz, name, typ, ns = struct.unpack_from('<I22sBH', d, p); names.append(name.split(b'\0')[0].decode('latin1').strip())
    p += sz
    if ns:
        sl = sum(struct.unpack_from('<I', d, p + 40 * k)[0] for k in range(ns)); p += 40 * ns + sl
print('instruments:', names)
