# CONTRAST by Oxygene (1996), reversed and ported to JavaScript

Play it: the GitHub Pages site of this repository (needs sound; F = fullscreen, P = pause).

* `oxg_cont/` the 1996 release (EXE, data archive, module).
* `oxg_out/REVERSE.md` how the release is built, the emulator harness, annotated assembly.
* `oxg_out/EFFECTS.md` the effects, the 3D engine, the tricks, the 3D scenes.
* `oxg_web/` the pixel-exact JavaScript port (`src/`), its tests and the web page (`site/`).
* `oxg_tools/` the emulator harness and the recording / extraction tools.

The port was verified tick by tick against the real program run in an emulator (39,243 ticks). The recording itself (~800 MB) is not in the repository; `oxg_tools/record.py` and `export_rec2.py` regenerate it.
