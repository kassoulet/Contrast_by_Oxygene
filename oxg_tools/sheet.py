"""Contact sheet from a recording: every STEP-th tick.   usage: sheet.py RECDIR STEP OUT.png"""
import sys, glob, numpy as np
from PIL import Image, ImageDraw
fs = sorted(glob.glob(sys.argv[1] + '/c*.npz')); step = int(sys.argv[2]); tiles = []; n = 0
for f in fs:
    z = np.load(f)
    for i in range(len(z['f'])):
        if n % step == 0:
            pal = (z['pal'][i].reshape(-1, 3).astype(np.int32) << 2 | 3).clip(0, 255).astype(np.uint8); im = Image.fromarray(pal[z['f'][i]]).resize((160, 100))
            ImageDraw.Draw(im).text((3, 3), str(n), fill=(255, 255, 0)); tiles.append(im)
        n += 1
cols = 12; rows = (len(tiles) + cols - 1) // cols; W = Image.new('RGB', (160 * cols, 100 * rows))
for k, im in enumerate(tiles): W.paste(im, ((k % cols) * 160, (k // cols) * 100))
W.save(sys.argv[3]); print(n, 'ticks', len(tiles), 'tiles')
