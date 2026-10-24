/**
 * LLM feature 5, Prof. Wynn's facts: question / fact fixtures over three saves (no badge, three badges, the Champion
 * beaten). Each question must route to the right lookup and its facts must hold what content says (the numbers come
 * from content here, not from the module), with the save's own creatures, and keep the spoiler rules. Plus the guards
 * a model answer goes through (`ungrounded`, `wrongTypeClaims`).
 */
import { describe, expect, it } from 'vitest';
import { ENCOUNTER_TABLES, LEAGUE, LEGENDARY_STATICS, SPECIES, TYPE_CHART, ZONES } from '@ewa/content';
import { TYPE_NAMES, typeMultiplier } from '@ewa/core';
import type { CreatureInstance, TypeName } from '@ewa/core';
import {
  bestMove, factsFor, findTypeFacts, matchupFacts, monOf, movesAtLevel, nextFacts, nextLeague, parseQuestion, routeQuestion, saveOf, superEffectiveOn,
  trainerFacts, typeFacts, typeView, ungrounded, wrongTypeClaims,
} from '../src/talk/professorFacts';
import type { ProfMon, ProfSave, ToolName } from '../src/talk/professorFacts';

const D = '\u2014';
const sp = (id: string) => SPECIES.find((s) => s.id === id)!;
const lt = (id: string) => LEAGUE.find((l) => l.id === id)!;
const mon = (speciesId: string, level: number, moves: string[], o: { honor?: number; name?: string } = {}): ProfMon => ({
  speciesId,
  name: o.name ?? sp(speciesId).name,
  level,
  moves,
  honor: o.honor ?? null,
});

/** no badge yet, in Mirevale: a Water starter, a Dustcub (honor -2, nicknamed Sparky), a Cindercap in the box */
const early: ProfSave = {
  party: [mon('glimfin', 10, ['Tackle', 'Water Gun']), mon('dustcub', 22, ['Tackle'], { honor: -2, name: 'Sparky' })],
  box: [mon('cindercap', 8, ['Ember'])],
  badges: [],
  flags: ['met_wynn'],
  dexCaught: ['glimfin', 'dustcub', 'cindercap'],
  dexSeen: [],
  zoneId: 'mirevale',
  items: { potion: 3 },
};
/** three badges, in Stormrook */
const mid: ProfSave = {
  party: [mon('pyrecap', 24, ['Ember', 'Flame Wheel']), mon('voltide', 23, ['Water Gun', 'Spark']), mon('briarbear', 22, ['Vine Lash'])],
  box: [mon('pebblit', 18, ['Rock Throw'])],
  badges: ['bloom', 'ember', 'current'],
  flags: ['met_wynn'],
  dexCaught: [],
  dexSeen: [],
  zoneId: 'stormrook',
  items: {},
};
const ALL_BADGES = ['bloom', 'ember', 'current', 'circuit', 'fault', 'wraith', 'anvil', 'ascend'] as const;
const champion: ProfSave = { ...mid, badges: [...ALL_BADGES], flags: ['met_wynn', 'elite:veil:beaten', 'elite:aurelia:beaten', 'elite:kirei:beaten', 'champion:zeon:beaten'], zoneId: 'solenne' };

const text = (save: ProfSave, q: string): string => factsFor(q, save).facts.join(' ');

