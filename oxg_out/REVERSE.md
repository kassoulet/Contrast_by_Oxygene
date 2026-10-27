# contrast (Oxygene, 1996): the executable and the data

How the release is built, how its data is organised, how the real program was run under emulation, and a tour of the assembly worth reading. (What the effects do and how the 3D engine works is in `EFFECTS.md`.)

## The release

| file | what it is |
|---|---|
| `CONTRAST.EXE` (405,181 bytes) | DOS/4GW Professional bound executable: a 62,500-byte MZ stub and the DOS/16M-style loader, then a 32-bit **LE** (Linear Executable) built with **Watcom C/C++32** |
| `CONTRAST.BIN` (2,595,696) | the data archive: 59 files, see below |
| `CONTRAST.XM` (542,976) | the soundtrack by Clawz/Impact: FastTracker 2, 12 channels, 93 patterns, 119 orders, speed 4, 130 BPM |
| `CONTRAST.TXT`, `FILE_ID.DIZ` | readme (credits and addresses) and BBS description |
| `YWDIFQAO.COM` (2,559), `-U-ACE-M-.YW` (2,878) | an obfuscated COM file and an ANSI text file that came with the scene release; not used by the demo |

Credits (from the readme): code OXBAB, 3D graphics SPIRAL and MON, soundtrack CLAWZ/IMPACT, sound system **MIDAS Sound System v0.50a** by Sahara Surfers. The program’s data also contains the string "S2 loves Triton!".

## The executable

* **LE image.** Two objects, both 32-bit: object 1, code, 0x1D2E9 bytes at 0x10000 (R+X); object 2, data and BSS, 0x3AAC0 bytes at 0x30000 (only the first 11 pages are in the file, the rest is zero). Entry at object 1 + 0xF3F0 (the Watcom `_cstart_`, which starts with the string "WATCOM C/C++32 Run-Time system"), initial stack at object 2 + 0x3AAC0. 5,687 fixups (all internal, 32-bit offsets, a few selectors). `oxg_tools/le.py` loads it into a flat image (`le.image`).
* **Flat model.** DOS/4GW gives the program zero-based flat selectors, so linear address 0xA0000 is VGA memory and 0xB8000 is the text screen. The harness reproduces exactly that.
* **Code layout (object 1).** 0x10000–0x19D3F is the program (about 50 routines, most of them called once), 0x19D40 onwards is MIDAS, the Watcom C library and the DOS/4GW glue. There are about 100 software interrupts: 64 × INT 21h (files, memory, vectors), 24 × INT 31h (DPMI: allocating memory, real-mode interrupts, vectors), a few INT 10h/2Fh/33h.
* **Start-up (0x10564).** builds a 4096-entry sine, cosine and square-root table with the x87 (0x107AC), starts MIDAS (a configuration screen is shown if no setup is stored; "No Sound" is the 11th entry), opens `contrast.xm` and `contrast.bin`, installs its own INT 8 handler and **re-programs the timer to the screen refresh**: it measures the vertical-retrace period with the PIT and sets the timer to fire slightly before each retrace (0x102DB), so that the tick counter at `[0x44E20]` is a frame counter.
* **Scenes** are routines called once from the main sequence, each loading its own files (the strings are referenced from the code, see below).

### Files each scene loads (from the string references in the code)

| code at | loads | what is there |
|---|---|---|
| 0x11720 | `textdeb2…7.bin`, `textdeb5.gif`, `oxygene.gif` | the intro: swirl warp and the OXYGENE lettering |
| 0x12900–0x12A32 | `oxbab/spiral/mon/clawz.gif`, `bumpecla.gif`, `bump2.gif`, `cpalcred.bin`, `bump3…5.bin` | credits and bump-mapped scene |
| 0x133B0 | (3DM loader) | reads a 3DM scene, builds objects and materials |
| 0x15C92 | `scene2.gif`, `scene2.cpl`, `scenebis.3dm` | 3D scene 1 (textured and shaded) |
| 0x161CA | `ref01.gif`, `ref01.cpl`, `cirk4.3dm` | 3D scene 2 (reflection mapped) |
| 0x166E4 | `bump9.gif`, `line3.3dm` | 3D scene 3 |
| 0x16AED | `centre.gif`, `centre.cpl`, `poto4.3dm` | 3D scene 4 |
| 0x16D61 | `meduse.gif`, `meduse.cpl`, `meduse2.3dm`, `oxyge.gif`, `tank.gif`, `contr.gif` | the jellyfish scene and the title strips |
| 0x1852B | `greets.gif`, `fond7.gif`, `final.gif`, `fond3.gif` | greetings and end |
| 0x18CBA | `boite21.gif`, `rip3.gif`, `bobz.bin`, `debut(2).3dm`, `fleur(2,3).3dm`, `final.3dm` | particle morphs (point clouds) and bobs |

