/**
 * Phase D1–D3 items, hand-authored (data/items.ts and data/consumables.ts stay the generated legacy tables):
 *   - key items: `old_rod` (Maren's gift) and one reusable TM per `TM_MOVES` entry (`tm:<Move id>`);
 *   - evolution stones: six consumables with `effect: { kind: 'evolutionStone' }` — the species a stone evolves name
 *     it in `SpeciesDef.evolution { kind: 'item', item }`;
 *   - the move tutor price, the machine-compatibility rule and the trade-evolution marker.
 * Key items are never sold back and never consumed; TMs are bought once (the shop refuses a second copy).
 */
import type { ConsumableDef, ItemDef, MoveDef, SpeciesDef } from '@ewa/core';
import type { ZoneId } from '../types';
import { MOVES } from './moves';

// ─── TMs ─────────────────────────────────────────────────────────────────────

/**
 * The 39 machine moves (ids from MOVES): two or three per type, Normal ones teachable to anything. Order = the
 * TM number (TM01 = Body Slam).
 */
export const TM_MOVES: readonly string[] = [
  'Body Slam', 'Double Edge', 'Protect',
  'Heat Wave', 'Fire Fang', 'Will-O-Wisp',
  'Scald', 'Water Pulse',
  'Energy Ball', 'Giga Drain', 'Solar Beam',
  'Thunderbolt', 'Discharge',
  'Ice Beam', 'Frost Bite',
  'Close Combat', 'Bulk Up',
  'Sludge Bomb', 'Cross Poison',
  'Earthquake', 'Bulldoze',
  'Aerial Ace', 'Roost',
  'Extrasensory', 'Calm Mind',
  'X-Scissor', 'Signal Beam',
  'Rock Slide', 'Stone Edge',
  'Shadow Ball', 'Hex',
  'Dragon Claw', 'Dragon Breath',
  'Crunch', 'Dark Pulse',
  'Flash Cannon', 'Iron Defense',
  'Dazzling Gleam', 'Moonblast',
];

export const TM_PREFIX = 'tm:';
export function tmItemId(move: string): string {
  return `${TM_PREFIX}${move}`;
}
/** The move a TM item teaches, or null when `itemId` is not a TM. */
export function tmMoveOf(itemId: string): string | null {
  return itemId.startsWith(TM_PREFIX) ? itemId.slice(TM_PREFIX.length) : null;
}

/** Price by power band: status 2000, ≤ 70 power 2500, ≤ 90 3500, stronger 5000. */
function tmPrice(power: number): number {
  if (power === 0) return 2000;
  if (power <= 70) return 2500;
  if (power <= 90) return 3500;
  return 5000;
}

/**
 * Phase D2 learnability — the one rule for TMs and the tutor: a species can be taught a machine/tutor move when the
 * move is Normal-type, shares a type with the species, or is already in the species' level learnset.
 */
export function canLearnMachineMove(sp: SpeciesDef, mv: MoveDef): boolean {
  if (mv.type === 'Normal') return true;
  if ((sp.types as readonly string[]).includes(mv.type)) return true;
  return sp.learnableMoves.some((e) => e.move === mv.id);
}

/** Move-tutor price per move (money), charged by `POST /creature/:id/tutor`. */
export const MOVE_TUTOR_PRICE = 3000;

// ─── trade evolutions ────────────────────────────────────────────────────────

/**
 * The ribbon a trade writes on a received creature whose species evolves by trade; `POST /creature/:id/evolve`
 * accepts the trade evolution only while it is present and removes it. Never shown as a ribbon.
 */
export const TRADE_EVOLVE_RIBBON = 'trade_evolve';

// ─── key items ───────────────────────────────────────────────────────────────

/** Phase D11: the bicycle's item id and its (steep) Saltmourn price. */
export const BIKE_ITEM = 'bike';
/** Majin / Tenjin: the two transformation bands (key items; a side holding one may transform once a battle). */
export const MAJIN_BAND = 'majin_band';
export const TENJIN_BAND = 'tenjin_band';
export const BIKE_PRICE = 30000;

