# Ewamon pixel-art sprites with gpt-image

How to make new Ewamon battle sprites (front and back) in the style the user chose on 2026-10-26, with the
gpt-image-2 API. All 14 type-gap lines (34 species) exist as concept sprites in `concepts/<key>-line/`: front and back,
each 128x128, the prompt behind each and a `<key>-line-preview.png`. The Puffinch line was made by hand first; the
other 13 by `pixel-tools/batch.py` from `concepts/lines.json`. Only Roobrawler's back is missing (see Moderation).
The concept writeups are in `../type-gap-concepts.pdf`.

## The look

The reference is **Nebucloak** (`assets-src/creatures/{front,back}/nebucloak(...).png`): real low-resolution pixel art,
not a detailed illustration made to look pixel-ish.

- Big, crisp square pixels: the creature is drawn on a grid of roughly 80 to 120 art pixels.
- A thick dark outline around the whole silhouette.
- Flat cel shading: 2 or 3 tones per colour, hard edges between them.
- Big simple shapes, a readable silhouette, large expressive eyes.
- No fine feather or fur texture, no gradients, no soft shading, no anti-aliasing, no blur.
- Final sprites are 128x128 with a transparent background, the creature bottom-centred.
- Front: 3/4 view facing slightly left. Back: 3/4 rear view, facing away toward the upper right.

What the user rejected: smooth, detailed illustrations (the first round of the Puffinch line), and pixelating those
afterwards by shrinking them. Shrinking a smooth image gives soft, busy sprites; the pixel style has to come from the
prompt.

## Workflow

Tools are in `pixel-tools/`. The key lives in `~/.env` as `OPENAI_API_KEY` (never in the repo or the chat).

1. **Style reference.** `python pixel-tools/refs.py nebucloak refs` writes Nebucloak's front and back on flat magenta,
   enlarged 4x nearest-neighbour, so the model sees big square pixels on the background it has to use.
2. **Fronts first.** `python pixel-tools/gen.py <prompt.txt> <out.png> refs/nebucloak-front-ref.png`, one creature per
   call, using the front template below. Describe each stage's look in the text so the family stays consistent;
   do not pass an earlier stage's image as a reference (see Moderation).
3. **Backs from fronts.** For each species, pass its own front (resized to 512, nearest) and Nebucloak's back as
   references with the back template. The front fixes the design; Nebucloak's back fixes the framing.
4. **Snap to 128.** `python pixel-tools/snap.py <in.png> <out.png>` measures the art-pixel grid and samples one output
   pixel per art pixel by majority colour, so the drawn pixels survive. When gpt-image mixes pixel sizes (Galeforth),
   it falls back to majority colour per cell at a size that fits 122 px. It never blends colours.
5. **Review** front and back together at 3x or 4x nearest before anything goes into `assets-src/creatures/`.

For many lines at once, `python pixel-tools/batch.py --quality low --cap <dollars>` does steps 2 to 4 for every line in
`concepts/lines.json`, line by line (front, then back), logs the estimated cost of every call and stops at the cap. It
is resumable, skips blocked sprites and prints them as `BLOCKED`. Raw images, refs and the log live in
`assets-src/imagegen/` (gitignored); run `python pixel-tools/refs.py nebucloak assets-src/imagegen/refs` first.

**Use `--quality low`.** For this blocky style, low looks as good as medium after snapping and costs about a quarter:
196 output tokens instead of 1,756. Medium only made sense for the smooth first round.

## Prompt templates

