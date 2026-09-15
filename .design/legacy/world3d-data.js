/* ============================================================================
   data.js — RULES LAYER. Wraps Ewamon's authoritative data (src/ewamon-data.js)
   with the 4-stat math, creature instances, leveling/evolution, capture, and
   sprite-path resolution. World/story/league content lives in src/world.js.
   ========================================================================== */
import { SPECIES, MOVES, TYPE_CHART, ITEMS as EWA_ITEMS, ORBS } from './ewamon-data.js';
import { SPRITES } from './ewamon-sprites.js';

export { SPECIES, MOVES, TYPE_CHART, ORBS };

export const STARTERS = ['bramblecub', 'cindercap', 'glimfin'];

/* 19 types + their UI colors */
export const TYPES = ['Normal','Fire','Water','Grass','Electric','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Steel','Fairy','Dark','Cosmic'];
export const TYPE_COLORS = {
  Normal:'#a8a290', Fire:'#ee6f4a', Water:'#4aa3d6', Grass:'#6fae5a', Electric:'#f4cf3f',
  Ice:'#8fd6e8', Fighting:'#c0492f', Poison:'#9a5bb0', Ground:'#c9a24a', Flying:'#8aa6e0',
  Psychic:'#e06fa0', Bug:'#9aa83a', Rock:'#b09a6f', Ghost:'#6a5b9a', Dragon:'#6a52d0',
  Steel:'#9aa6b0', Fairy:'#f0a6d0', Dark:'#5b4b66', Cosmic:'#7be0d0',
};

/* ---- sprite path resolution (filenames have parens; encode them for URLs) ---- */
export function spritePath(speciesId, side = 'front'){
  const m = SPRITES[speciesId];
  let file = m && m[side];
  if (!file && side === 'back') file = m && m.front;     // yaschamp etc. lack a back
  if (!file) return null;
  return `assets/ewamon/${side === 'back' && (!m || !m.back) ? 'front' : side}/` + file.replace(/\(/g, '%28').replace(/\)/g, '%29');
}

/* ---- Ewamon stat math (4 stats: hp/atk/def/spd, no special split, no STAB) ---- */
export const calcStat  = (base, level) => Math.floor((base * level) / 50) + level + 10;
export const calcMaxHp = (base, level) => Math.floor((base * level) / 50) + level + 20;

export function typeMult(moveType, defenderTypes){
  let m = 1;
  for (const t of (defenderTypes || [])) m *= (TYPE_CHART[moveType] && TYPE_CHART[moveType][t] !== undefined) ? TYPE_CHART[moveType][t] : 1;
  return m;
}

const STAGE = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
export function statVal(c, key){ return Math.max(1, Math.floor(c.stats[key] * STAGE(c.stages?.[key] || 0))); }

/* Gen-style damage on Ewamon's single Atk/Def pair. crit-flagged moves crit more. */
export function calcDamage(att, def, moveId){
  const m = MOVES[moveId];
  if (!m || !m.power) return { dmg: 0, tm: 1, crit: false };
  const atk = statVal(att, 'atk'), dfn = statVal(def, 'def');
  const tm = typeMult(m.type, def.types);
  const critChance = m.effect === 'crit' ? 0.30 : 0.0625;
  const crit = Math.random() < critChance ? 1.5 : 1;
  const rand = 0.85 + Math.random() * 0.15;
  let base = ((2 * att.level / 5 + 2) * m.power * atk / dfn) / 50 + 2;
  if (att.status === 'burn') base *= 0.5;                 // burn halves physical output
  const dmg = Math.max(tm === 0 ? 0 : 1, Math.floor(base * rand * crit * tm));
  return { dmg, tm, crit: crit > 1 };
}

/* ---- leveling / evolution ---- */
export const expToNext = level => level * 100;
export function expYieldFor(defeated){ const sp = SPECIES[defeated.species]; return Math.max(1, Math.floor((sp.expYield || 60) * defeated.level / 7)); }

export function recomputeStats(c){
  const sp = SPECIES[c.species]; const ratio = c.hp / c.stats.hp;
  c.stats = { hp: calcMaxHp(sp.baseHp, c.level), atk: calcStat(sp.baseAtk, c.level),
              def: calcStat(sp.baseDef, c.level), spd: calcStat(sp.baseSpd, c.level) };
  c.hp = Math.max(1, Math.round(c.stats.hp * ratio));
}
/* returns target species id if this creature should evolve at its current level */
export function evolutionFor(c){
  const sp = SPECIES[c.species];
  if (sp && sp.evolvesInto && sp.evolvesAt && c.level >= sp.evolvesAt) return sp.evolvesInto;
  return null;
}
export function evolveInto(c, targetId){
  const ratio = c.hp / c.stats.hp; const wasName = SPECIES[c.species].name;
  c.species = targetId; const sp = SPECIES[targetId];
  if (c.name === wasName) c.name = sp.name;               // keep nickname if renamed
  c.types = sp.type.slice();
  c.stats = { hp: calcMaxHp(sp.baseHp, c.level), atk: calcStat(sp.baseAtk, c.level),
              def: calcStat(sp.baseDef, c.level), spd: calcStat(sp.baseSpd, c.level) };
  c.hp = Math.max(1, Math.round(c.stats.hp * ratio));
}

