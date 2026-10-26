"""Generate concept lines as pixel sprites, line by line, front then back, with a hard spend cap.

    python batch.py --quality low [--only id,id] [--front-only] [--short-back] [--cap 6.0]

Lines come from ../concepts/lines.json (the Puffinch line is skipped: it was made by hand first). Finished 128 px
sprites and their prompts go to ../concepts/<key>-line/; raw 1024 px images and log.jsonl go to
assets-src/imagegen/batch/ (gitignored). Run `python refs.py nebucloak <repo>/assets-src/imagegen/refs` once first.
Resumable: a sprite whose 128 px file exists is skipped, and a raw image that exists is snapped without a new call.

--short-back retries a blocked back with only the first sentence of the look and only the front as reference.
Cost is an ESTIMATE at gpt-image-1 rates (text in $5/M, image in $10/M, image out $40/M); the OpenAI usage page has
the real figure. Set EWA_IMAGEGEN_SPENT to count earlier spend against --cap.
"""
import argparse, base64, json, os, subprocess, sys
from pathlib import Path

from dotenv import load_dotenv
from openai import BadRequestError, OpenAI
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
FAMILIES = json.loads((HERE.parent / "concepts" / "lines.json").read_text(encoding="utf8"))
SNAP = HERE / "snap.py"
WORK = REPO / "assets-src" / "imagegen"
NEBU_FRONT = WORK / "refs" / "nebucloak-front-ref.png"
NEBU_BACK = WORK / "refs" / "nebucloak-back-ref.png"

ap = argparse.ArgumentParser()
ap.add_argument("--quality", default="low")
ap.add_argument("--only", default="")
ap.add_argument("--front-only", action="store_true")
ap.add_argument("--short-back", action="store_true")
ap.add_argument("--out", default=str(HERE.parent / "concepts"))
ap.add_argument("--cap", type=float, default=6.0, help="stop when the estimated total passes this many dollars")
args = ap.parse_args()
OUT = Path(args.out)
RAW = WORK / "batch"
RAW.mkdir(parents=True, exist_ok=True)
LOG = RAW / "log.jsonl"
SPENT_BEFORE = float(os.environ.get("EWA_IMAGEGEN_SPENT", "0"))

load_dotenv(Path.home() / ".env", override=False)
client = OpenAI()

STYLE = """Pixel art style (most important): a true low-resolution pixel art sprite drawn on a grid of about 100 by 100 pixels, then enlarged with nearest-neighbour scaling so every art pixel is a big, crisp square block, exactly like image 1. Thick dark outline around the whole silhouette. Flat cel shading with only 2 or 3 tones per colour, hard edges between tones. Big simple shapes, a clean readable silhouette, large expressive eyes. No fine fur or feather texture, no gradients, no soft airbrush shading, no anti-aliasing, no blur, no painterly detail."""
BG = """Background: perfectly flat solid magenta #ff00ff, no shadow, no scenery. No magenta or pink on the creature. No text, no border, no watermark, only one creature."""


def est(u):
    d = u.get("input_tokens_details") or {}
    return (d.get("text_tokens", 0) * 5 + d.get("image_tokens", 0) * 10 + u.get("output_tokens", 0) * 40) / 1e6


def spent():
    tot = SPENT_BEFORE
    if LOG.exists():
        for line in LOG.read_text(encoding="utf8").splitlines():
            tot += json.loads(line).get("est", 0)
    return tot


def log(**kw):
    with LOG.open("a", encoding="utf8") as f:
        f.write(json.dumps(kw) + "\n")


def call(prompt, refs, out):
    if spent() >= args.cap:
        print(f"CAP reached: estimated ${spent():.2f} >= ${args.cap:.2f}; stopping")
        sys.exit(3)
    try:
        res = client.images.edit(model="gpt-image-2", image=[open(r, "rb") for r in refs], prompt=prompt,
                                 size="1024x1024", quality=args.quality, n=1)
    except BadRequestError as e:
        body = e.body if isinstance(getattr(e, "body", None), dict) else {}
        if body.get("code") == "moderation_blocked":
            log(file=out.name, status="blocked", est=0)
            print(f"BLOCKED {out.name}")
            return None
        raise
    out.write_bytes(base64.b64decode(res.data[0].b64_json))
    u = res.usage.model_dump() if getattr(res, "usage", None) else {}
    log(file=out.name, status="ok", quality=args.quality, usage=u, est=est(u))
    print(f"ok {out.name} est ${est(u):.3f} total ${spent():.2f}", flush=True)
    return out


