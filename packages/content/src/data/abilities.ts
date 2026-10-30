// GENERATED — edit the generator (packages/content/scripts/migrate-legacy.ts), not this file.
// Source: .design/legacy/ewamon.js. Regenerate with `pnpm --filter @ewa/content run migrate`.
// Hooks are the 25 §2.5 rows; descriptions rewritten where the spine changed the legacy semantics.
import type { AbilityDef } from '@ewa/core';

export const ABILITIES: readonly AbilityDef[] = [
  {
    id: 'Avatar Cycle',
    name: 'Avatar Cycle',
    description: 'Holding an Original Master Relic, it takes that element\'s form, type and signature-move type as it enters battle. The Vial of Spirit Water wakes the Avatar State below 30% HP.',
    hooks: [],
  },
  {
    id: 'Chlorophyll',
    name: 'Chlorophyll',
    description: 'Boosts Speed in sunny weather',
    hooks: [{ kind: 'modifySpeed', whenWeather: 'sun', mul: 2 }],
  },
  {
    id: 'Competitive',
    name: 'Competitive',
    description: 'Raises Attack by two stages when a foe lowers one of its stats.',
    hooks: [{ kind: 'onStatLowered', raise: { stat: 'atk', stages: 2 } }],
  },
  {
    id: 'Flame Body',
    name: 'Flame Body',
    description: 'Burns the attacker on contact',
    hooks: [{ kind: 'onContact', reaction: { kind: 'inflictStatus', status: 'burn', chance: 30 } }],
  },
  {
    id: 'Flash Fire',
    name: 'Flash Fire',
    description: 'Increases Fire power when hit by Fire moves',
    hooks: [
      { kind: 'typeImmunity', moveType: 'Fire', reaction: { kind: 'flag', flag: 'flashFired' } },
      { kind: 'modifyDamage', side: 'attacker', moveTypes: ['Fire'], when: 'flashFired', mul: 1.5 },
    ],
  },
  {
    id: 'Guts',
    name: 'Guts',
    description: 'Boosts Atk by 50% when afflicted with a status condition',
    hooks: [{ kind: 'modifyAttack', when: 'statused', mul: 1.5 }],
  },
  {
    id: 'Hustle',
    name: 'Hustle',
    description: 'Boosts Attack by 50% but lowers the accuracy of damaging moves by 20%.',
    hooks: [
      { kind: 'modifyAttack', when: 'always', mul: 1.5 },
      { kind: 'modifyAccuracy', side: 'attacker', onlyDamaging: true, mul: 0.8 },
    ],
  },
  {
    id: 'Immunity',
    name: 'Immunity',
    description: 'Cannot be poisoned',
    hooks: [{ kind: 'statusImmunity', statuses: ['poison'] }],
  },
  {
    id: 'Inner Chi',
    name: 'Inner Chi',
    description: 'Non-contact moves deal 30% more damage while its HP is full.',
    hooks: [{ kind: 'modifyDamage', side: 'attacker', when: 'fullHp', contact: false, mul: 1.3 }],
  },
  {
    id: 'Intimidate',
    name: 'Intimidate',
    description: 'Lowers the opponent\'s Attack by one stage on switch-in, once.',
    hooks: [{ kind: 'onSwitchIn', lowerFoe: { stat: 'atk', stages: 1 } }],
  },
  {
    id: 'Iron Barbs',
    name: 'Iron Barbs',
    description: 'Damages attacker with iron spikes on contact',
    hooks: [{ kind: 'onContact', reaction: { kind: 'damageFraction', fraction: 0.125 } }],
  },
  {
    id: 'Keen Eye',
    name: 'Keen Eye',
    description: 'Its accuracy cannot be lowered.',
    hooks: [{ kind: 'stageLowerImmunity', stats: ['acc'] }],
  },
  {
    id: 'Levitate',
    name: 'Levitate',
    description: 'Immune to Ground-type moves',
    hooks: [{ kind: 'typeImmunity', moveType: 'Ground', reaction: { kind: 'none' } }],
  },
  {
    id: 'Lightning Rod',
    name: 'Lightning Rod',
    description: 'Immune to Electric moves; raises Attack by one stage when hit by one.',
    hooks: [
      {
        kind: 'typeImmunity',
        moveType: 'Electric',
        reaction: { kind: 'raiseStat', stat: 'atk', stages: 1 },
      },
    ],
  },
  {
    id: 'Natural Cure',
    name: 'Natural Cure',
    description: 'Cures major status conditions when switched out.',
    hooks: [{ kind: 'onSwitchOut', action: 'cureStatus' }],
  },
  {
    id: 'Poison Spores',
    name: 'Poison Spores',
    description: 'Poisons attacker on contact',
    hooks: [{ kind: 'onContact', reaction: { kind: 'inflictStatus', status: 'poison', chance: 30 } }],
  },
  {
    id: 'Regenerator',
    name: 'Regenerator',
    description: 'Restores a third of its HP when switched out.',
    hooks: [{ kind: 'onSwitchOut', action: 'healFraction', fraction: 0.3333 }],
  },
  {
    id: 'Rough Skin',
    name: 'Rough Skin',
    description: 'Damages attacker on contact',
    hooks: [{ kind: 'onContact', reaction: { kind: 'damageFraction', fraction: 0.125 } }],
  },
  {
    id: 'Sand Veil',
    name: 'Sand Veil',
    description: 'Foes hit it less often in a sandstorm.',
    hooks: [{ kind: 'modifyAccuracy', side: 'defender', whenWeather: 'sand', mul: 0.8 }],
  },
  {
    id: 'Solid Rock',
    name: 'Solid Rock',
    description: 'Reduces damage from super-effective moves by 25%',
    hooks: [{ kind: 'modifyDamage', side: 'defender', when: 'superEffective', mul: 0.75 }],
  },
  {
    id: 'Speed Boost',
    name: 'Speed Boost',
    description: 'Speed increases every turn',
    hooks: [{ kind: 'endOfTurn', raise: { stat: 'spd', stages: 1 } }],
  },
  {
    id: 'Stance Change',
    name: 'Stance Change',
    description: 'After hitting with a contact move, raises Defense by one stage; after a non-contact move, Speed. At most two stages each until it switches out.',
    hooks: [
      {
        kind: 'afterMoveUsed',
        contact: { stat: 'def', stages: 1 },
        nonContact: { stat: 'spd', stages: 1 },
        cap: 2,
      },
    ],
  },
  {
    id: 'Swift Swim',
    name: 'Swift Swim',
    description: 'Boosts Speed in rain',
    hooks: [{ kind: 'modifySpeed', whenWeather: 'rain', mul: 2 }],
  },
  {
    id: 'Thermal Divide',
    name: 'Thermal Divide',
    description: 'Cannot be burned or frozen. Fire- and Ice-type moves deal half damage to it.',
    hooks: [
      { kind: 'statusImmunity', statuses: ['burn', 'freeze'] },
      { kind: 'modifyDamage', side: 'defender', moveTypes: ['Fire', 'Ice'], mul: 0.5 },
    ],
  },
  {
    id: 'Thick Fat',
    name: 'Thick Fat',
    description: 'Reduces damage from Fire and Ice moves',
    hooks: [{ kind: 'modifyDamage', side: 'defender', moveTypes: ['Fire', 'Ice'], mul: 0.5 }],
  },
  {
    id: 'Void Sovereign',
    name: 'Void Sovereign',
    description: 'Immune to Fairy-type moves',
    hooks: [{ kind: 'typeImmunity', moveType: 'Fairy', reaction: { kind: 'none' } }],
  },
  {
    id: 'Volt Absorb',
    name: 'Volt Absorb',
    description: 'Recovers HP when hit by Electric moves',
    hooks: [{ kind: 'typeImmunity', moveType: 'Electric', reaction: { kind: 'heal', fraction: 0.25 } }],
  },
  {
    id: 'Water Absorb',
    name: 'Water Absorb',
    description: 'Recovers HP when hit by Water moves',
    hooks: [{ kind: 'typeImmunity', moveType: 'Water', reaction: { kind: 'heal', fraction: 0.25 } }],
  },
  {
    id: 'Wonder Guard',
    name: 'Wonder Guard',
    description: 'Only takes damage from super-effective moves',
    hooks: [{ kind: 'wonderGuard' }],
  },
];
