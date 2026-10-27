"""Cut a gpt-image item sheet (a cols x rows grid of icons on flat magenta) into 128x128 transparent sprites.

    python slice_sheet.py <sheet.png> <cols> <rows> <names.txt> <out_dir>

names.txt lists one item id per cell, row by row; a line `-` leaves that cell out. Each sprite is written as
`<slug>.png`, the slug being the id lowercased with every run of other characters turned into `_`.

1. The background goes: every pixel close to the sheet's own magenta (the median of its border) anywhere, and
   magenta-tinted fringe (snap.py's test) only within 2 px of that. A violet potion or a lilac crystal keeps its
   colour; snap.py's test alone punched holes in them.
2. Every connected shape belongs to the cell its centre falls in, so an icon that spills over a cell line stays
   whole and does not leak into its neighbour, and sparkles or drops next to an icon stay with it.
3. One scale for the whole sheet: the biggest icon fits 116 px, so a Nugget stays smaller than a Big Nugget.
   Downscaling uses Lanczos; the bag shows the sprites at 32 px, so the drawn pixel grid need not survive.
4. Each sprite sits centred on the 128 canvas.
"""
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SIZE, FIT = 128, 116


def slug(item_id):
    return re.sub(r"[^a-z0-9]+", "_", item_id.lower()).strip("_")


def key_magenta(im):
    a = np.asarray(im.convert("RGBA")).copy()
    rgb = a[..., :3].astype(int)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.sqrt(((rgb - np.median(border, axis=0)) ** 2).sum(-1)) < 60
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    tinted = (r > 140) & (b > 110) & (g < 110) & (b > g + 50)
    near = ndimage.binary_dilation(bg, iterations=2)
    a[bg | (tinted & near), 3] = 0
    return a


def main():
    sheet, cols, rows, names, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], Path(sys.argv[5])
    ids = [line.strip() for line in Path(names).read_text(encoding="utf8").splitlines() if line.strip()]
    if len(ids) != cols * rows:
        sys.exit(f"{names}: {len(ids)} names for {cols * rows} cells")
    a = key_magenta(Image.open(sheet))
    h, w = a.shape[:2]
    labels, n = ndimage.label(a[..., 3] > 0, structure=np.ones((3, 3)))
    centres = ndimage.center_of_mass(np.ones_like(labels), labels, range(1, n + 1))
    owner = np.zeros(n + 1, dtype=int) - 1  # component -> cell index
    for k, (y, x) in enumerate(centres, start=1):
        owner[k] = min(int(y * rows / h), rows - 1) * cols + min(int(x * cols / w), cols - 1)
    cell_of = owner[labels]
    crops = []
    for i, item_id in enumerate(ids):
        if item_id == "-":
            continue
        mask = (cell_of == i) & (labels > 0)
        ys, xs = np.nonzero(mask)
        if len(xs) == 0:
            sys.exit(f"cell {i + 1} ({item_id}) is empty")
        sub = a[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1].copy()
        sub[~mask[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1], 3] = 0
        crops.append((item_id, Image.fromarray(sub)))
    scale = FIT / max(max(c.size) for _, c in crops)
    out.mkdir(parents=True, exist_ok=True)
    for item_id, c in crops:
        c = c.resize((max(1, round(c.width * scale)), max(1, round(c.height * scale))), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(c, ((SIZE - c.width) // 2, (SIZE - c.height) // 2))
        canvas.save(out / f"{slug(item_id)}.png")
    print(f"{len(crops)} sprites -> {out} (scale {scale:.3f})")


if __name__ == "__main__":
    main()
