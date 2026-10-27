"""Run CONTRAST.EXE and save a thumbnail every STEP virtual seconds into one contact sheet.   usage: survey.py END_SECONDS STEP OUT.png"""
import sys, time, numpy as np
import run
from PIL import Image, ImageDraw
end = float(sys.argv[1]); step = float(sys.argv[2]); out = sys.argv[3]
pc = run.PC(); pc.kbd = [0, 0x50] * 10 + [0x0D]; tiles = []; nxt = [step]; t0 = time.time()
def hook(p):
    if p.clock >= nxt[0]:
        f = p.vga.frame(); pal = (np.array(p.vga.dac, np.int32).reshape(-1, 3) << 2 | 3).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(pal[f]).resize((160, 100)); ImageDraw.Draw(im).text((3, 3), '%d' % nxt[0], fill=(255, 255, 0)); tiles.append(im); nxt[0] += step
        print('t=%d wall=%.0fs eip=%x' % (p.clock, time.time() - t0, p.reg(run.UC_X86_REG_EIP)), flush=True)
import os
SNAP = os.environ.get('SNAPS')
if SNAP: os.makedirs(SNAP, exist_ok=True)
last_snap = [-1]
def hook2(p):
    hook(p)
    if SNAP and int(p.clock / 10) != last_snap[0]: last_snap[0] = int(p.clock / 10); p.save(os.path.join(SNAP, 's%04d.bin' % (10 * last_snap[0])))
pc.run(end, hook2)
cols = 12; rows = (len(tiles) + cols - 1) // cols; W = Image.new('RGB', (160 * cols, 100 * rows))
for k, im in enumerate(tiles): W.paste(im, ((k % cols) * 160, (k // cols) * 100))
W.save(out); print('exit', pc.exit, 'unhandled', pc.unhandled, pc.log[-5:])
