"""Capture a test vector for one routine of the program: run from a snapshot until the routine is entered, save the data/heap memory before and when it returns.
Output OUT.bin = header (JSON length u32 + JSON {regs, regions:[[addr, len]...], ret}) then the 'before' bytes of all regions, then the 'after' bytes.
usage: capture_fn.py SNAPSHOT ENTRY_HEX OUT.bin [skip_calls]"""
import sys, json, struct
import run
from unicorn import *
from unicorn.x86_const import *
snap, entry, out = sys.argv[1], int(sys.argv[2], 16), sys.argv[3]; skip = int(sys.argv[4]) if len(sys.argv) > 4 else 0
pc = run.PC(); pc.load_snapshot(snap); st = dict(n=0, before=None, ret=None, after=None, regs=None)
REG = [UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDX, UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_ESP]
def regions(): return [(0x30000, 0x3AAC0 + 0x4000), (0x1000000, max(0x1000, pc.next_alloc - 0x1000000))]
def grab(): return [pc.r(a, n) for a, n in regions()]
def at_entry(mu, a, sz, ud):
    if st['before'] is not None: return
    if st['n'] < skip: st['n'] += 1; return
    sp = pc.reg(UC_X86_REG_ESP); st['ret'] = struct.unpack('<I', pc.r(sp, 4))[0]; st['regs'] = [pc.reg(r) for r in REG]; st['before'] = grab()
    h = []
    def at_ret(mu, a, sz, ud):
        if pc.reg(UC_X86_REG_ESP) == sp + 4 and st['after'] is None: st['after'] = grab(); st['rregs'] = [pc.reg(r) for r in REG]; mu.emu_stop()
    mu.hook_add(UC_HOOK_CODE, at_ret, None, st['ret'], st['ret'])
pc.mu.hook_add(UC_HOOK_CODE, at_entry, None, entry, entry)
while st['after'] is None and pc.clock < pc.clock + 5 and pc.exit is None:
    pc.run(pc.clock + 0.05)
    if st['before'] is not None and st['after'] is None and pc.clock > 100: break
regs = regions(); hdr = json.dumps(dict(regs=st['regs'], rregs=st['rregs'], regions=regs, ret=st['ret'], clock=pc.clock)).encode()
with open(out, 'wb') as f:
    f.write(struct.pack('<I', len(hdr))); f.write(hdr)
    for b in st['before']: f.write(b)
    for b in st['after']: f.write(b)
print('captured', hex(entry), 'regs', [hex(x) for x in st['regs']], 'bytes', sum(len(b) for b in st['after']))
