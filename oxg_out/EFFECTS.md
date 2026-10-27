# contrast (Oxygene, 1996): the effects, the 3D engine and the tricks

What the demo does, how, and which tricks keep it fast on a 486/Pentium of 1996. Everything below was read from the disassembly and then **checked against the real program**: the JavaScript port (`oxg_web/src`) reproduces the original's frames pixel for pixel, tick for tick, from the first swirl to the last jellyfish (see "How it was checked" at the end). The executable, the data archive and the assembly snippets are described in `REVERSE.md`.

## 1. The show, scene by scene

The program is one `main` that calls nine scene routines in order. Each scene waits for a **sync value** that the music (a 12-channel FastTracker 2 module by Clawz/Impact, played by MIDAS 0.50a) sets with its sync commands, then runs a fixed loop of one iteration per video frame. Times below are from the recorded run (70.09 ticks per second; the sound device is "No Sound", see section 6 for what that implies).

| # | scene (routine) | what you see | starts waiting | plays from | ends |
|---|---|---|---|---|---|
| 1 | intro (0x11720) | a pink swirl tunnel, the letters OXYGENE appear one by one, palette flashes on the music | 0 s | 0 s | 49.9 s |
| 2 | water (0x127F0) | a bump-mapped, perspective water floor with credit logos (oxbab, spiral, mon, clawz) | 49.9 s | 50.5 s | 97.7 s |
| 3 | `scenebis.3dm` (0x15BD0) | textured and gouraud-lit tori, a marble floor, four chrome objects | 97.7 s | 102.3 s | 187.2 s |
| 4 | greetings (0x184A0) | ten glowing orbs behind the "greets" lettering, then two dissolves | 187.2 s | 193.4 s | 233.7 s |
| 5 | `cirk4.3dm` (0x16130) | a flight through a reflection-mapped metal complex | 233.7 s | 239.7 s | 330.6 s |
| 6 | particles (0x18BA0) | 3D point clouds drawn as shaded balls that morph into each other | 330.6 s | 335.5 s | 397.7 s |
| 7 | `line3.3dm` (0x16644) | a wireframe scene whose lines leave glowing trails that flow outwards | 397.7 s | 402.1 s | 425.6 s |
| 8 | `poto4.3dm` (0x16A7C) | a textured room with a reflecting centrepiece | 425.6 s | 427.1 s | 475.0 s |
| 9 | `meduse2.3dm` (0x16CF0) | an articulated jellyfish, then the title strips and a fade | 475.0 s | 475.0 s | 560 s (demo end) |

After the last scene MIDAS is shut down and `contrast.txt` is printed on the text screen.

Scenes 3, 5 and 8, 9 share one **template**: the same ~250-byte loop with different constants (file names, the sync that starts it, the tick at which the end-of-scene ripple begins). That is why the port is one parametrised class for four scenes.

## 2. The frame loop and the clock

* The program measures the **vertical retrace** with the PIT and re-programs the timer interrupt (IRQ0) to fire once per frame (0x102DB). The tick counter `[0x44E20]` is therefore a frame counter, and "wait for the next frame" is a three-instruction spin: `mov eax,[0x44e20] / cmp eax,[0x44e20] / jz` (0x102CB). There is no `vsync` polling in the scenes.
* Each scene runs `wait tick → set palette → show the previous frame → draw the next frame into the back buffer`. The frame you see is always the one computed during the previous iteration (the double buffer is a plain `memcpy` to `0xA0000`, 0x10450; some scenes keep two buffers and swap pointers).
* **Time-based animation.** A second counter `[0x44E2C]` and a copy `[0x44E14]` give the number of ticks that passed during an iteration; the 3D scenes advance their animation frame by `1 + late ticks`, so a slow machine skips frames instead of slowing the music down. On the emulator every iteration fits in one tick, so the frame counter is just the tick count.
* Scene changes are **edges of the sync value** (`1→0`, `3`, `4`, ... `0xD`), polled from MIDAS in the main loop. Setup that takes long (the dissolve tables of the greetings scene, 16 million loop iterations; the sprite groups of the particle scene) simply lets ticks pass: the screen keeps showing the old picture with a black palette. The port reproduces those gaps (11 ticks in the greetings scene, about 340 in the particle scene).
* Palettes are **pre-computed fade tables**: `0x10F64` builds 64 palettes (768 bytes of 8-bit RGB each) from a source and a destination; fading is then `set the DAC from table[tick]`, no arithmetic per frame. The DAC gets `value >> 2`. DAC colour 0 is forced to black every tick.