## CONTRAST.BIN

A directory of **24-byte records** (16-byte NUL-padded name, u32 offset, u32 size) in the first 0xC00 bytes (up to 128 slots, 59 used, the list ends at the first empty name); the files follow, contiguous, in directory order. 2,592,624 bytes of data + 3,072 of directory = the file size exactly. `oxg_tools/extract_bin.py` extracts them (to `oxg_out/data`).

| kind | files | format |
|---|---|---|
| GIF | 32 | standard GIF with the palette inside: textures (`scene2`, `scene3`, `meduse`, `torti`, `decor`, `fond`…), bump maps (`bump2`, `bump9`, `bumpecla`), reflection/environment maps (`ref01…05`, `reflec`, `centref`), backgrounds and lettering (`oxygene`, `final`, `greets`, `contr`…). 256×256 for textures, 320×200 for screens |
| `.bin`, 768 bytes | `textdeb*.bin`, `bump3…5.bin` | a palette: 256 × RGB, **8 bits per channel** (the demo writes `value >> 2` to the DAC) |
| `.cpl`, 16,384 bytes | `scene2`, `ref01`, `centre`, `meduse` | a **colour/shade lookup table, 64 rows × 256 columns**: `cpl[level][colour]` gives the colour of palette entry `colour` at brightness `level`. Row 63 is the identity (full brightness; 204–245 of the 256 entries unchanged), rows 0–16 are black, the mean luminance rises linearly between rows ~16 and ~48. It is built against the palette of the GIF of the same name |
| `cpalcred.bin`, `bobz.bin` | 16,384 bytes each | tables for the credits colours and for the bobs (not yet decoded) |
| `.3dm`, "3DM!" | `scenebis`, `cirk4`, `line3`, `poto4`, `meduse2` | animated hierarchical 3D scenes exported from 3D Studio, see below |
| `.3dm`, point cloud | `debut`, `debut2`, `final`, `fleur`, `fleur2`, `fleur3` | morph targets |
| `contrast.txt` | | the readme |

### 3DM scenes (`oxg_tools/parse_3dm.py` checks that the structure accounts for every byte of all five)

```
"3DM!"  u32 off_anim  i16 params[3]  u16 nobj  u32 objoff[nobj]  u16 nmat  u32 matoff[nmat]
at off_anim: u16 nrec, nrec × 7 × i16 animation records (position and three angles of each object for every frame)
objects (contiguous, in order):
    u32 off[5]  i16 id  i16 parent  i16 tag
    vertices  u16 n, n × 3 × i16 (x, y, z)
    faces     u16 n, n × 4 × i16 (v1, v2, v3, flags)
    array C   u16 n, n × 3 × i16     (one entry: the pivot / local axes)
    array D   u16 n, n × 4 × i16
    mapping   u16 n, n × 2 × i16 (u, v) per vertex
materials (36 bytes): char name[16]  char texture[16]  4 bytes (colour and flags)
```

| scene | objects | vertices | faces | animation records | materials |
|---|---|---|---|---|---|
| `scenebis` | 11 | 2,631 | 3,810 | 5,776 | SOLMARR (`scene2.gif`), TORBLEU (`scene3.gif`), METAL (`sc14b.gif`) |
| `cirk4` | 36 | 4,030 | 4,568 | 6,201 | FLATNOIR, REF01/02/3/05 (reflection maps), DALLES |
| `line3` | 4 | 887 | 1,766 | 1,625 | 1TOTO |
| `poto4` | 8 | 1,165 | 1,934 | 3,361 | DECOR, CENTRE, FOND, TORTI, ENVCENTRE (`centref.gif`) |
| `meduse2` | 24 | 1,134 | 1,240 | 2,481 | MEDUSE (`meduse.gif`), RELECT (`reflec.gif`) |

