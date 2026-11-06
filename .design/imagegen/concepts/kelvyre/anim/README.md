# Kelvyre's idle animation (2026-11-06)

How Kelvyre's front and back battle loops were made, step by step, with what each step cost. The general method is in
`../../../PIXEL-STYLE.md` ("Animated sprites"); the scripts are in `../../../pixel-tools/anim/`. Raw sheets, previews
and the old stills are in `assets-src/imagegen/kelvyre-anim/` (gitignored).

## Result

- 48 frames per side at 100 ms (a 4.8 s loop), 128 x 160 px (the 128 sprite plus 32 rows of flame headroom), lossless
  animated WebP in `assets-src/creatures/{front,back}/kelvyre(*).webp`.
- The body is the original still's own pixels on a 2D bone rig: knees bend over planted feet, the torso sways, the
  head lags behind it, the fire arm pumps, the ice arm swings and a wave runs down the tail. The flames and frost
  sparkles come from gpt-image-2. Twice per loop the hand flame flares up, on the deepest breath.
- Motion, measured as the share of the silhouette that differs between the two most different frames: 43 %. The
  legendaries are 24 to 38 %; the first, flames-only version the user called stiff was 17 %.
- In the game: 3.84 MB of flipbooks at the shared q80 / q80 rung (the anim ceiling went from 25 to 29 MiB for it, the
  user's call) and a 529 KB animated dex thumbnail.

## How we got here

1. **The ChatGPT GIF (rejected).** Measured against our legendaries' loops: 12 frames at 180 ms, 79 % of the body
   pixels redrawn every frame (the body "boils"), the feet drifting 5 px, the neck ring and elbow flame lost. A model
   that redraws every frame cannot hold a pixel sprite still.
2. **v1, flames only (liked, but "more frames and more movement").** gpt-image-2 edited a sheet of 8 copies of our
   still; only the flames were taken from it, the body stayed our pixels, plus a 1 px breath in code. 24 frames.
3. **v2, more frames (rejected: "the body is very stiff").** A second flame sheet with bigger fire, 48 frames, a
   smooth displacement field for breath, head sway, hand bob and tail swish. Still only 17 % silhouette change.
4. **v3, the bone rig (shipped).** `rig_idle.py` replaces the displacement field. Problems solved on the way: inverting
   the skin pulled in stray pixels (switched to forward splatting from an 8x EPX upscale); overlapping parts
   interleaved (a depth order per bone); the ice arm blended into the thigh it touches and stretched into stripes
   (weights diffuse only through the sprite and only between a bone and its parent or children); one-pixel cracks at
   stretched joints (filled).

## Commands

From the repo root, with `K` a scratch folder. The stills live in `assets-src/imagegen/kelvyre-anim/stills/`.

```bash
T=.design/imagegen/pixel-tools; P=.design/imagegen/concepts/kelvyre/anim; S=assets-src/imagegen/kelvyre-anim/stills
python $T/anim/base_sheet.py "$S/kelvyre(front).png" $K/base-front.png
python $T/anim/base_sheet.py "$S/kelvyre(back).png" $K/base-back.png
# four gpt-image-2 edits (the only paid step)
python $T/gen.py --size=1536x1024 --quality=medium $P/sheet-prompt.txt $K/front-calm.png $K/base-front.png
python $T/gen.py --size=1536x1024 --quality=medium $P/sheet2-prompt.txt $K/front-flare.png $K/base-front.png
python $T/gen.py --size=1536x1024 --quality=medium $P/back-sheet-prompt.txt $K/back-calm.png $K/base-back.png
python $T/gen.py --size=1536x1024 --quality=medium $P/back-sheet2-prompt.txt $K/back-flare.png $K/base-back.png
# slice each sheet back onto the sprite's pixel grid
python $T/anim/slice_frames.py "$S/kelvyre(front).png" $K/front-calm.png $K/f1.npy   # and f2, b1, b2
# rest-pose frames with the AI flames, then the rig
python $T/anim/compose_idle.py front $K/rf 48 $K/f1.npy $K/f2.npy --rest
python $T/anim/compose_idle.py back $K/rb 48 $K/b1.npy $K/b2.npy --rest
python $T/anim/rig_idle.py front $K/rf.npy $K/vf
python $T/anim/rig_idle.py back $K/rb.npy $K/vb
python $T/anim/write_webp.py $K          # writes the WebP sources, prints the page for frame-select.json
pnpm --filter @ewa/sprite-pipeline run build
pnpm --filter @ewa/sprite-pipeline dex-anim kelvyre
```

`compose_idle.py` reads the stills from `kelvyre-anim/stills/` and `rig_idle.py` holds the bones per side (`RIGS`), the
draw order (`DEPTH`) and the motion (`pose()`), so a new creature needs its own bones, flame zones and anchors there.

## Cost

Four gpt-image-2 edits, each a 1536 x 1024 sheet at medium quality with one reference image (the base sheet). Usage as
the API reported it:

| Call | Input (image + text) | Output image tokens |
|---|---|---|
| front, calm flicker | 1,536 + 479 | 1,372 |
| front, flare | 1,536 + 435 | 1,372 |
| back, calm flicker | 1,536 + 496 | 1,372 |
| back, flare | 1,536 + 453 | 1,372 |
| **total** | **6,144 + 1,863** | **5,488** |

At gpt-image-1's published rates (image input $10, text input $5, image output $40 per million tokens) that is about
$0.07 a call and **about $0.30 for all four**; gpt-image-2's own rates may differ, the OpenAI usage page has the exact
figure. No other step calls a paid service: slicing, the rig, the WebP sources, the sprite build and the dex thumbnail
all run locally. The user's ChatGPT GIF was made outside this pipeline and is not counted.
