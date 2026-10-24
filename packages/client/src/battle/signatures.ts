/**
 * Signature move cinematics: a battle form's signature move (`BattleFormDef.signatureMove`) and every legendary's and
 * mythical's signature move play a DOM overlay over the arena — a letterboxed dim, a cut-in band with the creature's
 * portrait and the move's name, then the move's own SVG/CSS effect (sigfx/*) — while the 3D stage plays the move as
 * usual. A signature move is its owner's alone: no other species learns it (asserted by signatures.test.tsx).
 *
 * Clock (one per cinematic, from the `cinematic` timeline frame): the cut-in band takes `leadMs`; the move's windup
 * (`windupMs`, the charge) and travel (`travelMs`, the release) follow and the impact lands at
 * `leadMs + windupMs + travelMs`, exactly when the timeline's damage frame does (the timeline spends a signature move's
 * lead, windup and travel uncompressed). The overlay fades out by `totalMs`.
 *
 * A battler's first use of its signature move in a battle plays the full cut-in; later uses play `short`: the band is
 * skipped and the clock starts `leadMs − SHORT_LEAD_MS` in, so the dim still has `SHORT_LEAD_MS` to come in.
 *
 * Every entry needs a portrait at `public/signature/<portrait>.webp`
 * (`pnpm --filter @ewa/sprite-pipeline portraits <sprite ids…>`).
 */
import type { MoveAnimDef } from './moveAnims';

/** The bespoke effect layer each cinematic draws (sigfx/index.ts). */
export type SignatureFx =
  | 'crescent' | 'volley' | 'pyre' | 'grace' | 'sunbreaker' | 'foxfire' | 'kamehameha' | 'miracle' | 'devour' | 'bankai' | 'rift' | 'aurora' | 'lotus'
  | 'convergence';

export interface SignatureCinematic {
  readonly fx: SignatureFx;
  /** the species that owns the move (the only one that learns it, or the battle form's species) */
  readonly species: string;
  /** the creature manifest entry shown in the cut-in band: the species, or `<species>_<form>` for a battle form */
  readonly portrait: string;
  /** the eye glint in the portrait, % of its square (the portrait is the source sprite's full canvas) */
  readonly glint: readonly [number, number];
  /** the move's name on two lines in the band */
  readonly lines: readonly [string, string];
  /** small caps line over the name */
  readonly kicker: string;
  /** the band and frame colours: edge / name shadow, the band's depth, the glint / kicker / speed lines */
  readonly palette: { readonly accent: string; readonly deep: string; readonly hot: string };
  /** the cut-in band, before the move's windup (full cinematics only) */
  readonly leadMs: number;
  /** the charge: the move's windup */
  readonly windupMs: number;
  /** the release: the move's travel; the impact lands at leadMs + windupMs + travelMs */
  readonly travelMs: number;
  /** the overlay's full length (the dim is gone by then) */
  readonly totalMs: number;
  /** sfx played as the cut-in starts (ids from the audio manifest) */
  readonly sfx: readonly string[];
  /**
   * the move's own sound design (`sig_*`, audio manifest), played from the charge (the `aim` frame) in place of the type's
   * move sfx: its impact transient sits at windupMs + travelMs, on the damage frame (tools/audio-pipeline/cc0-tools/mix.py)
   */
  readonly aimSfx: string;
  /** the 3D side of the move under the overlay (MOVE_ANIMS takes windup / travel from above, camera `wide`) */
  readonly anim: Pick<MoveAnimDef, 'recoverMs' | 'attackerPose'> & { readonly vfx?: string };
}

/** A short cinematic's dim-in before its charge. */
export const SHORT_LEAD_MS = 250;

const RAGE = 'Signature move · Rage Form';
const LEGENDARY = 'Signature move · Legendary';
const MYTHICAL = 'Signature move · Mythical';

