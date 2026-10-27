"""Walk the order list of an XM module the way a player does (speed/BPM changes Fxx, jumps Bxx, breaks Dxx, pattern delay EEx) and give the start time of every visited row.
usage: xm_timeline.py FILE.XM   -> prints a summary; import `timeline(path)` -> list of (time_s, order, row, speed, bpm)"""
import struct, sys

def timeline(path, maxtime=1e9):
    d = open(path, 'rb').read()
    ver, hs, songlen, restart, nch, npat, ninst, flags, speed, bpm = struct.unpack_from('<HIHHHHHHHH', d, 58)
    order = list(d[80:80 + songlen]); p = 60 + hs; pats = []
    for i in range(npat):
        hl, ptype, nrows, size = struct.unpack_from('<IBHH', d, p); q = p + hl; rows = []
        for r in range(nrows):
            row = []
            for c in range(nch):
                b = d[q]
                if b & 0x80:
                    q += 1; note = ins = vol = eff = par = 0
                    if b & 1: note = d[q]; q += 1
                    if b & 2: ins = d[q]; q += 1
                    if b & 4: vol = d[q]; q += 1
                    if b & 8: eff = d[q]; q += 1
                    if b & 16: par = d[q]; q += 1
                else:
                    note, ins, vol, eff, par = d[q:q + 5]; q += 5
                row.append((eff, par))
            rows.append(row)
        pats.append(rows); p += hl + size
    out = []; t = 0.0; o = 0; r = 0; seen = 0
    while o < songlen and t < maxtime and len(out) < 200000:
        pat = pats[order[o]]
        if r >= len(pat): o += 1; r = 0; continue
        out.append((t, o, r, speed, bpm)); jump = None; brk = None; delay = 0
        for eff, par in pat[r]:
            if eff == 0x0F:
                if par == 0: pass
                elif par < 32: speed = par
                else: bpm = par
            elif eff == 0x0B: jump = par
            elif eff == 0x0D: brk = (par >> 4) * 10 + (par & 15)
            elif eff == 0x0E and par >> 4 == 0x0E: delay = par & 15
        t += (speed * (1 + delay)) * 2.5 / bpm
        if jump is not None or brk is not None:
            if jump is not None: o = jump
            else: o += 1
            r = brk or 0
            if o >= songlen: break
        else: r += 1
    return out

if __name__ == '__main__':
    tl = timeline(sys.argv[1]); print(len(tl), 'rows, ends at %.1f s' % (tl[-1][0]), 'bpm values', sorted(set(x[4] for x in tl)), 'speeds', sorted(set(x[3] for x in tl)))