## 3. The 2D effects

### Scene 1: swirl tunnel and lettering (0x11FB7, 0x12141, 0x122CD, 0x12459, 0x1261E)

A 256×256 **polar map** (65,536 `u16` entries built at start-up by sweeping radius and angle with the sine table) maps a screen position to a texture offset. The tunnel is drawn by walking the map along a rotated, scaled line per row and reading the texture through it: no multiply per pixel, one table read and one texture read.

* Two rows share one computation (each dword is stored twice, one line up), and four pixels are packed into a dword before the store. 256 of the 320 columns are computed.
* The inner loop is **self-modifying code**: the per-row step (a 32-bit fixed-point pair) is written into the immediates of the `add`/`adc` instructions before every frame (`mov esi,0x...; mov [esi],ecx`). Four routines with slightly different patched constants implement the variants selected by the music state (rotation, position added to the map value, a per-pixel shear).
* The fractional parts of u and v live in one register: `add ecx,imm` advances them and the carry out of the low half is folded into the integer part with `adc al,ah`. See the snippet in `REVERSE.md`.
* Ten states follow the script table at 0x3009A: per state a rotation speed, a drift and the fade table to use; the state advances when the sync goes `1 → 0`.
* The lettering is a 320×86 GIF with colour 0 as background. Each state reveals a few more letters with a mask: `buf = (buf & mask) | picture`, mask = 0xFF where the picture is 0.

### Scene 2: water bump mapping (0x12F58, 0x13047, table at 0x12ABF)

A floor in perspective. For every screen row the program computes a scale `d` from a row counter, divides a rotation vector twice by it (`idiv`), and walks a 256×256 **height** texture along that line. Per pixel pair it does three lookups and no multiply:

1. the height texture gives the height `h` and indexes a **displacement table** (65,536 `u16`) built at start-up from the luminance differences between each texel and the ones four rows below / four to the right, scaled by a sine of the row/column phase: this is the bump map, precomputed as two signed offsets per texel;
2. the displaced position picks two pixels in a 256×256 **environment image** (`bumpecla.gif`);
3. a 64 KB **colour table** `lut[(env << 8) | h]` (`cpalcred.bin`, 16 KB in the file but indexed up to 64 KB: the program reads past it) gives the final palette index.

Two pixels share one height, and the rotation, the zoom and the look-up offset all come from sums of sines of five free-running counters, which is what makes the surface ripple. The credit logos (160×32, drawn with colour 0 transparent) are copied on top when the sync says so; the palette cross-fades between five palettes (`bump2.gif`, `bump3..5.bin`, black).

### Scene 4: greetings (0x184A0)

* **Orbs.** A 96×96 sprite of a float-computed radial profile (`1 - 3 q²` inside a core, `(1 - q)² · 75` outside) is added onto the screen at ten positions that are sums of two sines each (`(sin a + sin b) · 0x34 >> 16` for y, the cosines · 0x70 for x). The add is a plain `add dword,dword`: **four pixels at a time with carries between the bytes**. There is no clamping; the palette is made so that overflow is harmless. This is a free "additive glow".
* **Lettering.** The 128×200 "greets" picture is merged with the same `(screen & mask) | picture` trick, dword by dword.
* **Dissolves.** `fond7.gif` and `fond3.gif` are not pictures to show but **dissolve orders**: for each value v = 0..255 the offsets of all pixels of that value are listed in a table (`[0x6290c]`, plus start and count per value); at tick v the pixels of group v are copied from the next picture (`0x10010`) or cleared (`0x10064`). A 256-step dissolve with a hand-drawn shape costs one table walk per frame.

### Scene 6: particles and bobs (0x18BA0)

