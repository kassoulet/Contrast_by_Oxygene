"""Wanted start time of every row of the rendered module, from the recorded run: make_targets.py REC.rawz rows.txt target.txt   (rows.txt from `render_xm in.xm rows.txt`)"""
import sys, struct, zlib, numpy as np
P = 1 / 70.0864
b = open(sys.argv[1], 'rb').read(); n, B, nb = struct.unpack_from('<III', b, 4)
sizes = struct.unpack_from('<%dI' % nb, b, 16); R = 8 + 64000 + 768 + 0x120; p = 16 + 4 * nb; ors = []; rows = []
for k in range(nb):
    d = zlib.decompress(b[p:p + sizes[k]]); p += sizes[k]
    for i in range(len(d) // R):
        g = i * R + 8 + 64000 + 768; ors.append(struct.unpack_from('<I', d, g + 0xE0)[0]); rows.append(struct.unpack_from('<I', d, g + 0xE8)[0])
chg = [i for i in range(4, len(ors)) if (ors[i], rows[i]) != (ors[i - 1], rows[i - 1])]
nom = [l.split() for l in open(sys.argv[2])]; nt = np.array([float(x[2]) for x in nom])
seq_rec = [(ors[i], rows[i]) for i in chg]; seq_nom = [(int(x[0]), int(x[1])) for x in nom][1:]; nt = nt[1:]   # the recording starts after row 0 began
m = min(len(seq_rec), len(seq_nom)); ok = sum(1 for k in range(m) if seq_rec[k] == seq_nom[k]); print('rows recorded', len(seq_rec), 'rendered', len(seq_nom), 'sequence equal for', ok)
K = len(seq_rec); T = np.array([(i - 0.5) * P for i in chg]); x = nt[:K]
W = 60; out = np.zeros(len(nt))
for k in range(len(nt)):
    c = min(k, K - 1 - W) if k > K - 1 - W else k; lo = max(0, c - W); hi = min(K, c + W + 1)
    a, b0 = np.polyfit(x[lo:hi], T[lo:hi], 1); out[k] = a * nt[k] + b0
out = np.concatenate([[out[0] - (nt[1] - nt[0]) * 0 - 0.0], out]); out[0] = 2 * out[1] - out[2]; np.savetxt(sys.argv[3], out, fmt='%.5f'); print('first', out[:3], 'last recorded', out[K - 1], 'last', out[-1], 'rows', len(out), 'raw resid max', np.abs(T - out[:K]).max())
