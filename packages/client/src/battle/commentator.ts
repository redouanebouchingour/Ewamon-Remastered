/**
 * The battle commentator and the opposing trainer's banter (LLM feature 3): BattleController hands it each timeline's
 * events as the timeline starts (`timeline`) and tells it when the timeline has played (`played`); then the moments
 * of that timeline (battle/moments.ts) are said: the commentator's highlight (throttled) as a caption, the trainer's
 * reaction beside its side. Lines are words over the battle, never part of it: nothing here touches the battle state,
 * its timing or its input, and a line that is not ready when its moment plays is simply not said (the templates are).
 *
 * At the start of a battle (not a replay), in the background and one after the other: a villager's memory of the
 * player (`GET /npc/memory`, signed in), the trainer's bank (its voice, the memory folded in), then the commentator's
 * colour bank (talk/commentary.ts). Every one is dropped if the battle is over by the time it answers.
 *
 * What the trainer says and what it leaves to authored lines: a league trainer's pre-battle lines and VS card open
 * its battle, its `mid.lastStand` banner announces its last creature and its concession line closes a lost battle, so
 * those moments get no banter; its knockouts and a win get banter. A faint line is dropped while a league banner is up.
 * Raids and spectated matches get no commentary.
 */
import type { BattleEvent, BattleState, ContentIndex, Ref } from '@ewa/core';
import { villagerNpcId } from '@ewa/protocol';
import type { NpcMemoryView } from '@ewa/protocol';
import {
  COLOUR, CASTER_KEY, GHOST_START, GUARD_START, HEADLINES, TRAINER_LINES, createPicker, createThrottle, fetchCasterBank, fetchTrainerBank, fill, memoryInstruction,
  villagerStartLines,
} from '../talk/commentary';
import type { CasterBank, MatchInfo, Picker, Throttle, TrainerBank, TrainerMoment, TrainerPersona } from '../talk/commentary';
import { apiFetch } from '../net/api';
import { clearCommentary, showCaster, showTrainer } from '../state/commentary';
import { useSettingsStore } from '../state/settings';
import { useSessionStore } from '../state/session';
import { useUiStore } from '../state/ui';
import { MAJOR_MOMENTS, highlightOf, momentsOf } from './moments';
import type { Moment } from './moments';
import { bandOf } from './BattleController';
import { concessionLine } from './foe';
import type { FoeIdentity } from './foe';

export interface BeginInfo {
  readonly battleId: string;
  readonly seat: 0 | 1;
  readonly format: BattleState['format'];
  readonly state: BattleState;
  readonly foe: FoeIdentity | null;
  /** a replay (no model calls: the templates speak) */
  readonly replay: boolean;
  /** a spectated match (no commentary) */
  readonly spectator: boolean;
  /** a battle that starts now (its opening is called); false: a battle restored after a reload, joined mid-way */
  readonly fresh: boolean;
}

export interface Commentator {
  begin(b: BeginInfo): void;
  /** a timeline starts playing these events from `from`: its moments wait for `played` */
  timeline(events: readonly BattleEvent[], from: BattleState): void;
  /** the timeline that started last has played: say its moments */
  played(): void;
  /** the battle is over and its card dismissed (or reset): drop everything, late banks included */
  end(): void;
}

export interface CommentatorDeps {
  readonly content: ContentIndex;
  readonly now?: () => number;
  /** the model banks; false: templates only (tests, a model you do not want to load) */
  readonly banks?: boolean;
  /** a villager's memory of the player (default: `GET /npc/memory` when signed in) */
  readonly memory?: (npcId: string) => Promise<NpcMemoryView | null>;
  readonly fetchTrainerBank?: typeof fetchTrainerBank;
  readonly fetchCasterBank?: typeof fetchCasterBank;
}

/** how long a villager's memory may take before its bank is written without it */
export const MEMORY_WAIT_MS = 2500;
/** a trainer's faint line needs this long since its last line */
export const TRAINER_GAP_MS = 4000;

const casterOn = (): boolean => useSettingsStore.getState().accessibility.battleCommentary;
const trainerOn = (): boolean => useSettingsStore.getState().accessibility.trainerBanter;
const playerName = (): string => useSessionStore.getState().profile?.username ?? 'the challenger';

async function defaultMemory(npcId: string): Promise<NpcMemoryView | null> {
  if (useSessionStore.getState().accessToken === null) return null;
  try {
    return await apiFetch('npcMemory', { params: { npcId } });
  } catch (_e) {
    return null;
  }
}

function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

/** "Hessa Dunmore, town archivist" → "Hessa Dunmore" */
const short = (name: string): string => name.split(',')[0]!.trim();

