"use strict";
// The main sequence (0x10564): the scenes in order, each started on the tick after the previous one finished.
const { Intro } = require("./intro"), { Scene2 } = require("./scene2"), { Scene3, SCENEBIS, CIRK4, POTO4 } = require("./scene3"), { Greets } = require("./greets"), { Bobs } = require("./bobs"), { Wire } = require("./wire"), { Meduse } = require("./meduse");
/** the tick (of the recorded run) at which each scene is set up; a player can start a scene there instead of running the ones before it */
const CHAPTERS = [["Intro", 0], ["Water", 3497], ["Tori", 6848], ["Greetings", 13121], ["Metal complex", 16381], ["Particles", 23169], ["Wireframe", 27875], ["Room", 29830], ["Jellyfish", 33294]];
const INTRO_END_ANGLE = 13764;      // the swirl angle the intro leaves behind (the water scene continues from it)
function chain(files) {
  let i = 0, scene = new Intro(files), G = null, tickNo = 0; const started = { intro: 0 };
  const list = [
    ["intro", null],
    ["scene2", () => { G = { angle: scene ? scene.angle : INTRO_END_ANGLE, o8c: 0x800000, o90: 0x800000 }; return new Scene2(files, G); }],
    ["scene3", () => new Scene3(files, SCENEBIS)],
    ["greets", () => new Greets(files)],
    ["cirk4", () => new Scene3(files, CIRK4)],
    ["bobs", () => new Bobs(files, scene ? scene.shown : undefined)],
    ["wire", () => new Wire(files)],
    ["poto4", () => new Scene3(files, POTO4)],
    ["meduse", () => new Meduse(files)],
  ];
  const seq = { name: "intro", started, get scene() { return scene; }, get G() { return G; }, get index() { return i; }, step(sync) {
    let r = scene.step(sync); tickNo++;
    if (scene.done) {
      if (++i >= list.length) return null;
      scene = list[i][1](); seq.name = list[i][0]; started[seq.name] = tickNo; r = { frame: scene.shown, pal: scene.pal };
    }
    return r;
  },
  /** jump to the start of chapter k (the scene is set up as if the previous one had just finished); the next step() is that scene's first */
  startAt(k) { scene = null; i = k; scene = k === 0 ? new Intro(files) : list[k][1](); seq.name = list[k][0]; tickNo = CHAPTERS[k][1]; return { frame: scene.shown, pal: scene.pal }; } };
  return seq;
}
module.exports = { chain, CHAPTERS };
