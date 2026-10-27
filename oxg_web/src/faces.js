"use strict";
// Collecting the visible faces of an object into a depth list (0x13C40), sorting the list (0x13210, a two-pass radix sort on a 16-bit key) and walking it from the far end (0x132DC).
/**
 * @param o object (prepared); mode 1: key from the nearest vertex, 2: from the farthest, other: from the sum of the three depths
 * @param list array of { o, face, key } appended to
 */
function collect(o, mode, list) {
  if (!o.visible) return;
  const v = o.v, f = o.f;
  for (let k = 0; k < o.nf; k++) {
    const a = k * 0x18, i1 = f.getInt16(a, true) * 0x2E, i2 = f.getInt16(a + 2, true) * 0x2E, i3 = f.getInt16(a + 4, true) * 0x2E;
    const x1 = v.getInt32(i1 + 0x10, true), y1 = v.getInt32(i1 + 0x14, true), x2 = v.getInt32(i2 + 0x10, true), y2 = v.getInt32(i2 + 0x14, true), x3 = v.getInt32(i3 + 0x10, true), y3 = v.getInt32(i3 + 0x14, true);
    const xmax = Math.max(x1, x2, x3), xmin = Math.min(x1, x2, x3), ymax = Math.max(y1, y2, y3), ymin = Math.min(y1, y2, y3);
    if (xmin >= 0x13F || xmax <= 0 || ymin >= 0xC7 || ymax <= 0) continue;           // outside the screen
    if (!(((Math.imul(x2 - x1, y3 - y1) - Math.imul(y2 - y1, x3 - x1)) | 0) < 0)) continue;   // back face (screen winding)
    const z1 = v.getInt32(i1 + 0x18, true), z2 = v.getInt32(i2 + 0x18, true), z3 = v.getInt32(i3 + 0x18, true);
    if (!(z1 > 0 || z2 > 0 || z3 > 0)) continue;                                      // entirely behind the camera
    const key = mode === 1 ? -Math.min(z1, z2, z3) : mode === 2 ? -Math.max(z1, z2, z3) : -(z1 + z2 + z3);
    list.push({ o, face: k, key: key & 0xFFFF });
  }
}
/** stable ascending order on the unsigned 16-bit key = farthest first (the key is the negated depth) */
function sortList(list) { return list.map((e, i) => [e, i]).sort((p, q) => p[0].key - q[0].key || p[1] - q[1]).map(p => p[0]); }
module.exports = { collect, sortList };