describe('the question / fact fixtures', () => {
  const FIXTURES: readonly { q: string; save: ProfSave; tool: ToolName; has: readonly (string | RegExp)[]; not?: readonly (string | RegExp)[] }[] = [
    {
      q: "What beats Mira's team?",
      save: early,
      tool: 'team_vs_trainer',
      has: ['Mira Thornwell', `level ${Math.max(...lt('verdant_gym').team.map((m) => m.level))}`, 'your highest is level 22', 'Cindercap (Fire, level 8)', 'In your box'],
      not: ['Your Bramblecub'],
    },
    { q: 'where do I find a fire type?', save: early, tool: 'where_to_find', has: ['Ash Route', 'you need the Bloom Badge', 'You already have Cindercap'] },
    { q: 'how do I evolve dustcub?', save: early, tool: 'evolve_info', has: ['level 30', 'Lawlander with honor 0 or more', 'Badlander otherwise', 'Your Sparky is level 22 with honor -2'] },
    { q: 'How do I evolve Sparky?', save: early, tool: 'evolve_info', has: ['Dustcub evolves at level 30'] },
    { q: 'what should I do next?', save: early, tool: 'next_goal', has: ['Mira Thornwell', 'Grass'] },
    { q: 'is my team good against the next gym?', save: mid, tool: 'team_vs_trainer', has: ['Zia Volt', 'Electric', "Your Pyrecap's Ember is super effective on their"] },
    { q: 'What is an Ember Stone for?', save: mid, tool: 'item_info', has: ['Ember Stone', 'Marrowdig', 'Circuit Badge'] },
    { q: 'What can I catch on Mire Route?', save: early, tool: 'zone_info', has: ['Wild Ewamon in Mire Route', 'Mossling'] },
    { q: 'What can I catch here?', save: mid, tool: 'zone_info', has: ['Stormrook'] },
    { q: 'What is strong against ghost types?', save: mid, tool: 'type_matchup', has: ['Ghost and Dark moves are super effective on Ghost'], not: ['Ghost moves are super effective on Psychic'] },
    { q: 'What is fire good against?', save: mid, tool: 'type_matchup', has: ['Fire moves are super effective on Grass, Ice, Bug and Steel'] },
    { q: 'Tell me about Cindercap', save: early, tool: 'species_info', has: ['pure Fire type', 'Pyrecap at level 16', 'Cindercap (level 8)'] },
    { q: 'Where can I catch a Mossling?', save: mid, tool: 'where_to_find', has: ['Mire Route', 'Tide Route'] },
    { q: 'How do I get a Lawlander?', save: mid, tool: 'where_to_find', has: ['evolve a Dustcub', 'Deepcut', 'Circuit Badge'] },
    { q: 'Which of my Ewamon should I use against Karn?', save: early, tool: 'team_vs_trainer', has: ['Karn Emberlitt', 'Your best pick is Glimfin', 'half damage from Fire moves'] },
    { q: "What level is Zia Volt's strongest?", save: mid, tool: 'trainer_team', has: ['Zia Volt', `level ${Math.max(...lt('volt_gym').team.map((m) => m.level))}`] },
    { q: 'Is my team any good?', save: mid, tool: 'my_team', has: ['Pyrecap (Fire, level 24)', 'Your highest level is 24'] },
    { q: 'Where is Raikitsune?', save: mid, tool: 'where_to_find', has: ['legendary', 'Galvan Span', 'Circuit Badge'] },
    { q: 'What do I do now?', save: champion, tool: 'next_goal', has: ['You are the Champion'] },
    { q: 'hello there', save: early, tool: 'help', has: ['Ask me about'] },
  ];

  for (const f of FIXTURES) {
    it(`"${f.q}" → ${f.tool}`, () => {
      expect(routeQuestion(f.q, f.save).tool).toBe(f.tool);
      const t = text(f.save, f.q);
      for (const h of f.has) expect(t).toMatch(typeof h === 'string' ? new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : h);
      for (const n of f.not ?? []) expect(t).not.toMatch(typeof n === 'string' ? new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : n);
      expect(t).not.toContain(D);
    });
  }

  it('the facts are deterministic and short', () => {
    for (const f of FIXTURES) {
      const a = factsFor(f.q, f.save);
      expect(factsFor(f.q, f.save)).toEqual(a);
      expect(a.facts.length).toBeGreaterThan(0);
      expect(a.facts.length).toBeLessThanOrEqual(7);
    }
  });
});

