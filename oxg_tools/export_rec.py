"""Flatten the chunks written by record.py into one raw file for the JS tests.
Layout: u32 'RAWF', u32 n; then n records of: f64 clock, 64000 bytes frame, 768 bytes DAC (6-bit), 0xE0 + 0x40 bytes of memory slices
(0x44E10..+0x60, 0x30080..+0x80, then the music position block).   usage: export_rec.py RECDIR OUT.raw [first_chunk last_chunk]"""
import sys, glob, struct, numpy as np
fs = sorted(glob.glob(sys.argv[1] + '/c*.npz')); lo = int(sys.argv[3]) if len(sys.argv) > 3 else 0; hi = int(sys.argv[4]) if len(sys.argv) > 4 else len(fs)
n = 0
with open(sys.argv[2], 'wb') as o:
    o.write(b'RAWF' + struct.pack('<I', 0))
    for f in fs[lo:hi]:
        z = np.load(f)
        for i in range(len(z['f'])):
            o.write(struct.pack('<d', z['t'][i])); o.write(z['f'][i].tobytes()); o.write(z['pal'][i].tobytes()); o.write(z['g'][i].tobytes().ljust(0x120, b'\0')); n += 1
    o.seek(4); o.write(struct.pack('<I', n))
print(n, 'records')
