"""Flatten the chunks written by record.py (one or more directories, a later directory replaces the records of the earlier ones from its first clock on) into one compressed file for the JS tests.
Layout: 'RAWZ', u32 n, u32 block (records per block), u32 nblocks, u32 compressed size per block, then the zlib blocks; a record = f64 clock, 64000 bytes frame, 768 bytes DAC (6-bit), 0x120 bytes of memory slices
(0x44E10..+0x60, 0x30080..+0x80, then the music position block).   usage: export_rec2.py OUT.rawz DIR1 [DIR2 ...]"""
import sys, glob, struct, zlib, numpy as np
out = sys.argv[1]; dirs = sys.argv[2:]; B = 64
chunks = [sorted(glob.glob(d + '/c*.npz')) for d in dirs]
starts = [float(np.load(c[0])['t'][0]) if c else 1e18 for c in chunks]
blocks = []; cur = bytearray(); n = 0; nin = 0
def flush():
    global cur
    if cur: blocks.append(zlib.compress(bytes(cur), 1)); cur = bytearray()
for k, fs in enumerate(chunks):
    end = starts[k + 1] if k + 1 < len(chunks) else 1e18
    for f in fs:
        z = np.load(f)
        for i in range(len(z['f'])):
            if z['t'][i] >= end: break
            cur += struct.pack('<d', z['t'][i]) + z['f'][i].tobytes() + z['pal'][i].tobytes() + z['g'][i].tobytes().ljust(0x120, b'\0'); n += 1; nin += 1
            if nin == B: flush(); nin = 0
flush()
with open(out, 'wb') as o:
    o.write(b'RAWZ' + struct.pack('<III', n, B, len(blocks)) + b''.join(struct.pack('<I', len(b)) for b in blocks))
    for b in blocks: o.write(b)
print(n, 'records,', sum(len(b) for b in blocks) // 1024, 'KiB')