export const SIGNATURE_CINEMATICS: Readonly<Record<string, SignatureCinematic>> = {
  // hollowmane's Rage Form: a black crescent with a crimson edge, charged in a crimson aura, cuts through the foe
  'Hollow Crescent': {
    fx: 'crescent', species: 'hollowmane', portrait: 'hollowmane_rage', glint: [36, 32], lines: ['Hollow', 'Crescent'], kicker: RAGE,
    palette: { accent: '#e0193a', deep: '#3a0612', hot: '#ff4a62' },
    leadMs: 1100, windupMs: 420, travelMs: 260, totalMs: 2800, sfx: ['wind_gust', 'cry_ghost'], aimSfx: 'sig_hollow_crescent',
    anim: { recoverMs: 380, vfx: 'form_rage', attackerPose: 'lunge' },
  },
  // castlemaw's Rage Form: both arm cannons charge while a crosshair locks on, an alternating tracer volley, a
  // fireball and the skull mark on the foe
  'Vendetta Volley': {
    fx: 'volley', species: 'castlemaw', portrait: 'castlemaw_rage', glint: [38, 27], lines: ['Vendetta', 'Volley'], kicker: RAGE,
    palette: { accent: '#ff6a1a', deep: '#4a1a08', hot: '#ff9a4a' },
    leadMs: 1100, windupMs: 420, travelMs: 420, totalMs: 3000, sfx: ['wind_gust', 'cry_steel'], aimSfx: 'sig_vendetta_volley',
    anim: { recoverMs: 360, vfx: 'form_rage', attackerPose: 'windup' },
  },
  // galaxion: five star-fires kindle into a constellation round it and fuse into a violet comet that arcs onto the foe,
  // which goes up in a pillar of cosmic flame
  'Cosmic Pyre': {
    fx: 'pyre', species: 'galaxion', portrait: 'galaxion', glint: [36, 19], lines: ['Cosmic', 'Pyre'], kicker: LEGENDARY,
    palette: { accent: '#ff7a1a', deep: '#2a0a4a', hot: '#c9a0ff' },
    leadMs: 1100, windupMs: 480, travelMs: 360, totalMs: 3000, sfx: ['wind_gust', 'cry_fire'], aimSfx: 'sig_cosmic_pyre',
    anim: { recoverMs: 360, attackerPose: 'windup' },
  },
  // voltaura: a ribbon of pink-gold lightning pirouettes round it and dances to the foe in a graceful zig-zag, blooming
  // into a flower of lightning with sparkles
  'Sparking Grace': {
    fx: 'grace', species: 'voltaura', portrait: 'voltaura', glint: [38, 27], lines: ['Sparking', 'Grace'], kicker: LEGENDARY,
    palette: { accent: '#ffd23a', deep: '#3a1840', hot: '#ff8ad8' },
    leadMs: 1100, windupMs: 420, travelMs: 240, totalMs: 2800, sfx: ['wind_gust', 'cry_electric'], aimSfx: 'sig_sparking_grace',
    anim: { recoverMs: 340, attackerPose: 'windup' },
  },
  // sunjaw: a sun rises behind it, then a barrage of six blazing fists and a final sun-burst that cracks the air
  'Sunbreaker Barrage': {
    fx: 'sunbreaker', species: 'sunjaw', portrait: 'sunjaw', glint: [41, 23], lines: ['Sunbreaker', 'Barrage'], kicker: LEGENDARY,
    palette: { accent: '#ffb020', deep: '#4a1606', hot: '#ffe08a' },
    leadMs: 1100, windupMs: 420, travelMs: 480, totalMs: 3000, sfx: ['wind_gust', 'cry_fighting'], aimSfx: 'sig_sunbreaker_barrage',
    anim: { recoverMs: 380, attackerPose: 'lunge' },
  },
  // raikitsune: nine foxfire wisps fan out like tails, crackling, and home in on the foe, which a cage of lightning seals
  'Foxfire Voltage': {
    fx: 'foxfire', species: 'raikitsune', portrait: 'raikitsune', glint: [55, 31], lines: ['Foxfire', 'Voltage'], kicker: LEGENDARY,
    palette: { accent: '#4ad8ff', deep: '#10204a', hot: '#ffcf4a' },
    leadMs: 1100, windupMs: 460, travelMs: 380, totalMs: 3000, sfx: ['wind_gust', 'cry_electric'], aimSfx: 'sig_foxfire_voltage',
    anim: { recoverMs: 360, attackerPose: 'windup' },
  },
  // zenryu: a long cupped-hands charge of blue-white ki drawing light inward, then a beam across the arena and a
  // blinding blast
  Kamehameha: {
    fx: 'kamehameha', species: 'zenryu', portrait: 'zenryu', glint: [41, 19], lines: ['Kame', 'hameha'], kicker: LEGENDARY,
    palette: { accent: '#4ab8ff', deep: '#0a1a40', hot: '#d8f4ff' },
    leadMs: 1100, windupMs: 700, travelMs: 300, totalMs: 3200, sfx: ['wind_gust', 'cry_dragon'], aimSfx: 'sig_kamehameha',
    anim: { recoverMs: 400, attackerPose: 'windup' },
  },
  // lumyth: a halo and a constellation, a shower of falling stars on the foe, a nova, then motes of light flow back and
  // heal it
  'Cosmic Miracle': {
    fx: 'miracle', species: 'lumyth', portrait: 'lumyth', glint: [51, 27], lines: ['Cosmic', 'Miracle'], kicker: MYTHICAL,
    palette: { accent: '#f4d27a', deep: '#1a1048', hot: '#fff6d8' },
    leadMs: 1100, windupMs: 480, travelMs: 420, totalMs: 3100, sfx: ['wind_gust', 'cry_cosmic'], aimSfx: 'sig_cosmic_miracle',
    anim: { recoverMs: 420, attackerPose: 'windup' },
  },
  // noxmyth: a black hole with a turning accretion disc swallows the starlight, drifts onto the foe and devours it
  'Stellar Devour': {
    fx: 'devour', species: 'noxmyth', portrait: 'noxmyth', glint: [38, 28], lines: ['Stellar', 'Devour'], kicker: MYTHICAL,
    palette: { accent: '#9a4aff', deep: '#120620', hot: '#d0a8ff' },
    leadMs: 1100, windupMs: 480, travelMs: 360, totalMs: 3100, sfx: ['wind_gust', 'cry_dark'], aimSfx: 'sig_stellar_devour',
    anim: { recoverMs: 400, attackerPose: 'windup' },
  },
  // bankaiser: spiritual pressure rises like a black pillar, the red line on its armour ignites, one flash-step and a
  // cross of blade light splits the foe a beat later
  'Bankai Sever': {
    fx: 'bankai', species: 'bankaiser', portrait: 'bankaiser', glint: [49, 19], lines: ['Bankai', 'Sever'], kicker: LEGENDARY,
    palette: { accent: '#c8d4e0', deep: '#0c0f16', hot: '#ff2a3a' },
    leadMs: 1100, windupMs: 520, travelMs: 120, totalMs: 2900, sfx: ['wind_gust', 'cry_steel'], aimSfx: 'sig_bankai_sever',
    anim: { recoverMs: 380, attackerPose: 'lunge' },
  },
  // voidraxis: space cracks round it, a rift tears open over the foe pouring violet light, then collapses inward and
  // falls apart like broken glass
  'Rift Collapse': {
    fx: 'rift', species: 'voidraxis', portrait: 'voidraxis', glint: [26, 26], lines: ['Rift', 'Collapse'], kicker: LEGENDARY,
    palette: { accent: '#b04aff', deep: '#0a0418', hot: '#5af0ff' },
    leadMs: 1100, windupMs: 460, travelMs: 340, totalMs: 3000, sfx: ['wind_gust', 'cry_cosmic'], aimSfx: 'sig_rift_collapse',
    anim: { recoverMs: 380, attackerPose: 'windup' },
  },
  // glacinid: a calm winter sky — aurora ribbons and slow snow — then an icy trail coils onto the foe and seals it in
  // a crystal that shatters
  'Aurora Requiem': {
    fx: 'aurora', species: 'glacinid', portrait: 'glacinid', glint: [28, 34], lines: ['Aurora', 'Requiem'], kicker: LEGENDARY,
    palette: { accent: '#7af0d0', deep: '#06182a', hot: '#e8fbff' },
    leadMs: 1100, windupMs: 460, travelMs: 340, totalMs: 3000, sfx: ['wind_gust', 'cry_ice'], aimSfx: 'sig_aurora_requiem',
    anim: { recoverMs: 380, attackerPose: 'windup' },
  },
  // hyoryu: a flower of ice opens in the sky one petal at a time, an ice dragon coils onto the foe and a lotus of ice
  // closes round it, burns crimson at its heart and shatters
  'Crimson Lotus Prison': {
    fx: 'lotus', species: 'hyoryu', portrait: 'hyoryu', glint: [35, 29], lines: ['Crimson Lotus', 'Prison'], kicker: LEGENDARY,
    palette: { accent: '#9aeaff', deep: '#061a2e', hot: '#ff4a62' },
    leadMs: 1100, windupMs: 460, travelMs: 340, totalMs: 3000, sfx: ['wind_gust', 'cry_dragon'], aimSfx: 'sig_crimson_lotus_prison',
    anim: { recoverMs: 380, attackerPose: 'windup' },
  },
  // ravatar (the Elemutt line's final stage): water, earth, fire and air wheel in and fuse into one sphere that bursts
  // on the foe in the four elements' rings. One cinematic for every relic form; the move's type follows the relic.
  'Cosmic Convergence': {
    fx: 'convergence', species: 'ravatar', portrait: 'ravatar', glint: [39, 28], lines: ['Cosmic', 'Convergence'], kicker: MYTHICAL,
    palette: { accent: '#bfe8ff', deep: '#0a1430', hot: '#ffffff' },
    leadMs: 1100, windupMs: 500, travelMs: 300, totalMs: 3000, sfx: ['wind_gust'], aimSfx: 'sig_cosmic_convergence',
    anim: { recoverMs: 380, attackerPose: 'windup' },
  },
};