/** Built from MOVES at module load so a TM never disagrees with its move. */
export function buildKeyItems(moves: readonly MoveDef[]): readonly ItemDef[] {
  const byId = new Map(moves.map((m) => [m.id, m]));
  const tms = TM_MOVES.map((id, i): ItemDef => {
    const m = byId.get(id);
    const n = String(i + 1).padStart(2, '0');
    return {
      id: tmItemId(id),
      name: `TM${n} ${id}`,
      description:
        m === undefined
          ? `Teaches ${id}.`
          : `Teaches ${id} (${m.type}${m.power > 0 ? `, power ${m.power}` : ''}) to an Ewamon of that type, or any Ewamon if it is Normal. Never used up.`,
      slot: 'key',
      fieldVerb: null,
      hooks: [],
      price: m === undefined ? null : tmPrice(m.power),
    };
  });
  return [
    {
      id: 'old_rod',
      name: 'Old Rod',
      description: "Maren's grandfather's rod, patched more than once. Cast it from the shore to fish.",
      slot: 'key',
      fieldVerb: null,
      hooks: [],
      price: null,
    },
    {
      // Phase D11: ridden outdoors (not in halls, not on water), toggled with the bike key; sold in Saltmourn
      id: BIKE_ITEM,
      name: 'Bicycle',
      description: 'A folding harbour bicycle with salt in its chain. Much faster than running; it stays folded indoors and on water.',
      slot: 'key',
      fieldVerb: null,
      hooks: [],
      price: BIKE_PRICE,
    },
    // Majin / Tenjin (.design/majin-tenjin.md): story rewards (beats sables_turn / the_requisition), never sold, never a gate
    {
      id: MAJIN_BAND,
      name: 'Majin Band',
      description:
        "Sable's field lens on an iron wrist-mount. Below half HP, an Ewamon with a Majin form sees itself being unmade and refuses: once a battle it breaks open into its Majin Form.",
      slot: 'key',
      fieldVerb: null,
      hooks: [],
      price: null,
    },
    {
      id: TENJIN_BAND,
      name: 'Tenjin Band',
      description:
        "Wynn's spare Attestor lens, ground into a gold band. At or above half HP, an Ewamon with a Tenjin form sees that it is held: once a battle it ascends into its Tenjin Form.",
      slot: 'key',
      fieldVerb: null,
      hooks: [],
      price: null,
    },
    ...tms,
  ];
}

// ─── evolution stones ────────────────────────────────────────────────────────

const stone = (id: string, name: string, description: string): ConsumableDef => ({
  id,
  name,
  description,
  effect: { kind: 'evolutionStone' },
  usableInBattle: false,
  price: 3000,
  sellPrice: 1500,
  maxStack: 99,
});

export const EVOLUTION_STONES: readonly ConsumableDef[] = [
  stone('ember_stone', 'Ember Stone', 'A coal that never cools. Some Fire-type Ewamon evolve when they hold it close.'),
  stone('tide_stone', 'Tide Stone', 'Salt-cold and always damp. Some Water-type Ewamon evolve at its touch.'),
  stone('storm_stone', 'Storm Stone', 'It crackles when the grid hums. Some Electric-type Ewamon evolve at its touch.'),
  stone('verdant_stone', 'Verdant Stone', 'A pebble with a leaf grown into it. Some Grass-type Ewamon evolve at its touch.'),
  stone('moon_stone', 'Moon Stone', 'Pale, and heavier at night. A few Ewamon evolve at its touch.'),
  stone('dusk_stone', 'Dusk Stone', 'It drinks the light around it. Some Ewamon of the dark evolve at its touch.'),
];

// ─── where they are sold ─────────────────────────────────────────────────────

/** Phase D2/D3 shop additions per town (appended to the town's stock in zones.ts). Later towns sell more. */
export const PROGRESSION_STOCK: Readonly<Partial<Record<ZoneId, readonly string[]>>> = {
  saltmourn: [BIKE_ITEM, tmItemId('Water Pulse'), tmItemId('Protect'), tmItemId('Fire Fang'), tmItemId('Frost Bite')],
  stormrook: ['storm_stone', tmItemId('Discharge'), tmItemId('Thunderbolt'), tmItemId('Aerial Ace'), tmItemId('Body Slam')],
  marrowdig: ['ember_stone', 'moon_stone', tmItemId('Rock Slide'), tmItemId('Bulldoze'), tmItemId('Earthquake'), tmItemId('Iron Defense')],
  vesperveil: ['dusk_stone', tmItemId('Hex'), tmItemId('Shadow Ball'), tmItemId('Will-O-Wisp'), tmItemId('Dark Pulse'), tmItemId('Crunch')],
  forgewall: ['tide_stone', 'verdant_stone', tmItemId('Flash Cannon'), tmItemId('Close Combat'), tmItemId('Bulk Up'), tmItemId('X-Scissor'), tmItemId('Signal Beam')],
  skyrend: [
    'ember_stone', 'tide_stone', 'storm_stone', 'verdant_stone',
    tmItemId('Roost'), tmItemId('Dragon Breath'), tmItemId('Dragon Claw'), tmItemId('Extrasensory'), tmItemId('Calm Mind'), tmItemId('Dazzling Gleam'),
  ],
  solenne: [
    'ember_stone', 'tide_stone', 'storm_stone', 'verdant_stone', 'moon_stone', 'dusk_stone',
    tmItemId('Heat Wave'), tmItemId('Scald'), tmItemId('Energy Ball'), tmItemId('Giga Drain'), tmItemId('Solar Beam'), tmItemId('Ice Beam'),
    tmItemId('Sludge Bomb'), tmItemId('Stone Edge'), tmItemId('Moonblast'), tmItemId('Double Edge'),
  ],
};

/** `old_rod`, the bicycle (Phase D11), the Majin / Tenjin bands and the 39 TMs (`tm:<Move>`), all `slot: 'key'`. */
export const KEY_ITEMS: readonly ItemDef[] = buildKeyItems(MOVES);
