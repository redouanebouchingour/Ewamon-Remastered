/**
 * The 19 character looks (`@ewa/content` LOOKS) as paper-doll outfits, and the body palette variants
 * (`BODIES.palette`: 'dusk', 'tide', 'forge') as recolours of a look's clothing slots (never skin or hair).
 *
 * Every look is one silhouette idea first (JRPG town-sprite rule: you know who it is from the outline alone):
 * the knight's plume and cape, the ninja's hood tails, the pirate's tricorn and coat skirts, the doctor's white
 * coat, the viking's horns and beard, the old lady's shawl and bun, the cowboy's brim …
 */
import type { PartDef, PartUse, RampSpec } from './compose.js';
import type { RampKind } from './color.js';
import { ARMS, FACE_EYES, FACE_F, FACE_M, FACE_OLD_F, FACE_OLD_M, HEAD, LEGS } from './parts/body.js';
import * as HAIR from './parts/hair.js';
import * as HAT from './parts/hats.js';
import * as TOP from './parts/torso.js';
import * as WEAR from './parts/wear.js';
import type { LookDef } from './sheet.js';

// ---- palette helpers ---------------------------------------------------------------------------------------

/** Six skin tones. */
export const SKINS = Object.freeze({
  porcelain: '#f6d5b8', light: '#f0c39c', warm: '#dea77c', tan: '#c48a5e', brown: '#96623f', deep: '#6b442d',
});

const FIXED: Readonly<Record<string, RampSpec>> = {
  eye: { base: '#2a2130', kind: 'eye' },
  eyeHi: { base: '#fbf8f0', kind: 'eye' },
  iris: { base: '#3f5f8f', kind: 'eye' },
  mouth: { base: '#9a4a44', kind: 'skin' },
  blush: { base: '#ee9e90', kind: 'skin' },
};

const c = (base: string, kind: RampKind = 'cloth'): RampSpec => ({ base, kind });
const use = (part: PartDef, ...slots: string[]): PartUse => ({ part, slots });

/** The common body: head, face, arms (upper, forearm, hand), legs (trousers, shin, shoe). */
function body(face: PartDef, arms: readonly [string, string, string], legs: readonly [string, string, string]): PartUse[] {
  return [use(HEAD), use(face), use(ARMS, ...arms), use(LEGS, ...legs)];
}

