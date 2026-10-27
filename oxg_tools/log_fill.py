"""Log the real triangle fillers' calls (0x180D0 flat, 0x1716F textured, 0x17855 shaded): parameters, the frame buffer before and after.   usage: log_fill.py SNAP T0 T1 OUT.npz  (clock window in virtual seconds)"""
import sys, struct, numpy as np
import run
from unicorn import *
from unicorn.x86_const import *
snap, t0, t1, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
dbg=[0,0]; pc = run.PC(); pc.load_snapshot(snap); calls = []
def u32(a): return struct.unpack('<I', pc.r(a, 4))[0]
def hookfor(entry, kind):
    def at_entry(mu, a, sz, ud):
      try:
        dbg[0]+=1; dbg[1]=pc.clock
        if not (t0 <= pc.clock <= t1): return
        sp = pc.reg(UC_X86_REG_ESP); ret = u32(sp); fbp = u32(0x44E38)
        c = dict(kind=kind, v=[struct.unpack('<i', pc.r(0x5A804 + 4 * k, 4))[0] for k in range(3)], y=[struct.unpack('<i', pc.r(0x5A81C + 4 * k, 4))[0] for k in range(3)],
                 u=[struct.unpack('<i', pc.r(0x5A828 + 4 * k, 4))[0] for k in range(3)], w=[struct.unpack('<i', pc.r(0x5A7F4 + 4 * k, 4))[0] for k in range(3)],
                 s=[struct.unpack('<i', pc.r(a, 4))[0] for a in (0x5A818, 0x5A810, 0x5A814)], col=u32(0x5A834), tex=u32(0x5A7A0), cpl=u32(0x4C7F4), clock=pc.clock)
        c['tex_b'] = np.frombuffer(pc.r(c['tex'], 65536), np.uint8).copy() if kind else None
        c['before'] = np.frombuffer(pc.r(fbp, 64000), np.uint8).copy()
        def at_ret(mu, a2, sz2, ud2):
            if pc.reg(UC_X86_REG_ESP) == sp + 4 and 'after' not in c:
                c['after'] = np.frombuffer(pc.r(fbp, 64000), np.uint8).copy(); c['tab'] = np.frombuffer(pc.r(0x597B4, 4000), np.int32).copy(); c['glob'] = np.frombuffer(pc.r(0x5A7F4, 0x44), np.int32).copy(); calls.append(c)
        mu.hook_add(UC_HOOK_CODE, at_ret, None, ret, ret)
      except Exception as ex: print('ERR', repr(ex)); raise
    pc.mu.hook_add(UC_HOOK_CODE, at_entry, None, entry, entry)
for e, k in ((0x180D0, 0), (0x1716F, 1), (0x17855, 2)): hookfor(e, k)
while pc.clock < t1 + 0.01 and pc.exit is None: pc.run(pc.clock + 0.05)
n = len(calls); print(dbg, n, "calls; clock", pc.clock, "exit", pc.exit)
np.savez_compressed(out, kind=[c['kind'] for c in calls], v=[c['v'] for c in calls], y=[c['y'] for c in calls], u=[c['u'] for c in calls], w=[c['w'] for c in calls], s=[c['s'] for c in calls], col=[c['col'] for c in calls],
    cpl=[c['cpl'] for c in calls], before=np.array([c['before'] for c in calls]), after=np.array([c['after'] for c in calls]), clock=[c['clock'] for c in calls], tab=np.array([c['tab'] for c in calls]), glob=np.array([c['glob'] for c in calls]),
    tex=np.array([c['tex_b'] if c['tex_b'] is not None else np.zeros(65536, np.uint8) for c in calls]))
