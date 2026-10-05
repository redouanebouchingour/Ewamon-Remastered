/**
 * The KayKit character set (SPEC §40.2, amended 2026-10-05): six "Adventurers 2.0" characters by Kay Lousberg (CC0)
 * on one shared skeleton (`Rig_Medium`, 23 joints, identical bind pose in every file), turned into the 19
 * `@ewa/content` LOOKS plus the 5 `BODIES` palette variants.
 *
 *  - SHAPES: body geometry. Every KayKit character is 6–9 skinned parts (body, arms, legs, head, headwear, cape …)
 *    on the same rig and the same 8 × 4 gradient-swatch atlas grid; a shape takes the parts it wants — from up to two
 *    characters (a head from another character sits on any body: heads only sample the universal skin 0,0 / hair 1,0
 *    / eyes 2,0 cells, plus the metal 3,0 cell for the rogue's earring) — and the pipeline merges them into ONE
 *    skinned primitive. Capes, quivers, hats and visors are simply left out where a look should not have them.
 *  - LOOKS: shape + the body's texture recoloured swatch by swatch (`palette`, sRGB mid colours; the source gradient
 *    is kept as an OKLab lightness profile, see `atlas.ts`) + an optional accessory held in a hand (`handslot.*`
 *    joint): a mug for townsfolk, a book for scholars, a shield for soldiers — never a weapon.
 *  - PALETTE_VARIANTS: clothing-only recolours (`look:palette`), like 16-bit palette swaps: skin and hair never change.
 */

/** The six KayKit characters (file stem → mesh-name prefix). */
export const KAYKIT_CHARACTERS = Object.freeze({
  Barbarian: 'Barbarian',
  Knight: 'Knight',
  Mage: 'Mage',
  Ranger: 'Ranger',
  Rogue: 'Rogue',
  Rogue_Hooded: 'RogueHooded',
} as const);
export type KayKitCharacter = keyof typeof KAYKIT_CHARACTERS;

/** The five source textures (`<name>_texture.png`, 1024², 8 columns × 4 rows of 128 × 256 gradient swatches). */
export const BASE_TEXTURES = ['barbarian', 'knight', 'mage', 'ranger', 'rogue'] as const;
export type BaseTexture = (typeof BASE_TEXTURES)[number];
export const TEXTURE_OF: Readonly<Record<KayKitCharacter, BaseTexture>> = Object.freeze({
  Barbarian: 'barbarian', Knight: 'knight', Mage: 'mage', Ranger: 'ranger', Rogue: 'rogue', Rogue_Hooded: 'rogue',
});
/** Swatch grid of every source texture. */
export const SWATCH_COLUMNS = 8;
export const SWATCH_ROWS = 4;

/** `"col,row"` of a swatch cell (row 0 = the top of the image = glTF v 0). */
export type Cell = `${number},${number}`;

/**
 * Named recolour slots per texture → the swatch cells they cover. Measured (`dev/swatches.ts`): for every part, the
 * cells its UVs sample, their vertex count, centroid and colour. Cells used by several parts are one slot (a KayKit
 * swatch is a material: the ranger's blue 0,1 is the scarf, the cape and the fletching at once).
 */
