"""Run CONTRAST.EXE (Oxygene 1996: Watcom C/C++32 under DOS/4GW) under Unicorn, flat 32-bit, without the DOS/4GW stub.
The LE objects are loaded by le.image(); DOS (int 21h), DPMI (int 31h), the keyboard, the timer and the VGA are supplied here.
usage: run.py [SECONDS] [OUTDIR]   (needs CONTRAST.BIN / .XM / .TXT in the current directory's `game` folder, see GAME below)"""
import sys, os, struct, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unicorn import *
from unicorn.x86_const import *
import le
from vga import VGA
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.environ.get('GAME', os.path.join(HERE, '..', 'oxg_cont'))
PIT_HZ = 1193182.0
MEM = 0x4000000
GDT = 0x1000
IPS = float(os.environ.get('IPS', 1e9))      # fast CPU: a frame never takes more than a tick, as on the machines the demo was written for
SPIN = (0x102D1, 0x102D9)                      # the tick wait loop (0x102CB): cmp eax,[0x44e20]; jz

class PC:
    def __init__(self):
        self.mu = mu = Uc(UC_ARCH_X86, UC_MODE_32)
        mu.mem_map(0, MEM)
        self.L, self.objs = le.image(os.path.join(GAME, 'CONTRAST.EXE'))
        for n, ob in enumerate(self.L.objs, 1):
            m = self.objs[n]; mu.mem_write(ob['base'], bytes(m[:len(m)]))
        self.entry = self.L.objs[0]['base'] + self.L.h['eip']; self.stack = self.L.objs[1]['base'] + self.L.h['esp']
        # flat GDT: 0x08 code, 0x10 data
        def desc(base, limit): return struct.pack('<HHBBBB', limit & 0xFFFF, base & 0xFFFF, (base >> 16) & 0xFF, 0x92, (limit >> 16) & 0xF, (base >> 24) & 0xFF)
        PSP, ENV = 0x500, 0x600
        mu.mem_write(PSP, b'\xCD\x20' + bytes(0x7E) + b'\x00\r'); mu.mem_write(PSP + 0x2c, struct.pack('<H', 0x20))
        mu.mem_write(ENV, b'BLASTER=\x00\x00\x01\x00C:\\CONTRAST.EXE\x00')
        gdt = struct.pack('<QQQ', 0, 0x00CF9A000000FFFF, 0x00CF92000000FFFF) + desc(PSP, 0xFF) + desc(ENV, 0xFF)
        mu.mem_write(GDT, gdt); mu.reg_write(UC_X86_REG_GDTR, (0, GDT, 0xFF, 0))
        mu.reg_write(UC_X86_REG_CR0, mu.reg_read(UC_X86_REG_CR0) | 1)
        mu.reg_write(UC_X86_REG_CS, 0x08)
        for r in (UC_X86_REG_DS, UC_X86_REG_SS, UC_X86_REG_FS, UC_X86_REG_GS): mu.reg_write(r, 0x10)
        mu.reg_write(UC_X86_REG_ES, 0x18)         # DOS/4GW enters with ES = the PSP selector
        mu.reg_write(UC_X86_REG_ESP, self.stack); mu.reg_write(UC_X86_REG_EIP, self.entry)
        self.vga = VGA(); self.files = {}; self.nexth = 5; self.log = []; self.kbd = []; self.clock = 0.0
        self.vectors = {}; self.next_alloc = 0x1000000; self.irq0_pending = False; self.pit_reload = 65536; self.pit_next = 65536.0; self.pit_lo = None; self.pit_hi = False
        self.frames = []; self.retrace_n = 0; self.dta = 0; self.exit = None; self.mouse = None; self.insns = 0
        self.unhandled = {}
        mu.mem_write(0x700, b'\xCF')                                          # default interrupt handler: iretd
        mu.hook_add(UC_HOOK_INTR, self.on_int)
        mu.hook_add(UC_HOOK_INSN, self.on_in, None, 1, 0, UC_X86_INS_IN)
        mu.hook_add(UC_HOOK_INSN, self.on_out, None, 1, 0, UC_X86_INS_OUT)
        mu.hook_add(UC_HOOK_MEM_WRITE, self.on_vw, None, 0xA0000, 0xAFFFF)
        mu.hook_add(UC_HOOK_MEM_READ, self.on_vr, None, 0xA0000, 0xAFFFF)
        mu.hook_add(UC_HOOK_MEM_UNMAPPED, self.on_unmapped)
    # ---- helpers
    def r(self, a, n): return bytes(self.mu.mem_read(a, n))
    def reg(self, n): return self.mu.reg_read(n)
    def setreg(self, n, v): self.mu.reg_write(n, v & 0xFFFFFFFF)
    def cstr(self, a):
        s = bytearray()
        while True:
            c = self.r(a, 1)[0]
            if not c: return bytes(s)
            s.append(c); a += 1
    def carry(self, on):
        f = self.reg(UC_X86_REG_EFLAGS); self.setreg(UC_X86_REG_EFLAGS, (f | 1) if on else (f & ~1))
    def alloc(self, size):
        a = self.next_alloc; self.next_alloc += (size + 0xFFF) & ~0xFFF; return a
    # ---- VGA window
    def on_vw(self, mu, access, addr, size, val, ud):
        for k in range(size): self.vga.write(addr - 0xA0000 + k, (val >> (8 * k)) & 0xFF)
    def on_vr(self, mu, access, addr, size, val, ud):
        mu.mem_write(addr, bytes(self.vga.read(addr - 0xA0000 + k) for k in range(size)))
    def on_unmapped(self, mu, access, addr, size, val, ud):
        print('UNMAPPED access', access, hex(addr), 'eip=%x' % self.reg(UC_X86_REG_EIP)); return False
    # ---- ports
    def on_in(self, mu, port, size, ud):
        if port == 0x3DA: return self.status()
        if 0x3C0 <= port <= 0x3DF: return self.vga.inp(port)
        if port == 0x60: return self.kbd.pop(0) if self.kbd else 0
        if port == 0x40: return (int(self.pit_cnt()) & 0xFF)
        return 0
    def on_out(self, mu, port, size, val, ud):
        if 0x3C0 <= port <= 0x3DF: self.vga.out(port, size, val); return
        if port == 0x43: self.pit_hi = False; self.pit_lo = None
        if port == 0x40:
            if self.pit_lo is None: self.pit_lo = val & 0xFF
            else:
                self.pit_reload = (((val & 0xFF) << 8) | self.pit_lo) or 65536; self.pit_lo = None; self.pit_next = self.clock * PIT_HZ + self.pit_reload
    def pit_cnt(self): return max(0, self.pit_next - self.clock * PIT_HZ)
    def status(self):
        """port 3DA: bit 3 = vertical retrace (70.086 Hz frame, retrace for the last 6 % of it), bit 0 = display enable/blank.  A program that polls the port in a tight
        loop would burn instructions for nothing: the second identical answer in a row moves the virtual clock to the next change."""
        P = 1 / 70.086; ph = (self.clock % P) / P; v = 0x08 if ph >= 0.94 else (1 if (self.clock * 31469) % 1.0 < 0.2 else 0)
        if v == getattr(self, '_st', None) and (v & 8) == (self._st & 8):
            self._same = getattr(self, '_same', 0) + 1
            if self._same >= 2:
                self._same = 0
                if v & 8: self.clock += (P * (1 - ph)) + 1e-6
                else: self.clock += P * (0.94 - ph) + 1e-6
                ph = (self.clock % P) / P; v = 0x08 if ph >= 0.94 else (1 if (self.clock * 31469) % 1.0 < 0.2 else 0)
        else: self._same = 0
        self._st = v; return v
    # ---- interrupts
    def on_int(self, mu, n, ud):
        eax = self.reg(UC_X86_REG_EAX); ah = (eax >> 8) & 0xFF
        if n == 0x21: self.dos(ah, eax)
        elif n == 0x31: self.dpmi(eax & 0xFFFF)
        elif n == 0x10: self.video(ah, eax)
        elif n == 0x16:
            if ah in (0, 0x10): self.setreg(UC_X86_REG_EAX, (self.kbd.pop(0) if self.kbd else 0x1C0D) if False else 0)
            else: self.carry(False)
        elif n == 0x33: self.setreg(UC_X86_REG_EAX, 0)
        elif n == 0x2F: self.unhandled.setdefault(('2f', eax & 0xFFFF), 0); self.unhandled[('2f', eax & 0xFFFF)] += 1; self.setreg(UC_X86_REG_EAX, eax & 0xFFFF00FF if False else 0)
        else:
            self.unhandled.setdefault(('int', n), 0); self.unhandled[('int', n)] += 1
            if n in (13, 8, 6): print('int %d at eip=%x esp=%x ds=%x es=%x' % (n, self.reg(UC_X86_REG_EIP), self.reg(UC_X86_REG_ESP), self.reg(UC_X86_REG_DS), self.reg(UC_X86_REG_ES)))
    def video(self, ah, eax):
        if ah == 0:
            mode = eax & 0xFF; self.mode = mode
            v = self.vga; v.__init__() if False else None
            if mode == 0x13: self.set_mode13()
        elif ah == 0x0F: self.setreg(UC_X86_REG_EAX, (80 << 8) | getattr(self, 'mode', 3))
        elif ah == 0x12: pass
        else: self.unhandled.setdefault(('10', ah), 0); self.unhandled[('10', ah)] += 1
    def set_mode13(self):
        v = self.vga; v.seq[4] = 0x0E; v.seq[2] = 0xF; v.ac[0x10] = 0x41; v.crtc[0x14] = 0x40; v.crtc[0x17] = 0xA3; v.crtc[1] = 0x4F; v.crtc[0x12] = 0x8F; v.crtc[7] = 0x1F; v.crtc[9] = 0x41; v.crtc[0x13] = 0x28; v.crtc[0xC] = v.crtc[0xD] = 0
    def dos(self, ah, eax):
        E = lambda n: self.reg(n)
        if ah == 0xFF: self.setreg(UC_X86_REG_EAX, 0x4734)                          # DOS/4G installation check: AL != 0
        elif ah == 0x30: self.setreg(UC_X86_REG_EAX, 0x0005)                       # DOS 5.0
        elif ah == 0x09:
            s = bytearray(); a = E(UC_X86_REG_EDX)
            while self.r(a, 1) != b'$': s += self.r(a, 1); a += 1
            sys.stdout.write(s.decode('cp437', 'replace'));
        elif ah == 0x02: sys.stdout.write(chr(E(UC_X86_REG_EDX) & 0xFF))
        elif ah == 0x3D:
            name = self.cstr(E(UC_X86_REG_EDX)).decode('latin1'); p = os.path.join(GAME, name.replace('\\', '/'))
            cand = [f for f in os.listdir(GAME) if f.lower() == os.path.basename(p).lower()] if os.path.isdir(GAME) else []
            if cand: h = self.nexth; self.nexth += 1; self.files[h] = open(os.path.join(GAME, cand[0]), 'rb'); self.setreg(UC_X86_REG_EAX, h); self.carry(False)
            else: self.setreg(UC_X86_REG_EAX, 2); self.carry(True)
            self.log.append(('open', name, cand))
        elif ah == 0x3E:
            f = self.files.pop(E(UC_X86_REG_EBX), None); f and f.close(); self.carry(False)
        elif ah == 0x3F:
            h = E(UC_X86_REG_EBX); n = E(UC_X86_REG_ECX)
            if h in self.files: b = self.files[h].read(n); self.mu.mem_write(E(UC_X86_REG_EDX), b); self.setreg(UC_X86_REG_EAX, len(b)); self.carry(False)
            else: self.setreg(UC_X86_REG_EAX, 0); self.carry(False)
        elif ah == 0x40:
            n = E(UC_X86_REG_ECX); h = E(UC_X86_REG_EBX)
            if h in (1, 2): sys.stdout.write(self.r(E(UC_X86_REG_EDX), n).decode('cp437', 'replace'))
            self.setreg(UC_X86_REG_EAX, n); self.carry(False)
        elif ah == 0x42:
            h = E(UC_X86_REG_EBX); off = (E(UC_X86_REG_ECX) << 16) | (E(UC_X86_REG_EDX) & 0xFFFF); w = eax & 0xFF; f = self.files.get(h)
            if f: f.seek(off, w); p = f.tell(); self.setreg(UC_X86_REG_EAX, p & 0xFFFF); self.setreg(UC_X86_REG_EDX, p >> 16); self.carry(False)
            else: self.carry(True)
        elif ah == 0x4C: self.exit = eax & 0xFF; self.mu.emu_stop()
        elif ah == 0x2C: t = time.localtime(); self.setreg(UC_X86_REG_ECX, (t.tm_hour << 8) | t.tm_min); self.setreg(UC_X86_REG_EDX, t.tm_sec << 8)
        elif ah == 0x25: self.vectors[eax & 0xFF] = E(UC_X86_REG_EDX)
        elif ah == 0x35: self.setreg(UC_X86_REG_EBX, self.vectors.get(eax & 0xFF, 0x700)); self.setreg(UC_X86_REG_ES, 0x08)
        elif ah == 0x1A: self.dta = E(UC_X86_REG_EDX)
        elif ah in (0x62, 0x51): self.setreg(UC_X86_REG_EBX, 0x100)
        elif ah == 0x48: self.setreg(UC_X86_REG_EAX, self.alloc(E(UC_X86_REG_EBX) * 16) >> 4); self.carry(False)
        elif ah in (0x49, 0x4A): self.carry(False)
        elif ah == 0x44: self.setreg(UC_X86_REG_EDX, 0x80); self.carry(False)
        elif ah == 0x0B: self.setreg(UC_X86_REG_EAX, (eax & 0xFFFFFF00) | (0xFF if self.kbd else 0))
        elif ah in (0x07, 0x08, 0x01):
            if self.kbd: self.setreg(UC_X86_REG_EAX, (eax & 0xFFFFFF00) | self.kbd.pop(0))
            else: self.setreg(UC_X86_REG_EIP, self.reg(UC_X86_REG_EIP) - 2); self.mu.emu_stop(); self.waiting = True    # block: run the int again
        else:
            k = ('21', ah); self.unhandled[k] = self.unhandled.get(k, 0) + 1
    def dpmi(self, ax):
        E = lambda n: self.reg(n)
        if ax == 0x0501:
            size = (E(UC_X86_REG_EBX) << 16) | (E(UC_X86_REG_ECX) & 0xFFFF); a = self.alloc(size)
            self.setreg(UC_X86_REG_EBX, a >> 16); self.setreg(UC_X86_REG_ECX, a & 0xFFFF); self.setreg(UC_X86_REG_ESI, 0); self.setreg(UC_X86_REG_EDI, a & 0xFFFF); self.carry(False)
        elif ax == 0x0006: self.setreg(UC_X86_REG_ECX, 0); self.setreg(UC_X86_REG_EDX, 0); self.carry(False)
        elif ax == 0x0204: self.setreg(UC_X86_REG_ECX, 0x08); self.setreg(UC_X86_REG_EDX, self.vectors.get(E(UC_X86_REG_EBX) & 0xFF, 0x700)); self.carry(False)       # unset vectors: a stub that just irets
        elif ax == 0x0205: self.vectors[E(UC_X86_REG_EBX) & 0xFF] = E(UC_X86_REG_EDX); self.carry(False)
        elif ax in (0x0200, 0x0201): self.setreg(UC_X86_REG_ECX, 0); self.setreg(UC_X86_REG_EDX, 0); self.carry(False)
        elif ax == 0x0400: self.setreg(UC_X86_REG_EAX, 0x005A); self.setreg(UC_X86_REG_EBX, 3); self.setreg(UC_X86_REG_ECX, 4); self.setreg(UC_X86_REG_EDX, 0x0870); self.carry(False)
        elif ax == 0x0500:
            b = E(UC_X86_REG_EDI); self.mu.mem_write(b, struct.pack('<12I', 0x1000000, 4096, 4096, 4096, 0, 0, 0, 0, 0, 0, 0, 0xFFFFFFFF)); self.carry(False)
        elif ax in (0x0502, 0x0600, 0x0601, 0x0602, 0x0603, 0x0604, 0x0605, 0x0503): self.carry(False)
        elif ax == 0x0800: self.setreg(UC_X86_REG_EBX, E(UC_X86_REG_EBX)); self.carry(False)
        elif ax == 0x0300:                                                        # simulate a real-mode interrupt: nothing is installed, so every service answers 'not present'
            n = E(UC_X86_REG_EBX) & 0xFF; base = E(UC_X86_REG_EDI); regs = list(struct.unpack('<10I', self.r(base, 40)))
            self.log.append(('rm-int', hex(n), hex(regs[7] & 0xFFFF)))
            self.carry(False)
        elif ax == 0x0100: self.carry(True)
        else:
            k = ('31', ax); self.unhandled[k] = self.unhandled.get(k, 0) + 1; self.carry(True)

    def deliver(self, n):
        sp = self.reg(UC_X86_REG_ESP); eip = self.reg(UC_X86_REG_EIP); fl = self.reg(UC_X86_REG_EFLAGS); cs = self.reg(UC_X86_REG_CS)
        sp -= 12; self.mu.mem_write(sp, struct.pack('<III', eip, cs, fl)); self.setreg(UC_X86_REG_ESP, sp)
        self.setreg(UC_X86_REG_EFLAGS, fl & ~0x200); self.setreg(UC_X86_REG_EIP, self.vectors[n])
    def png(self, path):
        from PIL import Image
        f = self.vga.frame(); pal = (np.array(self.vga.dac, dtype=np.int32).reshape(-1, 3) << 2 | 3).clip(0, 255).astype(np.uint8)
        Image.fromarray(pal[f]).save(path)
    def save(self, path):
        """VM snapshot: memory, the CPU context (incl. x87) and the Python-side state"""
        import pickle, zlib, ctypes
        ctx = self.mu.context_save(); raw = ctypes.string_at(ctypes.cast(ctx.context, ctypes.c_void_p).value, ctx.size)
        st = {k: v for k, v in self.__dict__.items() if k not in ('mu', 'files', 'objs', 'L', 'frames', 'log')}
        st['_files'] = {h: (f.name, f.tell()) for h, f in self.files.items()}
        with open(path, 'wb') as f: pickle.dump(dict(state=st, ctx=raw, mem=zlib.compress(bytes(self.mu.mem_read(0, MEM)), 1)), f, protocol=4)
    def load_snapshot(self, path):
        import pickle, zlib, ctypes
        d = pickle.load(open(path, 'rb')); st = d['state']
        for k, v in st.items():
            if k != '_files': setattr(self, k, v)
        self.files = {}
        for h, (name, pos) in st['_files'].items(): f = open(name, 'rb'); f.seek(pos); self.files[h] = f
        self.mu.mem_write(0, zlib.decompress(d['mem']))
        ctx = self.mu.context_save(); ctypes.memmove(ctypes.cast(ctx.context, ctypes.c_void_p).value, d['ctx'], ctx.size); self.mu.context_restore(ctx)
    def text(self):
        d = self.r(0xB8000, 4000); return '\n'.join(''.join(chr(d[2 * (y * 80 + x)]) if d[2 * (y * 80 + x)] >= 32 else ' ' for x in range(80)).rstrip() for y in range(25))
    def run(self, seconds, hook=None, slice_insns=20000):
        mu = self.mu; eip = self.entry; t0 = time.time(); self.t_end = seconds
        while self.exit is None and self.clock < seconds:
            try: mu.emu_start(self.reg(UC_X86_REG_EIP), 0xFFFFFFFF, 0, slice_insns)
            except UcError as e:
                print('UcError', e, 'eip=%x' % self.reg(UC_X86_REG_EIP)); break
            n = slice_insns if not getattr(self, 'waiting', False) else 200; self.waiting = False
            self.insns += n; self.clock += n / IPS
            while self.clock * PIT_HZ >= self.pit_next:
                self.pit_next += self.pit_reload
                if 8 in self.vectors and self.reg(UC_X86_REG_EFLAGS) & 0x200: self.deliver(8)
            if SPIN[0] <= self.reg(UC_X86_REG_EIP) <= SPIN[1] and self.clock * PIT_HZ < self.pit_next: self.clock = self.pit_next / PIT_HZ      # waiting for the next tick: skip to it
            if hook: hook(self)
        return self

if __name__ == '__main__':
    secs = float(sys.argv[1]) if len(sys.argv) > 1 else 5
    pc = PC(); pc.kbd = [0, 0x50] * 10 + [0x0D]; pc.run(secs)
    print(pc.text()[:300]); os.makedirs(os.path.join(HERE, '..', 'oxg_out', 'shots'), exist_ok=True); pc.png(os.path.join(HERE, '..', 'oxg_out', 'shots', 'last.png')); print('vga', pc.vga.frame().shape, pc.vga.seq[4], pc.vga.crtc[:20])
    print('rm ints', [l for l in pc.log if l[0] == 'rm-int'][:10]); print('exit', pc.exit, 'clock %.2f' % pc.clock, 'eip %x' % pc.reg(UC_X86_REG_EIP)); print('files', pc.log[:20]); print('unhandled', pc.unhandled)
