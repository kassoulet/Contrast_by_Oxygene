# CONTRAST (Oxygene, 1996) - asm snippets worth reading

All addresses are linear addresses of object 1 (the code) of `CONTRAST.EXE`, which is a DOS/4GW-bound **LE** executable built with Watcom C/C++32 (not packed: `oxg_tools/le.py`
parses the LE and builds the flat image, code at 0x10000, data at 0x30000). `oxg_out/code.bin` / `code.asm` is that code object disassembled. For this write-up I re-listed every snippet
below from `oxg_out/code.bin` with `objdump -D -b binary -mi386 -M intel --adjust-vma=0x10000` (capstone is not installed here) and cross-checked it against the `ndisasm` listing in `code.asm`;
the two agree. Comments are mine. Watcom register convention: arguments in EAX, EDX, EBX, ECX, then the stack.

The code is a 1996 software engine for a 486/Pentium: integer only for the pixels and the 3D (x87 only at load time and for tables), 16.16 fixed point, lots of self-modifying code.
The tricks are period-typical, a few are neat.

---

## 1. Timer locked to the retrace (0x102CB, 0x102DB)

```
102db: cli
       ...
10312: mov dx,0x3da
10316: in al,dx / test al,8 / jz 10316        ; wait for retrace start
1031b: in al,dx / test al,8 / jnz 1031b       ; wait for its end
10320: loop 10316                             ; ecx = 3 retraces
10322: mov al,0x36 / out 0x43,al / xor al,al / out 0x40,al / out 0x40,al   ; PIT channel 0, mode 3, count 0
       ... wait one more retrace, latch the counter (xor al,al / out 0x43,al / in al,0x40 ...)

102cb: push eax
102cc: mov eax,[0x44e20]        ; tick counter, incremented by the demo's own IRQ0 handler
102d1: cmp eax,[0x44e20]        ; spin until it changes
102d7: je 102d1
102d9: pop eax / ret
```

The program measures one retrace period with the PIT and re-programs IRQ0 to fire once per video frame (`oxg_out/REVERSE.md`). From then on `[0x44E20]` is a frame counter, and
"wait for the next frame" is a three-instruction spin with no port access. It also makes the animation clock: a second counter gives the ticks that passed during an iteration, so a slow
machine skips frames instead of slowing the music (`oxg_out/EFFECTS.md`, section 2).

## 2. Self-modifying swirl: the step lives in the instruction stream (0x11FB7, loop 0x120B7)

Setup writes the same 32-bit step into the immediate of four `add ecx,imm32`:

```
11fcf: mov [0x3010c],ecx
11fd5: mov esi,0x120c9 / mov [esi],ecx         ; immediates of the four adds below
11fdc: mov esi,0x120e1 / mov [esi],ecx
11fe3: mov esi,0x120fc / mov [esi],ecx
11fea: mov esi,0x12114 / mov [esi],ecx
```