Point clouds: `u16 n`, then n × (x, y, z, w) as i16 (w is 0 or 3): `debut`/`debut2` 773 points, `final` 586, `fleur`, `fleur2`, `fleur3` 200 each. Same point order in the pairs, so they morph point by point.

## The module

`CONTRAST.XM`: FastTracker 2.00, 12 channels, 93 patterns (5,952 rows), 119 orders, speed 4 and 130 BPM, Amiga frequency table; the instrument names carry the author's address. The demo plays it through MIDAS; the harness runs the demo without sound ("No Sound" device) and keeps the scene timing from the timer interrupt.

## The harness (`oxg_tools/run.py`)

The program runs unmodified under **Unicorn** as a flat 32-bit process: the LE objects are loaded at their bases, a flat GDT (selector 0x08 code, 0x10 data) plus a PSP and an environment selector replace DOS/4GW, and the harness supplies

* INT 21h (file I/O on the release folder, memory, vectors, the DOS/4G installation check `AX=FF00h`), INT 31h (DPMI: memory blocks, vectors, "simulate real-mode interrupt" answered as not-present), INT 10h mode 13h, INT 16h/21h keyboard (the keys for the MIDAS menu are injected);
* the VGA (`oxg_tools/vga.py`: sequencer, CRTC, graphics controller, DAC, chain-4), the PIT with IRQ0 delivery through the program's own vector, and a virtual retrace;
* a virtual clock (30 million instructions per second), snapshots of the whole VM (`PC.save`, `PC.load_snapshot`), a frame grabber and an instruction profiler (`oxg_tools/profile.py`).

`oxg_tools/survey.py` runs it and writes a contact sheet. The first frames show a pink swirl and the letters of OXYGENE appearing one by one: the program starts, loads its data and runs, with MIDAS in "No Sound" mode.

## The assembly: a few snippets worth reading

All listings are from `oxg_out/code.asm` (object 1 at 0x10000, Intel syntax, addresses as the program has them). Comments are mine.

### 1. The clock: a frame counter fed by the retrace

```
000102CB  push eax
000102CC  mov eax,[0x44e20]        ; tick counter, incremented by the demo's own IRQ0 handler
000102D1  cmp eax,[0x44e20]        ; ... spin until it changes
000102D7  jz 0x102d1
000102D9  pop eax
000102DA  ret
```

`0x102DB` first measures three retraces on port 0x3DA, then reprograms the PIT (`out 0x43,0x36`, count 0) and times one retrace period with the counter to set the reload value, so IRQ0 fires once per frame. Every scene's "wait for the next frame" is the loop above.

### 2. Self-modifying code: the swirl (0x11FB7)

The per-row step is computed in registers and then **written into the immediates** of the loop, so the inner loop has no memory operands:

```
00011FCF  mov [0x3010c],ecx        ; the rotation step ...
00011FDA  mov [esi],ecx            ; ... stored into the immediate of an `add` below
...
000120B7  mov bh,ch                ; bh = integer part of u
000120B9  mov bl,al                ; bl = integer part of v
000120BB  mov bx,[edi+ebx*2]       ; 64K-entry polar map: (u,v) -> texture offset
000120BF  add bx,0xfff             ; immediate patched with the animation offset
000120C4  mov dh,[ebx+ebp]         ; texel
000120C7  add ecx,0xfffffff        ; patched fractional step ...
000120CD  adc al,ah                ; ... the carry feeds the integer part of v
...                                ; (four pixels per pass, packed into edx)
0001211D  mov [esi],edx            ; one dword of four pixels
0001211F  mov [esi-0x140],edx      ; and the same four pixels one line up: rows are doubled
```

### 3. Pair-multiply projection (0x14DE0, the vertex loop)

`(m0 + b)(m1 + a) - m0*m1 - a*b = m0*a + m1*b`, so a three-term dot product costs two `imul`. `[ebx+0xc]` holds the vertex's cached `x*z`; the `m0*m1` products are computed once per object (`[esp+0xcc]`, `[esp+0xc8]`).

