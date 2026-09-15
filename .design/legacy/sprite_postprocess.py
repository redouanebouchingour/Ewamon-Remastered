from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def remove_magenta_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    output = []
    for r, g, b, a in list(img.getdata()):
        is_magenta = r >= 145 and b >= 115 and g <= 150 and (r - g) >= 25 and (b - g) >= 5
        output.append((r, g, b, 0 if is_magenta else 255))
    img.putdata(output)
    return img


def remove_border_flood_background(img: Image.Image, threshold: int = 140) -> Image.Image:
    img = img.convert("RGBA")
    width, height = img.size
    pixels = img.load()

    border = []
    for x in range(width):
      border.append(pixels[x, 0])
      border.append(pixels[x, height - 1])
    for y in range(1, height - 1):
      border.append(pixels[0, y])
      border.append(pixels[width - 1, y])

    avg = tuple(sum(sample[i] for sample in border) // len(border) for i in range(3))

    queue = deque()
    seen = set()
    for x in range(width):
      for y in (0, height - 1):
        queue.append((x, y))
        seen.add((x, y))
    for y in range(height):
      for x in (0, width - 1):
        queue.append((x, y))
        seen.add((x, y))

    while queue:
      x, y = queue.popleft()
      r, g, b, a = pixels[x, y]
      dist = abs(r - avg[0]) + abs(g - avg[1]) + abs(b - avg[2])
      if dist <= threshold:
        pixels[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
          if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
            seen.add((nx, ny))
            queue.append((nx, ny))
    return img


def defringe(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    width, height = img.size
    pixels = img.load()
    updates = {}

    for y in range(height):
      for x in range(width):
        r, g, b, a = pixels[x, y]
        if a == 0:
          continue

        neighbors = []
        touches_transparent = False
        for nx, ny in (
          (x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1),
          (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1),
        ):
          if 0 <= nx < width and 0 <= ny < height:
            nr, ng, nb, na = pixels[nx, ny]
            if na == 0:
              touches_transparent = True
            else:
              neighbors.append((nr, ng, nb))

        if not touches_transparent or not neighbors:
          continue

        avg_r = sum(color[0] for color in neighbors) // len(neighbors)
        avg_g = sum(color[1] for color in neighbors) // len(neighbors)
        avg_b = sum(color[2] for color in neighbors) // len(neighbors)
        if abs(r - avg_r) + abs(g - avg_g) + abs(b - avg_b) > 30:
          updates[(x, y)] = (avg_r, avg_g, avg_b, a)

    for (x, y), value in updates.items():
      pixels[x, y] = value
    return img


def fit_canvas(img: Image.Image, size: int, pad: int) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    if not bbox:
      return Image.new("RGBA", (size, size), (0, 0, 0, 0))

    img = img.crop(bbox)
    scale = min((size - pad * 2) / max(img.size), 1.0)
    new_size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
    img = img.resize(new_size, Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((size - img.width) // 2, size - img.height - pad))
    return canvas


def create_audit(img: Image.Image, audit_background: tuple[int, int, int, int]) -> Image.Image:
    audit = Image.new("RGBA", img.size, audit_background)
    audit.alpha_composite(img)
    return audit


def main() -> None:
    parser = argparse.ArgumentParser(description="Post-process generated Ewamon sprites safely.")
    parser.add_argument("--input", required=True, help="Source sprite render")
    parser.add_argument("--output", required=True, help="Destination transparent sprite")
    parser.add_argument("--audit-output", required=True, help="Destination audit image on a solid background")
    parser.add_argument("--mode", choices=("magenta-key", "border-flood"), default="magenta-key")
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--pad", type=int, default=12)
    args = parser.parse_args()

    src = Path(args.input)
    out = Path(args.output)
    audit_out = Path(args.audit_output)
    out.parent.mkdir(parents=True, exist_ok=True)
    audit_out.parent.mkdir(parents=True, exist_ok=True)

    img = Image.open(src)
    if args.mode == "magenta-key":
      img = remove_magenta_background(img)
    else:
      img = remove_border_flood_background(img)
    img = defringe(img)
    img = fit_canvas(img, size=args.size, pad=args.pad)

    img.save(out)
    create_audit(img, (255, 0, 255, 255)).save(audit_out)


if __name__ == "__main__":
    main()