Then the inner loop (one of four unrolled pixels; the others are identical, imm bytes show the file image's placeholder):

```
120b7: mov bh,ch                 ; bh = integer part of u
120b9: mov bl,al                 ; bl = integer part of v
120bb: mov bx,[edi+ebx*2]        ; 64K-entry polar map: (u,v) -> texture offset
120bf: add bx,0xfff              ; immediate patched with the animation offset
120c4: mov dh,[ebx+ebp]          ; texel
120c7: add ecx,0xfffffff         ; patched step: fractional part in the high half, v step in the low half
120cd: adc al,ah                 ; carry out of the fraction feeds the integer part of the other coordinate
   ... three more pixels ...
1211a: sub esi,4
1211d: mov [esi],edx             ; four pixels in one dword
1211f: mov [esi-0x140],edx       ; and the same four pixels one line up
```

Why it is nice: per pixel there is one map read and one texture read, no multiply and no shift; the position is two bytes of a register pair (`ch` and `al` are the table address bytes)
advanced by one `add` plus one `adc`, with the step baked into the code so no register or memory operand holds it. Four pixels are packed in `edx` and stored with one `mov`, twice (two rows
per computed row). Four routines with slightly different patched constants implement the variants selected by the music state (the port's `variant` 0..3, `src/swirl.js`).

## 3. The textured span: carry as the fixed-point carry, pixel counter in the same register (0x17855 area, loop 0x18095)

Setup, per span:

```
18072: rol edx,16 / rol ecx,16   ; fractions of v and u into the high words
18078: mov bh,dl                 ; integer part of v
1807a: mov bl,cl                 ; integer part of u  -> bh:bl = address in a 256x256 texture
1807c: dec ax / mov cx,ax        ; cx = width - 1 : the pixel counter, in the low half of ecx
18081: mov dx,[edi+0x10]         ; low half of edx = shade level
```

Loop:

```
18095: mov al,[ebx+edi]          ; texel = texture[v:u]
18098: mov ah,dh                 ; shade level (integer part of the shade)
1809a: mov al,[eax+esi]          ; palette index = cpl[shade:texel]
1809d: add ecx,0xfff0000         ; imm = (frac step of u << 16) | 0xFFFF  (patched per triangle)
180a3: adc bl,0xf                ; carry out of the fraction -> integer part, plus the integer step
180a6: mov [ebp+0],al            ; plot
180a9: add edx,0xfff0000         ; imm = (frac step of v << 16) | shade step
180af: adc bh,0xf
180b2: inc ebp
180b3: or ch,ch                  ; bit 15 of the counter in cx: loop ends when it goes negative
180b5: jns 18095
```

Why it is nice: `bh:bl` *are* the texture address, so there is no shift or mask per pixel; the shade is `dh` of the same register that accumulates the v fraction, and `mov ah,dh` builds the
64x256 shade-table index for free. The counter is the low word of `ecx`: since the immediate's low word is 0xFFFF (-1), the same `add` that advances u also decrements the counter, and `or ch,ch / jns`
tests its sign. Side effect, which the port reproduces (`src/fill.js`): a carry from the counter into the high half on every pixel except the last, so the fractional step of u is effectively one unit
larger. Eleven instructions per textured, lit pixel with no multiply.

## 4. Pair-multiply projection (0x15150, the vertex loop of 0x14DE0)

```
15150: mov ebp,[esp+0x44]        ; M0
15154: mov eax,[ebx]             ; x
15156: add ebp,eax               ; M0 + x
15158: mov edx,[ebx+4]           ; z
1515b: mov [esp+0xb0],ebp
15162: mov ebp,[esp+0x40]        ; M1
15166: add ebp,edx               ; M1 + z
15168: imul ebp,[esp+0xb0]       ; (M0+x)(M1+z)
15170: mov esi,[ebx+0xc]         ; x*z, cached in the vertex record
15173: sub ebp,esi               ; - x*z
15175: sub ebp,[esp+0xcc]        ; - M0*M1, computed once per object
1517c: mov ecx,[ebx+8]           ; y
15186: mov ebp,[esp+0x48] / imul ebp,ecx       ; M2*y
15194: ... add ebp,[esp+0xb0]
151a2: sar ebp,7
```

`(M0 + x)(M1 + z) - x*z - M0*M1 = M0*z + M1*x`, so a three-term dot product costs two `imul` instead of three: the `x*z` product is stored in the vertex when the mesh is loaded
(and `nx*ny` for normals), `M0*M1` is computed once per object. This is Winograd's inner-product trick, worthwhile when `imul` is ~10 cycles. The port's `prepare.js` states the identity in its header and
`particles` use it again with 16-bit matrices (0x197C2). The camera's y row is scaled by 512/596 elsewhere for the 4:3 aspect.

## 5. The depth sort: two passes of linked lists, no array copy (0x13249..0x132BB)

Nodes of 10 bytes (pointer 4, 16-bit key 2, link 4) at 0x4CC5C, bucket heads at 0x58FAC and 0x4C85C.

```
13249: imul ebx,eax,0xa           ; node = 0x4cc5c + 10*i
1324c: mov dx,[ebx+0x4cc60]       ; key
13253: xor dh,dh                  ; low byte
13255: and edx,0xffff
1325b: mov ecx,[edx*4+0x58fac]    ; old head of that bucket
13263: mov [ebx+0x4cc62],ecx      ; node.next = old head
13269: mov [edx*4+0x58fac],esi    ; head = node
13270: add esi,0xa
...
13277: mov esi,0x3fc              ; pass 2: buckets from the highest
13280: mov ebx,[edx+0x58fac]
1328e: mov bx,[eax+4]             ; key of the popped node
13292: mov ecx,[eax+6]            ; its link
13295: sar ebx,8                  ; high byte
13298: mov [edx+0x58fac],ecx      ; pop
132aa: mov ecx,[ebx*4+0x4c85c]
132b1: mov [eax+6],ecx            ; push on the list of the high byte
132b4: mov [ebx*4+0x4c85c],eax
```

A radix sort on a 16-bit key in two passes, built from singly linked lists: pushing a node on a bucket is three moves, and pass 2 moves each node from one table to the other by pointer,
so nothing is copied or compared. The key is the *negated* depth, so ascending order is far-to-near for the painter's algorithm. The port substitutes a stable sort on the same 16-bit key and matches
the original's output on recorded frames (`test_sort.js` per `oxg_out/EFFECTS.md`).

## 6. Four pixels added at once, glow without clamping (0x18B66..0x18B8A, greetings orbs)

```
18b66: mov edx,0x18               ; 24 dwords = 96 pixels per row
18b6b: mov ecx,[ebx]              ; four sprite bytes
18b6d: mov ebp,[eax]              ; four screen pixels
18b6f: add eax,4
18b72: add ebx,4
18b75: add ebp,ecx                ; four additions, carries run into the neighbouring byte
18b77: dec edx
18b78: mov [eax-4],ebp
18b7b: test dx,dx / jg 18b6b
18b80: inc esi / add eax,0xe0 / cmp si,0x60 / jl 18b66     ; next row (320 - 96 = 0xe0 bytes on)
```

SWAR (SIMD within a register) on a 486: one `add` is four additive-blend pixels. The byte carries are harmless because the palette is built so that overflow does not matter; there is no clamp, no
lookup, six instructions per four pixels.

## 7. The z-test that is also the pixel write (0x19CD3, bobs)

The screen is an array of 16-bit words `depth << 8 | colour`:

```
19cd3: mov bx,[edi]              ; sprite word (colour bits)
19cd6: add ebx,ecx               ; + depth << 8
19cd8: add edi,2
19cdb: cmp [eax],bx              ; stored word vs new word, as signed 16-bit
19cde: jge 19ce3                 ; stored is nearer or equal: keep it
19ce0: mov [eax],bx              ; one store = depth write + colour write
19ce3: add eax,2
19ce6: dec dl
19ce8: jne 19cd3
```

A z-buffer without a z-buffer: the depth is the high byte of the colour word, so a single compare is the depth test and a single store writes both. Adding the depth to the sprite word
shades the ball by distance for free. A final pass gathers the low bytes of four words into one dword for the video write (`bswap`, in `oxg_out/EFFECTS.md`).

## 8. Two pixels per 16-bit operation: the trail filter (0x16A13, filter of 0x169B0)

```
16a13: mov ax,[edx]              ; two pixels of the previous picture
16a16: add ax,[edx-0x13f]        ; + two pixels one line up and one to the right
16a1d: shr ax,1                  ; average, both bytes at once
16a20: add edx,2
16a23: and eax,0x7f7f            ; 7 bits per pixel: kills the bit that crossed over
16a28: and eax,0xffff
16a2d: mov esi,edi
16a32: mov ax,[esi+eax*2]        ; 64K-entry word table: both intensities lowered by 5
16a37: mov [ebx-2],ax            ; into the next picture
```

Pixels are 7-bit gradient indices (the line colour is 0x7F), so `(a + b) >> 1` of a packed pair works with a mask: the bit shifted from the high byte into the low one lands in bit 7 and is
removed by `& 0x7F7F`. The same table lookup that decays the value (`lut[w]`, 128 x 256 words) decays both pixels in one read.

## 9. The ripple: two multiplies per 2x2 block (0x10141..0x10195)

```
1014b: mov ax,[ebp]               ; sine word for this column
1014f: imul word [0x30034]        ; dx:ax = ax * (row weight * amplitude)    -> dx = vertical offset
10156: mov ecx,edx
10158: xor eax,eax
1015a: shl ecx,6
1015d: shl edx,8
10160: mov al,[ebx]               ; column weight byte
10162: add ecx,edx                ; offset * 320 (= * 64 + * 256)
10164: imul word [0x30036]        ; * (sine of the row phase * amplitude)    -> dx = horizontal offset
1016b: add ecx,edx
1016d: shl ecx,0x10 / sar ecx,0x10  ; keep 16 bits, signed
10173: mov dx,[ecx+edi+0x140]     ; two pixels of the next line, displaced
1017e: mov ax,[ecx+edi]           ; two pixels
10185: mov [esi+0x140],dx
1018f: mov [esi],ax
```

`imul word` leaves the high 16 bits in `dx`, i.e. the `>> 16` is free. `* 320` is `<< 6` plus `<< 8`. Pixels move two at a time (16-bit loads) and two lines at once (+0x140), so one
iteration of two multiplies produces a 2x2 block. A cheap water-wobble transition. The port's `ripple` (`src/scene3.js`) is the same arithmetic.

## 10. Dissolve from a picture (0x10010, 0x10064)

```
10027: mov cx,[esi+ebx*2]         ; count of pixels in group v
1002b: or cx,cx / jz 10062
10030: mov esi,[0x62a9c]
10036: mov ax,[esi+ebx*2]         ; start of the group in the offset table
1003a: mov esi,[0x6290c]
10040: add eax,eax
10042: add esi,eax                ; address of the first offset
10044: mov ebp,[0x44e38]          ; destination picture
1004a: mov edi,[0x62a80]          ; source picture
10054: mov ax,[esi]               ; pixel offset
10057: mov bl,[eax+edi]           ; source pixel
1005a: mov [eax+ebp],bl           ; into the screen buffer
1005d: add esi,2
10060: loop 10054
```

At start-up the demo groups pixel offsets by the value of a 320x200 GIF (`fond7`, `fond3`, `rip3`). At tick v the group of value v is copied: the `loop` instruction does the counting, and one
256-entry table of (start, count) turns any greyscale picture into a transition. The twin routine at 0x10064 clears instead of copying.

## 11. The thick line (0x14752..0x14780)

```
14752: mov [esp],esi               ; remaining pixels
14755: mov ebp,[esp]
14758: dec esi
14759: test ebp,ebp / jng 147bc
1475d: dec eax                     ; one pixel left
1475e: mov [eax+1],bl              ; colour in bl (stack argument 0x7f)
14761: mov [eax+2],bl
14764: mov [eax],bl                ; three in a row ...
14766: mov [eax+0x141],bl          ; ... one below the middle one
1476c: sub edx,ecx                 ; error -= |dy|
1476e: mov [eax-0x13f],bl          ; ... and one above it
14774: test edx,edx / jg 14752     ; no y step yet
14778: mov ebp,[esp+0x10]          ; +-320
1477c: add edx,edi                 ; error += dx
1477e: add eax,ebp                 ; y step
```

A Bresenham x-major loop that writes five pixels (a plus) per step, so the wireframe has thick, clearly visible lines without a second pass. The error update is interleaved with the stores;
the y step costs only an add of +-320.

## 12. Truncating float-to-int cast (0x1F3D0)

```
1f3d2: fnstcw [esp]
1f3d5: wait / push dword [esp]
1f3d9: mov byte [esp+1],0x1f      ; control word high byte: round toward zero
1f3de: fldcw [esp]
1f3e1: frndint
1f3e3: fldcw [esp+4]              ; restore
```

Watcom's `float -> int` helper puts the x87 in truncate mode around `frndint`. All the tables the demo builds with `fsin`/`fcos`/`fsqrt` (the 4096-entry sine/cosine, the square roots, the
camera's integer square root) are therefore **truncated**, not rounded. A port that rounds is off by one on many entries; `src/tables.js` uses `Math.trunc` for this reason.

## Not covered

The EXE has about 50 routines in the program proper (0x10000-0x19D3F) plus MIDAS and the Watcom runtime above it; I only list routines I read and could tie to the port. The polygon edge-table
builder (self-modifying slopes) and the loader's x87 normal computation are described in `oxg_out/EFFECTS.md` but I did not extract a listing of them here.
