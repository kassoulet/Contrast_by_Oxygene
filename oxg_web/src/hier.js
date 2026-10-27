"use strict";
// The scene graph: each object's world matrix = parent . local, and camera . world (routines 0x154D0 and 0x15520).
// Objects are linked by `sibling` (next object with the same parent) and `child` (first object below).
const { mat, copy, mul } = require("./mat");
function setupHierarchy(root, cameraMatrix) {
  const cam = mat(); copy(cam, cameraMatrix);
  const identity = mat(); for (let i = 0; i < 4; i++) identity[5 * i] = 0x8000;
  (function walk(o, parent) {
    if (!o.world) { o.world = mat(); o.camw = mat(); }
    mul(o.world, parent, o.local); mul(o.camw, cam, o.world);
    if (o.sibling) walk(o.sibling, parent);
    if (o.child) walk(o.child, o.world);
  })(root, identity);
}
module.exports = { setupHierarchy };
