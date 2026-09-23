/**
 * SessionState (SPEC §20.3.1) and its single writers (§20.3.2, rule 3 of §20.0):
 *
 *   hydrateFromMe          — the ONLY full write; `/play` loader + after a reconnect
 *   applyProgressionDelta  — the ONLY writer of Progression (badges, trainer exp/level, rating, dex, flags, quests)
 *   applyInventoryDelta    — the ONLY writer of Inventory (items, money, party, box)
 *
 * Nothing else in the client assigns those slices. REST responses are converted to the two delta shapes by
 * `toInventoryDelta` / `toProgressionDelta` below and applied through the same functions; a BattleEvent
 * never reaches this file. `test/store.test.ts` and `test/no-client-badge.test.ts` hold the line.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CreatureInstance, VariantKey } from '@ewa/core';
import type { BadgeId, MeResponse, QuestProgressEntry, ServerMessageOf, ZoneId } from '@ewa/protocol';

export interface Profile {
  readonly id: string;
  readonly username: string;
  readonly title: string;
  readonly motto: string;
  readonly body: string;
  readonly isAdmin: boolean;
  /** unix ms */
  readonly createdAt: number;
}

export type QuestState = Readonly<Record<string, Readonly<Record<string, { readonly count: number; readonly done: boolean }>>>>;

export interface Progression {
  readonly badges: readonly BadgeId[];
  readonly trainerExp: number;
  readonly trainerLevel: number;
  readonly rating: number;
  readonly dexSeen: readonly string[];
  readonly dexCaught: readonly string[];
  readonly dexVariants: Readonly<Record<string, readonly VariantKey[]>>;
  readonly dexAlpha: readonly string[];
  readonly flags: readonly string[];
  /** questId -> objectiveId -> progress */
  readonly quests: QuestState;
  /** quest ids whose rewards were claimed (from GET /me) */
  readonly questsClaimed: readonly string[];
}

export interface Inventory {
  readonly items: Readonly<Record<string, number>>;
  readonly money: number;
  readonly party: readonly CreatureInstance[];
  readonly box: readonly CreatureInstance[];
}

/**
 * The room's `progressionDelta` plus the two REST-only dex fields GET /dex returns (variants seen per species,
 * alpha catches), which the wire variant has no slot for. Same single writer; deviation D4.
 */
export type ProgressionDelta = ServerMessageOf<'progressionDelta'> & {
  readonly dexVariants?: Readonly<Record<string, readonly VariantKey[]>>;
  readonly dexAlpha?: readonly string[];
};

/**
 * The room's `inventoryDelta` plus two optional REST-only fields. The wire variant cannot express a party
 * reorder or a party↔box move (it carries creatures by id with no slot), but `POST /party/*` answers with the
 * full ordered `party`/`box`; the route action puts them here so the move still flows through the one
 * writer. Deviation D4 in IMPLEMENTATION-NOTES.md.
 */
export type InventoryDelta = ServerMessageOf<'inventoryDelta'> & {
  readonly party?: readonly CreatureInstance[];
  readonly box?: readonly CreatureInstance[];
};

export interface SessionState {
  readonly accessToken: string | null;
  /** unix ms */
  readonly accessExp: number;
  readonly profile: Profile | null;
  readonly progression: Progression | null;
  readonly inventory: Inventory | null;
  /** last known; written by WorldSession on join/handover only (and seeded by hydrateFromMe) */
  readonly zoneId: ZoneId | null;
  /** performance.now() of the last hydrateFromMe; 0 = never */
  readonly hydratedAt: number;
  hydrateFromMe(me: MeResponse): void;
  applyProgressionDelta(d: ProgressionDelta): void;
  applyInventoryDelta(d: InventoryDelta): void;
  setTokens(access: string, accessExp: number): void;
  setZone(zoneId: ZoneId): void;
  clearSession(): void;
}

const EMPTY = {
  accessToken: null,
  accessExp: 0,
  profile: null,
  progression: null,
  inventory: null,
  zoneId: null,
  hydratedAt: 0,
} as const;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function union(a: readonly string[], b: readonly string[] | null): readonly string[] {
  if (b === null || b.length === 0) return a;
  const seen = new Set(a);
  const out = [...a];
  for (const x of b) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function questsFrom(entries: readonly QuestProgressEntry[], base: QuestState = {}): QuestState {
  const out: Record<string, Record<string, { count: number; done: boolean }>> = {};
  for (const [q, objectives] of Object.entries(base)) out[q] = { ...objectives };
  for (const e of entries) {
    const q = (out[e.questId] ??= {});
    q[e.objectiveId] = { count: e.count, done: e.done };
  }
  return out;
}

function withoutZeros(items: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(items)) if (v > 0) out[k] = v;
  return out;
}