/** Who the trainer is, for its bank (and which kind of start line its templates use). */
export function personaOf(foe: FoeIdentity, memory: NpcMemoryView | null): TrainerPersona {
  const lt = foe.league;
  if (lt !== null) return { who: `${lt.name}, ${lt.title}, a ${lt.type} type expert`, memory: '' };
  if (foe.title === 'Villager') return { who: `${foe.name}, a villager${memory !== null ? ` of ${memory.town.name}` : ''}`, memory: memoryInstruction(memory) };
  if (foe.title === 'Camp guard') return { who: `${foe.name}, keeping the camp while its owner is away`, memory: '' };
  if (foe.title === 'Ghost trainer') return { who: `${foe.name}, the team a trainer left behind`, memory: '' };
  return { who: `${foe.name}, ${foe.title ?? 'a trainer'}`, memory: '' };
}

/** The battle the commentator's bank is written for: kinds and types only (the bank is name free). */
export function matchOf(b: BeginInfo, content: ContentIndex): MatchInfo {
  const typesAt = (side: 0 | 1): readonly string[] => {
    const s = b.state.sides[side];
    const c = s.party[s.active]?.creature;
    if (c === undefined) return [];
    try {
      return content.species(c.speciesId).types;
    } catch (_e) {
      return [];
    }
  };
  const foeSide = (b.seat === 0 ? 1 : 0) as 0 | 1;
  const lt = b.foe?.league ?? null;
  const kind =
    lt !== null
      ? `a ${lt.stage === 'gym' ? 'gym battle' : 'league battle'} against a ${lt.type} type master`
      : b.format === 'wild'
        ? 'a wild encounter'
        : b.format === 'pvp'
          ? 'a battle between two trainers'
          : 'a trainer battle';
  return { kind, ownTypes: typesAt(b.seat), foeTypes: typesAt(foeSide) };
}

/** The trainer's moment of a timeline (its end first, then its last creature, then a faint), with its creature. */
export function trainerMomentOf(ms: readonly Moment[]): { readonly kind: TrainerMoment; readonly name: string } | null {
  const find = (k: Moment['kind'], side?: Moment['side']): Moment | undefined => ms.find((m) => m.kind === k && (side === undefined || m.side === side));
  if (find('win') !== undefined) return { kind: 'loss', name: '' };
  if (find('loss') !== undefined) return { kind: 'win', name: '' };
  const last = find('lastOne', 'foe');
  if (last !== undefined) return { kind: 'last_one', name: last.name };
  const faint = find('knockout', 'foe');
  if (faint !== undefined) return { kind: 'faint', name: faint.name };
  if (find('opening') !== undefined) return { kind: 'start', name: '' };
  return null;
}

/** Whether an authored line already covers this moment for this trainer (see the header). */
export function authored(foe: FoeIdentity, kind: TrainerMoment): boolean {
  const lt = foe.league;
  if (lt === null) return false;
  if (kind === 'start') return true;
  if (kind === 'last_one') return lt.mid !== undefined;
  if (kind === 'loss') return concessionLine(lt) !== null;
  return false;
}

