"""Lay a 128 sprite 8 times on a 1536x1024 magenta sheet (4 by 2 cells of 384x512, 3x nearest, bottom 24 px above the
cell edge): the image gpt-image-2 edits into animation frames.

    python base_sheet.py <sprite128.png> <out.png>
"""
import sys
import numpy as np
from PIL import Image

s = Image.open(sys.argv[1]).convert('RGBA')
ys, xs = np.nonzero(np.asarray(s)[..., 3])
crop = s.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
c = crop.resize((crop.width * 3, crop.height * 3), Image.NEAREST)
sheet = Image.new('RGBA', (1536, 1024), (255, 0, 255, 255))
for i in range(8):
    cx, cy = (i % 4) * 384 + 192, (i // 4) * 512 + 512 - 24
    sheet.alpha_composite(c, (cx - c.width // 2, cy - c.height))
sheet.convert('RGB').save(sys.argv[2])
