"""Turn a roster sprite into a gpt-image style reference: composited on flat magenta and enlarged 4x nearest-neighbour,
so the model sees big square pixels on the same background it has to draw.

    python refs.py <species-id> <out-dir>      e.g. python refs.py nebucloak refs

Reads assets-src/creatures/{front,back}/<id>({front,back}).png and writes <out-dir>/<id>-front-ref.png and
<id>-back-ref.png, each at most 1024 px.
"""
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[3]
sid, out = sys.argv[1], Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
for side in ("front", "back"):
    im = Image.open(REPO / "assets-src" / "creatures" / side / f"{sid}({side}).png").convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
    bg.alpha_composite(im)
    z = max(1, min(4, 1024 // max(im.size)))
    bg.convert("RGB").resize((im.width * z, im.height * z), Image.NEAREST).save(out / f"{sid}-{side}-ref.png")
    print(out / f"{sid}-{side}-ref.png")
