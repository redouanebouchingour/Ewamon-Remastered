/**
 * Followers with field powers (SPEC §3.18, §20.4.8): what the hint chip shows. The world's `FieldPowerSystem` writes
 * it when something it shows changes (the lead, the zone, the dark, a spot used); `FieldPowerChip` reads it.
 */
import { create } from 'zustand';
import type { FieldPower } from '@ewa/content';

export interface FieldHint {
  readonly power: FieldPower;
  /** what the lead can do here, in a few words (player copy, no em-dashes) */
  readonly text: string;
  /** false: nothing for it to do in this zone right now (shown dimmed) */
  readonly here: boolean;
  /** the key that triggers it, when it has one (the sense) */
  readonly key: string | null;
}

export interface FieldChip {
  /** the lead walking behind the player (null: every creature fainted, or no world) */
  readonly lead: { readonly speciesId: string; readonly name: string; readonly types: readonly string[]; readonly variantKey: string; readonly form: string | null } | null;
  /** false: the server has field powers off (the follower still walks) */
  readonly enabled: boolean;
  readonly hints: readonly FieldHint[];
}

export interface FieldPowerState extends FieldChip {
  setChip(c: FieldChip): void;
}

export const EMPTY_CHIP: FieldChip = Object.freeze({ lead: null, enabled: false, hints: [] });

export const useFieldPowerStore = create<FieldPowerState>()((set) => ({
  ...EMPTY_CHIP,
  setChip: (c) => set({ lead: c.lead, enabled: c.enabled, hints: c.hints }),
}));

/** Whether two chips show the same thing (the system writes only on a change). */
export function sameChip(a: FieldChip, b: FieldChip): boolean {
  if (a.enabled !== b.enabled) return false;
  if ((a.lead === null) !== (b.lead === null)) return false;
  if (a.lead !== null && b.lead !== null && (a.lead.speciesId !== b.lead.speciesId || a.lead.name !== b.lead.name || a.lead.variantKey !== b.lead.variantKey || a.lead.form !== b.lead.form)) return false;
  if (a.hints.length !== b.hints.length) return false;
  for (let i = 0; i < a.hints.length; i++) {
    const x = a.hints[i]!;
    const y = b.hints[i]!;
    if (x.power !== y.power || x.text !== y.text || x.here !== y.here || x.key !== y.key) return false;
  }
  return true;
}
