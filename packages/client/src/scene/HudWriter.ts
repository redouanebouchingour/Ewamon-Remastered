/**
 * SPEC §20.6 — HudWriter: keeps the client's HudModel and hands render's HudLayer ONLY the fields that changed
 * since the last flush (a per-field dirty bitmask; `flush()` is a no-op when the mask is 0 — the §20.10 "HUD
 * dirty-flag" rule, `hud-dirty.test.ts`).
 *
 * Setters compare with the current value and set the field's bit only on a change. `flush` fills one preallocated
 * partial (clean fields `undefined`, which HudLayer.set skips) and calls `hud.set` once. HudLayer detects changes by
 * reference, so every changed value is a new (or alternate-buffer) reference. Cadences (§20.6): party on
 * applyInventoryDelta, zoneName on loadZone, timeOfDay ≤ 1 Hz rounded to a game minute, questHint on
 * applyProgressionDelta, chat per message, prompt when the nearest target changes, nameplates every 500 ms, battle
 * from the TimelinePlayer, dev at 1 Hz. React-free; `flush` is allocation-free.
 */
import type { HudModel, VariantKey } from '@ewa/render';
import { wornForm } from '../data/content';

export type HudField = keyof HudModel;
export type HudParty = HudModel['party'];
export type HudPrompt = NonNullable<HudModel['prompt']>;
export type HudNameplates = HudModel['nameplates'];
export type HudChat = HudModel['chat'];
export type HudBattle = HudModel['battle'];
export type HudDev = HudModel['dev'];

export interface HudSink {
  set(partial: Partial<HudModel>): void;
}

const FIELDS: readonly HudField[] = ['party', 'zoneName', 'timeOfDay', 'questHint', 'chat', 'prompt', 'nameplates', 'battle', 'connection', 'dev'];
const BIT: Readonly<Record<HudField, number>> = {
  party: 1, zoneName: 2, timeOfDay: 4, questHint: 8, chat: 16, prompt: 32, nameplates: 64, battle: 128, connection: 256, dev: 512,
};
/** a game minute of the 0..1 day */
export const TIME_QUANTUM = 1 / 1440;
export const CHAT_LINES = 6;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export class HudWriter {
  private readonly model: Mutable<HudModel> = {
    party: [], zoneName: null, timeOfDay: 0.5, questHint: null, chat: [], prompt: null, nameplates: [], battle: null, connection: 'connected', dev: null,
  };
  private readonly scratch: Mutable<Partial<HudModel>> = {
    party: undefined, zoneName: undefined, timeOfDay: undefined, questHint: undefined, chat: undefined, prompt: undefined,
    nameplates: undefined, battle: undefined, connection: undefined, dev: undefined,
  };
  private mask = 0;
  private visible = true;
  private chatSeq = 0;
  /** hud.set calls so far (hud-dirty.test.ts) */
  setCalls = 0;

  constructor(private sink: HudSink | null) {}

  bind(sink: HudSink | null): void {
    this.sink = sink;
    this.mask = 1023; // a new layer gets everything once
  }

  get dirtyMask(): number {
    return this.mask;
  }
  current(): Readonly<HudModel> {
    return this.model;
  }

  private mark(f: HudField): void {
    this.mask |= BIT[f];
  }

  setParty(p: HudParty): void {
    if (p === this.model.party) return;
    this.model.party = p;
    this.mark('party');
  }
  setZoneName(n: string | null): void {
    if (n === this.model.zoneName) return;
    this.model.zoneName = n;
    this.mark('zoneName');
  }
  /** Rounded to a game minute: the glyph / clock changes once per in-game minute (≤ 1 Hz at 48-minute days). */
  setTimeOfDay(t: number): void {
    const q = Math.round((((t % 1) + 1) % 1) / TIME_QUANTUM) * TIME_QUANTUM;
    if (q === this.model.timeOfDay) return;
    this.model.timeOfDay = q;
    this.mark('timeOfDay');
  }
  setQuestHint(h: string | null): void {
    const v = h !== null && h.length > 60 ? `${h.slice(0, 59)}…` : h;
    if (v === this.model.questHint) return;
    this.model.questHint = v;
    this.mark('questHint');
  }
  /** One chat line (the last 6 are kept; `at` is a unique line key for render's fade bookkeeping). */
  pushChat(name: string, text: string): void {
    const at = ++this.chatSeq;
    const next = this.model.chat.length >= CHAT_LINES ? this.model.chat.slice(1 - CHAT_LINES) : this.model.chat.slice();
    next.push({ name, text, at });
    this.model.chat = next;
    this.mark('chat');
  }
  setPrompt(p: HudPrompt | null): void {
    if (p === this.model.prompt) return;
    this.model.prompt = p;
    this.mark('prompt');
  }
  setNameplates(n: HudNameplates): void {
    if (n === this.model.nameplates) return;
    this.model.nameplates = n;
    this.mark('nameplates');
  }
  setBattle(b: HudBattle): void {
    if (b === this.model.battle) return;
    this.model.battle = b;
    this.mark('battle');
  }
  setConnection(c: HudModel['connection']): void {
    if (c === this.model.connection) return;
    this.model.connection = c;
    this.mark('connection');
  }
  setDev(d: HudDev): void {
    if (d === this.model.dev) return;
    this.model.dev = d;
    this.mark('dev');
  }

  /** F1: hides / restores every canvas HUD field (screenshots). */
  setVisible(on: boolean): void {
    if (on === this.visible) return;
    this.visible = on;
    this.mask = 1023;
  }

  /** Writes only the dirty fields to the HudLayer; no-op when nothing changed. */
  flush(): void {
    if (this.mask === 0 || this.sink === null) return;
    const s = this.scratch;
    const m = this.model;
    const show = this.visible;
    for (let i = 0; i < FIELDS.length; i++) {
      const f = FIELDS[i]!;
      if ((this.mask & BIT[f]) === 0) {
        (s as Record<string, unknown>)[f] = undefined;
        continue;
      }
      (s as Record<string, unknown>)[f] = show || f === 'battle' || f === 'connection' || f === 'timeOfDay' ? m[f] : HIDDEN[f];
    }
    this.mask = 0;
    this.setCalls++;
    this.sink.set(s);
  }
}