```
00015150  mov ebp,[esp+0x44]       ; M[0]
00015154  mov eax,[ebx]            ; x
00015156  add ebp,eax              ; M0 + x
00015158  mov edx,[ebx+0x4]        ; z
0001515B  mov [esp+0xb0],ebp
00015162  mov ebp,[esp+0x40]       ; M[1]
00015166  add ebp,edx              ; M1 + z
00015168  imul ebp,[esp+0xb0]      ; (M0+x)(M1+z)
00015170  mov esi,[ebx+0xc]        ; x*z, cached in the vertex
00015173  sub ebp,esi              ; - x*z
00015175  sub ebp,[esp+0xcc]       ; - M0*M1, per object
0001517C  mov ecx,[ebx+0x8]        ; y
...
0001518A  imul ebp,ecx             ; + M2*y
...
000151A2  sar ebp,byte 0x7         ; then + (M3 << 8): the x of the camera-space vertex
```

### 4. The depth sort: two passes of linked lists (0x13210)

A face-list node is 10 bytes: pointer (4), 16-bit key (2), link (4). Pass 1 pushes every node on the list of its **low** key byte, pass 2 pops the 256 lists from the highest and pushes each node on the list of its **high** key byte: a stable LSD radix sort without any array copy.

```
00013249  imul ebx,eax,0xa            ; node = 0x4cc5c + 10*i
0001324C  mov dx,[ebx+0x4cc60]        ; key
00013253  xor dh,dh                   ; low byte
0001325B  mov ecx,[edx*4+0x58fac]     ; old head of that bucket
00013263  mov [ebx+0x4cc62],ecx       ; node.next = old head
00013269  mov [edx*4+0x58fac],esi     ; head = node (esi = node address)
...
0001328E  mov bx,[eax+0x4]            ; pass 2: key of the popped node
00013295  sar ebx,byte 0x8            ; high byte
000132AA  mov ecx,[ebx*4+0x4c85c]
000132B1  mov [eax+0x6],ecx           ; push on the high-byte list
000132B4  mov [ebx*4+0x4c85c],eax
```

### 5. The texture span: carry flag as the fixed-point carry, counter in the same register (0x17855)

`bl:bh` = (u, v) integer parts = the address in the 256x256 texture; `ecx` holds `frac(u)` in its high half and **the pixel counter in its low half**; `edx` holds `frac(v)` in its high half and the shade level in `dh`. The immediates (steps) are patched per triangle.

```
00018095  mov al,[ebx+edi]            ; texel = texture[v:u]
00018098  mov ah,dh                   ; shade level (integer part of the shade)
0001809A  mov al,[eax+esi]            ; shade table: palette index = cpl[shade:texel]
0001809D  add ecx,0xfff0000           ; imm = (frac step of u << 16) | 0xFFFF
000180A3  adc bl,0xf                  ; carry out of the fraction -> integer part, + integer step
000180A6  mov [ebp+0x0],al            ; plot
000180A9  add edx,0xfff0000           ; imm = (frac step of v << 16) | shade step
000180AF  adc bh,0xf
000180B2  inc ebp
000180B3  or ch,ch                    ; bit 15 of the counter in cx: the loop ends when it goes negative
000180B5  jns 0x18095
```

The low word of the `add ecx` immediate is 0xFFFF, i.e. -1: the pixel counter in `cx` is decremented by the same instruction that advances `u`. The side effect (a carry out of `cx` into the high half whenever the counter is not zero) makes the fractional step one unit larger on all pixels but the last; the port copies it.

### 6. SWAR: four pixels added at once (0x18B38, the orbs of the greetings)

```
00018B6B  mov ecx,[ebx]               ; four sprite bytes
00018B6D  mov ebp,[eax]               ; four screen pixels
00018B6F  add eax,0x4
00018B72  add ebx,0x4
00018B75  add ebp,ecx                 ; four additions, carries run into the neighbouring pixel
00018B78  mov [eax-0x4],ebp
```

### 7. The ripple: two multiplies per 2x2 block (0x100B5)

```
0001014B  mov ax,[ebp+0x0]            ; sine word for this column
0001014F  imul word [0x30034]         ; * (row weight * amplitude)  -> dx = vertical offset
00010156  mov ecx,edx
0001015A  shl ecx,byte 0x6
0001015D  shl edx,byte 0x8
00010162  add ecx,edx                 ; offset * 320
00010164  imul word [0x30036]         ; (column weight) * (sine of the row phase * amplitude)
0001016B  add ecx,edx                 ; + horizontal offset
0001016D  shl ecx,byte 0x10           ; keep 16 bits, signed
00010170  sar ecx,byte 0x10
00010173  mov dx,[ecx+edi+0x140]       ; two pixels of the next line, displaced
0001017E  mov ax,[ecx+edi]             ; two pixels
00010185  mov [esi+0x140],dx
0001018F  mov [esi],ax
```