export const useSessionStore = create<SessionState>()(
  subscribeWithSelector((set, get) => ({
    ...EMPTY,

    hydrateFromMe(me) {
      const quests = questsFrom(me.quests.flatMap((q) => q.progress));
      const prev = get().progression;
      set({
        profile: {
          id: me.id,
          username: me.username,
          title: me.title,
          motto: me.motto,
          body: me.body,
          isAdmin: me.isAdmin,
          createdAt: Date.parse(me.createdAt),
        },
        progression: {
          badges: [...me.badges],
          trainerExp: me.trainerExp,
          trainerLevel: me.trainerLevel,
          rating: me.rating,
          // GET /me carries no dex; keep what GET /dex already delivered through applyProgressionDelta
          dexSeen: prev?.dexSeen ?? [],
          dexCaught: prev?.dexCaught ?? [],
          dexVariants: prev?.dexVariants ?? {},
          dexAlpha: prev?.dexAlpha ?? [],
          flags: [...me.flags],
          quests,
          questsClaimed: me.quests.filter((q) => q.claimed).map((q) => q.id),
        },
        inventory: {
          items: withoutZeros(me.inventory),
          money: me.money,
          party: me.party,
          box: me.box,
        },
        zoneId: me.presence.zoneId,
        hydratedAt: now(),
      });
    },

    applyProgressionDelta(d) {
      const p = get().progression;
      if (p === null) return;
      set({
        progression: {
          ...p,
          badges: d.badges === null ? p.badges : [...d.badges],
          trainerExp: d.trainerExp ?? p.trainerExp,
          trainerLevel: d.trainerLevel ?? p.trainerLevel,
          rating: d.rating ?? p.rating,
          dexSeen: union(union(p.dexSeen, d.dexSeen), d.dexCaught),
          dexCaught: union(p.dexCaught, d.dexCaught),
          dexVariants: d.dexVariants ?? p.dexVariants,
          dexAlpha: d.dexAlpha ?? p.dexAlpha,
          flags: union(p.flags, d.flags),
          quests: d.questProgress === null ? p.quests : questsFrom(d.questProgress, p.quests),
        },
      });
    },

    applyInventoryDelta(d) {
      const inv = get().inventory;
      if (inv === null) return;
      const removed = new Set(d.creaturesRemoved);
      const updated = new Map(d.creaturesUpdated.map((c) => [c.id, c]));
      const patch = (list: readonly CreatureInstance[]): CreatureInstance[] =>
        list.filter((c) => !removed.has(c.id)).map((c) => updated.get(c.id) ?? c);
      let party = d.party !== undefined ? [...d.party] : patch(inv.party);
      let box = d.box !== undefined ? [...d.box] : patch(inv.box);
      // mirrors the server's placement: a new creature joins the party while it has room, else the box
      for (const c of d.creaturesAdded) {
        if (party.some((p) => p.id === c.id) || box.some((b) => b.id === c.id)) continue;
        if (party.length < 6) party = [...party, c];
        else box = [...box, c];
      }
      set({
        inventory: {
          items: withoutZeros({ ...inv.items, ...d.items }),
          money: d.money ?? inv.money,
          party,
          box,
        },
      });
    },

    setTokens(access, accessExp) {
      set({ accessToken: access, accessExp });
    },

    setZone(zoneId) {
      set({ zoneId });
    },

    clearSession() {
      set({ ...EMPTY });
    },
  })),
);

// ---- REST → delta literals (the route actions' only way into the store) ----------------------------------

/**
 * A REST body with the full inventory map (`inventory`) and/or money/party/box/creature lists, as an
 * `inventoryDelta` literal. Items missing from a full `inventory` map are sent as 0 (the server omits
 * empty rows), so the merge in applyInventoryDelta removes them.
 */
export function toInventoryDelta(res: {
  readonly inventory?: Readonly<Record<string, number>>;
  readonly money?: number | null;
  readonly party?: readonly CreatureInstance[];
  readonly box?: readonly CreatureInstance[];
  readonly creaturesAdded?: readonly CreatureInstance[];
  readonly creaturesUpdated?: readonly CreatureInstance[];
  readonly creaturesRemoved?: readonly string[];
}): InventoryDelta {
  let items: Record<string, number> = {};
  if (res.inventory !== undefined) {
    const current = useSessionStore.getState().inventory?.items ?? {};
    for (const k of Object.keys(current)) items[k] = 0;
    items = { ...items, ...res.inventory };
  }
  return {
    type: 'inventoryDelta',
    items,
    money: res.money ?? null,
    creaturesAdded: res.creaturesAdded ?? [],
    creaturesRemoved: res.creaturesRemoved ?? [],
    creaturesUpdated: res.creaturesUpdated ?? [],
    ...(res.party !== undefined ? { party: res.party } : {}),
    ...(res.box !== undefined ? { box: res.box } : {}),
  };
}

/** A REST body with dex/quest fields, as a `progressionDelta` literal (null = untouched). */
export function toProgressionDelta(res: {
  readonly dexSeen?: readonly string[];
  readonly dexCaught?: readonly string[];
  readonly dexVariants?: Readonly<Record<string, readonly VariantKey[]>>;
  readonly dexAlpha?: readonly string[];
  readonly questProgress?: readonly QuestProgressEntry[];
}): ProgressionDelta {
  return {
    type: 'progressionDelta',
    badges: null,
    trainerExp: null,
    trainerLevel: null,
    rating: null,
    dexSeen: res.dexSeen ?? null,
    dexCaught: res.dexCaught ?? null,
    flags: null,
    questProgress: res.questProgress ?? null,
    ...(res.dexVariants !== undefined ? { dexVariants: res.dexVariants } : {}),
    ...(res.dexAlpha !== undefined ? { dexAlpha: res.dexAlpha } : {}),
  };
}

// ---- convenience accessors for non-React code -------------------------------------------------------------

export const hydrateFromMe = (me: MeResponse): void => useSessionStore.getState().hydrateFromMe(me);
export const applyProgressionDelta = (d: ProgressionDelta): void => useSessionStore.getState().applyProgressionDelta(d);
export const applyInventoryDelta = (d: InventoryDelta): void => useSessionStore.getState().applyInventoryDelta(d);
export const clearSession = (): void => useSessionStore.getState().clearSession();