export const SLOTS: Readonly<Record<BaseTexture, Readonly<Record<string, readonly Cell[]>>>> = Object.freeze({
  knight: {
    skin: ['0,0'], hair: ['1,0'], armour: ['3,0'], trim: ['7,0'], dark: ['4,0'], under: ['7,1'], leather: ['6,0'],
    cape: ['0,1'], ribbon: ['1,1'], buckle: ['2,1'], shield: ['2,2'], shieldLight: ['0,2'], shieldRim: ['3,1'], grip: ['6,1'],
  },
  ranger: {
    skin: ['0,0'], hair: ['1,0'], metal: ['3,0'], leather: ['7,0'], shirt: ['5,0'], sleeve: ['6,0'], scarf: ['0,1'],
    band: ['1,1'], bracer: ['7,2'], trousers: ['7,1'], boots: ['3,2'],
  },
  rogue: {
    skin: ['0,0'], hair: ['1,0'], metal: ['3,0'], tunic: ['0,1'], scarf: ['1,1'], vest: ['5,0'], gloves: ['7,2'],
    belt: ['6,0'], trousers: ['7,1'], boots: ['3,2'],
  },
  mage: {
    skin: ['0,0', '7,2'], hair: ['1,0'], robe: ['0,1'], hat: ['1,1'], trim: ['4,0'], belt: ['5,0'], buttons: ['3,0'],
    satchel: ['2,2'], under: ['7,1'], cape: ['2,1'], boots: ['3,2'], book: ['1,2'], pages: ['0,2'], bookBand: ['5,1'],
  },
  barbarian: {
    skin: ['0,0'], beard: ['1,0'], fur: ['7,0'], furTrim: ['2,1'], leather: ['6,0'], strap: ['6,1'], bracer: ['7,2'],
    trousers: ['7,1'], boots: ['3,2'], metal: ['3,0', '3,1'], mugWood: ['5,1'], foam: ['1,3'],
  },
});

/** A part of a KayKit character: `<prefix>_<part>` in `Characters/gltf/<character>.glb`. */
export interface PartRef { readonly from: KayKitCharacter; readonly part: string }
export interface ShapeDef {
  /** The texture whose swatch layout the shape's UVs address (its body's). */
  readonly texture: BaseTexture;
  readonly parts: readonly PartRef[];
}

const p = (from: KayKitCharacter, ...parts: string[]): PartRef[] => parts.map((part) => ({ from, part }));
const LIMBS = ['Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight'];

/** Body geometry (merged to one skinned primitive each). Headwear and capes are part of the shape. */
export const SHAPES: Readonly<Record<string, ShapeDef>> = Object.freeze({
  knight: { texture: 'knight', parts: p('Knight', ...LIMBS, 'Head', 'Helmet', 'Cape') },
  knight_trooper: { texture: 'knight', parts: p('Knight', ...LIMBS, 'Head', 'Helmet') },
  barbarian: { texture: 'barbarian', parts: p('Barbarian', ...LIMBS, 'Head', 'BearHat') },
  ranger_lad: { texture: 'ranger', parts: [...p('Ranger', ...LIMBS, 'Cape'), ...p('Knight', 'Head')] },
  ranger_lass: { texture: 'ranger', parts: [...p('Ranger', ...LIMBS, 'Cape'), ...p('Rogue', 'Head')] },
  ranger_plain: { texture: 'ranger', parts: [...p('Ranger', ...LIMBS), ...p('Knight', 'Head')] },
  ranger_moustache: { texture: 'ranger', parts: p('Ranger', ...LIMBS, 'Cape', 'Head') },
  rogue_lad: { texture: 'rogue', parts: [...p('Rogue', ...LIMBS), ...p('Knight', 'Head')] },
  rogue_lass: { texture: 'rogue', parts: p('Rogue', ...LIMBS, 'Head') },
  rogue_captain: { texture: 'rogue', parts: [...p('Rogue', ...LIMBS, 'Cape'), ...p('Ranger', 'Head')] },
  rogue_hooded: { texture: 'rogue', parts: p('Rogue_Hooded', ...LIMBS, 'Cape', 'Head', 'Mask') },
  mage_lass: { texture: 'mage', parts: [...p('Mage', ...LIMBS), ...p('Rogue', 'Head')] },
  mage_long: { texture: 'mage', parts: p('Mage', ...LIMBS, 'Head') },
  mage_moustache: { texture: 'mage', parts: [...p('Mage', ...LIMBS), ...p('Ranger', 'Head')] },
  mage_hatted: { texture: 'mage', parts: [...p('Mage', ...LIMBS, 'Hat'), ...p('Knight', 'Head')] },
});

/** Headwear parts (excluded from the bare-head height the one scale factor is measured on). */
export const HEADWEAR_PARTS: ReadonlySet<string> = new Set(['Helmet', 'HelmetVisor', 'BearHat', 'Hat', 'Mask']);

