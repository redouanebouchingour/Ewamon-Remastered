/**
 * SPEC §40.4.1 — the source manifest `.design/audio/manifest.json`, the shape `.design/audio-bible.md` is
 * transcribed into. The TypeScript types are §40.4.1 verbatim; the zod schemas are annotated against them so
 * the two cannot drift, and `validateSourceManifest` adds the cross-field rules zod cannot express
 * (stem alignment, zone coverage against `@ewa/content` `ZONE_ORDER`, the boot-validated sfx id set).
 */
import { TYPE_NAME_VALUES, ZONES, ZONE_ORDER } from '@ewa/content';
import { z } from 'zod';

// ─── §40.4.1 types, verbatim ────────────────────────────────────────────────

export type AudioKind = 'stem' | 'ambience' | 'sfx' | 'ui';
export type StemLayer = 'base' | 'threat' | 'biome' | 'night';

export interface AudioPrompt {
  readonly text: string; // the generation prompt, plain English
  readonly negative?: string;
  readonly seed: number; // uint32; passed to the provider when it supports one, otherwise folded into the request hash
  readonly durationSec: number; // requested length (stems: whole bars, §40.4.4)
  readonly bpm?: number;
  readonly key?: string; // stems/ambience only
  readonly instrumental: true; // never lyrics
}

export interface ThemeSpec {
  readonly id: string; // grove cinder salt storm marrow vesper forge sky capital shrine rift (11 biomes) + battle gym elite champion raid victory
  readonly bpm: number;
  readonly bars: 8 | 16 | 32;
  readonly timeSig: 4;
  readonly stems: Readonly<Record<StemLayer, AudioPrompt>>; // 4 prompts sharing bpm/key/bars so the layers stay aligned
}
export interface SfxSpec {
  readonly id: string; // hit_normal, hit_super, faint, switch, orb_throw, … ui_click, ui_confirm
  readonly bus: 'sfx' | 'ui';
  readonly variants: 1 | 2 | 3 | 4; // round-robin clips; each variant re-rolls the seed (seed + i)
  readonly prompt: AudioPrompt; // durationSec ≤ 4
  readonly gainDb: number;
  readonly maxConcurrent: number; // copied to the output manifest
}
export interface AmbienceSpec {
  readonly id: string;
  readonly biome: string;
  readonly prompt: AudioPrompt;
} // one per biome, 60 s, looped

export interface AudioSourceManifest {
  readonly version: 1;
  readonly themes: readonly ThemeSpec[]; // 17
  readonly ambience: readonly AmbienceSpec[]; // 11
  readonly sfx: readonly SfxSpec[]; // ~120
  readonly zoneThemes: Readonly<Record<string, string>>; // ZoneId -> theme id, all 21 (validated against @ewa/content ZONE_ORDER)
}

// ─── Fixed vocabularies ─────────────────────────────────────────────────────

export const STEM_LAYERS: readonly StemLayer[] = ['base', 'threat', 'biome', 'night'];
export const BIOME_IDS = ['grove', 'cinder', 'salt', 'storm', 'marrow', 'vesper', 'forge', 'sky', 'capital', 'shrine', 'rift'] as const;
export const CUE_THEME_IDS = ['battle', 'gym', 'elite', 'champion', 'raid', 'victory'] as const;
/** §20.7.4: one theme per biome (11) + battle, gym, elite, champion, raid, victory = 17. */
export const THEME_IDS: readonly string[] = [...BIOME_IDS, ...CUE_THEME_IDS];

/** Bars per theme fixed by §20.7.4 / OQ-5: 16 by default, 32 for battle/champion, 8 for raid/victory. Biome themes may use 8 (§40.4.7 budget). */
export const REQUIRED_BARS: Readonly<Record<string, 8 | 16 | 32>> = { battle: 32, champion: 32, raid: 8, victory: 8, gym: 16, elite: 16 };

/** SfxSpec prompt ceiling (§40.4.1 "durationSec ≤ 4"). */
export const SFX_MAX_SEC = 4;
/** §20.7.2 polyphony: per-id concurrency ≤ 4. */
export const SFX_MAX_CONCURRENT = 4;

/**
 * Every sfx id the client validates at boot (§20.7.4): the `MOVE_ANIMS` / `DEFAULT_BY_TYPE` defaults
 * (`move_<type>` for all 19 types) and every id the battle timeline can emit.
 */