### 8. A depth test that is also the pixel write (0x19C45, the bobs)

The screen is an array of 16-bit words, `depth << 8 | colour`; the sprite word plus the depth word is compared with what is there as a *signed* word:

```
00019CD3  mov bx,[edi]                ; sprite word (colour, bits of shading)
00019CD6  add ebx,ecx                 ; + depth << 8
00019CDB  cmp [eax],bx
00019CDE  jnl 0x19ce3                 ; the word already there is nearer or equal: keep it
00019CE0  mov [eax],bx                ; one store = depth write + colour write
00019CE3  add eax,0x2
00019CE6  dec dl                      ; pixel count of the run
00019CE8  jnz 0x19cd3
```

### 9. The decaying trail filter (0x169B0): two pixels per 16-bit operation

```
00016A13  mov ax,[edx]                ; two pixels of the previous picture
00016A16  add ax,[edx-0x13f]          ; + two pixels one line up and one to the right
00016A1D  shr ax,1                    ; average (both bytes at once)
00016A23  and eax,0x7f7f              ; keep 7 bits per pixel, kill the bit that crossed over
00016A2D  mov esi,edi
00016A32  mov ax,[esi+eax*2]          ; 64K-entry word table: both intensities minus 5
00016A37  mov [ebx-0x2],ax            ; into the next picture
```

### 10. Truncating `frndint`: how the sine tables are rounded (0x1F3D0)

Watcom's `float -> int` helper sets the x87 rounding bits to "truncate" around `frndint`; all tables the demo builds with `fsin`/`fcos` are therefore **truncated toward zero**, not rounded, which is why a straightforward rounding port is off by one on many entries:

```
0001F3D2  fnstcw [esp]
0001F3D5  wait
0001F3D6  push dword [esp]
0001F3D9  mov byte [esp+0x1],0x1f     ; precision = extended, rounding = truncate
0001F3DE  fldcw [esp]
0001F3E1  frndint
0001F3E3  fldcw [esp+0x4]             ; restore
```

### 11. The thick line (0x145F4)

Five pixels per step, drawn from the right end to the left: the x-major loop writes a horizontal bar of three and one pixel above and below the middle.

```
0001475D  dec eax                     ; one pixel left
0001475E  mov [eax+0x1],bl            ; the colour comes from the stack argument (0x7f)
00014761  mov [eax+0x2],bl
00014764  mov [eax],bl                ; three in a row ...
00014766  mov [eax+0x141],bl          ; ... one below the middle one
0001476C  sub edx,ecx                 ; error -= |dy|
0001476E  mov [eax-0x13f],bl          ; ... and one above it
00014774  test edx,edx
00014776  jg 0x14752                  ; no y step yet
00014778  mov ebp,[esp+0x10]          ; +-320
0001477C  add edx,edi                 ; error += dx
0001477E  add eax,ebp                 ; y step
```

## Tools

`oxg_tools/`: `extract_bin.py` (archive), `le.py` (LE parser and flat image), `parse_3dm.py`, `xm_info.py`, `xm_timeline.py` (row times of the module), `vga.py` + `run.py` + `survey.py` + `profile.py` (the harness), `record.py` + `export_rec2.py` (record the whole run tick by tick), `capture_fn.py`, `capture_multi.py`, `log_fill.py` (memory dumps of single routines, logs of every polygon fill), `scene_report.js` (3D scene tables), `render_xm.c` (the module rendered and time-warped), `sheet.py` (contact sheets).

## The port

`oxg_web/src/*.js` is the port, one module per routine group; `node test/test_seq.js` runs the entire demo against the recording. `EFFECTS.md` explains what each module does. The web page is `oxg_web/site/` (`node build.js` bundles `src/` into `site/oxg.js`).

## Open points

* The meaning of the 3DM `tag` field and of the material's extra colour bytes (not needed by the engine as exercised).
* The behaviour of the demo on a real sound card (MIDAS timing, see `EFFECTS.md` section 7) could not be observed; the port follows the emulated "No Sound" run.