* The point clouds (`debut`, `debut2`, `fleur`, `fleur2`, `fleur3`, `final`: 773, 773, 200, 200, 200, 586 points of `x y z w`) are **morphed** by linear interpolation in 24.8 fixed point (0x194A0 precomputes all frames: 64 frames debut → debut2, 128 + 128 frames fleur → fleur2 → fleur3).
* Every frame the cloud is rotated by three angles with a **16-bit rotation matrix** (9 entries from `sin/cos·512` tables, products shifted by 9) using the pair-multiply trick of the 3D engine, then projected with a 16-bit `idiv`.
* The balls are drawn from a sprite file (`bobz.bin`: eight 2 KB sprites stored as runs `count, x-offset, words...`). The screen is a **16-bit z-buffer**: each word is `depth << 8 | colour`; the depth is added to every sprite word and `cmp [eax],bx / jnl skip / mov [eax],bx` is both the depth test and the write. The depth buffer is 384×340 words so that sprites can hang over the edges without clipping per pixel.
* The picture behind (boite21.gif) is the cleared state of the buffer: every frame the visible 320×200 words are copied from a background copy, then the clouds are drawn. A second dissolve (grouped by the value of `rip3.gif`) overwrites buffer words with background words (stage 1) or zeros (stage 2).
* Output goes straight to `0xA0000`: four colour bytes (the low bytes of four words) are gathered into one dword with `mov ah,[esi] / mov al,[esi+2] / shl eax,16 / ... / bswap`.

### Scene 7: wireframe with flowing trails (0x16644, filter at 0x169B0, lines at 0x145F4)

The 3D engine draws only edges. Every visible face of the sorted list draws up to three **thick lines** (a plus of five pixels per step, drawn from the right end of the line to the left) in colour 0x7F. Then a **feedback filter** turns the picture into the next frame's background: the screen is cut into 160 blocks of 20×20 pixels (a 16×10 grid), each block is copied from the previous picture at an offset that points towards the centre (`-row·320 - column` pixels, so the picture slowly flows outwards), two pixels at a time: `lut[((w0 + w1) >> 1) & 0x7F7F]` where `w0` is a word of two pixels, `w1` the word one line up and one pixel right, and `lut` (64 K words) lowers both packed intensities by 5. The "SIMD within a register" average `(a+b)>>1 & 0x7f7f` handles two pixels per 16-bit operation. The palette is the gradient of `bump9.gif`; the bright 0x7F lines decay over ~25 frames.

### End-of-scene ripple (0x100B5, in scenes 3 and 5)

The last 210 (scene 3) or 350 (scene 5) frames of a 3D scene are drawn into a second buffer and copied to the screen in 2×2 blocks displaced by `sin(phase)·amplitude`, with triangular weights (zero at the screen edges) in x and y; the amplitude grows by one per frame to 63, the phases by one and two. It is a cheap water-wobble transition made of two 16-bit multiplies per block.

### The ending (0x16CF0)

After sync 9 the jellyfish stops, the screen is cleared and three 320×32 title strips (`contr`, `oxyge`, `tank`) are copied into video memory at row 84 on syncs 9, 10 and 11; on sync 12 the palette fades to black through a fade table built from the strips' palette; sync 13 ends the program.

## 4. The 3D engine

One engine drives scenes 3, 5, 7, 8 and 9. It is a classic 1996 **painter's-algorithm polygon engine** with integer arithmetic and no floating point except at load time. All coordinates are signed 32-bit integers; matrices are 16.15 fixed point.

### 4.1 Data

* **Scene files** (`.3dm`, exported from 3D Studio by the group): a header with three light parameters, the objects (vertices, faces, per-vertex mapping, two animation arrays), the materials (name, texture file, flags, colour) and a **camera track** of 7 `i16` per frame: position, target, roll. Object animation is two key arrays per object: a position per frame and an orientation quaternion per frame (stored ×64). Details and counts per scene: section 5.
* In memory a **vertex** is 46 bytes: `x, z, y, x·z` (the product is cached for the projection trick), the projected `sx, sy`, the depth, the normal, `nx·ny` (cached too) and a shade level. A **face** is 24 bytes: three vertex indices, a word that is the material index (or, for the wireframe scene, three edge-visibility bits), the object id and the face normal.
* The loader (0x133B0) also computes the object's centroid and bounding radius, one normal per face (a cross product, halved until it fits in 16 bits, scaled to 256) and one normal per vertex (the sum of the face normals, normalised with the x87: `1/len` in extended precision, truncated; this is the only floating-point code in the engine and the port had to model the x87's extended precision to match its rounding).

### 4.2 Per frame (the loop of 0x15BD0)