/** What the HUD shows for each field while F1 has hidden it. */
const HIDDEN: Readonly<Record<HudField, unknown>> = {
  party: Object.freeze([]), zoneName: null, timeOfDay: 0.5, questHint: null, chat: Object.freeze([]), prompt: null, nameplates: Object.freeze([]),
  battle: null, connection: 'connected', dev: null,
};

/**
 * Builds the party strip value (on applyInventoryDelta; not per frame). A creature holding a relic shows the form it
 * opens (`wornForm`): the strip's id is the thumb it draws, `<species>_<form>`.
 */
export function partyStrip(
  party: readonly { readonly speciesId: string; readonly heldItem?: string | null; readonly variantKey: VariantKey; readonly hp: number; readonly status: readonly string[] }[],
  maxHpOf: (i: number) => number,
): HudParty {
  return party.slice(0, 6).map((c, i) => {
    const max = Math.max(1, maxHpOf(i));
    const major = c.status.find((s) => s !== 'confuse') ?? null;
    const form = c.heldItem === undefined ? null : wornForm({ speciesId: c.speciesId, heldItem: c.heldItem });
    return { speciesId: form === null ? c.speciesId : `${c.speciesId}_${form.id}`, variantKey: c.variantKey, hpFrac: Math.max(0, Math.min(1, c.hp / max)), status: major === null ? null : STATUS_GLYPH[major] ?? null, fainted: c.hp <= 0 };
  });
}

const STATUS_GLYPH: Readonly<Record<string, string>> = { burn: 'brn', poison: 'psn', paralyze: 'par', sleep: 'slp', freeze: 'frz' };