export function createCommentator(deps: CommentatorDeps): Commentator {
  const now = deps.now ?? (() => performance.now());
  const trainerBankOf = deps.fetchTrainerBank ?? fetchTrainerBank;
  const casterBankOf = deps.fetchCasterBank ?? fetchCasterBank;
  const memoryOf = deps.memory ?? defaultMemory;

  let active = false;
  let token = 0;
  let info: BeginInfo | null = null;
  let picker: Picker = createPicker('');
  let throttle: Throttle = createThrottle();
  let casterBank: CasterBank | null = null;
  let trainerBank: TrainerBank | null = null;
  let memory: NpcMemoryView | null = null;
  let pending: Moment[] = [];
  let opening: Moment | null = null;
  let lineId = 0;
  let trainerAt = Number.NEGATIVE_INFINITY;
  let abort: AbortController | null = null;

  const nameIn = (st: BattleState) => (r: Ref): string => {
    const c = st.sides[r.side]?.party[r.slot]?.creature;
    if (c === undefined) return 'It';
    if (c.nickname !== null) return c.nickname;
    try {
      return deps.content.species(c.speciesId).name;
    } catch (_e) {
      return c.speciesId;
    }
  };

  async function loadBanks(b: BeginInfo, my: number, signal: AbortSignal): Promise<void> {
    const live = (): boolean => my === token && active;
    const foe = b.foe;
    if (foe !== null && trainerOn()) {
      const npcId = villagerNpcId(foe.id);
      if (npcId !== null) {
        memory = await within(memoryOf(npcId).catch(() => null), MEMORY_WAIT_MS, null);
        if (!live()) return;
      }
      const bank = await trainerBankOf(personaOf(foe, memory), signal);
      if (!live()) return;
      trainerBank = bank;
    }
    if (casterOn()) {
      const names: string[] = [];
      for (const side of [0, 1] as const) b.state.sides[side].party.forEach((_p, slot) => names.push(nameIn(b.state)({ side, slot })));
      if (foe !== null) names.push(short(foe.name));
      const bank = await casterBankOf(matchOf(b, deps.content), names, signal);
      if (!live()) return;
      casterBank = bank;
    }
  }

  function sayCaster(ms: readonly Moment[], b: BeginInfo): void {
    if (!casterOn()) return;
    const h = highlightOf(ms);
    if (h === null || !throttle.take(h.kind, MAJOR_MOMENTS.has(h.kind), now())) return;
    const heads = HEADLINES[h.kind];
    const head = fill(heads[picker.pick(`head:${h.kind}`, heads.length)]!, { name: h.name, other: h.other, ...(h.status ? { status: h.status } : {}), ...(h.band ? { band: h.band } : {}), player: playerName() });
    const key = CASTER_KEY[h.kind];
    const bank = (key === undefined ? undefined : casterBank?.[key]) ?? [];
    // the opening is the bank's own (it knows the matchup); elsewhere its lines join the templates
    const pool = bank.length === 0 ? COLOUR[h.kind] : h.kind === 'opening' ? bank : [...bank, ...COLOUR[h.kind]];
    const i = picker.pick(`colour:${h.kind}`, pool.length);
    showCaster({ id: ++lineId, battleId: b.battleId, kind: h.kind, side: h.side, head, text: pool[i]!, fromModel: i < bank.length });
  }

  function sayTrainer(ms: readonly Moment[], b: BeginInfo): void {
    const foe = b.foe;
    if (foe === null || !trainerOn()) return;
    const t = trainerMomentOf(ms);
    if (t === null || authored(foe, t.kind)) return;
    if (t.kind === 'faint') {
      if (now() - trainerAt < TRAINER_GAP_MS) return;
      // a league trainer's own banner is speaking: it has the floor
      if (useUiStore.getState().battleBanner !== null) return;
    }
    const bank = trainerBank?.[t.kind];
    let pool: readonly string[];
    if (bank !== undefined && bank.length > 0) pool = bank;
    else if (t.kind === 'start' && foe.title === 'Villager') pool = villagerStartLines(memory);
    else if (t.kind === 'start' && foe.title === 'Camp guard') pool = GUARD_START;
    else if (t.kind === 'start' && foe.title === 'Ghost trainer') pool = GHOST_START;
    else pool = TRAINER_LINES[t.kind];
    const text = fill(pool[picker.pick(`trainer:${t.kind}`, pool.length)]!, { name: t.name });
    trainerAt = now();
    showTrainer({ id: ++lineId, battleId: b.battleId, kind: t.kind, speaker: short(foe.name), text, fromModel: pool === bank });
  }

  return {
    begin(b) {
      token++;
      abort?.abort();
      abort = null;
      clearCommentary();
      active = b.format !== 'raid' && !b.spectator;
      info = b;
      picker = createPicker(b.battleId);
      throttle = createThrottle();
      casterBank = null;
      trainerBank = null;
      memory = null;
      pending = [];
      trainerAt = Number.NEGATIVE_INFINITY;
      opening = null;
      if (!active) return;
      const foeSide = (b.seat === 0 ? 1 : 0) as 0 | 1;
      const name = nameIn(b.state);
      const own = b.state.sides[b.seat];
      const other = b.state.sides[foeSide];
      const foeName = name({ side: foeSide, slot: other.active });
      if (b.fresh) opening = { kind: 'opening', side: 'own', name: name({ side: b.seat, slot: own.active }), other: other.kind === 'wild' ? `a wild ${foeName}` : foeName };
      if (b.replay || deps.banks === false || (!casterOn() && !trainerOn())) return;
      const ctl = new AbortController();
      abort = ctl;
      void loadBanks(b, token, ctl.signal).catch(() => undefined);
    },

    timeline(events, from) {
      if (!active || info === null) return;
      const ms = momentsOf(events, from, { seat: info.seat, nameOf: nameIn(from), bandOf: (r) => bandOf(from, r, deps.content) });
      if (opening !== null) {
        ms.unshift(opening);
        opening = null;
      }
      // a timeline cut short (a resync) never said its moments: they are dropped, not carried over
      pending = ms;
    },

    played() {
      if (!active || info === null) return;
      const ms = pending;
      pending = [];
      if (ms.length === 0) return;
      sayCaster(ms, info);
      sayTrainer(ms, info);
    },

    end() {
      token++;
      abort?.abort();
      abort = null;
      active = false;
      info = null;
      pending = [];
      opening = null;
      clearCommentary();
    },
  };
}
