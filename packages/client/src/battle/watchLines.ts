/**
 * Watching battles in the open world: a turn of someone else's battle (protocol `WatchEvent`s, the `battleWatch`
 * message) worded for the Watch panel, and what each side is called. Only the spectator's view: no exp, no exact hp.
 */
import { NPC_TRAINER_PREFIX } from '@ewa/protocol';
import type { WatchBattler, WatchEvent } from '@ewa/protocol';
import { speciesName } from '../data/content';
import { foeIdentity } from './foe';

/** What a side is called: the player's name, the NPC trainer's name, or "Wild" (`BattleSummary.trainers`). */
export function watchSideName(trainer: string | undefined): string {
  if (trainer === undefined || trainer === '') return 'Wild';
  return trainer.startsWith(NPC_TRAINER_PREFIX) ? foeIdentity(trainer.slice(NPC_TRAINER_PREFIX.length)).name : trainer;
}

export interface WatchNames {
  /** the two sides' names (`watchSideName`) */
  readonly sides: readonly [string, string];
  /** the species on a field position right now, null when nobody stands there */
  species(side: 0 | 1, pos: 0 | 1): string | null;
}

const STATUS_WORDS: Readonly<Record<string, string>> = {
  burn: 'was burned',
  poison: 'was poisoned',
  paralyze: 'is paralyzed',
  sleep: 'fell asleep',
  freeze: 'was frozen solid',
  confuse: 'became confused',
};

/** "Rex's Pyrekit", "the wild Mossling", or the trainer's own creature by species alone when nobody is named. */
function who(n: WatchNames, side: 0 | 1, sp: string | null): string {
  const name = sp === null ? 'its partner' : speciesName(sp);
  return n.sides[side] === 'Wild' ? `the wild ${name}` : `${n.sides[side]}'s ${name}`;
}

/** "The wild ..." at the start of a line; a player's name keeps its own case ("rex's Mossling"). */
function cap(s: string): string {
  return s.startsWith('the ') ? `T${s.slice(1)}` : s;
}

function winnerLine(n: WatchNames, w: 0 | 1 | 'draw' | 'fled' | 'caught'): string {
  if (w === 'draw') return 'The battle ended in a draw.';
  if (w === 'fled') return `${n.sides[0]} got away.`;
  if (w === 'caught') return `${n.sides[0]} caught it!`;
  return n.sides[w] === 'Wild' ? `${n.sides[w === 0 ? 1 : 0]} lost the battle.` : `${n.sides[w]} won the battle!`;
}

/**
 * The lines of one turn, in order. `n.species` is read as the events go: a switch-in updates the name the next lines
 * use, so the caller passes a view that applies `in` / `form` events as they come (`applyWatchEvent`).
 */
export function watchLines(events: readonly WatchEvent[], n: WatchNames, apply?: (e: WatchEvent) => void): string[] {
  const out: string[] = [];
  for (const e of events) {
    switch (e.k) {
      case 'in':
        apply?.(e);
        out.push(n.sides[e.b.side] === 'Wild' ? `A wild ${speciesName(e.b.species)} appeared!` : `${n.sides[e.b.side]} sent out ${speciesName(e.b.species)}!`);
        break;
      case 'move':
        out.push(`${cap(who(n, e.side, n.species(e.side, e.pos)))} used ${e.move}!`);
        break;
      case 'miss':
        out.push(`${cap(who(n, e.side, n.species(e.side, e.pos)))} missed!`);
        break;
      case 'hit':
        if (!e.byMove) break;
        if (e.eff === 'none') out.push(`It doesn't affect ${who(n, e.side, n.species(e.side, e.pos))}.`);
        else if (e.crit) out.push(e.eff === 'super' ? 'A critical hit! It was super effective!' : 'A critical hit!');
        else if (e.eff === 'super') out.push("It's super effective!");
        else if (e.eff === 'weak') out.push("It's not very effective.");
        break;
      case 'status': {
        const w = STATUS_WORDS[e.status];
        if (w !== undefined) out.push(`${cap(who(n, e.side, n.species(e.side, e.pos)))} ${w}!`);
        break;
      }
      case 'form':
        apply?.(e);
        out.push(`${cap(who(n, e.b.side, e.b.species))} changed its form!`);
        break;
      case 'faint':
        out.push(`${cap(who(n, e.side, n.species(e.side, e.pos)))} fainted!`);
        break;
      case 'throw':
        out.push(`${n.sides[e.side]} threw an orb!`);
        break;
      case 'catch':
        out.push(e.caught ? 'Gotcha! It was caught!' : 'It broke free!');
        break;
      case 'fled':
        out.push(`${n.sides[e.side]} ran away.`);
        break;
      case 'forfeit':
        out.push(`${n.sides[e.side]} gave up.`);
        break;
      case 'end':
        out.push(winnerLine(n, e.winner));
        break;
      default:
        break;
    }
  }
  return out;
}

/** Applies a turn's field changes to a battler list (a copy): switch-ins, form changes, hp and status, faints. */
export function applyWatchEvents(field: readonly WatchBattler[], events: readonly WatchEvent[]): WatchBattler[] {
  let out = [...field];
  const at = (side: 0 | 1, pos: 0 | 1): number => out.findIndex((b) => b.side === side && b.pos === pos);
  const put = (b: WatchBattler): void => {
    const i = at(b.side, b.pos);
    if (i >= 0) out[i] = b;
    else out = [...out, b];
  };
  for (const e of events) {
    switch (e.k) {
      case 'in':
      case 'form':
        put(e.b);
        break;
      case 'hit':
      case 'heal': {
        const i = at(e.side, e.pos);
        if (i >= 0) out[i] = { ...out[i]!, hpPct: e.hpPct };
        break;
      }
      case 'status': {
        const i = at(e.side, e.pos);
        if (i >= 0 && e.status !== 'confuse') out[i] = { ...out[i]!, status: e.status };
        break;
      }
      case 'faint': {
        const i = at(e.side, e.pos);
        if (i >= 0) out[i] = { ...out[i]!, hpPct: 0 };
        break;
      }
      default:
        break;
    }
  }
  return out;
}
