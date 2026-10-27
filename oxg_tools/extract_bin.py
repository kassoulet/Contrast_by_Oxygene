"""Extract CONTRAST.BIN (Oxygene, 1996): a directory of 24-byte records (16-byte name, u32 offset, u32 size), 128 slots, data follows at 0xC00.
usage: extract_bin.py CONTRAST.BIN OUTDIR"""
import sys, os, struct
d = open(sys.argv[1], 'rb').read(); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
for i in range(0, 0xC00, 24):
    n = d[i:i + 16].split(b'\0')[0]
    if not n: break
    off, size = struct.unpack('<II', d[i + 16:i + 24]); open(os.path.join(out, n.decode()), 'wb').write(d[off:off + size])
