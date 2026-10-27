"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { parseArchive } = require("../src/archive"), { readGif } = require("../src/gif");
const files = parseArchive(fs.readFileSync(path.join(__dirname, "../../oxg_cont/CONTRAST.BIN")));
// reference: oxg_tools/gif_raw.py (independent LZW implementation)
const ref = JSON.parse(cp.execSync(`python3 -c "
import sys, glob, json, hashlib; sys.path.insert(0, '${path.join(__dirname, "../../oxg_tools")}'); import gif_raw
r = {}
for f in sorted(glob.glob('${path.join(__dirname, "../../oxg_out/data")}/*.gif')):
    w, h, im, pal = gif_raw.read(f); r[f.split('/')[-1]] = [w, h, hashlib.md5(im.tobytes()).hexdigest(), hashlib.md5(pal).hexdigest()]
print(json.dumps(r))"`).toString());
const md5 = b => require("crypto").createHash("md5").update(Buffer.from(b)).digest("hex"); let bad = 0, n = 0;
for (const [name, [w, h, hi, hp]] of Object.entries(ref)) { const g = readGif(files[name]); n++; if (g.w !== w || g.h !== h || md5(g.pix) !== hi || md5(g.pal) !== hp) { bad++; console.log("MISMATCH", name); } }
console.log("gif: " + (bad ? bad + " of " + n + " differ" : "all " + n + " GIFs identical to the reference decoder"));
process.exit(bad ? 1 : 0);
