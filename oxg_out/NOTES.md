# Working notes: porting CONTRAST (Oxygene 1996) to JS

(Internal notes for the port; the readable write-ups are REVERSE.md and the later EFFECTS.md.)

## Layout
* `oxg_cont/` the release; `oxg_tools/` Python harness; `oxg_web/` the JS port (src/, test/); `oxg_out/` extracted data, listings, recordings.
* `oxg_out/code.asm` = `ndisasm -b 32 -o 0x10000` of object 1 (code.bin), with the D0/D1 shift-by-1 quirk fixed. `oxg_tools/dis.sh START END` prints a compact listing (hex addresses, no 0x).
* Data object 2 at 0x30000 (`oxg_out/data.bin`). Heap (malloc) from 0x1000000 in the harness; all `[0x4cxxx]`/`[0x44exx]`/`[0x62xxx]` globals are BSS in object 2.

## Harness conventions
* `run.py`: flat 32-bit Unicorn, IPS=1e9 + idle-skip so one iteration = one tick. Keys for the MIDAS menu injected (10 x Down, Enter = "No Sound").
* `record.py OUTDIR END`: per-tick frame + DAC + memory slices (globals 0x44E10..+0x60, 0x30080..+0x80, music block +0x40) + snapshots every 10 s (`sNNNN.bin`). The tick hook is the demo's callback 0x10790 (inc [0x44E20], inc [0x44E2C]); VGA content at that moment = frame displayed in the previous tick.
* `capture_fn.py SNAP ENTRY OUT [skip]`: test vector (memory before/after one call of a routine); JS side `test/vec.js` reads it.
* `export_rec.py RECDIR OUT.raw` -> `test/rec.js` (`loadRec`, `sync`, `row`, `order`, `pattern`).
* Alignment found for the intro: record index = iteration + 3; the sync value used by iteration i is the recorded one at i + 3.
* Music block (at pointer [0x44E3C]): +0 order, +4 pattern, +8 row, +0xC bpm(130), +0x10 speed(4), +0x14 **syncInfo** (-1 until the first, then 1 / 0 / 0xF ... set by the module's sync commands). Scenes advance on sync edges.

## Main sequence (0x10564): scene routines called in this order
1. 0x11720 intro swirl + OXYGENE lettering **[ported, exact for 2700 ticks, test_intro.js]**
2. 0x127F0 bump scene with credit labels (oxbab, spiral, mon, clawz.gif; bump2.gif; waits for sync 0xF first)
3. 0x15BD0 3D scene `scenebis.3dm` (scene2.gif/.cpl); ends at tick 0x173E
4. 0x184A0 greetings/final (greets.gif, fond7, final, fond3)
5. 0x16130 3D scene `cirk4.3dm` (ref01)
6. 0x18BA0 particles/bobs (boite21, rip3, bobz, debut/fleur/final .3dm point clouds)
7. 0x16644 `line3.3dm` (bump9)
8. 0x16A7C `poto4.3dm` (centre)
9. 0x16CF0 `meduse2.3dm` (meduse, oxyge/tank/contr strips)
Then MIDAS shutdown and the text of contrast.txt is printed.

## Library routines (program, object 1)
* 0x10490 malloc, 0x104C4 fopen(name, mode), 0x1A52E fread, 0x11340 GIF loader(name, pixels*, palette*, x, y?, flag), 0x10ee0 set DAC from 768-byte palette (>>2; 0 = black), 0x10F30 set one DAC colour (0x00RRGGBB, index in dl), 0x10F64 fade table builder (src, dst, out; 64 palettes) = `src/fade.js`, 0x10254 clear back buffer, 0x101EF/0x10450 present (copy [0x44E38] to A0000), 0x10208 present+clear, 0x102CB wait tick, 0x10790 tick callback, 0x1DE08 MIDAS get play status(handle [0x69768], &[0x44E3C]).
* Tables: cos/sin 4096 entries x 32768 (int32 at 0x3AE0C / 0x40E0C), isqrt (u16 at 0x3EE0C) = `src/tables.js` (exact).

## Intro details (ported)
* variant of the swirl routine per state: [V0,V3,V1,V3,V0,V2,V3,V1,V0,V0] (state 0..9); V2 zeroes the A step; V1 zeroes the B step of u; V2/V3 add the position to the map value; V3 adds a per-pixel counter to the high byte.
* state advances when the music sync goes 1 -> 0; tick counter [0x44E20] resets to 0 then.

## 3D engine (partial reading)
* 3DM loader 0x133B0 (see REVERSE.md for the file layout). Objects keep expanded 0x2E-byte vertex records. The "animation records" are the **camera track**: position(3), target(3), roll(1) per frame.
* 0x147D0(scene, frame): camera look-at matrix from the track -> globals 0x5A838.. (3x4 matrix, 16.15 fixed point), multiplied with the translation at 0x30158 by 0x14D24 (matrix multiply), then x<<9/0x254.
* 0x14AA0(obj, frame): object matrix from a quaternion track ([obj+0x1C], 16-byte records) and a position track ([obj+0x10], 0x2E stride).
* 0x14DE0(obj): object matrix x camera, bounding-sphere visibility (0x15690), per-vertex transform + perspective (screen x = 0xA0 + .., y = 0x64 + ..), env-map coordinates u,v = (n . view)>>16 + 0x7F when material flag 0x80, per-vertex light = (n . L)>>11 clamped to [-31, 31] when material flags & 3 == 2.
* 0x13C40(obj, ?): draw (rasteriser), 0x154D0 sort, 0x13210 flush, 0x14164 (per tick), 0x15BC0 camera set.
* Fixed point 16.15 (>>15) for matrices; framebuffers 320x200 at [0x44E38].