export function requiredSfxIds(): string[] {
  const ids = [
    'hit_normal', 'hit_super', 'hit_weak', 'hit_crit', 'faint', 'switch',
    'orb_throw', 'orb_shake', 'orb_catch', 'orb_break',
    'status_burn', 'status_poison', 'status_paralyze', 'status_sleep', 'status_freeze', 'status_confuse', 'status_heal',
    'stage_up', 'stage_down',
    'weather_sun', 'weather_rain', 'weather_sand', 'weather_hail',
    'ui_levelup',
    ...TYPE_NAME_VALUES.map((t) => `move_${t.toLowerCase()}`),
  ];
  return ids.sort();
}

/**
 * Stem generation length: the loop, then two more bars and 2 s (§40.4.4 writes `bars × 4 × 60 / bpm + 2`, but its
 * step 3 compares 2 bars after s + L, which a 2 s tail cannot hold — IMPLEMENTATION-NOTES D1). The extra audio is
 * free at a flat per-generation price and is trimmed away by `process`.
 */
export function stemDurationSec(bars: number, bpm: number): number {
  return Math.round(((bars + STEM_TAIL_BARS) * 240 * 1000) / bpm + 2000) / 1000;
}

/** Bars generated after the loop so the autocorrelation window can cover 2 bars (§40.4.4 step 3). */
export const STEM_TAIL_BARS = 2;

/** Nominal loop length in seconds for a theme. */
export function loopSec(bars: number, bpm: number): number {
  return (bars * 240) / bpm;
}

// ─── zod ────────────────────────────────────────────────────────────────────

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are snake_case');
const Uint32 = z.number().int().min(0).max(0xffffffff);

export const AudioPromptSchema: z.ZodType<AudioPrompt> = z.strictObject({
  text: z.string().min(20).max(1200),
  negative: z.string().min(1).max(600).optional(),
  seed: Uint32,
  durationSec: z.number().positive().max(300),
  bpm: z.number().int().min(40).max(220).optional(),
  key: z.string().min(1).max(40).optional(),
  instrumental: z.literal(true),
});

const StemsSchema = z.strictObject({
  base: AudioPromptSchema,
  threat: AudioPromptSchema,
  biome: AudioPromptSchema,
  night: AudioPromptSchema,
});

export const ThemeSpecSchema: z.ZodType<ThemeSpec> = z.strictObject({
  id: Id,
  bpm: z.number().int().min(40).max(220),
  bars: z.union([z.literal(8), z.literal(16), z.literal(32)]),
  timeSig: z.literal(4),
  stems: StemsSchema,
});

export const SfxSpecSchema: z.ZodType<SfxSpec> = z.strictObject({
  id: Id,
  bus: z.enum(['sfx', 'ui']),
  variants: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  prompt: AudioPromptSchema,
  gainDb: z.number().min(-40).max(6),
  maxConcurrent: z.number().int().min(1).max(SFX_MAX_CONCURRENT),
});

export const AmbienceSpecSchema: z.ZodType<AmbienceSpec> = z.strictObject({
  id: Id,
  biome: z.string(),
  prompt: AudioPromptSchema,
});

export const AudioSourceManifestSchema: z.ZodType<AudioSourceManifest> = z.strictObject({
  version: z.literal(1),
  themes: z.array(ThemeSpecSchema),
  ambience: z.array(AmbienceSpecSchema),
  sfx: z.array(SfxSpecSchema),
  zoneThemes: z.record(z.string(), z.string()),
});

// ─── Semantic validation ────────────────────────────────────────────────────

export interface ValidateOptions {
  /** Zone ids the manifest must cover exactly; defaults to `@ewa/content` `ZONE_ORDER`. */
  readonly zoneIds?: readonly string[];
  /** ZoneId → biome; defaults to `@ewa/content` `ZONES`. `zoneThemes[z]` must equal it. */
  readonly zoneBiomes?: Readonly<Record<string, string>>;
  /** Themes the manifest must contain exactly; defaults to the 17 of §20.7.4. */
  readonly themeIds?: readonly string[];
  /** Biomes that need an ambience bed; defaults to the 11. */
  readonly biomes?: readonly string[];
  /** Sfx ids that must exist; defaults to `requiredSfxIds()`. */
  readonly requiredSfx?: readonly string[];
}

export class ManifestError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`audio-pipeline: source manifest invalid (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n  - ${problems.join('\n  - ')}`);
    this.name = 'ManifestError';
  }
}

export function defaultZoneBiomes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const z of ZONES) out[z.id] = z.biome;
  return out;
}