/**
 * Hand-held accessories (`Assets/gltf/<id>.gltf`, rigid, parented to a hand-slot joint at runtime). `rotation` (XYZ
 * Euler, radians) turns the item in the slot's frame. KayKit slots are built for weapons: in the idle pose (measured
 * in the sandbox) the right slot's +X points down and the left slot's +X up, +Y forward along the forearm and +Z
 * sideways — a blade points forward, but a mug lies on its side and a shield's top points forward. A quarter turn
 * about Z stands each item up (+Y to world up) with its face (+Z) still turned outward.
 */
export const ACCESSORIES = Object.freeze({
  mug_full: { texture: 'barbarian', bone: 'handslot.r', rotation: [0, 0, Math.PI / 2] },
  spellbook_closed: { texture: 'mage', bone: 'handslot.l', rotation: [0, 0, -Math.PI / 2] },
  shield_round_color: { texture: 'knight', bone: 'handslot.l', rotation: [0, 0, -Math.PI / 2] },
  shield_badge_color: { texture: 'knight', bone: 'handslot.l', rotation: [0, 0, -Math.PI / 2] },
  shield_square_color: { texture: 'knight', bone: 'handslot.l', rotation: [0, 0, -Math.PI / 2] },
} as const satisfies Readonly<Record<string, { readonly texture: BaseTexture; readonly bone: 'handslot.l' | 'handslot.r'; readonly rotation: readonly [number, number, number] }>>);
export type AccessoryId = keyof typeof ACCESSORIES;

/** sRGB hex mid colour per slot (unlisted slots keep the source swatch). */
export type Palette = Readonly<Record<string, string>>;
export interface LookDef {
  readonly shape: keyof typeof SHAPES & string;
  readonly palette: Palette;
  readonly accessory: AccessoryId | null;
}

// Skin tones (mid of the gradient; KayKit's own skin is #f5ba95).
const SKIN = { fair: '#f6c4a2', light: '#f0b892', tan: '#d9a07a', olive: '#c48a62', brown: '#9c6446', deep: '#6e4430' } as const;

/**
 * The 19 looks. Ids are `@ewa/content` LOOKS (historically the Quaternius file stems); each is re-cast as a KayKit
 * townsperson or adventurer of the same role.
 */