1. **Camera** (0x147D0): a look-at matrix from the track entry: direction normalised with an integer square root, a roll rotation from the 4096-entry sine/cosine tables, the translation multiplied in, and the **y row scaled by 512/596**: this is the aspect-ratio correction for the 4:3 screen (320×200 pixels are 1.2 times taller than wide).
2. **Per object matrix** (0x14AA0): the quaternion of the current frame becomes a 3×3 rotation (`1 - 2(b²+d²)` and the other eight terms, each product `>> 15`), the position goes into the fourth column; indices are clamped to the array length (a single key = a static object).
3. **Hierarchy** (0x154D0): the objects are linked as `child` / `sibling` lists by the loader; a recursive walk computes `world = parent · local` and `camera · world`.
4. **Prepare** (0x14DE0, per object): the bounding sphere is tested against the 320×200 view (0x15690); then every vertex is transformed and projected (§4.3), reflection-mapped materials (flag 0x80) get `u, v = (normal · view) >> 16 + 0x7F` from the normal in camera space, and lit materials (flags&3 == 2) get a light level `(n · l) >> 11` clamped to ±31 where `l` is the direction from the light to the object's centroid; the light's position is, every frame, the **sum of the camera's position and target** from the track (the 3 light parameters of the file are only used by the loader's first call).
5. **Collect** (0x13C40): for every face, reject by screen bounding box, reject **back faces by the sign of the screen-space cross product**, reject faces entirely behind the camera, and put `(face, key)` in a list, `key = -(z1+z2+z3)`, `-max z` or `-min z` depending on a mode parameter (scenes 3 and 8 use the maximum, the others the sum).
6. **Sort** (0x13210): a two-pass **radix sort** on the 16-bit key, with the nodes kept in 10-byte records linked through 256-entry bucket tables, then walked from the far end: far to near, stable.
7. **Draw** (0x14164): for each face, pick the filler from the material: flat colour, textured, or textured with a shade table; or the line drawer in the wireframe scene.

### 4.3 Vertex transform: the pair-multiply trick

The projection uses the identity `(m0 + b)(m1 + a) − m0·m1 − a·b = m0·a + m1·b`: with the products `m0·m1`, `m2·m3`, ... per frame and `a·b` per vertex precomputed (the vertex record caches `x·z` for exactly this), a dot product of three terms costs **two multiplies instead of three**, as in Winograd's inner-product algorithm. In 1996 on a Pentium `imul` was 10 cycles, so this was worth the extra adds. See the assembly in `REVERSE.md`. The screen position is `x' = (X >> 7 + tx<<8) / Z + 160`, `y' = -(Y ...) / Z + 100`, with `Z` clamped to 64 only for the divide (the stored depth is the raw one, which the sort uses).

### 4.4 The three polygon fillers

All three (flat 0x180D0, textured 0x1716F, textured + shaded 0x17855) are the same algorithm with 0, 2 or 3 interpolated attributes:

1. rotate the three vertices until the first one has the smallest y;
2. compute, per edge, the slope in 16.16 (`(Δx << 16) / Δy`, and the same for u, v and shade); the triangle needs only the slopes along **two** edges for each attribute, because the interpolation across a scanline is constant per triangle: the gradients `du/dx, dv/dx, dshade/dx` are computed **once** from the first scanline (`(u_left − u_right) / width`) and reused for every pixel of every line. This is affine texture mapping with a constant gradient, no per-pixel or per-line division;
3. fill an **edge table** (the x of the long edge, the x of the short edge, and the attributes of the left edge, 8, 16 or 20 bytes per scanline) with an unrolled add-the-slope loop whose immediates are patched (self-modifying code again);
4. clip to y < 200 while building the table, to x in [0, 319] while filling, then fill each span.

The span loop of the textured fillers is where the tricks are, see `REVERSE.md`: `u` and `v` are fixed-point numbers in one dword each, whose **integer parts are the address bytes** (`bl` = u, `bh` = v: the texture is 256×256 and the address is `bh:bl`), and the span count lives in the **low word of the u register**: `add ecx, (frac_u << 16) | 0xFFFF` adds the fractional step to the high half *and* subtracts one from the counter in the low half, and the carry out of the high half goes to `adc bl, int_u`; `or ch,ch / jns` ends the loop when the counter wraps negative. It also has a quirk the port copies: the low-word carry makes the fractional step one unit larger on every pixel but the last.

