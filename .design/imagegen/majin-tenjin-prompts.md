# Majin & Tenjin form art: Gemini prompts

Design: `.design/majin-tenjin.md`. 10 new forms × front + back = **20 images**, plus 2 optional band icons.
hollowmane and castlemaw already have their Majin art (their Rage Form sprites).

## How to run them

1. Use Gemini's image model (Gemini app or AI Studio, "Nano Banana" / Gemini 2.5 Flash Image), **one chat per form**.
2. **Front first.** Attach the files listed, paste the front prompt, and re-roll until it's right.
3. **Back second, in the same chat.** Attach the approved front plus the files listed, then paste the back prompt.
4. **Do Thornback Tenjin first.** Once approved, it becomes the Tenjin *example* attached to every other Tenjin prompt
   (save it as `refs/majin-tenjin/example_thornback_tenjin_front.png`). That keeps all six Tenjin forms in one style,
   the way the hollowmane/castlemaw pairs do for Majin.
5. Save the finals as `assets-src/creatures/front/<species>_<form>(front).png` and
   `assets-src/creatures/back/<species>_<form>(back).png`, e.g. `thornback_tenjin(front).png`.

**Reference files** are in `.design/imagegen/refs/majin-tenjin/`. Each is 1024², the sprite scaled to fit with
pixels kept crisp, and flattened onto the chroma colour that species' prompt asks for:
`<species>_front.png`, `<species>_back.png`, and the Majin examples `example_hollowmane_front.png` →
`example_hollowmane_rage_front.png`, `example_castlemaw_front.png` → `example_castlemaw_rage_front.png`.

**Background:** magenta `#FF00FF` by default. **Green `#00FF00`** for necrogeist, gemknight and glimmereen, which have
pink or rainbow parts. The sprite pipeline keys a flat border colour out, so it must be one flat colour, with no
shadow or gradient.

**Accept an image when:** it's clearly the same species; the style, pixel size and outline match the attachment;
the view matches (front: 3/4 facing left; back: same angle as the back reference); no aura or glow drawn around it; the Majin cracked ring or Tenjin gold ring is visible; the background is perfectly
flat; there's no ground shadow, text or second creature; and no background colour appears inside the creature.

### The two looks (already written into every prompt below)

- **Majin**: darker, more saturated palette; glowing **crimson cracks** breaking open across the body; a burning crimson
  core; blazing red eyes; longer, more jagged spikes and claws; a **cracked crimson ring sigil**; aggressive forward
  lean. *A memory refusing to be erased.*
- **Tenjin**: palette lifted toward ivory, pearl and soft gold; **gold kintsugi seams** (cracks mended with gold); a
  thin **gold halo ring** behind the head with a small lens-circle at its centre; calm white-gold eyes; weightless
  flowing streamers, fins or cloth; upright, serene pose. *A memory held perfectly.*

### No aura in the art

Don't draw an aura, glow or flames around the creature. The game draws the aura itself, animated, over the sprite (`.design/majin-tenjin.md` §8). A baked-in aura would sit frozen underneath the moving one, and a soft glow can't survive the pipeline anyway, because every pixel ends up fully opaque or fully transparent.

---

# MAJIN

## 1. Infernomorel: Majin (magenta)

**Front.** Attach: `infernomorel_front.png`, `example_hollowmane_front.png`, `example_hollowmane_rage_front.png`

```
Image 1 is Infernomorel, a Fire/Dark mushroom creature from our monster-collecting game. Images 2 and 3 show another creature (Hollowmane) before and after its Majin transformation: use them only to judge how strong a transformation should be, not for design.

Create MAJIN INFERNOMOREL: the same creature, instantly recognisable, transformed into its rage form. Its blazing mushroom cap erupts into a towering inferno crown, the flames turning from orange to deep crimson and black at the tips, trailing black smoke. Its grinning face splits into a wider jagged maw with ember teeth. Glowing crimson cracks split open across its charred black body as if it is breaking apart from the inside, with a burning crimson core in its chest. Its claws grow into long smouldering talons. Eyes blaze solid red. A cracked ring sigil, a circle broken by a jagged crack, glows crimson on its chest. Aggressive, forward-leaning, about-to-pounce pose. It should feel like a memory refusing to be erased: furious, cracked, unstoppable.

Match image 1 exactly in art style: same pixel-art technique, same pixel size and chunkiness, same dark outline weight, same shading style and level of detail. Front battle sprite, 3/4 view facing left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no glow on the background. Do not use magenta or hot pink anywhere in the creature. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Majin Infernomorel front, `infernomorel_back.png`

```
Image 1 is Majin Infernomorel (front view). Image 2 is regular Infernomorel's back sprite.

