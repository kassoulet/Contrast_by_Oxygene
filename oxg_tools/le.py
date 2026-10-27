"""Parse the Linear Executable (LE) inside CONTRAST.EXE (Watcom C/C++32, bound to DOS/4GW Professional) and build its flat memory image.
usage: le.py CONTRAST.EXE            prints header, objects, entry; as a module: load(path) -> LE with .objs, .mem (dict base->bytearray), .entry"""
import struct, sys
class LE:
    pass
def load(path, base_of=lambda i, size: 0x400000 + i * 0x1000000):
    d = open(path, 'rb').read(); o = d.find(b'LE\0\0', 0x2e000); assert o > 0
    # the LE header's offsets are relative to the start of the LE image: MZ stub of the bound extender precedes it; find the MZ that owns it
    mz = max(m for m in range(0, o) if d[m:m + 2] == b'MZ' and m + 0x3c + 4 <= len(d) and struct.unpack_from('<I', d, m + 0x3c)[0] == o - m) if False else None
    for m in range(o - 0x400, 0, -1):
        if d[m:m + 2] == b'MZ' and struct.unpack_from('<I', d, m + 0x3c)[0] == o - m: mz = m; break
    names = ('sig border worder level cpu os ver flags npages eip_obj eip esp_obj esp pagesize lastpage fixsize fixcksum ldrsize ldrcksum objtab nobj objpagemap objiter restab nres nametab entrytab moddir nmoddir '
             'fixpagetab fixrectab impmod nimpmod impproc pagecksum datapages npreload nonresname nonressize nonrescksum autods debuginfo debuglen').split()
    h = struct.unpack_from('<2sBBIHHIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII', d, o)
    L = LE(); L.h = dict(zip(names, h)); L.file = d; L.base = o; L.mz = mz; H = L.h
    L.objs = []
    for i in range(H['nobj']):
        size, base, flags, pgi, npg, _ = struct.unpack_from('<6I', d, o + H['objtab'] + 24 * i); L.objs.append(dict(size=size, base=base, flags=flags, pageidx=pgi, npages=npg))
    L.pagemap = [struct.unpack_from('>I', d, o + H['objpagemap'] + 4 * i)[0] for i in range(H['npages'])]
    return L
if __name__ == '__main__':
    L = load(sys.argv[1]); H = L.h
    print('LE at file 0x%x (MZ stub at 0x%x)' % (L.base, L.mz))
    for k, v in H.items(): print('  %-10s %s' % (k, hex(v) if isinstance(v, int) else v))
    for i, ob in enumerate(L.objs): print('obj', i + 1, {k: hex(v) for k, v in ob.items()})

SEL = {1: 0x08, 2: 0x10}          # selectors DOS/4GW would put in selector fixups: the flat code and data selectors of the runner (run.py)
def image(path):
    """flat memory image of the LE objects at their preferred bases with all fixups applied: returns (L, {objnum: bytearray}, bases)"""
    L = load(path); H = L.h; d = L.file; o = L.base; ps = H['pagesize']
    objs = L.objs; mem = {}
    pages = []
    dp = L.mz + H['datapages']
    for i in range(H['npages']):
        ln = ps if i < H['npages'] - 1 else H['lastpage']
        pages.append(bytearray(d[dp + i * ps: dp + i * ps + ln].ljust(ps, b'\0')))
    # object page map: entry i (1-based page in file) -> object page order
    for n, ob in enumerate(objs, 1):
        m = bytearray(ob['size'] + (-ob['size'] % ps))
        for k in range(ob['npages']): m[k * ps:(k + 1) * ps] = pages[ob['pageidx'] - 1 + k]
        mem[n] = m
    # fixups
    fpt = [struct.unpack_from('<I', d, o + H['fixpagetab'] + 4 * i)[0] for i in range(H['npages'] + 1)]
    frt = o + H['fixrectab']; nfix = 0; bad = 0
    for pg in range(H['npages']):
        # which object/page
        for n, ob in enumerate(objs, 1):
            if ob['pageidx'] - 1 <= pg < ob['pageidx'] - 1 + ob['npages']: on = n; pidx = pg - (ob['pageidx'] - 1); break
        p = frt + fpt[pg]; end = frt + fpt[pg + 1]
        while p < end:
            st, fl = d[p], d[p + 1]; so = struct.unpack_from('<h', d, p + 2)[0]; p += 4
            tt = fl & 3
            if tt != 0: bad += 1; raise SystemExit('unsupported fixup target type %d' % tt)
            tobj = d[p] if not fl & 0x40 else struct.unpack_from('<H', d, p)[0]; p += 1 if not fl & 0x40 else 2
            toff = 0
            if (st & 0xF) not in (2,):
                if fl & 0x10: toff = struct.unpack_from('<I', d, p)[0]; p += 4
                else: toff = struct.unpack_from('<H', d, p)[0]; p += 2
            tb = objs[tobj - 1]['base'] + toff; pos = pidx * ps + so; m = mem[on]; kind = st & 0xF
            if kind == 7: m[pos:pos + 4] = struct.pack('<I', tb & 0xFFFFFFFF)
            elif kind == 8: m[pos:pos + 4] = struct.pack('<I', (tb - (objs[on - 1]['base'] + pos + 4)) & 0xFFFFFFFF)
            elif kind == 5: m[pos:pos + 2] = struct.pack('<H', tb & 0xFFFF)
            elif kind == 2: m[pos:pos + 2] = struct.pack('<H', SEL[tobj])
            elif kind in (3, 6): m[pos:pos + (4 if kind == 3 else 6)] = (struct.pack('<HH', tb & 0xFFFF, SEL[tobj]) if kind == 3 else struct.pack('<IH', tb, SEL[tobj]))
            else: raise SystemExit('fixup kind %d' % kind)
            nfix += 1
    L.nfix = nfix
    return L, mem
