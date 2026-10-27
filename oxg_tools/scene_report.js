// Markdown summary of the five 3DM scenes (objects, hierarchy, materials, camera track):  node oxg_tools/scene_report.js
const fs = require("fs"), path = require("path");
const { parseArchive } = require("../oxg_web/src/archive"), { readGif } = require("../oxg_web/src/gif"), { loadScene } = require("../oxg_web/src/scene3d"), { linkObjects } = require("../oxg_web/src/scene3");
const files = parseArchive(fs.readFileSync(path.join(__dirname, "../oxg_cont/CONTRAST.BIN")));
const S = [["scenebis.3dm", "scene2.gif"], ["cirk4.3dm", "ref01.gif"], ["line3.3dm", "bump9.gif"], ["poto4.3dm", "centre.gif"], ["meduse2.3dm", "meduse.gif"]];
for (const [m, g] of S) {
  const L = loadScene(files[m], files, readGif(files[g]).pal); linkObjects(L.objects);
  let nv = 0, nf = 0; for (const o of L.objects) { nv += o.nv; nf += o.nf; }
  const ss = L.ss; let xs = [1e9, -1e9], ys = [1e9, -1e9], zs = [1e9, -1e9];
  for (const o of L.objects) for (let k = 0; k < o.nv; k++) { const x = o.v.getInt32(k * 46, true), z = o.v.getInt32(k * 46 + 4, true), y = o.v.getInt32(k * 46 + 8, true); xs = [Math.min(xs[0], x), Math.max(xs[1], x)]; ys = [Math.min(ys[0], y), Math.max(ys[1], y)]; zs = [Math.min(zs[0], z), Math.max(zs[1], z)]; }
  console.log(`### ${m}\n\n${L.objects.length} objects, ${nv} vertices, ${nf} faces, camera track ${ss.nrec} frames (${(ss.nrec / 70.086).toFixed(1)} s at 70 Hz), light parameters (${L.light.x}, ${L.light.y}, ${L.light.z}); vertex extent x ${xs.join("..")}, y ${zs.join("..")}, z ${ys.join("..")} (file units)\n`);
  console.log("| # | id | parent | vertices | faces | position keys | orientation keys | materials used |\n|---|---|---|---|---|---|---|---|");
  L.objects.forEach((o, i) => { const mats = new Set(); for (let k = 0; k < o.nf; k++) mats.add(o.f.getInt16(k * 24 + 6, true) & 0x3FFF); console.log(`| ${i} | ${o.id} | ${o.parent} | ${o.nv} | ${o.nf} | ${o.nc} | ${o.nd} | ${[...mats].map(x => L.materials[x] ? L.materials[x].name : "?" + x).join(", ")} |`); });
  console.log("\n| material | texture | flags | colour (palette index) |\n|---|---|---|---|");
  for (const x of L.materials) console.log(`| ${x.name} | ${x.texture || "-"} | 0x${x.flags.toString(16)} | #${x.colour.toString(16).padStart(6, "0")} (${x.index}) |`);
  console.log();
}