Draw MAJIN INFERNOMOREL from behind, using exactly the pose, rear 3/4 angle and framing of image 2, with every change from image 1 visible from the back: the towering crimson-and-black inferno crown with black smoke, glowing crimson cracks across its charred black back, long smouldering talons. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow. No magenta or hot pink in the creature. No text, no frame, no second creature. Square 1:1.
```

## 2. Badlander: Majin (magenta)

**Front.** Attach: `badlander_front.png`, `example_castlemaw_front.png`, `example_castlemaw_rage_front.png`

```
Image 1 is Badlander, a Ground/Dark outlaw honey-badger drifter in a cowboy hat, bandana and bullet belts, from our monster-collecting game. Images 2 and 3 show another creature (Castlemaw) before and after its Majin transformation: use them only to judge how strong a transformation should be, not for design.

Create MAJIN BADLANDER: the same drifter, instantly recognisable, gone feral. Its eyes burn solid red in the shadow under a torn hat brim. The red bandana is shredded into tatters that flutter like flames. Its fur bristles into dark spikes along the shoulders and back. Glowing crimson cracks split across its chest and arms as if it is breaking open from inside. Its claws lengthen into hooked black talons. The bullet belts glow red-hot and the lasso coil smoulders. A cracked ring sigil, a circle broken by a jagged crack, glows crimson on the front of its hat where a badge would sit. A low, hunched gunslinger crouch, ready to draw. It should feel like a memory refusing to be erased: furious, cracked, unstoppable.

Match image 1 exactly in art style: same pixel-art technique, same pixel size, same outline weight, same shading style and level of detail. Front battle sprite, 3/4 view facing left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no dust or specks. No magenta or hot pink in the creature. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Majin Badlander front, `badlander_back.png`

```
Image 1 is Majin Badlander (front view). Image 2 is regular Badlander's back sprite.

Draw MAJIN BADLANDER from behind, using exactly the pose, rear 3/4 angle and framing of image 2, with every change from image 1 visible from the back: torn hat brim, shredded bandana tails fluttering like flames, dark spikes bristling along its shoulders and back, crimson cracks across its back and arms, red-hot bullet belts, smouldering lasso. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no specks. No magenta in the creature. No text, no frame, no second creature. Square 1:1.
```

## 3. Toxshade: Majin (magenta)

**Front.** Attach: `toxshade_front.png`, `example_hollowmane_front.png`, `example_hollowmane_rage_front.png`

```
Image 1 is Toxshade, a Poison/Dark plague-rat demon with purple crystals in its black fur, from our monster-collecting game. Images 2 and 3 show another creature (Hollowmane) before and after its Majin transformation: use them only to judge how strong a transformation should be, not for design.

Create MAJIN TOXSHADE: the same creature, instantly recognisable, swollen and enraged. Its purple crystals erupt into tall jagged crimson-violet spikes along its spine and shoulders. Glowing crimson cracks split across its body as if it is breaking open from inside, with a burning crimson core in its chest. Its toxic drool turns glowing crimson. Its shadow tendrils thicken into a ragged mantle of black smoke. Its tail ends in a barbed whip. Its claws lengthen. Eyes blaze solid red. A cracked ring sigil, a circle broken by a jagged crack, glows crimson on its forehead. Low, aggressive, lunging pose. It should feel like a memory refusing to be erased: furious, cracked, unstoppable.

Match image 1 exactly in art style: same pixel-art technique, same pixel size, same outline weight, same shading style and level of detail. Front battle sprite, 3/4 view facing left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no sparkles. Keep the creature's violets clearly purple, never magenta. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Majin Toxshade front, `toxshade_back.png`

```
Image 1 is Majin Toxshade (front view). Image 2 is regular Toxshade's back sprite.