let _uid = 1;
export function instantiateCreature(speciesId, level, opts = {}){
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error('unknown species ' + speciesId);
  const moves = (sp.moves || []).slice(0, 4).map(id => ({ id, pp: (MOVES[id] && MOVES[id].pp) || 20, ppMax: (MOVES[id] && MOVES[id].pp) || 20 }));
  const c = {
    uid: _uid++, species: speciesId, name: opts.nick || sp.name, level,
    types: sp.type.slice(),
    stats: { hp: calcMaxHp(sp.baseHp, level), atk: calcStat(sp.baseAtk, level),
             def: calcStat(sp.baseDef, level), spd: calcStat(sp.baseSpd, level) },
    moves, status: null, statusTurns: 0, confuseTurns: 0,
    stages: { atk: 0, def: 0, spd: 0 },
    exp: 0, expToNext: expToNext(level),
    variantKey: opts.variantKey || 'normal', isAlpha: !!opts.isAlpha,
  };
  c.hp = c.stats.hp;
  return c;
}

/* learn up to 4 of the species' learnable moves the creature doesn't yet know */
export function newMovesAtLevel(c){
  const sp = SPECIES[c.species]; const pool = sp.learnableMoves || sp.moves || [];
  const known = new Set(c.moves.map(m => m.id));
  // milestone learning: every 7 levels, try to add the next unknown learnable move
  if (c.level % 7 !== 0) return [];
  const next = pool.find(id => !known.has(id));
  if (!next) return [];
  if (c.moves.length < 4) c.moves.push({ id: next, pp: MOVES[next]?.pp || 20, ppMax: MOVES[next]?.pp || 20 });
  else { c.moves.shift(); c.moves.push({ id: next, pp: MOVES[next]?.pp || 20, ppMax: MOVES[next]?.pp || 20 }); }
  return [next];
}

export function healCreature(c){
  c.hp = c.stats.hp; c.status = null; c.statusTurns = 0; c.confuseTurns = 0;
  c.stages = { atk: 0, def: 0, spd: 0 };
  for (const mv of c.moves) mv.pp = mv.ppMax;
}

/* ---- capture (Ewamon orb math) ---- */
export function captureChance(enemy, orbId){
  const orb = ORBS[orbId] || ORBS.spark_orb;
  if (orb.catchRate >= 999) return 1;                     // aether orb = guaranteed
  const sp = SPECIES[enemy.species];
  const max = enemy.stats.hp, cur = Math.max(1, enemy.hp);
  const statusBonus = enemy.status ? (enemy.status === 'sleep' || enemy.status === 'freeze' ? 2 : 1.5) : 1;
  // base Gen-style rate scaled by species catchRate (1..255) and orb multiplier
  let mult = orb.catchRate;
  // type-targeted orbs (verdant/ember/tide/phantom) and dusk/mythos bonuses
  if (orb.id === 'verdant_orb' && enemy.types.includes('Grass')) mult *= 3;
  if (orb.id === 'ember_orb' && enemy.types.includes('Fire')) mult *= 3;
  if (orb.id === 'tide_orb' && enemy.types.includes('Water')) mult *= 3;
  if (orb.id === 'phantom_orb' && enemy.types.includes('Ghost')) mult *= 3;
  if (orb.id === 'dusk_orb' && enemy.types.includes('Dark')) mult *= 3;
  if (orb.id === 'mythos_orb' && (enemy.isAlpha || (enemy.variantKey && enemy.variantKey !== 'normal'))) mult *= 4;
  const a = ((3 * max - 2 * cur) / (3 * max)) * (sp.catchRate / 255) * mult * statusBonus;
  return Math.max(0.02, Math.min(0.99, a));
}

/* ---- moves / display helpers ---- */
export function moveInfo(id){ return MOVES[id] || { power: 0, type: 'Normal', pp: 0, accuracy: 100, effect: null }; }
export function typeColor(t){ return TYPE_COLORS[t] || '#888'; }
export const isLegendary = id => { const r = SPECIES[id]?.rarity; return r === 'legendary' || r === 'mythical'; };

/* ---- items (healing + orbs) for shop/bag ---- */
export const POTIONS = {
  potion:      { name: 'Potion', kind: 'heal', amount: 40, price: 200, desc: 'Restores 40 HP.' },
  superpotion: { name: 'Super Potion', kind: 'heal', amount: 100, price: 600, desc: 'Restores 100 HP.' },
  hyperpotion: { name: 'Hyper Potion', kind: 'heal', amount: 200, price: 1500, desc: 'Restores 200 HP.' },
  revive:      { name: 'Revive', kind: 'revive', price: 1800, desc: 'Revives a fainted ally to half HP.' },
  fullheal:    { name: 'Full Heal', kind: 'cure', price: 400, desc: 'Cures any status condition.' },
};
export function itemInfo(id){
  if (POTIONS[id]) return { id, ...POTIONS[id], isOrb: false };
  if (ORBS[id]) return { id, name: ORBS[id].name, kind: 'ball', price: ORBS[id].price, desc: ORBS[id].desc, isOrb: true };
  return null;
}