def first_sentence(t):
    return t.split(". ")[0].rstrip(".") + "."


def front_prompt(fam, k, st):
    stages, split = fam["stages"], fam.get("split")
    if split and k >= 1:
        pos = "one of two possible final forms"
    elif len(stages) == 2:
        pos = ["the first stage", "the final stage"][k]
    else:
        pos = ["the first stage", "the middle stage", "the final stage"][k]
    ctx = ""
    if k >= 1:
        prev = stages[:1] if split else stages[:k]
        ctx = (" It belongs to a line whose earlier stage" + ("s are " if len(prev) > 1 else " is ")
               + "; ".join(f"{p['name']}: {first_sentence(p['look'])}" for p in prev)
               + " Keep the same family colours and features.")
    final = k == len(stages) - 1 or (split and k >= 1)
    compact = " Keep wings, limbs and tails close to the body so the body and face stay large and readable." if final else ""
    cols = ", ".join(f"{n} {h}" for h, n in st["palette"])
    return f"""Image 1 is a battle sprite from an indie creature-collecting RPG called Ewamon. Draw ONE new original creature in exactly the same pixel art style as image 1, but do not copy its design.

{STYLE}

Creature: {st['name']}, an original {'/'.join(st['types'])} creature, {pos} of its line. {st['look']}{ctx}

Pose and framing: front battle sprite, 3/4 view facing slightly to the left, full body, centered, with clear empty space on every side, the same scale as image 1.{compact}

Colours: {cols}, dark outline #2a2d3c.

{BG}"""


def back_prompt(st):
    look = first_sentence(st["look"]) if args.short_back else st["look"]
    ref2 = "" if args.short_back else " Image 2 is the back sprite of a different creature from the same game; it only shows how a back sprite is framed and drawn."
    framed = "" if args.short_back else ", framed like image 2"
    return f"""Image 1 is the front battle sprite of {st['name']}, an original creature from an indie creature-collecting RPG called Ewamon.{ref2}

Draw the BACK battle sprite of the creature in image 1: the view the player sees of their own creature in battle, from behind in a 3/4 rear view, the creature facing away from the viewer toward the upper right{framed}. Keep everything identical to image 1: the same true low-resolution pixel art style with big crisp square pixels, the same thick dark outline, the same flat 2 to 3 tone cel shading, the same colours, proportions and size. Show from behind every feature of its design that is visible from the back: {look} The face is turned away; at most the edge of one cheek shows.

No gradients, no soft shading, no anti-aliasing, no blur.

Framing: full body, centered, the same scale as image 1, nothing touching the canvas edges.

{BG}"""


def snap(raw, dst):
    r = subprocess.run([sys.executable, str(SNAP), str(raw), str(dst)], capture_output=True, text=True)
    print("  " + (r.stdout.strip() or r.stderr.strip().splitlines()[-1]))


only = {x for x in args.only.split(",") if x}
for fam in FAMILIES:
    if fam["key"] == "puffinch":
        continue
    d = OUT / f"{fam['key']}-line"
    d.mkdir(parents=True, exist_ok=True)
    for k, st in enumerate(fam["stages"]):
        sid = st["id"]
        if only and sid not in only:
            continue
        f128, fraw = d / f"{sid}-front.png", RAW / f"{sid}-front-raw.png"
        if not f128.exists():
            p = front_prompt(fam, k, st)
            (d / f"{sid}-front.prompt.txt").write_text(p, encoding="utf8")
            if not fraw.exists() and not call(p, [NEBU_FRONT], fraw):
                continue
            snap(fraw, f128)
        if args.front_only:
            continue
        b128, braw = d / f"{sid}-back.png", RAW / f"{sid}-back-raw.png"
        if not b128.exists() and fraw.exists():
            ref = RAW / f"{sid}-front-ref512.png"
            Image.open(fraw).resize((512, 512), Image.NEAREST).save(ref)
            p = back_prompt(st)
            (d / f"{sid}-back.prompt.txt").write_text(p, encoding="utf8")
            if not braw.exists() and not call(p, [ref] if args.short_back else [ref, NEBU_BACK], braw):
                continue
            snap(braw, b128)
print(f"done; estimated total spend ${spent():.2f}")