Draw MAJIN TOXSHADE from behind, using exactly the pose, rear 3/4 angle and framing of image 2, with every change from image 1 visible from the back: tall jagged crimson-violet spikes along the spine, crimson cracks across its back, the ragged black smoke mantle, the barbed whip tail. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no sparkles. Violets stay purple, never magenta. No text, no frame, no second creature. Square 1:1.
```

## 4. Necrogeist: Majin (GREEN background)

**Front.** Attach: `necrogeist_front.png`, `example_hollowmane_front.png`, `example_hollowmane_rage_front.png`

```
Image 1 is Necrogeist, a Ghost/Fairy specter with a halo, butterfly-bat wings and a glowing pink core, from our monster-collecting game. Images 2 and 3 show another creature (Hollowmane) before and after its Majin transformation: use them only to judge how strong a transformation should be, not for design.

Create MAJIN NECROGEIST: the same creature, instantly recognisable, its grudge unleashed. Its halo cracks and twists into a jagged crimson crown. Its wings tear into ragged membranes with glowing red veins. Its pink core becomes a burning crimson heart. Its grin widens with fangs. Eyes blaze solid red. Glowing crimson cracks split across its dark violet body as if it is breaking open from inside. Faint screaming spirit wisps trail behind it. A cracked ring sigil, a circle broken by a jagged crack, glows crimson just above the crown. Looming, aggressive pose. It should feel like a memory refusing to be erased: furious, cracked, unstoppable.

Match image 1 exactly in art style: same pixel-art technique, same pixel size, same outline weight, same shading style and level of detail. Front battle sprite, facing slightly left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid pure green #00FF00, no gradient, no ground shadow, no glow on the background. Do not use bright green anywhere in the creature. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Majin Necrogeist front, `necrogeist_back.png`

```
Image 1 is Majin Necrogeist (front view). Image 2 is regular Necrogeist's back sprite.

Draw MAJIN NECROGEIST from behind, using exactly the pose, angle and framing of image 2, with every change from image 1 visible from the back: the jagged crimson crown, the torn wings with glowing red veins, crimson cracks across its body, trailing spirit wisps. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid pure green #00FF00, no gradient, no ground shadow. No bright green in the creature. No text, no frame, no second creature. Square 1:1.
```

## 4b. Zenryu: Majin, its Super Saiyan form (magenta)

Zenryu is the Ultra Instinct dragon; its rage form is the golden Super Saiyan. Attach only `zenryu_front.png`
(the first frame of its flipbook, on magenta).

**Front.**
```
Generate an image. Image 1 is Zenryu, a legendary Dragon/Fighting martial-artist dragon from our monster-collecting game: a muscular white-silver dragon with a huge spiky silver mane, a golden horn crown, an orange gi sash and wristbands, navy pants and a long white tail, ringed by teal energy rings.

Create ONE single sprite of MAJIN ZENRYU, its rage form, a golden "super saiyan" power-up: the same creature, instantly recognisable. Its silver mane stands straight up into huge sharp golden-yellow spikes, rigid and glowing, swept up and back. Its eyes turn intense teal-green with a fierce glare and furrowed brow. Its body bulks up, muscles harder and more defined. Small crackles of electric-blue lightning arc across its body and mane. Its teal energy rings are gone. A crimson cracked ring sigil (a circle broken by one jagged crack) glows on its forehead under the golden horn crown. The orange gi sash, wristbands, navy pants and long tail stay, the tail tip now golden. Fists clenched, a powered-up battle stance, the moment after a scream of rage. Do not draw an aura, flames or glow around the outline: the creature only.

Match image 1 exactly in art style: same pixel-art technique, same pixel size, same dark outline weight, same shading style and level of detail. Front battle sprite, 3/4 view facing left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no glow on the background. No magenta or hot pink in the creature. No text, no logo, no frame, no second creature, no scene. Square 1:1.
```

**Back.** Attach: the approved Majin Zenryu front, `zenryu_back.png`
```
Generate an image using the two images I just attached. The first is Majin Zenryu (front view). The second is regular Zenryu's back sprite.

Draw ONE single sprite of MAJIN ZENRYU from behind, using exactly the pose, rear 3/4 angle and framing of the second image (we see its back and the back of its mane, not its face): the huge golden spiked mane standing straight up, seen from behind; the bulked-up back muscles; electric-blue lightning crackles; the orange gi sash, navy pants and long tail with a golden tip; no teal rings. Same creature, same palette as the first image. No aura around the outline.

Match the art style exactly: same pixel-art technique, pixel size, outline weight and shading as the second image. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow. No magenta in the creature. No text, no frame, no second creature, no scene. Square 1:1.
```