The **shade table** (`*.cpl`, 64 rows × 256 columns, one per texture, built offline against the picture's palette) turns `(light level, texel)` into a palette index: `pixel = cpl[(shade << 8) | texel]`, so gouraud-lit textured polygons need one extra byte lookup per pixel and a fourth interpolant, no palette arithmetic. The light level (row 1..63) comes from the vertex shade + 0x20; an interpolated level can wrap past the table (the shade register is 16-bit), and then the program reads the bytes **after** the table in memory (a heap header and the fade table). The port reproduces that read.

### 4.5 Materials

Material flags (byte at +0x22): `flags & 3 == 2` = a **lit** textured material (shaded filler + the shade table), `3` = textured, unlit (the filler reads u, v from the file's mapping), `1` = no texture (flat colour: `DALLES`, `FLATNOIR`, `1TOTO`); bit 7 (0x80) = **reflection map**: u, v are recomputed every frame from the normal in camera space. The colour of untextured faces is the palette entry nearest to the file's RGB (a squared-distance search at load time, 0x10E40).

## 5. The 3D objects and scenes

(Generated from the files by `oxg_tools/scene_report.js`; "keys" are the lengths of the object's position and orientation arrays, 1 = static.)

### 5.1 `scenebis.3dm`, scene 3 (11 objects, 2,631 vertices, 3,810 faces, camera track 5,776 frames = 82.4 s)

A marble floor (`SOLMARR`, 211 vertices, 390 faces, `scene2.gif`) with six identical animated blue tori (`TORBLEU`: 240 vertices each, 946 keys, `scene3.gif`) and four chrome pieces (`METAL`, texture `sc14b.gif` as a reflection map: three of 176 vertices and a larger one of 452) which follow 5,776 position keys. All objects are roots (no hierarchy). The camera track is longer than the scene needs; the program stops at tick 0x173E (5,950), so the last 174 frames repeat the final camera position. The floor and the tori are lit textures (flags 0x2: the shaded filler with `scene2.cpl`); the chrome pieces are reflection-mapped (flags 0x83: the normal in camera space picks the texel, no lighting).

### 5.2 `cirk4.3dm`, scene 5 (36 objects, 4,030 vertices, 4,568 faces, 6,201 frames = 88.5 s)

A static "city" of 26 pieces (the biggest: 336 vertices, 362 faces; five identical pillars; ten small `DALLES` flat tiles of ~20 faces, the only flat-shaded faces of the whole demo), a floor, six tiny 13-vertex markers, and animated pieces: two 166-vertex rings with 3,400-3,600 keys and two 344-vertex, 528-face objects with 5,800 position and 6,000 orientation keys that fly through the set (`REF05`). Four reflection pictures (`ref01`, `ref02`, `ref03`, `ref05`) plus a plain black material (`FLATNOIR`) give the polished-metal look; they are ordinary textures (flags 0x3) whose mapping coordinates were baked by the exporter, so this scene uses the plain textured filler and never the shade table (`ref01.cpl` is loaded but unused). The depth key here is the **sum** of the three vertex depths.

### 5.3 `line3.3dm`, scene 7 (4 objects, 887 vertices, 1,766 faces, 1,625 frames = 23.2 s)

Four wireframe objects (62, 480, 280 and 65 vertices; 120, 960, 560 and 126 faces). The face word is not a material here but the **edge flags** (4 = edge v1-v2, 2 = v2-v3, 1 = v3-v1): the flags choose which of the three edges of each triangle are drawn, so the quads of the 3D Studio mesh show only their outline. A single material (`1TOTO`, white) is declared but never used.

### 5.4 `poto4.3dm`, scene 8 (8 objects, 1,165 vertices, 1,934 faces, 3,361 frames = 48.0 s)

A room: four `DECOR` panels (55 vertices, 80 faces each), the `FOND` background shell (264 vertices, 400 faces), the `CENTRE` plate (76 vertices, 44 faces), an animated `TORTI` object (130 vertices, 224 faces, 1,401 position keys) and the reflecting centrepiece `ENVCENTRE` (475 vertices, 946 faces, texture `centref.gif` as a reflection map, 1,401 position keys and 3,361 orientation keys, so it turns for the whole scene). The scene runs 0xD20 = 3,360 ticks, i.e. one key per tick.

### 5.5 `meduse2.3dm`, scene 9 (24 objects, 1,134 vertices, 1,240 faces, 2,481 frames = 35.4 s)

The only scene with a **hierarchy**: a reflecting dome (`RELECT`, `reflec.gif`, 42 vertices, 80 faces) is the parent of four chains of four 32-vertex segments (object ids 10→11→12→13, 14→15→16→17, 18→19→20→21, 22→23→24→25), each segment animated with 2,357 position and orientation keys relative to its parent: the tentacles. Eight more textured pieces (`MEDUSE`: 64-152 vertices) make up the rest of the creature and are static. The scene's three light parameters are the only non-zero ones of the five files; the light itself is recomputed every frame from the camera.

## 6. Tricks, in one list

1. **Timer = retrace.** One interrupt per frame; the tick counter is the clock for every effect.
2. **Music as the script.** Scene order and many transitions are keyed to sync values from the module, so the demo is "cut" to the music without any timing table in the code.
3. **Self-modifying code** to turn runtime values into instruction immediates: the swirl steps, the edge-table slopes, the texture gradients, the shade step. No register pressure, no memory operand in the inner loop.
4. **Fixed-point DDA in one register with the carry flag**: `add reg, imm / adc other, imm` for the fraction-to-integer carry; the integer parts are the address bytes (`bh:bl`), so no shift or mask per pixel; a loop counter in the low word of the same register.
5. **Pair-multiply projection** (Winograd's inner product): two multiplies instead of three, with the cross products cached in the vertex.
6. **Precomputed everything**: 4096-entry sine/cosine in 32.15 and 512-scale `i16`, 64-step fade tables, the 64 K polar map, the bump displacement table, the 64 K decay and colour tables, the shade tables (64×256), the sphere radii and the normals at load time.
7. **SWAR**: two or four pixels per register in the glow add (byte carries are harmless), the 7-bit average with `& 0x7F7F`, the 16-bit depth+colour word, the masked merge `(a & mask) | b`.
8. **One computation, two rows** (swirl, water), and **half the columns** computed (256 of 320).
9. **Painter's algorithm with a stable radix sort** instead of a z-buffer, plus back-face culling on the screen-space winding; the sort key is the 16-bit negated depth so far-to-near is "ascending".
10. **Dissolves from pictures**: group the pixels by value, then reveal one group per tick; any greyscale image becomes a transition.
11. **Frame skipping by elapsed ticks**, not by a timer: the animation clock is `1 + (late ticks)`.
12. **Bug-compatible details** the port had to copy to be pixel-exact: the stored vertex depth is the unclamped one (the clamp to 64 is only for the divide); the extra fractional unit per pixel in the span loops; a shade index that wraps beyond the 64 rows of the shade table reads the following heap bytes; the vertex-normal sums done in float32 parts and normalised with an extended-precision reciprocal; the 16-bit `shr`/`and 0x7f7f` of the trail filter; a scene that never clears the screen at its start (the last picture of the previous one stays until the first display).

## 7. How it was checked

* The original EXE (DOS/4GW, Watcom C) runs unmodified in an x86 emulator (Unicorn, flat 32-bit model, `oxg_tools/run.py`) with a virtual VGA, PIT and MIDAS in "No Sound" mode. The whole demo (39,243 ticks, 560 s) was **recorded tick by tick**: the 320×200 frame, the 256-colour DAC and the music's position/sync block.
* The port is driven with the same sync values and compared to the recording **tick by tick**: frame and palette. `node test/test_seq.js` runs the whole chain; the result is **zero differing ticks** except tick 23,511, where the recording caught the real program half-way through its own screen update (a tear of the emulated retrace).
* Every routine was also compared with the real one in isolation using memory dumps taken before and after a call (`oxg_tools/capture_fn.py`, `capture_multi.py`, `log_fill.py`): the loader (285,478 values), camera, object matrices, hierarchy, vertex preparation, collection, sort, and all 2,492 + 879 logged polygon fills.
* Timing: scene durations depend on the sync edges, so the port takes the sync values as input. In the web page they come from a table recorded from the emulated run (`site/assets/sync.json`); the music is the module rendered with libopenmpt, time-warped row by row to the emulated MIDAS' timing. MIDAS in "No Sound" mode plays the module about 3.6% slower than its nominal tempo (effective BPM ≈ nominal − 5); on a real sound card the music would be at nominal tempo and the sync edges would fall a few percent earlier relative to the frame ticks.