describe('what the facts say is what content says', () => {
  it('every wild spot named for a species is in that zone’s encounter table at those levels', () => {
    for (const id of ['mossling', 'dustcub', 'cindercap', 'glimp']) {
      const facts = factsFor(`where can I catch a ${id}`, early).facts.join(' ');
      for (const m of facts.matchAll(/(?:on|in) ([A-Z][A-Za-z ]+?) at level (\d+) to (\d+)/g)) {
        const zone = ZONES.find((z) => z.name === m[1])!;
        const table = ENCOUNTER_TABLES.find((t) => t.zoneId === zone.id)!;
        expect(table.slots.some((s) => s.species === id && s.levelMin === Number(m[2]) && s.levelMax === Number(m[3]))).toBe(true);
      }
    }
  });

  it('a type search never lists a legendary, and lists only species of that type, open zones first', () => {
    for (const t of TYPE_NAMES) {
      const sh = findTypeFacts(t, early);
      for (const id of sh.species) {
        expect(sp(id).legendary).toBe(false);
        expect(sp(id).types).toContain(t);
      }
    }
    const legendaryNames = LEGENDARY_STATICS.map((s) => sp(s.species).name);
    for (const t of TYPE_NAMES) for (const n of legendaryNames) expect(text(mid, `where do I find a ${t} type`)).not.toContain(n);
  });

  it('the type chart facts match the chart', () => {
    for (const t of TYPE_NAMES) {
      const se = superEffectiveOn([t]);
      for (const a of TYPE_NAMES) expect(se.includes(a)).toBe(typeMultiplier(TYPE_CHART, a, [t]) >= 2);
    }
    expect(typeFacts(['Grass'], mid, 'defend').facts[0]).toBe('Fire, Ice, Poison, Flying and Bug moves are super effective on Grass.');
  });

  it('a trainer’s moves are the last four it learned by its level (as the server builds them)', () => {
    const b = sp('bramblecub');
    const m = movesAtLevel(b, 11);
    expect(m.length).toBeLessThanOrEqual(4);
    for (const id of m) expect(b.learnableMoves.some((e) => e.move === id && e.level <= 11)).toBe(true);
  });

  it('bestMove weighs type and same-type bonus, and skips status moves', () => {
    const r = bestMove(['Fire'], ['Ember', 'Growl'], ['Grass']);
    expect(r?.move).toBe('Ember');
    expect(r?.mult).toBe(2);
    expect(bestMove(['Normal'], ['Growl'], ['Grass'])).toBeNull();
  });

  it('the matchup names sides on every creature', () => {
    const facts = matchupFacts(lt('verdant_gym'), early).facts;
    for (const f of facts) {
      for (const m of f.matchAll(/\byour ([A-Z][a-z]+)/g)) expect(['Glimfin', 'Sparky', 'Cindercap']).toContain(m[1]);
    }
    expect(facts.some((f) => /^Watch out: Their \w+'s [\w -]+ is super effective on your/.test(f))).toBe(true);
  });
});

describe('spoilers', () => {
  it('a trainer not reached and not named shows its type and top level, not its team', () => {
    const t = trainerFacts(lt('draco_gym'), early, false);
    const names = lt('draco_gym').team.map((m) => sp(m.species).name);
    for (const n of names) expect(t.facts.join(' ')).not.toContain(n);
    expect(t.facts.join(' ')).toContain('mostly Dragon type, up to level 46');
    expect(t.species).toEqual([]);
    // named: the player asked directly
    expect(trainerFacts(lt('draco_gym'), early, true).facts.join(' ')).toContain(names[0]!);
  });

  it('the next step is the HUD’s, never a later beat', () => {
    expect(nextFacts(early).facts[0]).toBe('Your next step: Talk to Prof. Wynn (Mirevale).');
  });

  it('a legendary spot is named only when the legendary is asked for', () => {
    expect(text(mid, 'Where is Raikitsune?')).toContain('Galvan Span');
    expect(text(mid, 'where do I find an electric type?')).not.toContain('Raikitsune');
  });

  it('the next league fight walks the gyms, the Wardens, then nothing after the Champion', () => {
    expect(nextLeague(early)?.id).toBe('verdant_gym');
    expect(nextLeague(mid)?.id).toBe('volt_gym');
    expect(nextLeague({ ...mid, badges: [...ALL_BADGES] })?.id).toBe('veil');
    expect(nextLeague({ ...mid, badges: [...ALL_BADGES], flags: ['elite:veil:beaten'] })?.id).toBe('aurelia');
    expect(nextLeague(champion)).toBeNull();
  });
});

describe('reading the question', () => {
  it('finds names: species, nicknames, trainers by first name or town gym, items, zones, types', () => {
    const p = parseQuestion("Can Sparky beat Mira's Briarbear on Mire Route with a Potion? Is fire better?", early);
    expect(p.species).toEqual(['briarbear', 'dustcub']);
    expect(p.trainers).toEqual(['verdant_gym']);
    expect(p.items).toEqual(['potion']);
    expect(p.zones).toEqual(['mire_route']);
    expect(p.types).toEqual(['Fire']);
    expect(parseQuestion('what about the cinderhold gym', early).trainers).toEqual(['blaze_gym']);
    expect(parseQuestion('a dark day', early).types).toEqual([]);
    expect(parseQuestion('dark types?', early).types).toEqual(['Dark']);
  });

  it('a type question reads which way it asks', () => {
    expect(typeView(' what is strong against ghost types ', 'Ghost')).toBe('defend');
    expect(typeView(' what beats dragon ', 'Dragon')).toBe('defend');
    expect(typeView(' what is fire good against ', 'Fire')).toBe('attack');
    expect(typeView(' what does water beat ', 'Water')).toBe('attack');
    expect(typeView(' tell me about the ice type ', 'Ice')).toBe('both');
  });

  it('the save snapshot comes from the session', () => {
    const c = { speciesId: 'dustcub', nickname: 'Sparky', level: 12, moves: [{ id: 'Tackle', pp: 35, ppMax: 35 }], honor: 3 } as unknown as CreatureInstance;
    expect(monOf(c)).toEqual({ speciesId: 'dustcub', name: 'Sparky', level: 12, moves: ['Tackle'], honor: 3 });
    expect(monOf({ ...c, speciesId: 'mossling', nickname: null, honor: undefined } as unknown as CreatureInstance).honor).toBeNull();
    const s = saveOf({ progression: null, inventory: null, zoneId: null });
    expect(s.party).toEqual([]);
    expect(factsFor('what should I do next', s).facts[0]).toMatch(/partner Ewamon/);
  });
});

describe('the guards on a model answer', () => {
  const facts = ['Mossling lives on Mire Route at level 2 to 5 (common).'];
  it('ungrounded: a name, a number or "your <creature>" the facts do not hold', () => {
    expect(ungrounded('You can catch a Mossling on Mire Route at level 2 to 5.', facts)).toEqual([]);
    expect(ungrounded('Mossling lives on Tide Route.', facts)).toEqual(['Tide Route']);
    expect(ungrounded('Mossling is level 9 there.', facts)).toEqual(['9']);
    expect(ungrounded('Your Mossling is strong.', facts, '', ['Glimfin'])).toEqual(['your Mossling']);
    expect(ungrounded('Your Mossling is strong.', facts, '', ['Mossling'])).toEqual([]);
    expect(ungrounded('Ask Mossling.', facts, 'where is Bramblecub')).toEqual([]);
  });

  it('wrongTypeClaims: what the chart contradicts', () => {
    expect(wrongTypeClaims('Psychic and Ghost are strong against Ghost types.')).toEqual(['Psychic and Ghost are strong against Ghost']);
    expect(wrongTypeClaims('Super effective against Ghost types is Psychic and Ghost.')).toHaveLength(1);
    expect(wrongTypeClaims('Grass is weak to Water.')).toHaveLength(1);
    expect(wrongTypeClaims('Water resists Grass.')).toHaveLength(1);
    expect(wrongTypeClaims('Fire, Ice, Poison, Flying and Bug moves are super effective on Grass. Ghost and Dark moves are super effective on Ghost.')).toEqual([]);
    expect(wrongTypeClaims('Normal and Fighting moves have no effect on Ghost. Water resists Fire.')).toEqual([]);
  });

  it('every fixture save’s facts pass their own guards', () => {
    for (const save of [early, mid, champion]) {
      for (const q of ['what should I do next', 'is my team any good', 'what beats the next gym', 'where do I find a water type']) {
        const f = factsFor(q, save).facts;
        expect(wrongTypeClaims(f.join(' '))).toEqual([]);
      }
    }
  });
});

/** sanity for the fixtures themselves */
it('the fixture species exist', () => {
  for (const id of ['glimfin', 'dustcub', 'cindercap', 'pyrecap', 'voltide', 'briarbear', 'pebblit']) expect(sp(id)).toBeDefined();
  const t: TypeName = 'Fire';
  expect(TYPE_NAMES).toContain(t);
});