## 5. hollowmane & castlemaw: optional sigil touch-up

Their Rage art becomes their Majin art. The game adds the animated aura, so the only optional change is the shared
sigil. Attach the existing sprite (`assets-src/creatures/front/hollowmane_rage(front).png`, etc.):

```
Image 1 is a finished battle sprite. Keep it exactly as it is: same pose, pixels, colours, framing and background. Add only one thing: a small cracked ring sigil, a circle broken by a single jagged crack, glowing crimson, drawn in the same pixel-art style, placed on [hollowmane: its bone mask's forehead / castlemaw: the centre of the skull on its chest]. Change nothing else.
```

---

# TENJIN

> Do **Thornback first**. After approving it, save the front as
> `refs/majin-tenjin/example_thornback_tenjin_front.png` and attach it, together with `thornback_front.png`, as the
> before/after example on every other Tenjin prompt.

## 6. Thornback: Tenjin (magenta). DO THIS ONE FIRST

**Front.** Attach: `thornback_front.png`

```
Image 1 is Thornback, a Grass/Rock guardian bear with branch antlers, a moss-and-leaf cloak, bark armour, thorns and an amber seed core on its chest, from our monster-collecting game.

Create TENJIN THORNBACK: the same creature, instantly recognisable, ascended into its serene heavenly form. Its antlers bloom into a crown of small white blossoms on gold-tipped branches. Its mossy cloak becomes a long flowing mantle of pale green and ivory leaves that drift upward, weightless. Its bark plates are crossed by thin seams of liquid gold, like kintsugi: cracks that have been mended with gold. Its amber seed core becomes a radiant gold sun-seed. Its thorns become smooth, polished, gold-tipped. A thin gold halo ring floats behind its antlers, with a small lens-circle at its centre. Its eyes glow calm white-gold. A few small gold-white light motes float around it. Its palette lifts toward ivory, pearl and soft gold while staying clearly green and brown. Upright, calm, dignified stance, like an ancient forest guardian at peace. It should feel like a memory held perfectly: serene, radiant, untouchable.

Match image 1 exactly in art style: same pixel-art technique, same chunky pixel size, same dark outline weight, same shading style and level of detail. Front battle sprite, 3/4 view facing left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no glow on the background. Do not use magenta or hot pink anywhere in the creature. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Tenjin Thornback front, `thornback_back.png`

```
Image 1 is Tenjin Thornback (front view). Image 2 is regular Thornback's back sprite.

Draw TENJIN THORNBACK from behind, using exactly the pose, rear angle and framing of image 2, with every change from image 1 visible from the back: blossoming gold-tipped antler crown, the gold halo ring floating behind the head (seen from behind), the long flowing pale green and ivory leaf mantle drifting upward, gold kintsugi seams across its bark plates, a few floating light motes. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, chunky pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow. No magenta in the creature. No text, no frame, no second creature. Square 1:1.
```

## 7. Abysspark: Tenjin (magenta)

**Front.** Attach: `abysspark_front.png`, `thornback_front.png`, `example_thornback_tenjin_front.png`

```
Image 1 is Abysspark, a Water/Electric deep-sea anglerfish predator, navy blue with yellow lightning stripes and a glowing lure, from our monster-collecting game. Images 2 and 3 show another creature (Thornback) before and after its Tenjin transformation: use them for how a Tenjin form looks (gold kintsugi seams, gold halo ring, ivory-and-gold lift, serene mood), not for design.

Create TENJIN ABYSSPARK: the same creature, instantly recognisable, become the calm eye of the storm. Its navy body brightens to deep sea-blue with pearl highlights. Its jagged yellow lightning stripes become smooth flowing seams of liquid gold, like kintsugi. Its fins lengthen into long translucent veil-fins that drift weightlessly. Its lure becomes a calm glowing white-gold orb, encircled by a thin gold halo ring with a small lens-circle at its centre. Its mouth is closed and its expression serene; its eyes glow calm white-gold. A few small gold-white light motes and tiny bubbles float around it. Graceful pose, gliding slightly upward. It should feel like a memory held perfectly: serene, radiant, untouchable.

