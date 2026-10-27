"""Capture test vectors for several routines in one run: capture_multi.py SNAPSHOT ENTRY:OUT:SKIP [ENTRY:OUT:SKIP ...]   (see capture_fn.py for the file format)"""
import sys, json, struct
import run
from unicorn import *
from unicorn.x86_const import *
pc = run.PC(); pc.load_snapshot(sys.argv[1])
REG = [UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDX, UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EBP, UC_X86_REG_ESP]
def regions(): return [(0x30000, 0x3AAC0 + 0x4000), (0x1000000, max(0x1000, pc.next_alloc - 0x1000000))]
def grab(): return [pc.r(a, n) for a, n in regions()]
targets = []
def make(entry, out, skip):
    st = dict(entry=entry, out=out, skip=skip, n=0, before=None, after=None, active=False)
    def at_entry(mu, a, sz, ud):
        if st['before'] is not None: return
        if st['n'] < st['skip']: st['n'] += 1; return
        sp = pc.reg(UC_X86_REG_ESP); st['ret'] = struct.unpack('<I', pc.r(sp, 4))[0]; st['regs'] = [pc.reg(r) for r in REG]; st['before'] = grab()
        def at_ret(mu, a, sz, ud):
            if pc.reg(UC_X86_REG_ESP) == sp + 4 and st['after'] is None:
                st['after'] = grab(); st['rregs'] = [pc.reg(r) for r in REG]; write(st)
        mu.hook_add(UC_HOOK_CODE, at_ret, None, st['ret'], st['ret'])
    pc.mu.hook_add(UC_HOOK_CODE, at_entry, None, entry, entry); targets.append(st)
def write(st):
    regs = regions(); hdr = json.dumps(dict(regs=st['regs'], rregs=st['rregs'], regions=regs, ret=st['ret'], clock=pc.clock)).encode()
    with open(st['out'], 'wb') as f:
        f.write(struct.pack('<I', len(hdr))); f.write(hdr)
        for b in st['before']: f.write(b)
        for b in st['after']: f.write(b)
    print('captured', hex(st['entry']), '->', st['out'], 'at clock %.2f' % pc.clock, flush=True); st['before'] = st['after'] = 'done'
for t in sys.argv[2:]:
    e, o, s = t.split(':'); make(int(e, 16), o, int(s))
while any(t['after'] is None or t['after'] != 'done' for t in targets) and pc.exit is None and pc.clock < 600:
    pc.run(pc.clock + 0.2)
