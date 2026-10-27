"""Run-length table of the music's sync value per tick (as the port's step i sees it: the value recorded at tick i+3) from a .rawz recording.   usage: make_sync.py REC.rawz OUT.json"""
import sys, struct, zlib, json
b = open(sys.argv[1], 'rb').read(); n, B, nb = struct.unpack_from('<III', b, 4)
sizes = struct.unpack_from('<%dI' % nb, b, 16); R = 8 + 64000 + 768 + 0x120; p = 16 + 4 * nb; S = []
for k in range(nb):
    d = zlib.decompress(b[p:p + sizes[k]]); p += sizes[k]
    for i in range(len(d) // R): S.append(struct.unpack_from('<i', d, i * R + 8 + 64000 + 768 + 0xE0 + 0x14)[0])
runs = []; prev = None
for i in range(len(S) - 3):
    v = S[i + 3]
    if v != prev: runs.append([i, v]); prev = v
json.dump({'ticks': len(S) - 3, 'runs': runs}, open(sys.argv[2], 'w'))
print(len(S) - 3, 'ticks,', len(runs), 'runs')