Match image 1 exactly in art style: same pixel-art technique, same chunky pixel size, same dark outline weight, same shading style and level of detail. Front battle sprite, 3/4 view facing left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no glow on the background. No magenta or hot pink in the creature. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Tenjin Abysspark front, `abysspark_back.png`

```
Image 1 is Tenjin Abysspark (front view). Image 2 is regular Abysspark's back sprite.

Draw TENJIN ABYSSPARK from behind, using exactly the pose, rear angle and framing of image 2, with every change from image 1 visible from the back: deep sea-blue body with pearl highlights, smooth gold kintsugi seams where the lightning stripes were, long translucent veil-fins drifting, the white-gold lure orb in its gold halo ring, floating motes and bubbles. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, chunky pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow. No magenta in the creature. No text, no frame, no second creature. Square 1:1.
```

## 8. Lawlander: Tenjin (magenta)

**Front.** Attach: `lawlander_front.png`, `thornback_front.png`, `example_thornback_tenjin_front.png`

```
Image 1 is Lawlander, a Ground/Fighting honey-badger lawman with a cowboy hat, poncho, tin star, bandana and bullet belts, from our monster-collecting game. Images 2 and 3 show another creature (Thornback) before and after its Tenjin transformation: use them for how a Tenjin form looks (gold kintsugi seams, gold halo ring, ivory-and-gold lift, serene mood), not for design.

Create TENJIN LAWLANDER: the same lawman, instantly recognisable, exalted. His poncho becomes a long ivory-and-gold duster cape that drifts upward, weightless. The tin star becomes a radiant gold star. His hat gains a gold band. The bullet belts turn polished gold. The lasso becomes a coil of softly glowing golden rope. Thin seams of liquid gold, like kintsugi, cross his coat and arms where old wounds were. A thin gold halo ring floats behind his hat, with a small lens-circle at its centre. His eyes glow calm white-gold. A few small gold-white light motes float around him. Palette lifted toward ivory and soft gold while his browns stay readable. He stands straight and calm, one paw resting on his holster: he never draws first. It should feel like a memory held perfectly: serene, radiant, untouchable.

Match image 1 exactly in art style: same pixel-art technique, same pixel size, same outline weight, same shading style and level of detail. Front battle sprite, 3/4 view facing left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no dust or specks. No magenta or hot pink in the creature. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Tenjin Lawlander front, `lawlander_back.png`

```
Image 1 is Tenjin Lawlander (front view). Image 2 is regular Lawlander's back sprite.

Draw TENJIN LAWLANDER from behind, using exactly the pose, rear 3/4 angle and framing of image 2, with every change from image 1 visible from the back: the long ivory-and-gold duster cape drifting upward, the gold hat band, the gold halo ring behind the hat (seen from behind), gold bullet belts, the glowing golden lasso coil, gold kintsugi seams on the coat, floating motes. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no specks. No magenta in the creature. No text, no frame, no second creature. Square 1:1.
```

## 9. Gemknight: Tenjin (GREEN background)

**Front.** Attach: `gemknight_front.png`, `thornback_front.png`, `example_thornback_tenjin_front.png`

```
Image 1 is Gemknight, a Steel/Fairy crystal knight in silver armour with a prismatic cape, a longsword and a crystal shield, from our monster-collecting game. Images 2 and 3 show another creature (Thornback) before and after its Tenjin transformation: use them for how a Tenjin form looks (gold kintsugi seams, gold halo ring, ivory-and-gold lift, serene mood), not for design.

Create TENJIN GEMKNIGHT: the same knight, instantly recognisable, ascended. The silver armour becomes pearl-white trimmed with gold, crossed by thin seams of liquid gold like kintsugi. The prismatic cape becomes a long flowing cape of soft pearl light with a faint rainbow edge, drifting upward. The sword becomes a long blade of pure white-gold light, held lowered and calm. The shield shows a gold ring emblem with a small lens-circle at its centre. A thin gold halo ring floats behind the helm. The visor glows calm white-gold. A few small gold-white light motes float around it. Tall, still, dignified stance. It should feel like a memory held perfectly: serene, radiant, untouchable.

Match image 1 exactly in art style: same pixel-art technique, same pixel size, same outline weight, same shading style and level of detail. Front battle sprite, 3/4 view facing left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid pure green #00FF00, no gradient, no ground shadow, no sparkles or rays on the background. Do not use bright green anywhere in the creature, including in its rainbow edges. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Tenjin Gemknight front, `gemknight_back.png`

