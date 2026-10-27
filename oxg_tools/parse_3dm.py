"""Parse the 3DM files of CONTRAST.BIN (Oxygene, 1996; models exported from 3D Studio by Spiral) and check that the structure accounts for every byte.
Two kinds exist:
  "3DM!" scenes (cirk4, line3, meduse2, poto4, scenebis): a hierarchical animated scene
      u32 'sig', u32 off_anim, 3 x i16 params, u16 nobj, nobj x u32 object offsets, u16 nmat, nmat x u32 material offsets,
      u16 nrec + nrec x 7 x i16 animation records (at off_anim), the objects, the materials (36 bytes: 16 name, 16 texture file, 4 colour/flags)
      object: 5 x u32 offsets (vertices, faces, array C, array D, per-vertex mapping), then 3 x i16 (id, parent, tag);
              vertices u16 n + n x 3 x i16;  faces u16 n + n x 4 x i16 (v1, v2, v3, flags);  C and D u16 n + n small records;  mapping u16 n + n x 2 x i16 (u, v)
  point clouds (debut, debut2, final, fleur, fleur2, fleur3): u16 n + n x (x, y, z, 0) as i16: morph targets of the logo particle effects
usage: parse_3dm.py FILE.3dm"""
import struct, sys
def parse(d):
    U = lambda o: struct.unpack_from('<I', d, o)[0]; W = lambda o: struct.unpack_from('<H', d, o)[0]; S = lambda o, n: struct.unpack_from('<%dh' % n, d, o)
    if d[:4] != b'3DM!':
        n = W(0); assert 2 + 8 * n == len(d), 'not a point cloud'
        return dict(kind='points', n=n, pts=[S(2 + 8 * i, 4) for i in range(n)])
    off_anim = U(4); params = S(8, 3); nobj = W(14); offs = [U(16 + 4 * i) for i in range(nobj)]
    p = 16 + 4 * nobj; nmat = W(p); moffs = [U(p + 2 + 4 * i) for i in range(nmat)]; p += 2 + 4 * nmat
    assert p == off_anim, (p, off_anim)
    nrec = W(off_anim); anim = [S(off_anim + 2 + 14 * i, 7) for i in range(nrec)]; end_anim = off_anim + 2 + 14 * nrec
    objs = []; pos = end_anim
    for b in offs:
        assert b == pos, ('object gap', hex(b), hex(pos))
        hdr = struct.unpack_from('<5I', d, b); oid, parent, tag = S(b + 20, 3)
        def arr(o, rec): n = W(b + o); return [S(b + o + 2 + rec * i, rec // 2) for i in range(n)], 2 + rec * n
        verts, a = arr(hdr[0], 6); assert hdr[0] == 26 and hdr[1] == hdr[0] + a, 'vertex array'
        faces, f = arr(hdr[1], 8); assert hdr[2] == hdr[1] + f, 'face array'
        c, ca = arr(hdr[2], 6); dd, da = arr(hdr[3], 8)
        assert hdr[3] == hdr[2] + ca and hdr[4] == hdr[3] + da, 'C/D arrays'
        mapping, ma = arr(hdr[4], 4); pos = b + hdr[4] + ma
        objs.append(dict(id=oid, parent=parent, tag=tag, verts=verts, faces=faces, c=c, d=dd, uv=mapping))
    mats = []
    for m in moffs:
        assert m == pos, ('material gap', hex(m), hex(pos))
        mats.append(dict(name=d[m:m + 16].split(b'\0')[0].decode('latin1'), texture=d[m + 16:m + 32].split(b'\0')[0].decode('latin1'), extra=d[m + 32:m + 36].hex())); pos = m + 36
    assert pos == len(d), ('trailing bytes', len(d) - pos)
    return dict(kind='scene', params=params, anim=anim, objs=objs, mats=mats)
if __name__ == '__main__':
    r = parse(open(sys.argv[1], 'rb').read())
    if r['kind'] == 'points': print('point cloud:', r['n'], 'points', r['pts'][:3])
    else:
        print('scene: params', r['params'], 'animation records', len(r['anim']), 'objects', len(r['objs']), 'materials', [(m['name'], m['texture']) for m in r['mats']])
        print('  vertices', sum(len(o['verts']) for o in r['objs']), 'faces', sum(len(o['faces']) for o in r['objs']))