export function signatureOf(moveId: string): SignatureCinematic | undefined {
  return Object.prototype.hasOwnProperty.call(SIGNATURE_CINEMATICS, moveId) ? SIGNATURE_CINEMATICS[moveId] : undefined;
}

/** The impact's offset from the cinematic frame (full) — the overlay's impact beat. */
export function impactAt(c: SignatureCinematic): number {
  return c.leadMs + c.windupMs + c.travelMs;
}

/** How far into its full clock a cinematic starts: 0 for the full cut-in, the skipped band for a short one. */
export function skipMs(c: SignatureCinematic, mode: 'full' | 'short'): number {
  return mode === 'full' ? 0 : Math.max(0, c.leadMs - SHORT_LEAD_MS);
}

/** The lead the timeline spends before the move's windup. */
export function leadMs(c: SignatureCinematic, mode: 'full' | 'short'): number {
  return mode === 'full' ? c.leadMs : Math.min(c.leadMs, SHORT_LEAD_MS);
}

/** MOVE_ANIMS entries of every signature move: windup / travel are the cinematic's charge and release, camera `wide`. */
export function signatureAnims(): Record<string, Partial<MoveAnimDef>> {
  const out: Record<string, Partial<MoveAnimDef>> = {};
  for (const [id, c] of Object.entries(SIGNATURE_CINEMATICS)) {
    // 'wide' keeps both battlers framed: the overlay aims at their projected positions
    out[id] = { windupMs: c.windupMs, travelMs: c.travelMs, camera: 'wide', ...c.anim };
  }
  return out;
}