```
Image 1 is Tenjin Gemknight (front view). Image 2 is regular Gemknight's back sprite.

Draw TENJIN GEMKNIGHT from behind, using exactly the pose, rear 3/4 angle and framing of image 2, with every change from image 1 visible from the back: pearl-white and gold armour with gold kintsugi seams, the long flowing pearl-light cape drifting upward, the white-gold light blade, the gold halo ring behind the helm (seen from behind), floating motes. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid pure green #00FF00, no gradient, no ground shadow, no rays. No bright green in the creature. No text, no frame, no second creature. Square 1:1.
```

## 10. Glimmereen: Tenjin (GREEN background)

**Front.** Attach: `glimmereen_front.png`, `thornback_front.png`, `example_thornback_tenjin_front.png`

```
Image 1 is Glimmereen, a small round white Fairy creature with sparkly wings, a pink bow and a yellow antenna orb, from our monster-collecting game. Images 2 and 3 show another creature (Thornback) before and after its Tenjin transformation: use them for how a Tenjin form looks (gold kintsugi seams, gold halo ring, ivory-and-gold lift, serene mood), not for design.

Create TENJIN GLIMMEREEN: the same creature, still small, round and cute, but celestial. Its two wings grow into four long luminous wings with soft gold edges. Its antenna orb becomes a tiny glowing gold sun. Its pink bow becomes a pale-pink bow with long gold ribbons that drift upward. A thin gold halo ring floats behind its head, with a small lens-circle at its centre. A few very fine gold kintsugi lines trace its body, kept delicate so it stays cute. Its face has a serene closed-eye smile. Small gold-white light motes float around it. Floating gently, calm. It should feel like a memory held perfectly: serene, radiant, untouchable.

Match image 1 exactly in art style: same pixel-art technique, same pixel size, same soft outline, same shading style and level of detail. Front battle sprite, facing slightly left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid pure green #00FF00, no gradient, no ground shadow, no sparkles on the background. Do not use bright green anywhere in the creature. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Tenjin Glimmereen front, `glimmereen_back.png`

```
Image 1 is Tenjin Glimmereen (front view). Image 2 is regular Glimmereen's back sprite.

Draw TENJIN GLIMMEREEN from behind, using exactly the pose, angle and framing of image 2, with every change from image 1 visible from the back: four long luminous gold-edged wings, the tiny gold sun antenna orb, the bow's long gold ribbons drifting upward, the gold halo ring behind its head (seen from behind), floating motes. Same creature, same palette as image 1, still small and cute.

Match the art style exactly: same pixel-art technique, pixel size, outline and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid pure green #00FF00, no gradient, no ground shadow. No bright green in the creature. No text, no frame, no second creature. Square 1:1.
```

## 11. Solpyre: Tenjin (magenta)

**Front.** Attach: `solpyre_front.png`, `thornback_front.png`, `example_thornback_tenjin_front.png`

```
Image 1 is Solpyre, a Fire/Flying phoenix with red-orange feathers, a gold sun-disc chest plate and a burning flame base, from our monster-collecting game. Images 2 and 3 show another creature (Thornback) before and after its Tenjin transformation: use them for how a Tenjin form looks (gold kintsugi seams, gold halo ring, ivory-and-gold lift, serene mood), not for design.

Create TENJIN SOLPYRE: the same phoenix, instantly recognisable, as a calm sun-god. Its flames burn white-gold at the core with warm orange edges instead of red. Its wings spread wide, the feather tips turning ivory and gold. Its sun-disc chest plate becomes radiant gold engraved with a ring and a small lens-circle at its centre. Long flowing tail streamers of soft golden flame drift weightlessly. Thin seams of liquid gold, like kintsugi, cross its feathers. A thin gold halo ring of light floats behind its head. Its eyes glow calm white. The fire beneath it settles into a calm gold glow instead of a blaze. A few gold-white light motes float around it. Majestic, still, serene pose. It should feel like a memory held perfectly: serene, radiant, untouchable.