export const LOOK_DEFS: Readonly<Record<string, LookDef>> = Object.freeze({
  // the persist default body (ranger_m): a young adventurer — the KayKit ranger's blue cape and scarf, a bare head
  casual_male: { shape: 'ranger_lad', accessory: null, palette: { skin: SKIN.light, hair: '#5a3a26', scarf: '#2f78c0', trousers: '#5b5148' } },
  casual_female: { shape: 'ranger_lass', accessory: null, palette: { skin: SKIN.fair, hair: '#8a4024', scarf: '#c64a58', shirt: '#f1e4cc', sleeve: '#f1e4cc', trousers: '#4b5a7a', leather: '#8a5a3e' } },
  casual2_male: { shape: 'rogue_lad', accessory: null, palette: { skin: SKIN.tan, hair: '#2e2420', tunic: '#5d8a4c', scarf: '#d9a441', vest: '#8a5a3c', trousers: '#4a4440', boots: '#5a3a28', belt: '#6a4630' } },
  casual2_female: { shape: 'rogue_lass', accessory: null, palette: { skin: SKIN.fair, hair: '#3a2a22', tunic: '#c46a48', scarf: '#f0d27a', vest: '#7a5238', trousers: '#5c4a3e', boots: '#4e3426' } },
  casual3_male: { shape: 'ranger_plain', accessory: 'mug_full', palette: { skin: SKIN.fair, hair: '#d9b25a', shirt: '#c9503e', sleeve: '#c9503e', leather: '#7a5a40', trousers: '#46505e', boots: '#5a3c2a' } },
  cowboy_male: { shape: 'ranger_moustache', accessory: null, palette: { skin: SKIN.tan, hair: '#4a3020', shirt: '#e3c9a0', sleeve: '#e3c9a0', scarf: '#9a4e2e', leather: '#6a4430', trousers: '#5a4a3a', boots: '#4a3020' } },
  cowboy_female: { shape: 'ranger_lass', accessory: null, palette: { skin: SKIN.olive, hair: '#c0703a', shirt: '#f0dcc0', sleeve: '#f0dcc0', scarf: '#a8553a', leather: '#7a4a30', trousers: '#5a4636', boots: '#4a3020' } },
  // the healer: a white coat over blue, a red satchel and a red book
  doctor_female_young: { shape: 'mage_lass', accessory: 'spellbook_closed', palette: { skin: SKIN.fair, hair: '#4a2e22', robe: '#eef1f2', trim: '#9cc4d6', belt: '#5a8fb0', buttons: '#c0c8cc', under: '#5f8aa6', satchel: '#d0464a', boots: '#6a5a52', book: '#c8383e' } },
  // the pilgrim: indigo robe, red obi, a straw hat
  kimono_male: { shape: 'mage_hatted', accessory: null, palette: { skin: SKIN.light, hair: '#24201e', robe: '#33437a', hat: '#d2b070', belt: '#b8402e', trim: '#ece6da', buttons: '#d2b070', under: '#232a44', boots: '#3a2a20', satchel: '#6a8a5a' } },
  knight_golden_male: { shape: 'knight', accessory: 'shield_round_color', palette: { skin: SKIN.light, armour: '#e2b544', trim: '#f6df8e', dark: '#9a6a22', cape: '#f2efe8', ribbon: '#d24040', under: '#6a5a40', shield: '#e2b544', shieldLight: '#f2efe8', shieldRim: '#c89a38' } },
  knight_male: { shape: 'knight', accessory: 'shield_badge_color', palette: { skin: SKIN.light, armour: '#6a737a', trim: '#a2acb2', cape: '#c0343c', shield: '#c0343c', shieldRim: '#8a949a' } },
  ninja_male: { shape: 'rogue_hooded', accessory: null, palette: { skin: SKIN.tan, hair: '#1e1c1c', tunic: '#2c2c36', scarf: '#1e1e26', vest: '#3a3a46', gloves: '#2a2a32', belt: '#c0343c', trousers: '#26262e', boots: '#1e1e24', metal: '#8a8e96' } },
  old_classy_female: { shape: 'mage_long', accessory: 'spellbook_closed', palette: { skin: SKIN.fair, hair: '#cfcac4', robe: '#7c4a6c', trim: '#ece0cc', belt: '#4a3a46', buttons: '#d6ba6a', under: '#4a3a46', satchel: '#3a6a6a', boots: '#3a2a28', book: '#3a5a8a' } },
  old_classy_male: { shape: 'mage_moustache', accessory: 'spellbook_closed', palette: { skin: SKIN.light, hair: '#ddd8d0', robe: '#6e5c44', trim: '#cbb68a', belt: '#3a2a22', buttons: '#caa84a', under: '#4a4038', satchel: '#7a3a2a', boots: '#2e2420', book: '#7a2a2a' } },
  pirate_male: { shape: 'rogue_captain', accessory: 'mug_full', palette: { skin: SKIN.tan, hair: '#1e1a18', tunic: '#b8323a', scarf: '#1e1e24', vest: '#2c2428', gloves: '#2a2024', belt: '#d8b04a', trousers: '#2a2a30', boots: '#1e1a1a', metal: '#d8b04a' } },
  // the town guard: steel with a green tabard rosette and a green round shield
  soldier_male: { shape: 'knight_trooper', accessory: 'shield_round_color', palette: { skin: SKIN.brown, hair: '#2a2220', armour: '#6e777c', trim: '#a4acb0', cape: '#4f7a3a', ribbon: '#e8e2c8', under: '#4a5040', shield: '#4f7a3a', shieldLight: '#e8e2c8' } },
  blue_soldier_male: { shape: 'knight_trooper', accessory: 'shield_square_color', palette: { skin: SKIN.olive, hair: '#2a2220', armour: '#77838d', trim: '#b2bcc2', cape: '#2f5fae', ribbon: '#f0f0f0', under: '#3a4660', leather: '#5a3a28', shield: '#2f5fae', shieldLight: '#f0f0f0' } },
  suit_male: { shape: 'rogue_lad', accessory: 'spellbook_closed', palette: { skin: SKIN.light, hair: '#3a2a20', tunic: '#2e3440', scarf: '#b8323a', vest: '#3c4250', gloves: '#e6e6e6', belt: '#1e1e22', trousers: '#2a2e38', boots: '#1a1a1e', metal: '#d4b86a' } },
  // the viking: KayKit's barbarian with a ginger beard and a mug of mead
  viking_male: { shape: 'barbarian', accessory: 'mug_full', palette: { skin: SKIN.light, beard: '#c8743a' } },
});