/** Parse + validate. Throws `ManifestError` listing every problem with the offending id (SPEC §40.0.2 rule 3). */
export function validateSourceManifest(json: unknown, opts: ValidateOptions = {}): AudioSourceManifest {
  const parsed = AudioSourceManifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new ManifestError(parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  }
  const m = parsed.data;
  const problems: string[] = [];
  const zoneIds = opts.zoneIds ?? ZONE_ORDER;
  const zoneBiomes = opts.zoneBiomes ?? defaultZoneBiomes();
  const themeIds = opts.themeIds ?? THEME_IDS;
  const biomes = opts.biomes ?? BIOME_IDS;
  const required = opts.requiredSfx ?? requiredSfxIds();

  // themes
  const seenTheme = new Set<string>();
  for (const t of m.themes) {
    if (seenTheme.has(t.id)) problems.push(`themes: duplicate theme id '${t.id}'`);
    seenTheme.add(t.id);
    if (!themeIds.includes(t.id)) problems.push(`themes: unknown theme id '${t.id}'`);
    const need = REQUIRED_BARS[t.id];
    if (need !== undefined && t.bars !== need) problems.push(`themes.${t.id}: bars ${t.bars} but §20.7.4 fixes ${need}`);
    const want = stemDurationSec(t.bars, t.bpm);
    let key: string | undefined;
    for (const layer of STEM_LAYERS) {
      const p = t.stems[layer];
      const where = `themes.${t.id}.stems.${layer}`;
      if (p.bpm !== t.bpm) problems.push(`${where}: bpm ${String(p.bpm)} ≠ theme bpm ${t.bpm}`);
      if (p.key === undefined) problems.push(`${where}: key missing`);
      else if (key === undefined) key = p.key;
      else if (p.key !== key) problems.push(`${where}: key '${p.key}' ≠ '${key}' (the four layers must share a key)`);
      if (Math.abs(p.durationSec - want) > 0.0015) problems.push(`${where}: durationSec ${p.durationSec} ≠ (bars+2)×240/bpm+2 = ${want}`);
    }
  }
  for (const id of themeIds) if (!seenTheme.has(id)) problems.push(`themes: missing theme '${id}'`);

  // ambience
  const seenAmb = new Set<string>();
  const seenBiome = new Set<string>();
  for (const a of m.ambience) {
    if (seenAmb.has(a.id)) problems.push(`ambience: duplicate id '${a.id}'`);
    seenAmb.add(a.id);
    if (!biomes.includes(a.biome)) problems.push(`ambience.${a.id}: unknown biome '${a.biome}'`);
    if (seenBiome.has(a.biome)) problems.push(`ambience.${a.id}: second bed for biome '${a.biome}'`);
    seenBiome.add(a.biome);
    if (a.id !== a.biome) problems.push(`ambience.${a.id}: id must equal its biome ('${a.biome}') — public/audio/ambience/<biome>.webm`);
    if (a.prompt.durationSec < 30 || a.prompt.durationSec > 120) problems.push(`ambience.${a.id}: durationSec ${a.prompt.durationSec} outside [30, 120]`);
  }
  for (const b of biomes) if (!seenBiome.has(b)) problems.push(`ambience: missing bed for biome '${b}'`);

  // sfx
  const seenSfx = new Set<string>();
  for (const s of m.sfx) {
    if (seenSfx.has(s.id)) problems.push(`sfx: duplicate id '${s.id}'`);
    seenSfx.add(s.id);
    if (s.prompt.durationSec > SFX_MAX_SEC) problems.push(`sfx.${s.id}: durationSec ${s.prompt.durationSec} > ${SFX_MAX_SEC}`);
    const uiPrefix = s.id.startsWith('ui_');
    if (uiPrefix !== (s.bus === 'ui')) problems.push(`sfx.${s.id}: bus '${s.bus}' disagrees with the id prefix rule (ui bus ⇔ 'ui_'; §20.7.3 play())`);
    if (s.prompt.bpm !== undefined && !s.id.startsWith('ui_stinger_')) problems.push(`sfx.${s.id}: bpm is for stems/ambience/stingers only`);
  }
  for (const id of required) if (!seenSfx.has(id)) problems.push(`sfx: missing boot-validated id '${id}'`);

  // zoneThemes
  for (const z of zoneIds) {
    const t = m.zoneThemes[z];
    if (t === undefined) {
      problems.push(`zoneThemes: missing zone '${z}'`);
      continue;
    }
    if (!seenTheme.has(t)) problems.push(`zoneThemes.${z}: unknown theme id '${t}'`);
    const biome = zoneBiomes[z];
    if (biome !== undefined && t !== biome) problems.push(`zoneThemes.${z}: '${t}' but the zone's biome is '${biome}'`);
  }
  for (const z of Object.keys(m.zoneThemes)) if (!zoneIds.includes(z)) problems.push(`zoneThemes: '${z}' is not a ZoneId`);

  if (problems.length > 0) throw new ManifestError(problems);
  return m;
}
