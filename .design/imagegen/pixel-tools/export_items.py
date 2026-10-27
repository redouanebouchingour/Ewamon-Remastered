"""Write the sliced item sprites into the client as lossless WebP, and tint the two blank discs per type.

    python export_items.py <png_dir> <public_items_dir> <tokens.json>

Every `<slug>.png` in png_dir except the discs becomes `<public_items_dir>/<slug>.webp`. `tm_disc.png` becomes
`tm_<type>.webp` for each of the 19 type colours in the client tokens (`typeColors.default`), and `hm_disc.png`
becomes `hm_<type>.webp` the same way, so a new TM or HM needs no new art. Only the disc's white and grey pixels take
the colour (its shading kept, its brightest highlights left near white); the HM disc's gold rim and the dark outline
stay as drawn.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

DISCS = ("tm_disc", "hm_disc")


def tint(im, hex_colour):
    a = np.asarray(im.convert("RGBA")).astype(float)
    rgb = a[..., :3] / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    grey = (mx - mn < 0.18) & (a[..., 3] > 0) & (mx > 0.3)
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    col = np.array([int(hex_colour[i : i + 2], 16) for i in (1, 3, 5)]) / 255
    shaded = col * np.clip(lum * 1.25, 0, 1)[..., None]
    shine = np.clip((lum - 0.88) / 0.12, 0, 1)[..., None] * 0.7
    out = rgb.copy()
    out[grey] = (shaded * (1 - shine) + shine)[grey]
    a[..., :3] = out * 255
    return Image.fromarray(np.round(a).astype(np.uint8))


def main():
    src, dst, tokens = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    colours = json.loads(tokens.read_text(encoding="utf8"))["typeColors"]["default"]
    dst.mkdir(parents=True, exist_ok=True)
    n = 0
    for png in sorted(src.glob("*.png")):
        im = Image.open(png)
        if png.stem in DISCS:
            prefix = png.stem.split("_")[0]
            for type_name, hex_colour in colours.items():
                tint(im, hex_colour).save(dst / f"{prefix}_{type_name.lower()}.webp", lossless=True, method=6)
                n += 1
        else:
            im.save(dst / f"{png.stem}.webp", lossless=True, method=6)
            n += 1
    print(f"{n} sprites -> {dst}")


if __name__ == "__main__":
    main()