Front (reference image 1 = Nebucloak's front):

```
Image 1 is a battle sprite from an indie creature-collecting RPG called Ewamon. Draw ONE new original creature in
exactly the same pixel art style as image 1, but do not copy its design.

Pixel art style (most important): a true low-resolution pixel art sprite drawn on a grid of about 100 by 100 pixels,
then enlarged with nearest-neighbour scaling so every art pixel is a big, crisp square block, exactly like image 1.
Thick dark outline around the whole silhouette. Flat cel shading with only 2 or 3 tones per colour, hard edges between
tones. Big simple shapes, a clean readable silhouette, large expressive eyes. No fine feather texture, no gradients,
no soft airbrush shading, no anti-aliasing, no blur, no painterly detail.

Creature: <name>, a <types> <animal>, the <first / middle / final> stage of its line. <body shape, colours by area,
the 2 or 3 signature features, expression>. <for a later stage: one sentence describing the earlier stages' shared
features, so the family reads as one line>

Pose and framing: front battle sprite, 3/4 view facing slightly to the left, full body, centered, with empty space
around it, the same scale as image 1.

Colours: <3 to 5 named hex colours>, dark outline #2a2d3c.

Background: perfectly flat solid magenta #ff00ff, the same as image 1, no shadow, no scenery. No magenta or pink on
the creature. No text, no border, no watermark, only one creature.
```

Back (image 1 = this species' front, image 2 = Nebucloak's back): see `concepts/puffinch-line/*-back.prompt.txt`. It
asks for the same creature from behind in a 3/4 rear view facing the upper right, framed like image 2, lists what shows
from behind (crest, wing bands, scarf, tail tips), and repeats the pixel rules and the magenta background.

Tips that worked:

- Name 2 or 3 signature features per stage and carry them through the line (Puffinch line: cream and tan colours, a
  head feather, two ribbon tail strands with rust-red tips, a red neck piece that grows from ruff to scarf).
- For a large final stage, ask for wings or limbs held close to the body ("half open, not fully spread") so the body
  and face stay big at 128 px. Spread wings shrink the face to a few pixels.
- Give the first stage less detail than the last; size difference reads as evolution (Puffinch snaps to about 78 px,
  Galeforth fills 122). Low-quality images rarely keep one clean pixel grid, so `snap.py` mostly fits them to 122 px;
  the in-game size then comes from the species' `sizeScale`, not from the sprite canvas.
- Dark creatures (Corvlet, Ravenmourne) have near-black outlines on near-black bodies and read darker on the dark
  review background than they will on a lit battle stage.

## Moderation

OpenAI's output check (`moderation_blocked`, category "other") blocked the middle stage five times: a young finch
with a bandana, with and without reference images, with `moderation: "low"`, and with a goggles redesign. Puffinch and
Galeforth always passed. The likely trigger is a result too close to a well-known franchise's bird sprites. What
fixed it was a different concept, not different wording: Gustling as an egg-shaped bird with its wings wrapped around
it like a cloak, a feather ruff and a question-mark crest. Passing the smooth Puffinch image as a reference also got
blocked, which is why later stages are described in text instead.

The batch run hit the same check on 6 of 62 sprites:

- Lumistar's front (a bigger star with a planet ring) passed once reworked into a star child with a night-sky cape.
- Mesadrake's front (an upright desert dragon) passed once reworked into a low four-legged lizard with mesa plateaus.
- Petraptor's and Joeyjab's backs passed on a retry with `--short-back` (shorter text, front as the only reference).
- Roobrawler's back failed four times: the batch prompt, `--short-back`, a hand-written prompt without the joey in
  its pouch, and text-only generation with `moderation: "low"`. The front itself passed. It needs a design change
  (for example wrapped fists instead of boxing gloves) or a hand-drawn back.

If a design is blocked twice, change its silhouette or concept rather than retrying the same prompt. Blocked calls
are normally not billed.

## Cost

A 1024x1024 image returns 196 output image tokens at low quality and 1,756 at medium. Every reference image adds
about 1,024 input image tokens (a 768x512 one about 704). At gpt-image-1's published rates that is roughly $0.02 (front)
to $0.03 (back, two references) per low image and $0.08 to $0.10 per medium one; the OpenAI usage page has the exact
figure. By that estimate the Puffinch line (medium, plus 4 rejected smooth images) cost about $0.83 and the other 13
lines (59 sprites at low, including retries) about $1.50, so about $2.33 in all.

## Before a sprite ships

These are concept sprites. Shipping one still follows the species checklist (`.design/additions/species.js`, the
sprite pipeline, roster coverage spawn tables, shiny tuning) and the creature atlas byte ceiling, which has very
little room left.
