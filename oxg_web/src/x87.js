"use strict";
// Just enough of the x87 (64-bit mantissa, round to nearest even) to reproduce `n * (1.0 / len)` truncated, which a double cannot do when n/len is an exact integer.
// A value is { m: BigInt (63 or 64 significant bits, positive), e: exponent } meaning m * 2^e; sign handled separately.
function round64(num, den) {           // num, den positive BigInt: the nearest value of num/den with a 64-bit mantissa, as { m, e } (value = m * 2^e)
  const bl = x => x.toString(2).length;
  let s = BigInt(64 - (bl(num) - bl(den)));
  for (;;) {
    const a = s >= 0n ? num << s : num, d = s >= 0n ? den : den << -s;
    let q = a / d; const r = a % d;
    if (bl(q) > 64) { s -= 1n; continue; }
    if (bl(q) < 64) { s += 1n; continue; }
    if (r * 2n > d || (r * 2n === d && (q & 1n))) { q += 1n; if (bl(q) > 64) { return { m: q >> 1n, e: 1n - s }; } }
    return { m: q, e: -s };
  }
}
/** trunc(n * fl64(1 / len)) with n an integer (JS number) and len > 0 a float32 value (JS number), both extended-precision rounded like the FPU. */
function mulRecipTrunc(n, len) {
  if (n === 0) return 0;
  const sign = n < 0 ? -1 : 1, an = BigInt(Math.abs(n));
  // len as a rational: it is a float32, hence a dyadic rational: len = L / 2^k
  let k = 0, L = len; while (!Number.isInteger(L)) { L *= 2; k++; }
  const r = round64(1n << BigInt(k), BigInt(L));               // 1/len = 2^k / L
  let prod = r.m * an; let e = r.e;                              // exact product, up to 64+31 bits
  const pb = prod.toString(2).length;
  if (pb > 64) { const sh = BigInt(pb - 64); const rem = prod & ((1n << sh) - 1n), half = 1n << (sh - 1n); prod >>= sh; e += sh; if (rem > half || (rem === half && (prod & 1n))) prod += 1n; }
  let v; if (e >= 0n) v = prod << e; else v = prod >> (-e);   // truncation toward zero of the magnitude
  return sign * Number(v);
}
module.exports = { mulRecipTrunc, round64 };