export interface LookSpec extends LookDef {
  /** Palette variants: slot → new base colour (the ramp kind is kept). */
  readonly variants?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

// ---- the 19 looks --------------------------------------------------------------------------------------------

export const LOOK_SPECS: readonly LookSpec[] = [
  {
    id: 'casual_male',   // Ranger (the default body): the hero's teal jacket, red scarf, spiky brown hair
    palette: {
      ...FIXED, skin: c(SKINS.light, 'skin'), hair: c('#6e4428', 'hair'), jacket: c('#2f7f7b'), shirt: c('#ebe3d0', 'white'),
      scarf: c('#c9423a'), pants: c('#5b4b3a', 'leather'), shoe: c('#b0463b', 'leather'),
    },
    parts: [
      ...body(FACE_M, ['jacket', 'jacket', 'skin'], ['pants', 'pants', 'shoe']),
      use(HAIR.HAIR_SHORT, 'hair', 'scarf'), use(TOP.JACKET, 'jacket', 'shirt', 'shirt', 'shirt'), use(WEAR.SCARF, 'scarf'),
    ],
  },
  {
    id: 'casual_female',   // Ranger (f): auburn ponytail, coral top, navy skirt, leggings and boots
    palette: {
      ...FIXED, skin: c(SKINS.porcelain, 'skin'), hair: c('#9c4a2c', 'hair'), tie: c('#e6be3e'), top: c('#e27a5c'),
      skirt: c('#34416b'), legging: c('#3b3549'), boot: c('#7c4b31', 'leather'),
    },
    parts: [
      ...body(FACE_F, ['top', 'skin', 'skin'], ['legging', 'boot', 'boot']),
      use(HAIR.HAIR_PONYTAIL, 'hair', 'tie'), use(TOP.TEE, 'top'), use(WEAR.SKIRT, 'skirt'),
    ],
  },
  {
    id: 'casual2_male',   // Drifter: black mop, olive hoodie, jeans, white sneakers
    palette: {
      ...FIXED, skin: c(SKINS.tan, 'skin'), hair: c('#2a2530', 'hair'), hoodie: c('#6b7a52'), string: c('#e6e2d8', 'white'),
      jeans: c('#3b5a88'), sneaker: c('#e6e3db', 'white'),
    },
    variants: { dusk: { hoodie: '#5b3c7c', jeans: '#2f3448', string: '#e0b04a' } },
    parts: [
      ...body(FACE_M, ['hoodie', 'hoodie', 'skin'], ['jeans', 'jeans', 'sneaker']),
      use(HAIR.HAIR_MESSY, 'hair', 'string'), use(TOP.HOODIE, 'hoodie', 'string'),
    ],
  },
  {
    id: 'casual2_female',   // Drifter (f): dark bob, mustard cardigan, maroon skirt, stockings
    palette: {
      ...FIXED, skin: c(SKINS.light, 'skin'), hair: c('#4a3226', 'hair'), cardigan: c('#d6a03c'), blouse: c('#eeeae0', 'white'),
      skirt: c('#7c3b3d'), stocking: c('#3d3242'), shoe: c('#2b2530', 'leather'),
    },
    variants: { dusk: { cardigan: '#6d4d8e', skirt: '#2b3252', stocking: '#2a2a38' } },
    parts: [
      ...body(FACE_F, ['cardigan', 'cardigan', 'skin'], ['stocking', 'stocking', 'shoe']),
      use(HAIR.HAIR_BOB, 'hair', 'blouse'), use(TOP.SWEATER, 'cardigan', 'blouse'), use(WEAR.SKIRT, 'skirt'),
    ],
  },
  {
    id: 'casual3_male',   // Apprentice: red cap, olive waistcoat over a white shirt, khaki shorts
    palette: {
      ...FIXED, skin: c(SKINS.warm, 'skin'), hair: c('#5a3a24', 'hair'), cap: c('#c63c3c'), brim: c('#a8302f'), logo: c('#f0ece2', 'white'),
      vest: c('#5f6f3b'), shirt: c('#ece8de', 'white'), shorts: c('#8c7851', 'leather'), sneaker: c('#3b5ba8'),
    },
    parts: [
      ...body(FACE_M, ['shirt', 'shirt', 'skin'], ['shorts', 'skin', 'sneaker']),
      use(HAIR.HAIR_SHORT, 'hair', 'cap'), use(HAT.HAT_CAP, 'cap', 'brim', 'logo'), use(TOP.VEST, 'vest', 'shirt', 'shirt'),
    ],
  },
  {
    id: 'cowboy_female',   // Fisher (f): tan hat, long blonde hair, leather vest, red shirt, jeans and boots
    palette: {
      ...FIXED, skin: c(SKINS.tan, 'skin'), hair: c('#d8b060', 'hair'), hat: c('#b88a50', 'leather'), band: c('#5a3a24', 'leather'),
      vest: c('#8b5b36', 'leather'), shirt: c('#b83c3c'), jeans: c('#3b5a88'), boot: c('#6b4129', 'leather'),
    },
    variants: { tide: { shirt: '#3a8ca8', vest: '#4b5b6b', hat: '#8c9ca2', band: '#2c4a5a' } },
    parts: [
      ...body(FACE_F, ['shirt', 'shirt', 'skin'], ['jeans', 'boot', 'boot']),
      use(HAIR.HAIR_LONG, 'hair', 'band'), use(HAT.HAT_COWBOY, 'hat', 'band'), use(TOP.VEST, 'vest', 'shirt', 'shirt'),
    ],
  },
  {
    id: 'cowboy_male',   // Fisher: brown hat, blue shirt under a leather vest, red bandana, boots
    palette: {
      ...FIXED, skin: c(SKINS.warm, 'skin'), hair: c('#5b3b25', 'hair'), hat: c('#7b5333', 'leather'), band: c('#2b2426', 'dark'),
      vest: c('#7b4b2b', 'leather'), shirt: c('#5b7bb1'), bandana: c('#c9423a'), jeans: c('#3b4b6b'), boot: c('#5b3b23', 'leather'),
    },
    variants: { tide: { shirt: '#3a9ba1', bandana: '#2b5b8b', hat: '#6b7b81', vest: '#4a5a60' } },
    parts: [
      ...body(FACE_M, ['shirt', 'shirt', 'skin'], ['jeans', 'boot', 'boot']),
      use(HAIR.HAIR_CROP, 'hair', 'band'), use(HAT.HAT_COWBOY, 'hat', 'band'), use(TOP.VEST, 'vest', 'shirt', 'shirt'), use(WEAR.BANDANA, 'bandana'),
    ],
  },
  {
    id: 'doctor_female_young',   // Healer: white coat to the knees, teal scrubs, stethoscope, a dark bun
    palette: {
      ...FIXED, skin: c(SKINS.light, 'skin'), hair: c('#3b2b23', 'hair'), pin: c('#3a9a9a'), coat: c('#eceae4', 'white'),
      scrubs: c('#3b9b9b'), steth: c('#4b4b59', 'dark'), shoe: c('#e6e6e6', 'white'),
    },
    parts: [
      ...body(FACE_F, ['coat', 'coat', 'skin'], ['scrubs', 'scrubs', 'shoe']),
      use(HAIR.HAIR_BUN, 'hair', 'pin'), use(TOP.LABCOAT, 'coat', 'scrubs', 'steth'), use(WEAR.COAT_TAILS, 'coat', 'coat'),
    ],
  },
  {
    id: 'kimono_male',   // Pilgrim: indigo kimono, white collar, red obi, topknot, geta
    palette: {
      ...FIXED, skin: c(SKINS.warm, 'skin'), hair: c('#231f28', 'hair'), tie: c('#ece6d8', 'white'), kimono: c('#35417b'),
      collar: c('#ece6d8', 'white'), obi: c('#b9412f'), tabi: c('#ece8e0', 'white'), geta: c('#9b7149', 'leather'),
    },
    parts: [
      ...body(FACE_M, ['kimono', 'kimono', 'skin'], ['kimono', 'tabi', 'geta']),
      use(HAIR.HAIR_TOPKNOT, 'hair', 'tie'), use(TOP.KIMONO, 'kimono', 'collar', 'obi'), use(WEAR.ROBE, 'kimono', 'collar'),
    ],
  },
  {
    id: 'knight_golden_male',   // gilded plate, winged helm with a red crest, red cape
    palette: {
      ...FIXED, skin: c(SKINS.light, 'skin'), gold: c('#d7a83a', 'gold'), goldDark: c('#a87a2a', 'gold'), wing: c('#eccb68', 'gold'),
      crest: c('#c93b3b'), emblem: c('#c93b3b'), cape: c('#b62f2f'), chain: c('#8b909a', 'metal'),
    },
    parts: [
      ...body(FACE_M, ['gold', 'gold', 'goldDark'], ['chain', 'gold', 'goldDark']),
      use(WEAR.CAPE, 'cape', 'wing'), use(HAT.HELM_GOLD, 'gold', 'wing', 'emblem', 'crest'), use(TOP.PLATE, 'gold', 'goldDark', 'emblem'),
      use(WEAR.PAULDRONS, 'gold'), use(WEAR.TASSET, 'gold'),
    ],
  },
  {
    id: 'knight_male',   // Warden: steel plate, open bascinet with a blue plume, blue cape
    palette: {
      ...FIXED, skin: c(SKINS.light, 'skin'), steel: c('#a9b1bd', 'metal'), steelDark: c('#6d7480', 'metal'), plume: c('#3b5bc9'),
      emblem: c('#3b5bc9'), cape: c('#2f4b9b'), clasp: c('#d7b04a', 'gold'), chain: c('#80858f', 'metal'),
    },
    variants: { forge: { cape: '#c8512b', plume: '#e3712b', emblem: '#e3712b', steel: '#8b8d93', steelDark: '#5a5a60' } },
    parts: [
      ...body(FACE_M, ['steel', 'steel', 'steelDark'], ['chain', 'steel', 'steelDark']),
      use(WEAR.CAPE, 'cape', 'clasp'), use(HAT.HELM_KNIGHT, 'steel', 'steelDark', 'emblem', 'plume'), use(TOP.PLATE, 'steel', 'steelDark', 'emblem'),
      use(WEAR.PAULDRONS, 'steel'), use(WEAR.TASSET, 'steel'),
    ],
  },
  {
    id: 'ninja_male',   // Duelist: midnight wrap and hood, red headband with trailing tails, wrapped shins
    palette: {
      ...FIXED, skin: c(SKINS.warm, 'skin'), wrap: c('#2b2f42', 'dark'), band: c('#bb322f'), sash: c('#6c7080', 'metal'),
      belt: c('#8b2b2b'), shin: c('#6b6f7b'), tabi: c('#24262f', 'dark'),
    },
    parts: [
      ...body(FACE_EYES, ['wrap', 'shin', 'wrap'], ['wrap', 'shin', 'tabi']),
      use(HAT.HOOD_NINJA, 'wrap', 'band'), use(TOP.NINJA, 'wrap', 'sash', 'belt'),
    ],
  },
  {
    id: 'old_classy_female',   // Scholar (f): silver chignon, spectacles, lavender shawl over a burgundy dress
    palette: {
      ...FIXED, skin: c(SKINS.porcelain, 'skin'), hair: c('#c9c5cd', 'hair'), pin: c('#8b6aa9'), glasses: c('#b9913b', 'gold'),
      dress: c('#7b2b3f'), lace: c('#efe9dd', 'white'), shawl: c('#8b6aa9'), hem: c('#5a1f2e'), shoe: c('#2b2529', 'leather'),
    },
    parts: [
      ...body(FACE_OLD_F, ['dress', 'dress', 'skin'], ['dress', 'dress', 'shoe']),
      use(HAIR.HAIR_BUNLOW, 'hair', 'pin'), use(WEAR.GLASSES, 'glasses'), use(TOP.DRESS_TOP, 'dress', 'lace'), use(WEAR.SHAWL, 'shawl'),
      use(WEAR.SKIRT_LONG, 'dress', 'hem'),
    ],
  },
  {
    id: 'old_classy_male',   // Elder: bowler, grey tufts, a white handlebar moustache, tweed and a bow tie
    palette: {
      ...FIXED, skin: c(SKINS.light, 'skin'), hair: c('#c9c5c1', 'hair'), hat: c('#2b2729', 'dark'), band: c('#6b5540', 'leather'),
      moustache: c('#efebe3', 'white'), tweed: c('#7b5b3f', 'leather'), waistcoat: c('#4b5b4b'), bow: c('#a92f2f'),
      trousers: c('#5b5b63'), shoe: c('#4b3123', 'leather'),
    },
    parts: [
      ...body(FACE_OLD_M, ['tweed', 'tweed', 'skin'], ['trousers', 'trousers', 'shoe']),
      use(HAIR.HAIR_OLD_M, 'hair', 'band'), use(HAT.HAT_BOWLER, 'hat', 'band'), use(WEAR.MOUSTACHE, 'moustache'),
      use(TOP.TWEED, 'tweed', 'waistcoat', 'bow', 'tweed'),
    ],
  },
  {
    id: 'pirate_male',   // tricorn with a skull badge, eyepatch, black beard, red captain's coat with gold trim
    palette: {
      ...FIXED, skin: c(SKINS.tan, 'skin'), hair: c('#2b2531', 'hair'), hat: c('#2b2527', 'dark'), trim: c('#d9b14b', 'gold'),
      skull: c('#ede7d7', 'white'), patch: c('#1f1d23', 'dark'), coat: c('#a92f2f'), stripes: c('#dcd6ca', 'white'),
      pants: c('#3b3137'), boot: c('#2b2325', 'dark'),
    },
    parts: [
      ...body(FACE_M, ['coat', 'coat', 'skin'], ['pants', 'boot', 'boot']),
      use(HAIR.HAIR_PONYTAIL, 'hair', 'coat'), use(WEAR.EYEPATCH, 'patch'), use(WEAR.BEARD_PIRATE, 'hair'), use(HAT.HAT_TRICORN, 'hat', 'trim', 'skull'),
      use(TOP.PIRATE_COAT, 'coat', 'trim', 'stripes'), use(WEAR.COAT_TAILS, 'coat', 'trim'),
    ],
  },
  {
    id: 'soldier_male',   // field soldier: olive helmet with chin strap, fatigues, webbing belt, rucksack
    palette: {
      ...FIXED, skin: c(SKINS.brown, 'skin'), hair: c('#231f24', 'hair'), helmet: c('#5f6b3f'), strap: c('#3b3b2f', 'leather'),
      rim: c('#4b5531'), olive: c('#6b7547'), belt: c('#8b7b55', 'leather'), pack: c('#5b5b3b'), boot: c('#29272b', 'dark'),
    },
    parts: [
      ...body(FACE_M, ['olive', 'olive', 'skin'], ['olive', 'boot', 'boot']),
      use(HAIR.HAIR_CROP, 'hair', 'strap'), use(HAT.HELM_SOLDIER, 'helmet', 'strap', 'rim'), use(TOP.FATIGUES, 'olive', 'belt'),
      use(WEAR.PACK, 'pack', 'strap', 'belt'),
    ],
  },
  {
    id: 'suit_male',   // Scholar: charcoal suit, red tie, neat side part, spectacles
    palette: {
      ...FIXED, skin: c(SKINS.light, 'skin'), hair: c('#3b2b23', 'hair'), glasses: c('#2b2b33', 'dark'), suit: c('#3b3f4b'),
      shirt: c('#eeece6', 'white'), tie: c('#a93b3b'), shoe: c('#23222a', 'dark'),
    },
    parts: [
      ...body(FACE_M, ['suit', 'suit', 'skin'], ['suit', 'suit', 'shoe']),
      use(HAIR.HAIR_NEAT, 'hair', 'tie'), use(WEAR.GLASSES, 'glasses'), use(TOP.SUIT, 'suit', 'shirt', 'tie'),
    ],
  },
  {
    id: 'viking_male',   // horned iron helm, great red beard, fur mantle, green tunic, fur-wrapped boots
    palette: {
      ...FIXED, skin: c(SKINS.light, 'skin'), hair: c('#b9512b', 'hair'), iron: c('#7b7f87', 'metal'), bronze: c('#a9793b', 'gold'),
      horn: c('#e9ddc1', 'white'), tunic: c('#4b6b3b'), belt: c('#5b3b23', 'leather'), fur: c('#8b6b4b', 'hair'),
      trousers: c('#6b5141', 'leather'), wrap: c('#9b8b71', 'leather'), boot: c('#4b3123', 'leather'),
    },
    parts: [
      ...body(FACE_M, ['tunic', 'skin', 'skin'], ['trousers', 'wrap', 'boot']),
      use(HAIR.HAIR_LONG, 'hair', 'bronze'), use(WEAR.BEARD_VIKING, 'hair', 'bronze'), use(HAT.HELM_VIKING, 'iron', 'bronze', 'iron', 'horn'),
      use(TOP.TUNIC, 'tunic', 'bronze', 'belt', 'bronze'), use(WEAR.TUNIC_SKIRT, 'tunic', 'bronze'), use(WEAR.FUR_MANTLE, 'fur'),
    ],
  },
  {
    id: 'blue_soldier_male',   // dress uniform: navy shako, gold epaulettes and buttons, white cross belts and trousers
    palette: {
      ...FIXED, skin: c(SKINS.warm, 'skin'), hair: c('#5b3b25', 'hair'), shako: c('#2f3f74'), gold: c('#d9b14b', 'gold'),
      visor: c('#1f1e25', 'dark'), coat: c('#2f4b8b'), belts: c('#eae8e2', 'white'), trousers: c('#e2ded6', 'white'), boot: c('#23222a', 'dark'),
    },
    parts: [
      ...body(FACE_M, ['coat', 'coat', 'skin'], ['trousers', 'boot', 'boot']),
      use(HAIR.HAIR_CROP, 'hair', 'gold'), use(HAT.HAT_KEPI, 'shako', 'gold', 'gold', 'visor'), use(TOP.UNIFORM, 'coat', 'gold', 'belts'),
      use(WEAR.EPAULETTES, 'gold'),
    ],
  },
];

/** A look id with its palette variant: `<look>:<palette>` (BODIES: casual2_male:dusk, cowboy_male:tide, knight_male:forge …). */
export function variantId(look: string, palette: string): string { return `${look}:${palette}`; }

/** Every look plus every palette variant, as renderable LookDefs (variants replace clothing slot bases). */
export function allLooks(): LookDef[] {
  const out: LookDef[] = [];
  for (const s of LOOK_SPECS) {
    out.push({ id: s.id, palette: s.palette, parts: s.parts });
    for (const [name, recolour] of Object.entries(s.variants ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const palette: Record<string, RampSpec> = { ...s.palette };
      for (const [slot, base] of Object.entries(recolour)) {
        const prev = palette[slot];
        if (prev === undefined || !('base' in prev)) throw new RangeError(`character-pipeline: variant ${s.id}:${name} recolours unknown slot '${slot}'`);
        if (slot === 'skin' || slot === 'hair') throw new RangeError(`character-pipeline: variant ${s.id}:${name} may not recolour ${slot}`);
        palette[slot] = { base, kind: prev.kind };
      }
      out.push({ id: variantId(s.id, name), palette, parts: s.parts });
    }
  }
  return out;
}

/** Legacy export for the dev preview. */
export const LOOK_DEFS: readonly LookDef[] = allLooks();
