"""Snap a gpt-image pixel-art sprite (1024 px, art pixels drawn as ~7 to 13 px blocks, magenta background) onto a
128x128 transparent canvas without blending: every output pixel is the majority colour of one art pixel.

    python snap.py <in.png> <out.png>

1. Find the art-pixel grid: for each axis, try block sizes 6.0 to 13.0 px and phases, and keep the one where the most
   colour edges fall on grid lines. The range stops at 13 so a double-size grid (twice the real block) never wins.
2. If both axes agree on a clean grid (score >= 2.2, sizes within 0.3), sample one output pixel per art pixel.
   Otherwise the image has no single grid (gpt-image sometimes mixes pixel sizes): pick the cell size that makes the
   creature 122 px tall or wide and sample by majority colour per cell. A grid result bigger than 128 also falls
   back to this.
3. Magenta and magenta-tinted fringe become transparent; the sprite sits bottom-centred, 3 px above the bottom edge.
"""
import sys
from collections import Counter

import numpy as np
from PIL import Image

SIZE, FIT = 128, 122


def is_magenta(r, g, b):
    return r > 140 and b > 110 and g < 110 and b > g + 50


def find_grid(im):
    found = []
    for axis in (1, 0):
        edges = np.abs(np.diff(im, axis=axis)).sum(-1) > 60
        prof = edges.sum(axis=0 if axis == 1 else 1).astype(float)
        best = (0.0, 0.0, 0.0)
        for b10 in range(60, 131):
            b = b10 / 10
            for ph in np.arange(0, b, 0.5):
                idx = np.round(np.arange(ph, len(prof) - 1, b)).astype(int)
                score = prof[idx].sum() / prof.sum() * b  # 1.0 = no better than chance
                if score > best[0]:
                    best = (score, b, ph)
        found.append(best)
    return found


def main(src, dst, force_fit=False):
    im = np.asarray(Image.open(src).convert("RGB")).astype(int)
    H, W, _ = im.shape
    (sx, bx, px), (sy, by, py) = find_grid(im)
    if not force_fit and min(sx, sy) >= 2.2 and abs(bx - by) <= 0.3:
        block, mode = (bx + by) / 2, "grid"
    else:
        mask = ~((im[..., 0] > 170) & (im[..., 2] > 170) & (im[..., 1] < 110))
        ys, xs = np.where(mask)
        block, mode = max(ys.max() - ys.min(), xs.max() - xs.min()) / FIT, "fit"
        px, py = xs.min(), ys.min()
    gx = np.arange(px % block, W, block)
    gy = np.arange(py % block, H, block)
    rows = []
    for j in range(len(gy) - 1):
        row = []
        for i in range(len(gx) - 1):
            a, b = int(round(gy[j])), int(round(gy[j + 1]))
            c, d = int(round(gx[i])), int(round(gx[i + 1]))
            my, mx = max(1, (b - a) // 4), max(1, (d - c) // 4)
            cell = im[a + my: b - my, c + mx: d - mx].reshape(-1, 3)
            if len(cell) == 0:
                cell = im[a:b, c:d].reshape(-1, 3)
            keys = cell // 12
            top = Counter(map(tuple, keys.tolist())).most_common(1)[0][0]
            r, g, bb = (int(v) for v in cell[(keys == top).all(1)].mean(0).round())
            row.append((r, g, bb, 0 if is_magenta(r, g, bb) else 255))
        rows.append(row)
    img = Image.fromarray(np.array(rows, np.uint8), "RGBA")
    img = img.crop(img.getchannel("A").getbbox())
    w, h = img.size
    if max(w, h) > SIZE - 4:
        if mode == "grid":  # the grid read too fine (the art is bigger than 128 art pixels): fit it instead
            return main(src, dst, force_fit=True)
        sys.exit(f"{src}: snapped sprite is {w}x{h}, larger than {SIZE}; regenerate with more empty space around it")
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((SIZE - w) // 2, SIZE - h - 3))
    canvas.save(dst)
    print(f"{dst}: {mode}, block {block:.2f} px, sprite {w}x{h}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
