"use strict";
// The main sequence (0x10564): the scenes in order, each started on the tick after the previous one finished.
const { Intro } = require("./intro"), { Scene2 } = require("./scene2"), { Scene3, SCENEBIS, CIRK4, POTO4 } = require("./scene3"), { Greets } = require("./greets"), { Bobs } = require("./bobs"), { Wire } = require("./wire"), { Meduse } = require("./meduse");
function chain(files) {
  let i = 0, scene = new Intro(files), G = null, tickNo = 0; const started = { intro: 0 };
  const list = [
    ["intro", null],
    ["scene2", () => { G = { angle: scene.angle, o8c: 0x800000, o90: 0x800000 }; return new Scene2(files, G); }],
    ["scene3", () => new Scene3(files, SCENEBIS)],
    ["greets", () => new Greets(files)],
    ["cirk4", () => new Scene3(files, CIRK4)],
    ["bobs", () => new Bobs(files, scene.shown)],
    ["wire", () => new Wire(files)],
    ["poto4", () => new Scene3(files, POTO4)],
    ["meduse", () => new Meduse(files)],
  ];
  const seq = { name: "intro", started, get scene() { return scene; }, step(sync) {
    let r = scene.step(sync); tickNo++;
    if (scene.done) {
      if (++i >= list.length) return null;
      scene = list[i][1](); seq.name = list[i][0]; started[seq.name] = tickNo; r = { frame: scene.shown, pal: scene.pal };
    }
    return r;
  } };
  return seq;
}
module.exports = { chain };