Match image 1 exactly in art style: same pixel-art technique, same pixel size, same outline weight, same shading style and level of detail. Front battle sprite, facing slightly left, full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow, no glow on the background. No magenta or hot pink in the creature. No text, no logo, no frame, no second creature. Square 1:1.
```

**Back.** Attach: your approved Tenjin Solpyre front, `solpyre_back.png`

```
Image 1 is Tenjin Solpyre (front view). Image 2 is regular Solpyre's back sprite.

Draw TENJIN SOLPYRE from behind, using exactly the pose, angle and framing of image 2, with every change from image 1 visible from the back: white-gold flames with warm orange edges, wide wings with ivory-and-gold feather tips, long golden flame tail streamers drifting, gold kintsugi seams on the feathers, the halo ring of light behind its head (seen from behind), the calm gold glow beneath it, floating motes. Same creature, same palette as image 1.

Match the art style exactly: same pixel-art technique, pixel size, outline weight and shading as image 2. Full body, centered, filling about 85% of the square canvas.
Background: one perfectly flat solid magenta #FF00FF, no gradient, no ground shadow. No magenta in the creature. No text, no frame, no second creature. Square 1:1.
```

---

# BAND ICONS (optional)

The bag currently draws item icons from CSS by kind. These are for the story hand-over, the tutorial card and a
future bag icon. Attach `example_castlemaw_rage_front.png` (Majin) or your Tenjin Thornback (Tenjin) for palette only.

**Majin Band**
```
A single item icon for a monster-collecting game: the MAJIN BAND. A heavy dark-iron wrist band, scratched and battle-worn, with a round glass field lens set into it. The lens is cracked by one jagged crack that glows crimson, and the crack's red light seeps into the iron around it. A cracked ring sigil is engraved beside the lens. Pixel-art style matching the attached image's pixel size and outline weight, 3/4 view, centered, filling about 80% of the canvas. Background: one perfectly flat solid pure green #00FF00, no shadow. No text. Square 1:1.
```

**Tenjin Band**
```
A single item icon for a monster-collecting game: the TENJIN BAND. A slim ivory-and-gold wrist band, elegant and smooth, with a round clear glass lens set into it, circled by a thin glowing gold ring. Faint gold kintsugi seams run across the band where it was once cracked and mended. A soft white-gold glow rests on the lens. Pixel-art style matching the attached image's pixel size and outline weight, 3/4 view, centered, filling about 80% of the canvas. Background: one perfectly flat solid magenta #FF00FF, no shadow. No text. Square 1:1.
```

---

## Run log (2026-10-11): all 20 generated in Gemini (Nano Banana Pro, image mode, 1:1)

- **Where they are:** `assets-src/forms-pending/{front,back}/<species>_<form>(<side>).png`, 1024². They are
  deliberately **not** in `assets-src/creatures/` yet: the sprite pipeline lists unregistered files there as
  excluded and `budget.test` fails. They move over when the forms are registered (species data + manifest).
  Contact sheet: `.screenshots/majin-tenjin/forms-contact-sheet.png`.
- **What worked better than these prompts:**
  - Attach **only the creature's own sprite**, not the Thornback before/after example. With the example, Gemini
    copied Thornback's blossoms onto Abysspark and once drew Lawlander *fighting* Thornback in a western town.
  - For the back, attach the approved front + the original back sprite, and say "we see its back, not its face".
    Two backs still came out as side views and needed one more instruction (Abysspark, Glimmereen's wings).
  - Badlander's first Majin pass was too subtle; "push the transformation much further" fixed it.
- **Necrogeist:** Gemini silently drops any request that carries a Necrogeist reference image (no chat is created).
  Its Majin front was generated from a text description, then corrected toward the real design; the back used
  that front as its only reference. Its proportions are a bit chunkier than the base sprite.
- **Watermark:** Gemini sometimes stamps a ✦ in the bottom-right corner; it was removed from Toxshade's back
  (the only one that had it).
- **For the import:** Abysspark's translucent veil-fins and Gemknight's / Glimmereen's soft edges blend into the
  chroma colour; key them with the manual border-flood + defringe pass the sprite-pipeline README describes for
  hollowmane / dustcub rather than relying on stage 1 alone.
- **Zenryu (added later the same day):** Gemini silently dropped the first request that said "super saiyan" (a
  franchise term). Rephrased as "golden power-up form" with the same visual description, it went through.
  Files: `assets-src/forms-pending/{front,back}/zenryu_majin(...).png`.
