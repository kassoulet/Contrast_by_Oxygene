"""Record the real program frame by frame: at every timer tick (the demo's IRQ0 handler is retrace-synchronised, so a tick is a displayed frame) save the picture,
the DAC palette and a few memory slices (the program's globals and the music position block), to chunk files; VM snapshots every SNAP_EVERY virtual seconds.
usage: record.py OUTDIR END_SECONDS [START_SNAPSHOT]      env SNAP_EVERY (default 10)"""
import sys, os, time, zlib, numpy as np
import run
from unicorn.x86_const import *
out = sys.argv[1]; end = float(sys.argv[2]); os.makedirs(out, exist_ok=True)
pc = run.PC(); start = sys.argv[3] if len(sys.argv) > 3 else None
if start: pc.load_snapshot(start)
else: pc.kbd = [0, 0x50] * 10 + [0x0D]
SNAP = float(os.environ.get('SNAP_EVERY', 10)); TICK_HOOK = 0x10790          # the demo’s tick callback, called from the library INT 8 handler once per retrace: inc [0x44e20]; inc [0x44e2c]
CH = 60; buf = dict(f=[], pal=[], g=[], t=[]); chunk = [0]; nsnap = [-1]
def flush():
    if not buf['f']: return
    np.savez_compressed(os.path.join(out, 'c%05d.npz' % chunk[0]), f=np.array(buf['f'], np.uint8), pal=np.array(buf['pal'], np.uint8), g=np.array(buf['g'], np.uint8), t=np.array(buf['t'], np.float64))
    chunk[0] += 1
    for k in buf: buf[k] = []
def tick(mu, addr, size, ud):
    f = pc.vga.frame()
    if f.shape != (200, 320): f = np.zeros((200, 320), np.uint8)
    buf['f'].append(f.copy()); buf['pal'].append(np.array(pc.vga.dac, np.uint8).reshape(-1)[:768])
    g = pc.r(0x44E10, 0x60) + pc.r(0x30080, 0x80)
    mp = struct.unpack('<I', pc.r(0x44E3C, 4))[0]
    g += pc.r(mp, 0x40) if 0x10000 <= mp < run.MEM - 0x40 else bytes(0x40)
    buf['g'].append(np.frombuffer(g, np.uint8)); buf['t'].append(pc.clock)
    if len(buf['f']) >= CH: flush()
import struct
pc.mu.hook_add(run.UC_HOOK_CODE, tick, None, TICK_HOOK, TICK_HOOK)
t0 = time.time(); last = [-1]
def hook(p):
    s = int(p.clock / SNAP)
    if s != last[0]:
        last[0] = s; p.save(os.path.join(out, 's%04d.bin' % int(s * SNAP))); print('t=%.0f ticks=%d wall=%.0fs' % (p.clock, chunk[0] * CH + len(buf['f']), time.time() - t0), flush=True)
pc.run(end, hook); flush(); print('done', pc.exit, pc.unhandled)
