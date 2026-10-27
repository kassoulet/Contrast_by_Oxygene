# CONTRAST (Oxygene, 1996) in JavaScript

A pixel-exact port of the demo's code. The data (`CONTRAST.BIN`) is the original's; the music is the original module rendered with libopenmpt.

* `src/` the port, one module per routine group (`sequence.js` chains the nine scenes; each scene has `step(sync) -> {frame, pal}`: one call = one 70 Hz tick, `frame` = 320x200 palette indices, `pal` = 256 x 3 DAC values, 6 bits).
* `site/` the web page: `node build.js` bundles `src/` into `site/oxg.js` and copies `CONTRAST.BIN` and the tables to `site/assets/`; serve the folder with any static server (`python3 -m http.server -d site`). The 320x200 picture is stretched to 4:3 by CSS.
* `test/` checks against the recording of the real program: `node test/test_seq.js` (the whole demo, tick by tick, needs `../oxg_out/rec_a.rawz`), `test_*.js` (single routines against memory dumps), `timeline.js`, `perf.js`.
* `data/trig16.bin` the two 16-bit sine/cosine tables of the program's data section (the particle scene's rotation).

What the effects are and how they work: `../oxg_out/EFFECTS.md`; the executable, the data and the assembly: `../oxg_out/REVERSE.md`.