/** `BODIES` palette variants: clothing slots only. */
export const PALETTE_VARIANTS: Readonly<Record<string, Palette>> = Object.freeze({
  'casual2_male:dusk': { tunic: '#5a4a7e', scarf: '#e08a5a', vest: '#4a3a5a', trousers: '#3a3450', belt: '#3a2a3e' },
  'casual2_female:dusk': { tunic: '#6c4a8c', scarf: '#f0a070', vest: '#4a3858', trousers: '#3c3550' },
  'cowboy_male:tide': { scarf: '#2e6f8e', shirt: '#d8e2e6', sleeve: '#d8e2e6', trousers: '#3a4a5a', leather: '#5a4a3a' },
  'cowboy_female:tide': { scarf: '#3a86a8', shirt: '#e6eef0', sleeve: '#e6eef0', trousers: '#3d5566' },
  'knight_male:forge': { armour: '#55555e', trim: '#8e8e96', dark: '#2e2e34', cape: '#e0702a', shield: '#e0702a', ribbon: '#f0c060' },
});

/** Slots a palette variant may not touch (§40.2.3: variants recolour clothing only). */
export const NON_CLOTHING_SLOTS: ReadonlySet<string> = new Set(['skin', 'hair', 'beard']);

/**
 * Clips kept from `Rig_Medium_General.glb` / `Rig_Medium_MovementBasic.glb` (source name → shipped name). The other
 * clips (deaths, hits, jumps, spawns, T-poses, the alternative walks and runs …) are not shipped.
 */
export const CHARACTER_CLIPS: Readonly<Record<string, string>> = Object.freeze({
  Idle_A: 'idle',
  Walking_A: 'walk',
  Running_A: 'run',
  Jump_Full_Short: 'cheer',
  Use_Item: 'use',
  Hit_A: 'flinch',
});
export const CHARACTER_CLIP_NAMES: readonly string[] = Object.freeze(Object.values(CHARACTER_CLIPS).sort());

/** A standing character (bare head, no headwear), world metres. Chibi: 2.5 heads; a sizeScale-1 creature is ~1 m. */
export const CHARACTER_HEIGHT_M = 1.55;

/** Look ids the set ships: the 19 base looks then the palette variants, sorted. */
export function allLookIds(): string[] {
  return [...Object.keys(LOOK_DEFS), ...Object.keys(PALETTE_VARIANTS)].sort();
}

/** The full palette of a look id (base look palette + variant overrides). */
export function paletteOf(lookId: string): { readonly base: string; readonly def: LookDef; readonly palette: Palette } {
  const base = lookId.includes(':') ? lookId.slice(0, lookId.indexOf(':')) : lookId;
  const def = LOOK_DEFS[base];
  if (!def) throw new Error(`[model-pipeline] look ${lookId}: no base look ${base}`);
  const variant = lookId.includes(':') ? PALETTE_VARIANTS[lookId] : {};
  if (variant === undefined) throw new Error(`[model-pipeline] look ${lookId}: unknown palette variant`);
  return { base, def, palette: { ...def.palette, ...variant } };
}
