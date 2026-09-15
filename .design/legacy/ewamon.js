// ─── AUTHORITATIVE EWAMON DATA (server-side) ──────────────────────────────────
// All battle calculations must use this data to prevent cheating.

// ─── ABILITIES ──────────────────────────────────────────────────────────────
// Passive effects that trigger during or after moves
const ABILITIES = {
  // Stat boosters
  "Chlorophyll": { name: "Chlorophyll", desc: "Boosts Speed in sunny weather", type: "passive" },
  "Swift Swim": { name: "Swift Swim", desc: "Boosts Speed in rain", type: "passive" },
  "Thick Fat": { name: "Thick Fat", desc: "Reduces damage from Fire and Ice moves", type: "passive" },
  "Lightning Rod": { name: "Lightning Rod", desc: "Attracts Electric moves and boosts Atk", type: "passive" },
  "Competitive": { name: "Competitive", desc: "Boosts Atk when stats are lowered", type: "passive" },

  // Damage modifiers
  "Flame Body": { name: "Flame Body", desc: "Burns the attacker on contact", type: "onContact" },
  "Poison Spores": { name: "Poison Spores", desc: "Poisons attacker on contact", type: "onContact" },
  "Rough Skin": { name: "Rough Skin", desc: "Damages attacker on contact", type: "onContact" },

  // Effect immunity
  "Water Absorb": { name: "Water Absorb", desc: "Recovers HP when hit by Water moves", type: "passive" },
  "Volt Absorb": { name: "Volt Absorb", desc: "Recovers HP when hit by Electric moves", type: "passive" },
  "Flash Fire": { name: "Flash Fire", desc: "Increases Fire power when hit by Fire moves", type: "passive" },
  "Immunity": { name: "Immunity", desc: "Cannot be poisoned", type: "passive" },

  // Speed & priority
  "Speed Boost": { name: "Speed Boost", desc: "Speed increases every turn", type: "passive" },
  "Intimidate": { name: "Intimidate", desc: "Lowers opponent's Atk on switch-in", type: "passive" },

  // Special effects
  "Wonder Guard": { name: "Wonder Guard", desc: "Only takes damage from super-effective moves", type: "passive" },
  "Regenerator": { name: "Regenerator", desc: "Restores 1/3 HP when switched out", type: "passive" },

  // Additional abilities
  "Keen Eye":     { name: "Keen Eye",     desc: "Prevents accuracy from being lowered", type: "passive" },
  "Solid Rock":   { name: "Solid Rock",   desc: "Reduces damage from super-effective moves by 25%", type: "passive" },
  "Natural Cure": { name: "Natural Cure", desc: "Cures status conditions when switched out", type: "passive" },
  "Sand Veil":    { name: "Sand Veil",    desc: "Boosts evasion in sandstorm", type: "passive" },
  "Hustle":       { name: "Hustle",       desc: "Boosts Atk by 50% but lowers accuracy of physical moves", type: "passive" },
  "Guts":         { name: "Guts",         desc: "Boosts Atk by 50% when afflicted with a status condition", type: "passive" },
  "Iron Barbs":   { name: "Iron Barbs",   desc: "Damages attacker with iron spikes on contact", type: "onContact" },
  "Levitate":     { name: "Levitate",     desc: "Immune to Ground-type moves", type: "passive" },
  "Void Sovereign": { name: "Void Sovereign", desc: "Immune to Fairy-type moves", type: "passive" },
};

// ─── HELD ITEMS ─────────────────────────────────────────────────────────────
// Items that provide passive effects or stat boosts
const ITEMS = {
  // Stat boost items
  "Assault Vest": { name: "Assault Vest", desc: "+25% Sp.Def, can't use status moves", statBuff: { spDef: 1.25 } },
  "Choice Band": { name: "Choice Band", desc: "+25% Atk, locked to one move", statBuff: { atk: 1.25 } },
  "Choice Scarf": { name: "Choice Scarf", desc: "+25% Speed, locked to one move", statBuff: { spd: 1.25 } },
  "Choice Specs": { name: "Choice Specs", desc: "+25% Sp.Atk, locked to one move", statBuff: { spAtk: 1.25 } },
  "Eviolite": { name: "Eviolite", desc: "+50% Def & Sp.Def for unevolved species", statBuff: { def: 1.5, spDef: 1.5 }, unevolved: true },
  "Heavy Duty Boots": { name: "Heavy Duty Boots", desc: "Negates entry hazard damage", immune: ["hazards"] },

  // HP items
  "Sitrus Berry": { name: "Sitrus Berry", desc: "Restores 1/4 HP when below 50%", healing: "berry" },
  "Oran Berry": { name: "Oran Berry", desc: "Restores 10 HP when below 25%", healing: "berry" },

  // Type-boosting items
  "Charcoal": { name: "Charcoal", desc: "+20% Fire move power", typeBuff: { Fire: 1.2 } },
  "Mystic Water": { name: "Mystic Water", desc: "+20% Water move power", typeBuff: { Water: 1.2 } },
  "Mirrorcoat": { name: "Mirrorcoat", desc: "+20% Psychic move power", typeBuff: { Psychic: 1.2 } },
  "Black Sludge": { name: "Black Sludge", desc: "+20% Poison move power", typeBuff: { Poison: 1.2 } },

  // Utility items
  "Weakness Policy": { name: "Weakness Policy", desc: "+2 Atk & Sp.Atk when hit by super-effective move", effect: "weaknessPolicy" },
  "Speed Scarf": { name: "Speed Scarf", desc: "+10% Speed", statBuff: { spd: 1.1 } },

  // Field HMs — inventory-only; enable overworld traversal verbs.
  "HM Surf": { name: "HM Surf", desc: "Allows a water-type Ewamon to ferry you across deep water.", field: "surf" },
  "HM Cut": { name: "HM Cut", desc: "Teaches a Grass-type Ewamon to clear small trees blocking a path.", field: "cut" },
  "HM Strength": { name: "HM Strength", desc: "Lets a muscular Ewamon shove heavy boulders aside.", field: "strength" },
};

// ─── ORBS (capture devices) ─────────────────────────────────────────────────
// 10-tier catch-device system that replaces the legacy poke/great/ultra/master
// balls. Each orb has a flat catchRate multiplier and an optional conditional
// bonus that fires on a matching wild Ewamon (type, variant, or alpha).
const ORBS = {
  spark_orb: {
    id: "spark_orb", name: "Spark Orb", sprite: "spark_orb.png",
    desc: "A copper-bound starter orb. Standard catch rate.",
    catchRate: 1.0, price: 200, sellPrice: 100, maxStack: 99, rarity: "common",
  },
  crest_orb: {
    id: "crest_orb", name: "Crest Orb", sprite: "crest_orb.png",
    desc: "A reinforced silver orb. 1.75× catch rate.",
    catchRate: 1.75, price: 600, sellPrice: 300, maxStack: 99, rarity: "uncommon",
  },
  prism_orb: {
    id: "prism_orb", name: "Prism Orb", sprite: "prism_orb.png",
    desc: "A polished gold orb with a faceted core. 2.5× catch rate.",
    catchRate: 2.5, price: 1200, sellPrice: 600, maxStack: 99, rarity: "rare",
  },
  aether_orb: {
    id: "aether_orb", name: "Aether Orb", sprite: "aether_orb.png",
    desc: "An iridescent ceremonial orb. Catches any Ewamon without fail.",
    catchRate: 999, price: 50000, sellPrice: 25000, maxStack: 1, rarity: "legendary",
  },
  mythos_orb: {
    id: "mythos_orb", name: "Mythos Orb", sprite: "mythos_orb.png",
    desc: "A rune-etched orb. 4× catch rate on Alpha or variant Ewamon.",
    catchRate: 1.5, bonus: { kind: "alpha_or_variant", multiplier: 4.0 },
    price: 5000, sellPrice: 2500, maxStack: 99, rarity: "rare",
  },
  verdant_orb: {
    id: "verdant_orb", name: "Verdant Orb", sprite: "verdant_orb.png",
    desc: "A vine-wrapped orb. 3× catch rate on Grass-type Ewamon.",
    catchRate: 1.0, bonus: { kind: "type", type: "Grass", multiplier: 3.0 },
    price: 800, sellPrice: 400, maxStack: 99, rarity: "uncommon",
  },
  ember_orb: {
    id: "ember_orb", name: "Ember Orb", sprite: "ember_orb.png",
    desc: "A magma-veined orb. 3× catch rate on Fire-type Ewamon.",
    catchRate: 1.0, bonus: { kind: "type", type: "Fire", multiplier: 3.0 },
    price: 800, sellPrice: 400, maxStack: 99, rarity: "uncommon",
  },
  tide_orb: {
    id: "tide_orb", name: "Tide Orb", sprite: "tide_orb.png",
    desc: "A pearl-crusted orb. 3× catch rate on Water-type Ewamon.",
    catchRate: 1.0, bonus: { kind: "type", type: "Water", multiplier: 3.0 },
    price: 800, sellPrice: 400, maxStack: 99, rarity: "uncommon",
  },
  dusk_orb: {
    id: "dusk_orb", name: "Dusk Orb", sprite: "dusk_orb.png",
    desc: "A moonstone-set orb. 3× catch rate on Dark-type Ewamon.",
    catchRate: 1.0, bonus: { kind: "type", type: "Dark", multiplier: 3.0 },
    price: 900, sellPrice: 450, maxStack: 99, rarity: "uncommon",
  },
  phantom_orb: {
    id: "phantom_orb", name: "Phantom Orb", sprite: "phantom_orb.png",
    desc: "A wisp-bound orb. 3× catch rate on Ghost-type Ewamon.",
    catchRate: 1.0, bonus: { kind: "type", type: "Ghost", multiplier: 3.0 },
    price: 900, sellPrice: 450, maxStack: 99, rarity: "uncommon",
  },
};

// Legacy inventory keys still in player documents are remapped at read time and
// migrated on next save. Keep this map until all live accounts have been swept.
const LEGACY_ORB_ID_MAP = {
  ewamon_ball: "spark_orb",
  great_ball:  "crest_orb",
  ultra_ball:  "prism_orb",
  ultraball:   "prism_orb",
  master_ball: "aether_orb",
};

function resolveOrbId(id) {
  return LEGACY_ORB_ID_MAP[id] || id;
}

// Compute the final catch-rate multiplier for an orb against a specific wild
// Ewamon. Combines flat catchRate with the conditional bonus (if any).
function getOrbCatchMultiplier(orbId, wildEwamon, speciesDef) {
  const orb = ORBS[resolveOrbId(orbId)];
  if (!orb) return 1;
  const base = orb.catchRate || 1;
  if (!orb.bonus) return base;
  const b = orb.bonus;
  if (b.kind === "alpha_or_variant") {
    const isVariant = wildEwamon?.variantKey && wildEwamon.variantKey !== "normal";
    return wildEwamon?.isAlpha || isVariant ? base * b.multiplier : base;
  }
  if (b.kind === "type") {
    const types = speciesDef?.type || [];
    return types.includes(b.type) ? base * b.multiplier : base;
  }
  return base;
}

// ─── ROLE CATEGORIES ────────────────────────────────────────────────────────
// Helps players understand team composition and synergy
const SPECIES_ROLES = {
  PHYSICAL_ATTACKER: "Physical Attacker",
  SPECIAL_ATTACKER: "Special Attacker",
  MIXED_ATTACKER: "Mixed Attacker",
  PHYSICAL_DEFENDER: "Physical Defender",
  SPECIAL_DEFENDER: "Special Defender",
  MIXED_DEFENDER: "Mixed Defender",
  HEALER: "Healer",
  SPEED: "Speed",
  TANK: "Tank",
};

const EWAMON_SPECIES = {


  smellduck: {
    id: "smellduck", name: "Smellduck",
    flavor: "A cheerful duck-like Ewamon that emits a pungent aroma to ward off predators. Its feathers shimmer with faint chlorophyll.",
    type: ["Grass", "Normal"],
    baseHp: 72, baseAtk: 62, baseDef: 52, baseSpd: 72,
    rarity: "common", catchRate: 45,
    sizeScale: 0.72,
    expYield: 60,
    moves: ["Peck", "Leaf Blade", "Stink Cloud", "Feather Dance"],
    learnableMoves: ["Peck", "Leaf Blade", "Stink Cloud", "Feather Dance", "Solar Absorb", "Sunny Day"],
    abilities: ["Chlorophyll", "Immunity"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "smellduckfront.png",
    backSprite: "smellduckback.png",
    habitat: ["Pallet Town", "Route 2", "Cerulean City", "Route 21"],
    evolvesInto: "bloomduck", evolvesAt: 20,
  },


  bloomduck: {
    id: "bloomduck", name: "Bloomduck",
    flavor: "Its crest blooms into a fragrant crown that can stun foes with equal parts perfume and stink. It struts like it owns every pond it visits.",
    type: ["Grass", "Normal"],
    baseHp: 98, baseAtk: 84, baseDef: 78, baseSpd: 96,
    rarity: "uncommon", catchRate: 22,
    sizeScale: 0.95,
    expYield: 145,
    moves: ["Peck", "Leaf Blade", "Stink Cloud", "Feather Dance"],
    learnableMoves: ["Peck", "Leaf Blade", "Stink Cloud", "Feather Dance", "Solar Absorb", "Sunny Day", "Petal Blizzard", "Body Slam"],
    abilities: ["Chlorophyll", "Immunity"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "bloomduck(front).png",
    backSprite: "bloomduck(back).png",
    habitat: [],
    evolvesFrom: "smellduck",
  },


  budwing: {
    id: "budwing", name: "Budwing",
    flavor: "Tiny leaf-wings help it hop from branch to branch before it can truly fly. Budwing stores sunlight in the bud on its back.",
    type: ["Dragon", "Grass"],
    baseHp: 50, baseAtk: 65, baseDef: 45, baseSpd: 40,
    rarity: "common", catchRate: 45,
    sizeScale: 0.6,
    expYield: 60,
    moves: ["Tackle", "Vine Lash", "Dragon Burst", "Nature Drain"],
    learnableMoves: ["Tackle", "Vine Lash", "Dragon Burst", "Nature Drain", "Leaf Blade", "Forest Fury"],
    abilities: ["Chlorophyll", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "budwingfront.png",
    backSprite: "budwingback.png",
    habitat: ["Pallet Town", "Route 1", "Route 21"],
    evolvesInto: "bloomdrake", evolvesAt: 18
  },


  bloomdrake: {
    id: "bloomdrake", name: "Bloomdrake",
    flavor: "Its flowering scales release a calming scent when threatened. Bloomdrake is often seen circling forests just after the first spring rain.",
    type: ["Dragon", "Grass"],
    baseHp: 70, baseAtk: 85, baseDef: 65, baseSpd: 80,
    rarity: "uncommon", catchRate: 25,
    sizeScale: 1,
    expYield: 140,
    moves: ["Leaf Blade", "Dragon Burst", "Nature Drain", "Forest Fury"],
    learnableMoves: ["Leaf Blade", "Dragon Burst", "Nature Drain", "Forest Fury", "Vine Lash", "Petal Blizzard"],
    abilities: ["Chlorophyll", "Regenerator"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "bloomdrakefront.png",
    backSprite: "bloomdrakeback.png",
    habitat: [],
    evolvesFrom: "budwing",
    evolvesInto: "florasage", evolvesAt: 36
  },


  florasage: {
    id: "florasage", name: "Florasage",
    flavor: "Ancient groves are said to awaken when Florasage roars. Vines and roots answer its call as if it were the forest's own guardian.",
    type: ["Dragon", "Grass"],
    baseHp: 105, baseAtk: 130, baseDef: 95, baseSpd: 70,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.3,
    expYield: 270,
    moves: ["Gem Storm", "Dragon Rush", "Forest Fury", "Nature Drain"],
    learnableMoves: ["Gem Storm", "Dragon Rush", "Forest Fury", "Nature Drain", "Leaf Blade", "Petal Blizzard"],
    abilities: ["Chlorophyll", "Regenerator"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "florasagefront.png",
    backSprite: "florasageback.png",
    habitat: [],
    evolvesFrom: "bloomdrake"
  },


  fennorange: {
    id: "fennorange", name: "Fennorange",
    flavor: "A playful burrower with a peel-bright coat that stays fragrant even in the dirt. It marks tunnels by scratching citrus symbols into the walls.",
    type: ["Ground"],
    baseHp: 58, baseAtk: 60, baseDef: 50, baseSpd: 72,
    rarity: "common", catchRate: 45,
    sizeScale: 0.68,
    expYield: 60,
    moves: ["Sand Attack", "Tackle", "Mud-Slap", "Bite"],
    learnableMoves: ["Sand Attack", "Tackle", "Mud-Slap", "Bite", "Rock Throw", "Bulldoze"],
    abilities: ["Sand Veil", "Speed Boost"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "fennorangefront.png",
    backSprite: "fennorangeback.png",
    habitat: ["Safari Zone"],
    evolvesInto: "berkest", evolvesAt: 16
  },


  berkest: {
    id: "berkest", name: "Berkest",
    flavor: "Its heavy paws pack loose soil into sturdy dens in minutes. Berkest hurls tart stones at intruders with surprising accuracy.",
    type: ["Ground"],
    baseHp: 78, baseAtk: 88, baseDef: 76, baseSpd: 92,
    rarity: "uncommon",
    catchRate: 25,
    sizeScale: 0.95,
    expYield: 130,
    moves: ["Mud-Slap", "Rock Throw", "Sand Tomb", "Citrus Toss"],
    learnableMoves: ["Mud-Slap", "Rock Throw", "Sand Tomb", "Citrus Toss", "Earthquake", "Bulldoze"],
    abilities: ["Sand Veil", "Competitive"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "berkestfront.png",
    backSprite: "berkestback.png",
    habitat: [],
    evolvesFrom: "fennorange", evolvesInto: "clementar", evolvesAt: 36
  },


  clementar: {
    id: "clementar", name: "Clementar",
    flavor: "A colossal guardian of orchard valleys whose footsteps make roots surge from the earth. Sweet pollen drifts in its wake after every battle.",
    type: ["Ground", "Grass"],
    baseHp: 116, baseAtk: 132, baseDef: 112, baseSpd: 82,
    rarity: "epic",
    catchRate: 5,
    sizeScale: 1.3,
    expYield: 245,
    moves: ["Earthquake", "Wood Hammer", "Sandstorm", "Zest Blast"],
    learnableMoves: ["Earthquake", "Wood Hammer", "Sandstorm", "Zest Blast", "Leaf Blade"],
    abilities: ["Chlorophyll", "Regenerator"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "clementarfront.png",
    backSprite: "clementarback.png",
    habitat: [],
    evolvesFrom: "berkest"
  },


  glimp: {
    id: "glimp", name: "Glimp",
    flavor: "A shy, bubble-like Ewamon that emits a faint, twinkling light when it senses danger. It often hides in tall, colorful flowers.",
    type: ["Fairy"],
    baseHp: 50, baseAtk: 40, baseDef: 50, baseSpd: 60,
    rarity: "common", catchRate: 50,
    sizeScale: 0.55,
    expYield: 50,
    moves: ["Fairy Wind", "Tackle", "Light Screen", "Growl"],
    learnableMoves: ["Fairy Wind", "Tackle", "Light Screen", "Growl", "Dazzling Gleam"],
    abilities: ["Competitive", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_DEFENDER,
    frontSprite: "glimpfront.png",
    backSprite: "glimpback.png",
    habitat: ["Pallet Town", "Route 1"],
    evolvesInto: "glimmereen", evolvesAt: 16
  },


  glimmereen: {
    id: "glimmereen", name: "Glimmereen",
    flavor: "The evolved form of Glimp. It projects a beautiful, iridescent glow that can calm even the most aggressive opponents in battle.",
    type: ["Fairy"],
    baseHp: 80, baseAtk: 60, baseDef: 80, baseSpd: 90,
    rarity: "uncommon",
    catchRate: 25,
    sizeScale: 0.78,
    expYield: 130,
    moves: ["Fairy Wind", "Dazzling Gleam", "Light Screen", "Moonblast"],
    learnableMoves: ["Fairy Wind", "Dazzling Gleam", "Light Screen", "Moonblast", "Calm Mind", "Fairy Lock"],
    abilities: ["Competitive", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_DEFENDER,
    frontSprite: "glimmereenfront.png",
    backSprite: "glimmereenback.png",
    habitat: [],
    evolvesFrom: "glimp"
  },


  bramblecub: {
    id: "bramblecub", name: "Bramblecub",
    flavor: "A thorny cub that naps in hedgerows and swats at anything that rustles the leaves around it.",
    type: ["Grass"],
    baseHp: 64, baseAtk: 62, baseDef: 58, baseSpd: 48,
    rarity: "common", catchRate: 45,
    sizeScale: 0.82,
    expYield: 58,
    moves: ["Tackle", "Vine Lash", "Nature Drain", "Growl"],
    learnableMoves: ["Tackle", "Vine Lash", "Nature Drain", "Growl", "Leaf Blade", "Synthesis"],
    abilities: ["Chlorophyll", "Regenerator"],
    role: SPECIES_ROLES.MIXED_DEFENDER,
    frontSprite: "bramblecub(front).png",
    backSprite: "bramblecub(back).png",
    habitat: ["Pallet Town", "Route 2"],
    evolvesInto: "briarbear", evolvesAt: 16,
  },


  briarbear: {
    id: "briarbear", name: "Briarbear",
    flavor: "It hardens bark around its forearms and shoulders before charging intruders out of its grove.",
    type: ["Grass"],
    baseHp: 82, baseAtk: 84, baseDef: 78, baseSpd: 61,
    rarity: "uncommon", catchRate: 28,
    sizeScale: 1.1,
    expYield: 126,
    moves: ["Vine Lash", "Leaf Blade", "Nature Drain", "Synthesis"],
    learnableMoves: ["Vine Lash", "Leaf Blade", "Nature Drain", "Synthesis", "Power Whip", "Forest Fury"],
    abilities: ["Chlorophyll", "Regenerator"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "briarbear(front).png",
    backSprite: "briarbear(back).png",
    habitat: [],
    evolvesFrom: "bramblecub",
    evolvesInto: "thornback", evolvesAt: 32,
  },


  thornback: {
    id: "thornback", name: "Thornback",
    flavor: "A hulking woodland sentinel whose chest core burns whenever its territory is threatened.",
    type: ["Grass", "Rock"],
    baseHp: 108, baseAtk: 112, baseDef: 102, baseSpd: 70,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.3,
    expYield: 220,
    moves: ["Leaf Blade", "Forest Fury", "Power Whip", "Synthesis"],
    learnableMoves: ["Leaf Blade", "Forest Fury", "Power Whip", "Synthesis", "Stone Edge", "Earthquake"],
    abilities: ["Regenerator", "Rough Skin"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "thornback(front).png",
    backSprite: "thornback(back).png",
    habitat: [],
    evolvesFrom: "briarbear",
  },


  shiveruff: {
    id: "shiveruff", name: "Shiveruff",
    flavor: "It bounds over frost with a snowball tail bobbing behind it. The colder the wind gets, the louder it yips.",
    type: ["Ice", "Normal"],
    baseHp: 72, baseAtk: 58, baseDef: 56, baseSpd: 76,
    rarity: "common", catchRate: 40,
    sizeScale: 0.72,
    expYield: 76,
    moves: ["Ice Shard", "Frost Bite", "Quick Attack", "Growl"],
    learnableMoves: ["Ice Shard", "Frost Bite", "Quick Attack", "Growl", "Glacier Crash", "Body Slam", "Blizzard"],
    abilities: ["Thick Fat", "Competitive"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "shiveruff(front).png",
    backSprite: "shiveruff(back).png",
    habitat: ["Route 21", "Cerulean City"],
    evolvesInto: "blizzhowl", evolvesAt: 22,
  },


  blizzhowl: {
    id: "blizzhowl", name: "Blizzhowl",
    flavor: "Its roar rides blizzards for miles, turning drifting snow into a hunting pack around it. Whole coastlines fall silent when its moon-white mane begins to glow.",
    type: ["Ice", "Normal"],
    baseHp: 104, baseAtk: 94, baseDef: 82, baseSpd: 110,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.15,
    expYield: 224,
    moves: ["Frost Bite", "Glacier Crash", "Body Slam", "Blizzard"],
    learnableMoves: ["Ice Shard", "Frost Bite", "Quick Attack", "Glacier Crash", "Body Slam", "Blizzard", "Frozen Tempest"],
    abilities: ["Thick Fat", "Competitive"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "blizzhowl(front).png",
    backSprite: "blizzhowl(back).png",
    habitat: [],
    evolvesFrom: "shiveruff", evolvesInto: "auroracle", evolvesAt: 36,
  },


  auroracle: {
    id: "auroracle", name: "Auroracle",
    flavor: "Its veil catches auroras and folds them into omens that shimmer above frozen water. Trainers camp for days beside mirror-calm lakes hoping to see one finish a prophecy.",
    type: ["Ice", "Psychic"],
    baseHp: 112, baseAtk: 88, baseDef: 108, baseSpd: 92,
    rarity: "rare", catchRate: 14,
    sizeScale: 1.2,
    expYield: 210,
    moves: ["Extrasensory", "Blizzard", "Future Sight", "Heal Pulse"],
    learnableMoves: ["Confusion", "Ice Shard", "Light Screen", "Extrasensory", "Heal Pulse", "Future Sight", "Blizzard"],
    abilities: ["Competitive", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_DEFENDER,
    frontSprite: "auroracle(front).png",
    backSprite: "auroracle(back).png",
    habitat: [],
    evolvesFrom: "blizzhowl",
  },


  pebblit: {
    id: "pebblit", name: "Pebblit",
    flavor: "It hides in scree piles and polishes its pebbled hide with moonlit dust. Trainers sometimes mistake its blinking gemstone eyes for dropped treasure.",
    type: ["Rock"],
    baseHp: 58, baseAtk: 44, baseDef: 62, baseSpd: 48,
    rarity: "common", catchRate: 45,
    sizeScale: 0.55,
    expYield: 58,
    moves: ["Fairy Wind", "Rock Throw", "Charm", "Sand Attack"],
    learnableMoves: ["Fairy Wind", "Rock Throw", "Charm", "Sand Attack", "Power Gem", "Ancient Power", "Dazzling Gleam"],
    abilities: ["Competitive", "Regenerator"],
    role: SPECIES_ROLES.MIXED_DEFENDER,
    frontSprite: "pebblit(front).png",
    backSprite: "pebblit(back).png",
    habitat: ["Route 2", "Victory Road"],
    evolvesInto: "lithokrysm", evolvesAt: 22,
  },


  lithokrysm: {
    id: "lithokrysm", name: "Lithokrysm",
    flavor: "A living geode whose body grows new crystal plates after every battle. Miners once mistook sleeping Lithokrysm for rare treasure.",
    type: ["Rock"],
    baseHp: 120, baseAtk: 90, baseDef: 120, baseSpd: 40,
    rarity: "rare",
    catchRate: 12,
    sizeScale: 1.1,
    expYield: 200,
    moves: ["Steel Slash", "Iron Defense", "Crystal Slam", "Seismic Crush"],
    learnableMoves: ["Steel Slash", "Iron Defense", "Crystal Slam", "Seismic Crush", "Ancient Power", "Boulder Crash"],
    abilities: ["Thick Fat", "Regenerator"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "lithokrysmfront.png",
    backSprite: "lithokrysmback.png",
    habitat: ["Safari Zone", "Victory Road"],
    evolvesInto: "prismolith", evolvesAt: 36,
  },


  prismolith: {
    id: "prismolith", name: "Prismolith",
    flavor: "Its crystal plates bend dawn light into rings that dance across cliff walls. Old miners treat seeing one at sunrise as a sign the vein below is blessed.",
    type: ["Rock"],
    baseHp: 126, baseAtk: 96, baseDef: 126, baseSpd: 94,
    rarity: "epic", catchRate: 8,
    sizeScale: 1.25,
    expYield: 248,
    moves: ["Power Gem", "Ancient Power", "Dazzling Gleam", "Play Rough"],
    learnableMoves: ["Fairy Wind", "Rock Throw", "Charm", "Power Gem", "Ancient Power", "Dazzling Gleam", "Play Rough", "Crystal Slam"],
    abilities: ["Competitive", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_DEFENDER,
    frontSprite: "prismolith(front).png",
    backSprite: "prismolith(back).png",
    habitat: [],
    evolvesFrom: "lithokrysm",
  },


  nettlewisp: {
    id: "nettlewisp", name: "Nettlewisp",
    flavor: "It drifts through hedgerows at dusk, catching on thorns without ever tearing. The pale flame in its crown flickers brighter whenever someone lies nearby.",
    type: ["Ghost", "Grass"],
    baseHp: 60, baseAtk: 52, baseDef: 48, baseSpd: 70,
    rarity: "common", catchRate: 42,
    sizeScale: 0.6,
    expYield: 62,
    moves: ["Lick", "Vine Lash", "Nature Drain", "Growl"],
    learnableMoves: ["Lick", "Vine Lash", "Nature Drain", "Growl", "Hex", "Shadow Sneak", "Forest Fury", "Synthesis"],
    abilities: ["Regenerator", "Immunity"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "nettlewisp(front).png",
    backSprite: "nettlewisp(back).png",
    habitat: ["Route 2", "Safari Zone", "Victory Road"],
    evolvesInto: "briarvaunt", evolvesAt: 24,
  },


  briarvaunt: {
    id: "briarvaunt", name: "Briarvaunt",
    flavor: "Its antlered vines stalk abandoned paths and ring old grave markers in bloom. Travelers leave offerings where its root-shadow crosses the trail, hoping it walks on.",
    type: ["Ghost", "Grass"],
    baseHp: 92, baseAtk: 86, baseDef: 74, baseSpd: 96,
    rarity: "uncommon", catchRate: 18,
    sizeScale: 1.05,
    expYield: 166,
    moves: ["Hex", "Vine Lash", "Forest Fury", "Shadow Sneak"],
    learnableMoves: ["Lick", "Vine Lash", "Nature Drain", "Hex", "Shadow Sneak", "Forest Fury", "Synthesis"],
    abilities: ["Regenerator", "Immunity"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "briarvaunt(front).png",
    backSprite: "briarvaunt(back).png",
    habitat: [],
    evolvesFrom: "nettlewisp",
  },


  ampmite: {
    id: "ampmite", name: "Ampmite",
    flavor: "It stores static in the tiny bulbs along its back and releases crackles whenever it gets excited. Whole fence posts can glow after a swarm has climbed them.",
    type: ["Electric", "Bug"],
    baseHp: 54, baseAtk: 60, baseDef: 44, baseSpd: 82,
    rarity: "common", catchRate: 40,
    sizeScale: 0.45,
    expYield: 64,
    moves: ["String Shot", "Quick Attack", "Thunder Fang", "Bug Bite"],
    learnableMoves: ["String Shot", "Quick Attack", "Thunder Fang", "Bug Bite", "Signal Beam", "Thunder Claw", "X-Scissor", "Volt Crash"],
    abilities: ["Lightning Rod", "Speed Boost"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "ampmite(front).png",
    backSprite: "ampmite(back).png",
    habitat: ["Route 1", "Route 2"],
    evolvesInto: "luxtrik", evolvesAt: 20,
  },


  luxtrik: {
    id: "luxtrik", name: "Luxtrik",
    flavor: "Its wing-cases split into crackling prisms that leave afterimages in rain. Power lines hum louder when one lands nearby and turns its head toward the clouds.",
    type: ["Electric", "Bug"],
    baseHp: 82, baseAtk: 92, baseDef: 66, baseSpd: 116,
    rarity: "uncommon", catchRate: 16,
    sizeScale: 0.75,
    expYield: 178,
    moves: ["Thunder Claw", "Signal Beam", "X-Scissor", "Volt Crash"],
    learnableMoves: ["Quick Attack", "Thunder Fang", "Bug Bite", "Signal Beam", "Thunder Claw", "X-Scissor", "Volt Crash"],
    abilities: ["Lightning Rod", "Speed Boost"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "luxtrik(front).png",
    backSprite: "luxtrik(back).png",
    habitat: [],
    evolvesFrom: "ampmite",
  },


  gustuff: {
    id: "gustuff", name: "Gustuff",
    flavor: "Its wool gathers airborne pollen and seed fluff until it looks like a passing cloud. Children race them uphill just to watch them bounce with the wind.",
    type: ["Fairy", "Flying"],
    baseHp: 66, baseAtk: 48, baseDef: 52, baseSpd: 74,
    rarity: "common", catchRate: 46,
    sizeScale: 0.62,
    expYield: 60,
    moves: ["Fairy Wind", "Wing Gust", "Charm", "Quick Attack"],
    learnableMoves: ["Fairy Wind", "Wing Gust", "Charm", "Quick Attack", "Dazzling Gleam", "Acrobatics", "Roost", "Play Rough"],
    abilities: ["Competitive", "Intimidate"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "gustuff(front).png",
    backSprite: "gustuff(back).png",
    habitat: ["Route 21", "Route 1"],
    evolvesInto: "cirrileap", evolvesAt: 21,
  },


  cirrileap: {
    id: "cirrileap", name: "Cirrileap",
    flavor: "It runs a step ahead of oncoming squalls, kicking streamers of silver cloud from its heels. Shepherds once navigated sea fog by following their drifting wool trails inland.",
    type: ["Fairy", "Flying"],
    baseHp: 98, baseAtk: 74, baseDef: 78, baseSpd: 108,
    rarity: "uncommon", catchRate: 16,
    sizeScale: 0.95,
    expYield: 162,
    moves: ["Dazzling Gleam", "Acrobatics", "Play Rough", "Roost"],
    learnableMoves: ["Fairy Wind", "Wing Gust", "Charm", "Quick Attack", "Dazzling Gleam", "Acrobatics", "Roost", "Play Rough"],
    abilities: ["Competitive", "Intimidate"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "cirrileap(front).png",
    backSprite: "cirrileap(back).png",
    habitat: [],
    evolvesFrom: "gustuff",
  },


  brookrawl: {
    id: "brookrawl", name: "Brookrawl",
    flavor: "It scuttles sideways through shallow rapids and shadowboxes with floating branches until they snap. Young trainers dare each other to steal the stone it keeps tucked under one claw.",
    type: ["Water", "Fighting"],
    baseHp: 70, baseAtk: 68, baseDef: 62, baseSpd: 46,
    rarity: "common", catchRate: 40,
    sizeScale: 0.85,
    expYield: 64,
    moves: ["Bubble Beam", "Low Kick", "Protect", "Mach Punch"],
    learnableMoves: ["Bubble Beam", "Low Kick", "Protect", "Mach Punch", "Aqua Blade", "Bulk Up", "Body Slam", "Close Combat"],
    abilities: ["Swift Swim", "Intimidate"],
    role: SPECIES_ROLES.MIXED_DEFENDER,
    frontSprite: "brookrawl(front).png",
    backSprite: "brookrawl(back).png",
    habitat: ["Pallet Town", "Route 21", "Cerulean City"],
  },


  zaptus: {
    id: "zaptus", name: "Zaptus",
    flavor: "A dormant psychic vessel waiting to awaken. The glowing marks on its body pulse in time with its thoughts, and it often levitates slightly when dreaming.",
    type: ["Psychic"],
    baseHp: 48, baseAtk: 52, baseDef: 42, baseSpd: 75,
    rarity: "common", catchRate: 50,
    sizeScale: 0.65,
    expYield: 60,
    moves: ["Confusion", "Calm Mind", "Light Screen", "Growl"],
    learnableMoves: ["Tackle", "Growl", "Confusion", "Calm Mind", "Light Screen", "Psych Wave"],
    abilities: ["Levitate", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_DEFENDER,
    frontSprite: "zaptusfront.png",
    backSprite: "zaptusback.png",
    habitat: ["Victory Road", "Route 2"],
    evolvesInto: "nebucloak", evolvesAt: 18,
  },


  nebucloak: {
    id: "nebucloak", name: "Nebucloak",
    flavor: "Having learned to project its mind, Nebucloak constructs a cloak of telekinetic energy to hover above the ground. The gems on its body act as conduits for its growing power.",
    type: ["Psychic"],
    baseHp: 75, baseAtk: 88, baseDef: 62, baseSpd: 95,
    rarity: "uncommon", catchRate: 25,
    sizeScale: 0.95,
    expYield: 130,
    moves: ["Psych Wave", "Extrasensory", "Calm Mind", "Brain Pulse"],
    learnableMoves: ["Tackle", "Growl", "Confusion", "Calm Mind", "Light Screen", "Psych Wave", "Extrasensory", "Brain Pulse", "Shadow Ball", "Hypno Fog"],
    abilities: ["Levitate", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "nebucloakfront.png",
    backSprite: "nebucloakback.png",
    habitat: [],
    evolvesFrom: "zaptus", evolvesInto: "archonosis", evolvesAt: 38,
  },


  archonosis: {
    id: "archonosis", name: "Archonosis",
    flavor: "The apex of mental control. Archonosis’ multi-eyed mask sees into the threads of reality. The swirling orb it wields is a pocket dimension of pure, concentrated psychic energy.",
    type: ["Psychic"],
    baseHp: 115, baseAtk: 135, baseDef: 95, baseSpd: 118,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.2,
    expYield: 220,
    moves: ["Mind Crush", "Future Sight", "Shadow Ball", "Abyssal Nova"], 
    learnableMoves: ["Confusion", "Calm Mind", "Light Screen", "Psych Wave", "Extrasensory", "Brain Pulse", "Shadow Ball", "Hypno Fog", "Mind Crush", "Heal Pulse", "Future Sight", "Abyssal Nova"],
    abilities: ["Levitate", "Competitive"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "archonosisfront.png",
    backSprite: "archonosisback.png",
    habitat: [],
    evolvesFrom: "nebucloak",
  },


  grubolt: {
    id: "grubolt", name: "Grubolt",
    flavor: "A metallic scarab larva that curls its armoured body into a ball when threatened. The screw-tip on its tail can bore through packed earth in seconds.",
    type: ["Bug", "Steel"],
    baseHp: 50, baseAtk: 45, baseDef: 60, baseSpd: 38,
    rarity: "common", catchRate: 40,
    sizeScale: 0.55,
    expYield: 60,
    moves: ["Bug Bite", "Iron Defense", "String Shot", "Steel Slash"],
    learnableMoves: ["Bug Bite", "Iron Defense", "String Shot", "Steel Slash", "Signal Beam", "Flash Cannon", "Smart Strike", "Gyro Ball"],
    abilities: ["Keen Eye", "Iron Barbs"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "grubolt(front).png", backSprite: "grubolt(back).png",
    habitat: ["Route 1", "Route 2"],
    evolvesInto: "ironcarab", evolvesAt: 20,
  },


  ironcarab: {
    id: "ironcarab", name: "Ironcarab",
    flavor: "Its serrated horn can split boulders clean in half. Rival trainers have learned to never stand directly in front of one — the riveted seams on its shell hold back pressure that could level a wall.",
    type: ["Bug", "Steel"],
    baseHp: 90, baseAtk: 110, baseDef: 115, baseSpd: 55,
    rarity: "rare", catchRate: 12,
    sizeScale: 1.2,
    expYield: 232,
    moves: ["X-Scissor", "Steel Slash", "Iron Defense", "Megahorn"],
    learnableMoves: ["X-Scissor", "Steel Slash", "Iron Defense", "Megahorn", "Signal Beam", "Flash Cannon", "Smart Strike", "Gyro Ball", "Bug Bite", "Bankai Sever"],
    abilities: ["Intimidate", "Iron Barbs"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "ironcarab(front).png", backSprite: "ironcarab(back).png",
    habitat: [],
    evolvesFrom: "grubolt",
  },


  embrock: {
    id: "embrock", name: "Embrock",
    flavor: "A stocky lava lizard with cracks of molten rock running across its hide. It puffs up and lets smoke curl from its nostrils whenever it wants to look more intimidating than it actually is.",
    type: ["Rock", "Fire"],
    baseHp: 60, baseAtk: 55, baseDef: 65, baseSpd: 42,
    rarity: "common", catchRate: 40,
    sizeScale: 0.75,
    expYield: 65,
    moves: ["Rock Throw", "Ember", "Bite", "Rock Slide"],
    learnableMoves: ["Rock Throw", "Ember", "Bite", "Rock Slide", "Fire Fang", "Stone Edge", "Heat Wave", "Ancient Power", "Flame Dash"],
    abilities: ["Flash Fire", "Rough Skin"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "embrock(front).png", backSprite: "embrock(back).png",
    habitat: ["Ember Route"],
    evolvesInto: "magmolith", evolvesAt: 26,
  },


  magmolith: {
    id: "magmolith", name: "Magmolith",
    flavor: "The lava veins that were mere cracks on Embrock now run deep through every plate of its body. When it exhales, the air around it shimmers and rock underfoot begins to soften.",
    type: ["Rock", "Fire"],
    baseHp: 105, baseAtk: 118, baseDef: 102, baseSpd: 58,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.25,
    expYield: 250,
    moves: ["Rock Slide", "Flame Dash", "Stone Edge", "Heat Wave"],
    learnableMoves: ["Rock Slide", "Flame Dash", "Stone Edge", "Heat Wave", "Overheat", "Earthquake", "Seismic Crush", "Flare Blitz", "Crystal Slam", "Boulder Crash", "Blaze Tackle"],
    abilities: ["Flash Fire", "Rough Skin"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "magmolith(front).png", backSprite: "magmolith(back).png",
    habitat: [],
    evolvesFrom: "embrock",
  },


  mudbub: {
    id: "mudbub", name: "Mudbub",
    flavor: "A pudgy amphibian that practically lives submerged in riverbank mud. Its wide goofy grin fools predators into thinking it is harmless — right up until the floor gives out beneath them.",
    type: ["Ground", "Water"],
    baseHp: 70, baseAtk: 42, baseDef: 58, baseSpd: 32,
    rarity: "common", catchRate: 45,
    sizeScale: 0.7,
    expYield: 58,
    moves: ["Mud-Slap", "Water Pulse", "Tackle", "Sand Attack"],
    learnableMoves: ["Mud-Slap", "Water Pulse", "Tackle", "Sand Attack", "Mud Shot", "Scald", "Bulldoze", "Earthquake", "Aqua Blade"],
    abilities: ["Swift Swim", "Thick Fat"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "mudbub(front).png", backSprite: "mudbub(back).png",
    habitat: ["Route 1", "Tidal Route"],
    evolvesInto: "bogmaw", evolvesAt: 22,
  },


  bogmaw: {
    id: "bogmaw", name: "Bogmaw",
    flavor: "Its jaws can snap shut with enough force to crack stone. Moss and algae grow freely across its armoured hide — it sits so still in murky water that entire ecosystems mistake it for a rock.",
    type: ["Ground", "Water"],
    baseHp: 122, baseAtk: 95, baseDef: 92, baseSpd: 45,
    rarity: "rare", catchRate: 12,
    sizeScale: 1.25,
    expYield: 242,
    moves: ["Earthquake", "Scald", "Bulldoze", "Mud-Slap"],
    learnableMoves: ["Earthquake", "Scald", "Bulldoze", "Mud-Slap", "Aqua Blade", "Hydro Crush", "Sand Tomb", "Ocean Crash", "Tidal Slash", "Shore Up"],
    abilities: ["Swift Swim", "Thick Fat"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "bogmaw(front).png", backSprite: "bogmaw(back).png",
    habitat: [],
    evolvesFrom: "mudbub",
  },


  mufflo: {
    id: "mufflo", name: "Mufflo",
    flavor: "A round puffball of wool that wanders meadows with its chin raised. It looks proud but startles easily — one loud noise sends it tumbling into a fleece-covered ball.",
    type: ["Normal"],
    baseHp: 55, baseAtk: 40, baseDef: 50, baseSpd: 45,
    rarity: "common", catchRate: 45,
    sizeScale: 0.7,
    expYield: 55,
    moves: ["Tackle", "Growl", "Quick Attack", "Howl"],
    learnableMoves: ["Tackle", "Growl", "Quick Attack", "Howl", "Body Slam", "Protect"],
    abilities: ["Thick Fat", "Natural Cure"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "mufflo(front).png", backSprite: "mufflo(back).png",
    habitat: ["Route 1", "Route 2"],
    evolvesInto: "wooltug", evolvesAt: 18,
  },


  wooltug: {
    id: "wooltug", name: "Wooltug",
    flavor: "Its legs are short but it refuses to be pushed around. The brass bell on its neck rings when it lowers its head to charge, giving opponents just enough warning to regret standing there.",
    type: ["Normal"],
    baseHp: 75, baseAtk: 65, baseDef: 80, baseSpd: 48,
    rarity: "uncommon", catchRate: 25,
    sizeScale: 0.9,
    expYield: 135,
    moves: ["Tackle", "Howl", "Body Slam", "Slash"],
    learnableMoves: ["Tackle", "Howl", "Body Slam", "Slash", "Quick Attack", "Protect", "Endeavor", "Double Edge"],
    abilities: ["Intimidate", "Thick Fat"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "wooltug(front).png", backSprite: "wooltug(back).png",
    habitat: [],
    evolvesFrom: "mufflo", evolvesInto: "rambull", evolvesAt: 36,
  },


  rambull: {
    id: "rambull", name: "Rambull",
    flavor: "It stands upright on its hind legs and surveys the land like it owns every field in sight. A single headbutt from its coiled horns has been known to level fences, boulders, and the occasional overconfident trainer.",
    type: ["Normal"],
    baseHp: 110, baseAtk: 125, baseDef: 100, baseSpd: 65,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.25,
    expYield: 265,
    moves: ["Body Slam", "Howl", "Double Edge", "Hyper Beam"],
    learnableMoves: ["Body Slam", "Howl", "Double Edge", "Hyper Beam", "Slash", "Quick Attack", "Endeavor", "Protect", "Tackle"],
    abilities: ["Intimidate", "Rough Skin"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "rambull(front).png", backSprite: "rambull(back).png",
    habitat: [],
    evolvesFrom: "wooltug",
  },


  stormchick: {
    id: "stormchick", name: "Stormchick",
    flavor: "Its feathers haven't stopped standing on end since it hatched into a lightning storm.",
    type: ["Electric", "Flying"],
    baseHp: 42, baseAtk: 48, baseDef: 34, baseSpd: 72,
    rarity: "common", catchRate: 50, expYield: 58,
    sizeScale: 0.55,
    moves: ["Thunder Fang", "Wing Gust", "Quick Attack", "Growl"],
    learnableMoves: ["Thunder Fang", "Wing Gust", "Quick Attack", "Growl", "Thunder Claw", "Aerial Ace", "Volt Crash"],
    abilities: ["Lightning Rod", "Speed Boost"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "stormchick(front).png", backSprite: "stormchick(back).png",
    habitat: [], evolvesInto: "thundrix", evolvesAt: 21,
  },


  thundrix: {
    id: "thundrix", name: "Thundrix",
    flavor: "Grips a living lightning bolt in one talon as a weapon and a compass.",
    type: ["Electric", "Flying"],
    baseHp: 88, baseAtk: 112, baseDef: 78, baseSpd: 116,
    rarity: "rare", catchRate: 10, expYield: 234,
    sizeScale: 1.05,
    moves: ["Thunder Claw", "Sky Pierce", "Volt Crash", "Aerial Ace"],
    learnableMoves: ["Thunder Claw", "Sky Pierce", "Volt Crash", "Aerial Ace", "Wild Charge", "Discharge", "Wing Gust"],
    abilities: ["Lightning Rod", "Speed Boost"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "thundrix(front).png", backSprite: "thundrix(back).png",
    habitat: [], evolvesFrom: "stormchick",
  },


  scalewisp: {
    id: "scalewisp", name: "Scalewisp",
    flavor: "A wyvern hatchling whose wings are comically oversized for its stubby body.",
    type: ["Dragon", "Flying"],
    baseHp: 50, baseAtk: 58, baseDef: 44, baseSpd: 58,
    rarity: "common", catchRate: 45, expYield: 62,
    sizeScale: 0.62,
    moves: ["Dragon Rush", "Wing Gust", "Tackle", "Growl"],
    learnableMoves: ["Dragon Rush", "Wing Gust", "Tackle", "Growl", "Aerial Ace", "Dragon Breath", "Dragon Claw"],
    abilities: ["Speed Boost", "Intimidate"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "scalewisp(front).png", backSprite: "scalewisp(back).png",
    habitat: [], evolvesInto: "rexaloft", evolvesAt: 24,
  },


  rexaloft: {
    id: "rexaloft", name: "Rexaloft",
    flavor: "A sleek adult wyvern that shears stormclouds with emerald-plated wings.",
    type: ["Dragon", "Flying"],
    baseHp: 92, baseAtk: 115, baseDef: 88, baseSpd: 100,
    rarity: "rare", catchRate: 10, expYield: 238,
    sizeScale: 1.2,
    moves: ["Dragon Claw", "Aerial Ace", "Dragon Rush", "Sky Pierce"],
    learnableMoves: ["Dragon Claw", "Aerial Ace", "Dragon Rush", "Sky Pierce", "Draco Impact", "Dragon Breath", "Outrage"],
    abilities: ["Speed Boost", "Intimidate"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "rexaloft(front).png", backSprite: "rexaloft(back).png",
    habitat: [], evolvesFrom: "scalewisp",
  },


  tidalfang: {
    id: "tidalfang", name: "Tidalfang",
    flavor: "A sea dragon pup whose dorsal fin-sail catches deep currents like a rudder.",
    type: ["Dragon", "Water"],
    baseHp: 56, baseAtk: 62, baseDef: 50, baseSpd: 55,
    rarity: "common", catchRate: 42, expYield: 66,
    sizeScale: 0.7,
    moves: ["Bubble Beam", "Dragon Rush", "Bite", "Growl"],
    learnableMoves: ["Bubble Beam", "Dragon Rush", "Bite", "Growl", "Aqua Blade", "Dragon Breath", "Water Pulse"],
    abilities: ["Swift Swim", "Intimidate"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "tidalfang(front).png", backSprite: "tidalfang(back).png",
    habitat: [], evolvesInto: "abyssrake", evolvesAt: 26,
  },


  abyssrake: {
    id: "abyssrake", name: "Abyssrake",
    flavor: "A massive coiling sea serpent whose bioluminescent spots lure prey from the darkness.",
    type: ["Dragon", "Water"],
    baseHp: 108, baseAtk: 128, baseDef: 96, baseSpd: 88,
    rarity: "rare", catchRate: 8, expYield: 248,
    sizeScale: 1.35,
    moves: ["Aqua Blade", "Dragon Rush", "Crunch", "Hydro Crush"],
    learnableMoves: ["Aqua Blade", "Dragon Rush", "Crunch", "Hydro Crush", "Draco Impact", "Ocean Crash", "Dragon Claw"],
    abilities: ["Swift Swim", "Intimidate"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "abyssrake(front).png", backSprite: "abyssrake(back).png",
    habitat: [], evolvesFrom: "tidalfang",
  },


  glacifang: {
    id: "glacifang", name: "Glacifang",
    flavor: "A hatchling ice dragon whose crystal spines grow a new layer after every snowfall.",
    type: ["Dragon", "Ice"],
    baseHp: 48, baseAtk: 56, baseDef: 48, baseSpd: 52,
    rarity: "common", catchRate: 44, expYield: 60,
    sizeScale: 0.62,
    moves: ["Ice Shard", "Dragon Rush", "Bite", "Growl"],
    learnableMoves: ["Ice Shard", "Dragon Rush", "Bite", "Growl", "Frost Bite", "Dragon Breath", "Dragon Claw"],
    abilities: ["Thick Fat", "Speed Boost"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "glacifang(front).png", backSprite: "glacifang(back).png",
    habitat: [], evolvesInto: "blizzraak", evolvesAt: 25,
  },


  blizzraak: {
    id: "blizzraak", name: "Blizzraak",
    flavor: "Its hexagonal crystal armor can deflect both blades and blizzards without a scratch.",
    type: ["Dragon", "Ice"],
    baseHp: 104, baseAtk: 122, baseDef: 106, baseSpd: 82,
    rarity: "rare", catchRate: 9, expYield: 244,
    sizeScale: 1.25,
    moves: ["Glacier Crash", "Dragon Claw", "Blizzard", "Dragon Rush"],
    learnableMoves: ["Glacier Crash", "Dragon Claw", "Blizzard", "Dragon Rush", "Frozen Tempest", "Draco Impact", "Ice Shard"],
    abilities: ["Thick Fat", "Solid Rock"],
    role: SPECIES_ROLES.MIXED_DEFENDER,
    frontSprite: "blizzraak(front).png", backSprite: "blizzraak(back).png",
    habitat: [], evolvesFrom: "glacifang",
  },


  mossling: {
    id: "mossling", name: "Mossling",
    flavor: "A sleepy turtle hatchling whose shell is already sprouting a modest moss garden.",
    type: ["Water", "Grass"],
    baseHp: 60, baseAtk: 44, baseDef: 62, baseSpd: 38,
    rarity: "common", catchRate: 48, expYield: 58,
    sizeScale: 0.62,
    moves: ["Bubble Beam", "Vine Lash", "Tackle", "Growl"],
    learnableMoves: ["Bubble Beam", "Vine Lash", "Tackle", "Growl", "Nature Drain", "Water Pulse", "Synthesis"],
    abilities: ["Chlorophyll", "Water Absorb"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "mossling(front).png", backSprite: "mossling(back).png",
    habitat: [], evolvesInto: "verdatide", evolvesAt: 28,
  },


  verdatide: {
    id: "verdatide", name: "Verdatide",
    flavor: "An ancient turtle whose shell hosts a complete living ecosystem — grass, flowers and all.",
    type: ["Water", "Grass"],
    baseHp: 120, baseAtk: 88, baseDef: 128, baseSpd: 48,
    rarity: "rare", catchRate: 6, expYield: 242,
    sizeScale: 1.3,
    moves: ["Power Whip", "Hydro Crush", "Synthesis", "Nature Drain"],
    learnableMoves: ["Power Whip", "Hydro Crush", "Synthesis", "Nature Drain", "Earthquake", "Solar Absorb", "Leaf Blade"],
    abilities: ["Chlorophyll", "Water Absorb"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "verdatide(front).png", backSprite: "verdatide(back).png",
    habitat: [], evolvesFrom: "mossling",
  },


  slushpup: {
    id: "slushpup", name: "Slushpup",
    flavor: "An arctic pup whose crystal ears detect approaching storms days in advance.",
    type: ["Water", "Ice"],
    baseHp: 62, baseAtk: 48, baseDef: 54, baseSpd: 56,
    rarity: "common", catchRate: 46, expYield: 62,
    sizeScale: 0.7,
    moves: ["Ice Shard", "Bubble Beam", "Bite", "Growl"],
    learnableMoves: ["Ice Shard", "Bubble Beam", "Bite", "Growl", "Frost Bite", "Glacier Crash", "Water Pulse"],
    abilities: ["Thick Fat", "Swift Swim"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "slushpup(front).png", backSprite: "slushpup(back).png",
    habitat: [], evolvesInto: "frofloe", evolvesAt: 22,
  },


  frofloe: {
    id: "frofloe", name: "Frofloe",
    flavor: "Its spiked crystal mane makes a sound like cracking glaciers whenever it shakes its head.",
    type: ["Water", "Ice"],
    baseHp: 102, baseAtk: 96, baseDef: 108, baseSpd: 72,
    rarity: "rare", catchRate: 11, expYield: 218,
    sizeScale: 1.1,
    moves: ["Glacier Crash", "Aqua Blade", "Crunch", "Blizzard"],
    learnableMoves: ["Glacier Crash", "Aqua Blade", "Crunch", "Blizzard", "Frozen Tempest", "Ice Shard", "Hydro Crush"],
    abilities: ["Thick Fat", "Swift Swim"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "frofloe(front).png", backSprite: "frofloe(back).png",
    habitat: [], evolvesFrom: "slushpup",
  },


  glowtent: {
    id: "glowtent", name: "Glowtent",
    flavor: "Looks completely harmless. The pink glow luring you closer is the first mistake.",
    type: ["Water", "Poison"],
    baseHp: 48, baseAtk: 42, baseDef: 44, baseSpd: 60,
    rarity: "common", catchRate: 50, expYield: 56,
    sizeScale: 0.6,
    moves: ["Acid", "Bubble Beam", "String Shot", "Growl"],
    learnableMoves: ["Acid", "Bubble Beam", "String Shot", "Growl", "Venom Fang", "Water Pulse", "Cross Poison"],
    abilities: ["Poison Spores", "Swift Swim"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "glowtent(front).png", backSprite: "glowtent(back).png",
    habitat: [], evolvesInto: "toxiveil", evolvesAt: 24,
  },


  toxiveil: {
    id: "toxiveil", name: "Toxiveil",
    flavor: "The skull pattern on its bell glows brighter as it charges a toxic burst.",
    type: ["Water", "Poison"],
    baseHp: 90, baseAtk: 102, baseDef: 76, baseSpd: 94,
    rarity: "rare", catchRate: 12, expYield: 210,
    sizeScale: 0.95,
    moves: ["Sludge Bomb", "Hydro Crush", "Cross Poison", "Toxic Slam"],
    learnableMoves: ["Sludge Bomb", "Hydro Crush", "Cross Poison", "Toxic Slam", "Gunk Shot", "Ocean Crash", "Acid"],
    abilities: ["Poison Spores", "Swift Swim"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "toxiveil(front).png", backSprite: "toxiveil(back).png",
    habitat: [], evolvesFrom: "glowtent",
  },


  snapling: {
    id: "snapling", name: "Snapling",
    flavor: "Its flytrap head has a mind of its own and occasionally snaps at its own tail.",
    type: ["Grass", "Poison"],
    baseHp: 54, baseAtk: 58, baseDef: 46, baseSpd: 50,
    rarity: "common", catchRate: 44, expYield: 60,
    sizeScale: 0.65,
    moves: ["Vine Lash", "Acid", "Bite", "Growl"],
    learnableMoves: ["Vine Lash", "Acid", "Bite", "Growl", "Cross Poison", "Nature Drain", "Venom Fang"],
    abilities: ["Chlorophyll", "Poison Spores"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "snapling(front).png", backSprite: "snapling(back).png",
    habitat: [], evolvesInto: "venobulb", evolvesAt: 24,
  },


  venobulb: {
    id: "venobulb", name: "Venobulb",
    flavor: "Three separate flytrap maws that argue about which prey to dissolve first.",
    type: ["Grass", "Poison"],
    baseHp: 98, baseAtk: 106, baseDef: 88, baseSpd: 64,
    rarity: "rare", catchRate: 10, expYield: 220,
    sizeScale: 1.05,
    moves: ["Sludge Bomb", "Power Whip", "Cross Poison", "Nature Drain"],
    learnableMoves: ["Sludge Bomb", "Power Whip", "Cross Poison", "Nature Drain", "Gunk Shot", "Leaf Blade", "Toxic Slam"],
    abilities: ["Chlorophyll", "Poison Spores"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "venobulb(front).png", backSprite: "venobulb(back).png",
    habitat: [], evolvesFrom: "snapling",
  },


  seedrift: {
    id: "seedrift", name: "Seedrift",
    flavor: "Carried entirely by the wind. No one is sure if it chooses where it lands.",
    type: ["Grass", "Flying"],
    baseHp: 40, baseAtk: 36, baseDef: 32, baseSpd: 62,
    rarity: "common", catchRate: 52, expYield: 48,
    sizeScale: 0.5,
    moves: ["Wing Gust", "Nature Drain", "Tackle", "Growl"],
    learnableMoves: ["Wing Gust", "Nature Drain", "Tackle", "Growl", "Aerial Ace", "Leaf Blade", "Synthesis"],
    abilities: ["Chlorophyll", "Speed Boost"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "seedrift(front).png", backSprite: "seedrift(back).png",
    habitat: [], evolvesInto: "blossomsail", evolvesAt: 20,
  },


  blossomsail: {
    id: "blossomsail", name: "Blossomsail",
    flavor: "Its petal wings shed cherry blossoms that carry mild sleep spores.",
    type: ["Grass", "Flying"],
    baseHp: 78, baseAtk: 82, baseDef: 70, baseSpd: 102,
    rarity: "uncommon", catchRate: 18, expYield: 172,
    sizeScale: 0.85,
    moves: ["Leaf Blade", "Aerial Ace", "Sky Pierce", "Petal Blizzard"],
    learnableMoves: ["Leaf Blade", "Aerial Ace", "Sky Pierce", "Petal Blizzard", "Nature Drain", "Forest Fury", "Synthesis"],
    abilities: ["Chlorophyll", "Speed Boost"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "blossomsail(front).png", backSprite: "blossomsail(back).png",
    habitat: [], evolvesFrom: "seedrift",
  },


  coldplate: {
    id: "coldplate", name: "Coldplate",
    flavor: "A small golem of alternating ice panels and riveted steel — surprisingly warm to hug.",
    type: ["Ice", "Steel"],
    baseHp: 64, baseAtk: 52, baseDef: 80, baseSpd: 36,
    rarity: "common", catchRate: 40, expYield: 68,
    sizeScale: 0.75,
    moves: ["Iron Defense", "Ice Shard", "Steel Slash", "Tackle"],
    learnableMoves: ["Iron Defense", "Ice Shard", "Steel Slash", "Tackle", "Frost Bite", "Smart Strike", "Gyro Ball"],
    abilities: ["Thick Fat", "Solid Rock"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "coldplate(front).png", backSprite: "coldplate(back).png",
    habitat: [], evolvesInto: "glaciarm", evolvesAt: 28,
  },


  glaciarm: {
    id: "glaciarm", name: "Glaciarm",
    flavor: "Frost crystals grow from its joints overnight. It sheds them each morning like fingernails.",
    type: ["Ice", "Steel"],
    baseHp: 104, baseAtk: 94, baseDef: 132, baseSpd: 54,
    rarity: "rare", catchRate: 8, expYield: 224,
    sizeScale: 1.15,
    moves: ["Gyro Ball", "Glacier Crash", "Iron Defense", "Smart Strike"],
    learnableMoves: ["Gyro Ball", "Glacier Crash", "Iron Defense", "Smart Strike", "Frozen Tempest", "Metal Burst", "Blizzard"],
    abilities: ["Thick Fat", "Solid Rock"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "glaciarm(front).png", backSprite: "glaciarm(back).png",
    habitat: [], evolvesFrom: "coldplate",
  },


  wickling: {
    id: "wickling", name: "Wickling",
    flavor: "It chose a candle as its body. No one is sure which came first.",
    type: ["Ghost", "Fire"],
    baseHp: 44, baseAtk: 46, baseDef: 38, baseSpd: 66,
    rarity: "common", catchRate: 48, expYield: 58,
    sizeScale: 0.55,
    moves: ["Will-O-Wisp", "Lick", "Flame Dash", "Growl"],
    learnableMoves: ["Will-O-Wisp", "Lick", "Flame Dash", "Growl", "Shadow Sneak", "Fire Fang", "Hex"],
    abilities: ["Flame Body", "Levitate"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "wickling(front).png", backSprite: "wickling(back).png",
    habitat: [], evolvesInto: "ignispectre", evolvesAt: 23,
  },


  ignispectre: {
    id: "ignispectre", name: "Ignispectre",
    flavor: "Its ribcage glows like a lantern. Mortals mistake it for a lighthouse on foggy nights.",
    type: ["Ghost", "Fire"],
    baseHp: 88, baseAtk: 108, baseDef: 72, baseSpd: 100,
    rarity: "rare", catchRate: 11, expYield: 218,
    sizeScale: 1.05,
    moves: ["Shadow Ball", "Inferno Rush", "Will-O-Wisp", "Ghost Mist"],
    learnableMoves: ["Shadow Ball", "Inferno Rush", "Will-O-Wisp", "Ghost Mist", "Flare Blitz", "Shadow Strike", "Dark Fire"],
    abilities: ["Flame Body", "Levitate"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "ignispectre(front).png", backSprite: "ignispectre(back).png",
    habitat: [], evolvesFrom: "wickling",
  },


  dreambud: {
    id: "dreambud", name: "Dreambud",
    flavor: "It falls asleep mid-battle and keeps fighting through a shared dream.",
    type: ["Psychic", "Fairy"],
    baseHp: 52, baseAtk: 38, baseDef: 50, baseSpd: 64,
    rarity: "common", catchRate: 48, expYield: 60,
    sizeScale: 0.55,
    moves: ["Confusion", "Fairy Wind", "Calm Mind", "Growl"],
    learnableMoves: ["Confusion", "Fairy Wind", "Calm Mind", "Growl", "Dazzling Gleam", "Psych Wave", "Light Screen"],
    abilities: ["Levitate", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "dreambud(front).png", backSprite: "dreambud(back).png",
    habitat: [], evolvesInto: "starwhim", evolvesAt: 26,
  },


  starwhim: {
    id: "starwhim", name: "Starwhim",
    flavor: "Constellations drift inside its translucent body, rearranging themselves to predict the future.",
    type: ["Psychic", "Fairy"],
    baseHp: 96, baseAtk: 86, baseDef: 90, baseSpd: 108,
    rarity: "rare", catchRate: 10, expYield: 222,
    sizeScale: 0.95,
    moves: ["Moonblast", "Extrasensory", "Dazzling Gleam", "Future Sight"],
    learnableMoves: ["Moonblast", "Extrasensory", "Dazzling Gleam", "Future Sight", "Calm Mind", "Psych Wave", "Fairy Lock", "Heal Pulse"],
    abilities: ["Levitate", "Regenerator"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "starwhim(front).png", backSprite: "starwhim(back).png",
    habitat: [], evolvesFrom: "dreambud",
  },


  shardling: {
    id: "shardling", name: "Shardling",
    flavor: "Its faceted body refracts light into dazzling rainbow patches that blind attackers.",
    type: ["Steel", "Fairy"],
    baseHp: 56, baseAtk: 52, baseDef: 68, baseSpd: 48,
    rarity: "common", catchRate: 42, expYield: 64,
    sizeScale: 0.65,
    moves: ["Fairy Wind", "Steel Slash", "Dazzling Gleam", "Charm"],
    learnableMoves: ["Fairy Wind", "Steel Slash", "Dazzling Gleam", "Charm", "Smart Strike", "Flash Cannon", "Play Rough"],
    abilities: ["Competitive", "Iron Barbs"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "shardling(front).png", backSprite: "shardling(back).png",
    habitat: [], evolvesInto: "gemknight", evolvesAt: 27,
  },


  gemknight: {
    id: "gemknight", name: "Gemknight",
    flavor: "Its longsword splits light into blinding prismatic beams with every swing.",
    type: ["Steel", "Fairy"],
    baseHp: 98, baseAtk: 108, baseDef: 112, baseSpd: 76,
    rarity: "rare", catchRate: 9, expYield: 226,
    sizeScale: 1.15,
    moves: ["Flash Cannon", "Play Rough", "Smart Strike", "Dazzling Gleam"],
    learnableMoves: ["Flash Cannon", "Play Rough", "Smart Strike", "Dazzling Gleam", "Moonblast", "Metal Burst", "Six-Blade Storm"],
    abilities: ["Competitive", "Iron Barbs"],
    role: SPECIES_ROLES.MIXED_DEFENDER,
    frontSprite: "gemknight(front).png", backSprite: "gemknight(back).png",
    habitat: [], evolvesFrom: "shardling",
  },


  murkrat: {
    id: "murkrat", name: "Murkrat",
    flavor: "Its green drool is less a threat and more a calling card. You have already been pickpocketed.",
    type: ["Poison", "Dark"],
    baseHp: 50, baseAtk: 56, baseDef: 40, baseSpd: 68,
    rarity: "common", catchRate: 46, expYield: 62,
    sizeScale: 0.65,
    moves: ["Bite", "Acid", "Night Slash", "Growl"],
    learnableMoves: ["Bite", "Acid", "Night Slash", "Growl", "Sucker Punch", "Cross Poison", "Crunch"],
    abilities: ["Poison Spores", "Competitive"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "murkrat(front).png", backSprite: "murkrat(back).png",
    habitat: [], evolvesInto: "toxshade", evolvesAt: 24,
  },


  toxshade: {
    id: "toxshade", name: "Toxshade",
    flavor: "A plague-rat demon that shadow-steps between toxic clouds. Cities have gone dark overnight.",
    type: ["Poison", "Dark"],
    baseHp: 96, baseAtk: 112, baseDef: 74, baseSpd: 106,
    rarity: "rare", catchRate: 10, expYield: 222,
    sizeScale: 1.05,
    moves: ["Sludge Bomb", "Night Slash", "Crunch", "Dark Pulse"],
    learnableMoves: ["Sludge Bomb", "Night Slash", "Crunch", "Dark Pulse", "Gunk Shot", "Sucker Punch", "Toxic Slam", "Abyssal Roar"],
    abilities: ["Poison Spores", "Competitive"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "toxshade(front).png", backSprite: "toxshade(back).png",
    habitat: [], evolvesFrom: "murkrat",
  },


  pebfist: {
    id: "pebfist", name: "Pebfist",
    flavor: "It polishes its river-stone fists against canyon walls every morning at sunrise.",
    type: ["Fighting", "Ground"],
    baseHp: 66, baseAtk: 72, baseDef: 58, baseSpd: 54,
    rarity: "common", catchRate: 40, expYield: 72,
    sizeScale: 0.85,
    moves: ["Power Jab", "Mud-Slap", "Mach Punch", "Growl"],
    learnableMoves: ["Power Jab", "Mud-Slap", "Mach Punch", "Growl", "Bulldoze", "Rock Throw", "Body Slam"],
    abilities: ["Intimidate", "Rough Skin"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "pebfist(front).png", backSprite: "pebfist(back).png",
    habitat: [], evolvesInto: "geoboxer", evolvesAt: 24,
  },


  geoboxer: {
    id: "geoboxer", name: "Geoboxer",
    flavor: "Each punch compacts the ground so hard that geologists find its craters centuries later.",
    type: ["Fighting", "Ground"],
    baseHp: 114, baseAtk: 130, baseDef: 100, baseSpd: 72,
    rarity: "rare", catchRate: 8, expYield: 238,
    sizeScale: 1.25,
    moves: ["Champion Punch", "Earthquake", "Body Slam", "Rock Slide"],
    learnableMoves: ["Champion Punch", "Earthquake", "Body Slam", "Rock Slide", "Bulldoze", "Close Combat", "Seismic Crush", "Stone Edge"],
    abilities: ["Intimidate", "Rough Skin"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "geoboxer(front).png", backSprite: "geoboxer(back).png",
    habitat: [], evolvesFrom: "pebfist",
  },


  flampling: {
    id: "flampling", name: "Flampling",
    flavor: "A tiny fire-bird chick whose stub wings are already tipped with real flame.",
    type: ["Fire", "Flying"],
    baseHp: 44, baseAtk: 52, baseDef: 36, baseSpd: 68,
    rarity: "common", catchRate: 50, expYield: 55,
    sizeScale: 0.5,
    moves: ["Peck", "Flame Dash", "Wing Gust", "Growl"],
    learnableMoves: ["Peck", "Flame Dash", "Wing Gust", "Growl", "Aerial Ace", "Fire Fang", "Inferno Rush"],
    abilities: ["Flash Fire", "Speed Boost"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "flampling(front).png", backSprite: "flampling(back).png",
    habitat: [], evolvesInto: "solpyre", evolvesAt: 22,
  },


  solpyre: {
    id: "solpyre", name: "Solpyre",
    flavor: "A majestic phoenix whose sun-disc chest plate stores the heat of a thousand sunsets.",
    type: ["Fire", "Flying"],
    baseHp: 90, baseAtk: 110, baseDef: 75, baseSpd: 105,
    rarity: "rare", catchRate: 10, expYield: 230,
    sizeScale: 1.2,
    moves: ["Inferno Rush", "Aerial Ace", "Flare Blitz", "Sky Pierce"],
    learnableMoves: ["Inferno Rush", "Aerial Ace", "Flare Blitz", "Sky Pierce", "Solar Flare", "Flame Dash", "Blaze Tackle"],
    abilities: ["Flash Fire", "Speed Boost"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "solpyre(front).png", backSprite: "solpyre(back).png",
    habitat: [], evolvesFrom: "flampling",
  },


  resilian: {
    id: "resilian", name: "Resilian",
    flavor: "A tireless sky-runner that rides harsh winds for days without landing. Flocks of Resilian guide lost travelers back to safe roads.",
    type: ["Bug", "Flying"],
    baseHp: 65, baseAtk: 60, baseDef: 55, baseSpd: 95,
    rarity: "common", catchRate: 50,
    sizeScale: 0.7,
    expYield: 60,
    moves: ["Quick Attack", "Wing Gust", "String Shot", "Aerial Ace"],
    learnableMoves: ["Quick Attack", "Wing Gust", "String Shot", "Aerial Ace", "Sky Pierce", "Bug Bite"],
    abilities: ["Keen Eye", "Speed Boost"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "resilianfront.png",
    backSprite: "resilianback.png",
    habitat: ["Pallet Town", "Route 1", "Route 2"],
    evolvesInto: "resilith", evolvesAt: 21
  },


  resilith: {
    id: "resilith", name: "Resilith",
    flavor: "Its wings harden like polished shields when storms roll in. Resilith protects weaker Ewamon by circling overhead until danger passes.",
    type: ["Bug", "Flying"],
    baseHp: 85, baseAtk: 90, baseDef: 85, baseSpd: 75,
    rarity: "uncommon",
    catchRate: 30,
    sizeScale: 0.95,
    expYield: 145,
    moves: ["Quick Attack", "Wing Gust", "X-Scissor", "Aerial Ace"],
    learnableMoves: ["Quick Attack", "Wing Gust", "X-Scissor", "Aerial Ace", "Sky Pierce", "Signal Beam", "Megahorn"],
    abilities: ["Keen Eye", "Thick Fat"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "resilithfront.png",
    backSprite: "resilithback.png",
    habitat: [],
    evolvesFrom: "resilian", evolvesInto: "resilithorn", evolvesAt: 40,
  },


  resilithorn: {
    id: "resilithorn", name: "Resilithorn",
    flavor: "Having fully matured, Resilithorn no longer just carries the forest on its back; it dictates where the forest grows. Its armored hide is nearly impervious to physical damage, and the berries growing from its massive, branched antlers possess incredible restorative properties.",
    type: ["Grass", "Rock"],
    baseHp: 110, baseAtk: 120, baseDef: 130, baseSpd: 50,
    rarity: "epic",
    catchRate: 10,
    sizeScale: 1.3,
    expYield: 280,
    moves: ["Rock Slide", "Power Whip", "Megahorn", "Stone Edge"],
    learnableMoves: ["Rock Slide", "Power Whip", "Megahorn", "Stone Edge", "Earthquake", "Synthesis", "Forest's Wrath"],
    abilities: ["Solid Rock", "Natural Cure"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "resilithornfront.png",
    backSprite: "resilithornback.png",
    habitat: ["Safari Zone"],
    evolvesFrom: "resilith"
  },


  rimeidol: {
    id: "rimeidol", name: "Rimeidol",
    flavor: "This little shrine spirit shapes frost masks out of drifting mist and stares through them until they melt. Snow lines often trace symbols around wherever it slept.",
    type: ["Dark"],
    baseHp: 56, baseAtk: 42, baseDef: 58, baseSpd: 54,
    rarity: "uncommon", catchRate: 36,
    sizeScale: 0.65,
    expYield: 66,
    moves: ["Bite", "Ice Shard", "Growl", "Night Slash"],
    learnableMoves: ["Bite", "Ice Shard", "Growl", "Night Slash", "Sucker Punch", "Crunch", "Nasty Plot", "Dark Pulse"],
    abilities: ["Competitive", "Immunity"],
    role: SPECIES_ROLES.SPECIAL_DEFENDER,
    frontSprite: "rimeidol(front).png",
    backSprite: "rimeidol(back).png",
    habitat: ["Cerulean City", "Route 21"],
    evolvesInto: "murmink", evolvesAt: 23,
  },


  murmink: {
    id: "murmink", name: "Murmink",
    flavor: "It steals ribbons, rings, and gossip with equal delight, then hides in curtains to listen for the fallout. The purple gleam in its eyes widens whenever a secret lands well.",
    type: ["Dark", "Fairy"],
    baseHp: 60, baseAtk: 66, baseDef: 62, baseSpd: 82,
    rarity: "uncommon", catchRate: 38,
    sizeScale: 0.78,
    expYield: 108,
    moves: ["Bite", "Fairy Wind", "Quick Attack", "Charm"],
    learnableMoves: ["Bite", "Fairy Wind", "Quick Attack", "Charm", "Crunch", "Dazzling Gleam", "Sucker Punch", "Play Rough"],
    abilities: ["Competitive", "Immunity"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "murmink(front).png",
    backSprite: "murmink(back).png",
    habitat: ["Pallet Town", "Route 1"],
    evolvesFrom: "rimeidol", evolvesInto: "velvetomb", evolvesAt: 35,
  },


  velvetomb: {
    id: "velvetomb", name: "Velvetomb",
    flavor: "It glides through manor halls without stirring the dust, leaving only perfume and panic behind. By dawn every stolen secret in the house somehow belongs to it.",
    type: ["Dark", "Fairy"],
    baseHp: 86, baseAtk: 94, baseDef: 68, baseSpd: 114,
    rarity: "uncommon", catchRate: 14,
    sizeScale: 1,
    expYield: 176,
    moves: ["Crunch", "Dazzling Gleam", "Sucker Punch", "Play Rough"],
    learnableMoves: ["Bite", "Fairy Wind", "Quick Attack", "Charm", "Crunch", "Dazzling Gleam", "Sucker Punch", "Play Rough"],
    abilities: ["Competitive", "Immunity"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "velvetomb(front).png",
    backSprite: "velvetomb(back).png",
    habitat: [],
    evolvesFrom: "murmink",
  },


  darkone: {
    id: "darkone", name: "Darkone",
    flavor: "Born from electrical storms at midnight. Its crackling aura dims nearby lights.",
    type: ["Dark"],
    baseHp: 60, baseAtk: 75, baseDef: 45, baseSpd: 90,
    rarity: "uncommon", catchRate: 30,
    sizeScale: 0.75,
    expYield: 80,
    moves: ["Shadow Bolt", "Dark Pulse", "Thunder Fang", "Night Slash"],
    learnableMoves: ["Shadow Bolt", "Dark Pulse", "Thunder Fang", "Night Slash", "Volt Crash", "Dark Lasso"],
    abilities: ["Lightning Rod", "Competitive"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "darkonefront.png",
    backSprite: "darkoneback.png",
    habitat: ["Route 2", "Cerulean City", "Safari Zone"],
    evolvesAt: 20,
    // Split evolution: Lightning Rod → Aonred (legendary), Competitive → Darkyon
    splitEvolvesInto: [
      { condition: "ability", value: "Lightning Rod", into: "aonred" },
      { into: "darkyon" },
    ],
  },


  darkyon: {
    id: "darkyon", name: "Darkyon",
    flavor: "The evolved form of Darkone. It channels dark energy into searing flame. Few dare approach.",
    type: ["Dark", "Fire"],
    baseHp: 95, baseAtk: 90, baseDef: 70, baseSpd: 75,
    rarity: "rare", catchRate: 15,
    sizeScale: 1.1,
    expYield: 160,
    moves: ["Dark Fire", "Dark Pulse", "Inferno Shade", "Abyssal Roar"],
    learnableMoves: ["Dark Fire", "Dark Pulse", "Inferno Shade", "Abyssal Roar", "Flame Dash", "Shadow Strike"],
    abilities: ["Flash Fire", "Competitive"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "darkyonfront.png",
    backSprite: "darkyonback.png",
    habitat: ["Victory Road"],
    evolvesFrom: "darkone",
  },


  aonred: {
    id: "aonred", name: "Aonred",
    flavor: "Legend says its internal blue energy is a fragment of a dying star, and when it faces battle, its gaze illuminates the path toward victory for those it deems worthy.",
    type: ["Dark", "Fire"],
    baseHp: 108, baseAtk: 122, baseDef: 86, baseSpd: 104,
    rarity: "epic", catchRate: 4,
    sizeScale: 1.3,
    expYield: 260,
    moves: ["Dragon Fire", "Thunder Claw", "Mystic Blast", "Elemental Fury"],
    learnableMoves: ["Dragon Fire", "Thunder Claw", "Mystic Blast", "Elemental Fury", "Solar Flare", "Soul Burn"],
    abilities: ["Flash Fire", "Volt Absorb"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "aonredfront.png",
    backSprite: "aonredback.png",
    habitat: ["Victory Road"],
    evolvesFrom: "darkone",
  },


  nerohat: {
    id: "nerohat", name: "Nerohat",
    flavor: "A sinister trickster that hides poison beneath a suave hat. Never shake its hand.",
    type: ["Ghost", "Poison"],
    baseHp: 100, baseAtk: 70, baseDef: 90, baseSpd: 40,
    rarity: "uncommon", catchRate: 35,
    sizeScale: 0.95,
    expYield: 95,
    moves: ["Toxic Slam", "Shadow Strike", "Dark Lasso", "Poison Fog"],
    learnableMoves: ["Toxic Slam", "Shadow Strike", "Dark Lasso", "Poison Fog", "Venom Fang", "Shadow Ball"],
    abilities: ["Poison Spores", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_DEFENDER,
    frontSprite: "nerohatfront.png",
    backSprite: "nerohatback.png",
    habitat: ["Pallet Town", "Route 1"],
    evolvesInto: "fedoraith", evolvesAt: 22,
  },


  fedoraith: {
    id: "fedoraith", name: "Fedoraith",
    flavor: "A phantasmal specter that commands shadows with refined cruelty. Its mere presence turns the surrounding air toxic and cold.",
    type: ["Ghost", "Poison"],
    baseHp: 120, baseAtk: 85, baseDef: 110, baseSpd: 75,
    rarity: "rare", catchRate: 15,
    sizeScale: 1.2,
    expYield: 190,
    moves: ["Toxic Slam", "Shadow Strike", "Dark Lasso", "Poison Fog"],
    learnableMoves: ["Toxic Slam", "Shadow Strike", "Dark Lasso", "Poison Fog", "Venom Fang", "Shadow Ball"],
    abilities: ["Poison Spores", "Regenerator"],
    role: SPECIES_ROLES.MIXED_DEFENDER,
    frontSprite: "fedoraithfront.png",
    backSprite: "fedoraithback.png",
    habitat: [],
    evolvesFrom: "nerohat",
  },


  tidespine: {
    id: "tidespine", name: "Tidespine",
    flavor: "It wades through shallow riverbeds, using its sail to catch currents and speed along. Its rocky scales are smoothed by constant water flow.",
    type: ["Water", "Rock"],
    baseHp: 65, baseAtk: 75, baseDef: 60, baseSpd: 60,
    rarity: "uncommon", catchRate: 45,
    sizeScale: 0.95,
    expYield: 65,
    moves: ["Bubble Beam", "Bite", "Rock Throw", "Aqua Blade"],
    learnableMoves: ["Bubble Beam", "Bite", "Rock Throw", "Aqua Blade", "Water Pulse", "Mud-Slap", "Rock Slide"],
    abilities: ["Swift Swim", "Water Absorb"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "tidespinefront.png",
    backSprite: "tidespineback.png",
    habitat: ["Cerulean City", "Route 21"],
    evolvesInto: "tsunamite", evolvesAt: 30,
  },


  tsunamite: {
    id: "tsunamite", name: "Tsunamite",
    flavor: "A massive apex predator of the rivers. Its dorsal sail is as hard as bedrock, capable of splitting rushing rapids and small boats cleanly in two.",
    type: ["Water", "Rock"],
    baseHp: 105, baseAtk: 125, baseDef: 95, baseSpd: 85,
    rarity: "rare", catchRate: 15,
    sizeScale: 1.3,
    expYield: 210,
    moves: ["Aqua Blade", "Stone Edge", "Crunch", "Trident Surge"],
    learnableMoves: ["Bubble Beam", "Bite", "Rock Throw", "Aqua Blade", "Water Pulse", "Mud-Slap", "Rock Slide", "Stone Edge", "Crunch", "Trident Surge", "Ocean Crash", "Stealth Rock"],
    abilities: ["Swift Swim", "Intimidate"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "tsunamitefront.png",
    backSprite: "tsunamiteback.png",
    habitat: [],
    evolvesFrom: "tidespine",
  },


  fibrostis: {
    id: "fibrostis", name: "Fibrostis",
    flavor: "Its body is composed of tightly woven, fireproof mineral fibers. While it loves to be petted, trainers must wear heavy respiratory masks to avoid breathing in the hazardous dust it passively sheds.",
    type: ["Poison"],
    baseHp: 65, baseAtk: 50, baseDef: 90, baseSpd: 30,
    rarity: "uncommon", catchRate: 40,
    sizeScale: 0.78,
    expYield: 60,
    moves: ["Sand Attack", "Poison Fog", "Rock Throw", "Acid"],
    learnableMoves: ["Sand Attack", "Poison Fog", "Rock Throw", "Acid", "Stealth Rock", "Sludge Bomb", "Cross Poison"],
    abilities: ["Thick Fat", "Poison Spores"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "fibrostisfront.png",
    backSprite: "fibrostisback.png",
    habitat: ["Victory Road"],
    evolvesInto: "chrysotox", evolvesAt: 32,
  },


  chrysotox: {
    id: "chrysotox", name: "Chrysotox",
    flavor: "A towering golem of jagged, fibrous stone. It can wade through molten lava without taking a scratch, but the hazy cloud of microscopic toxic needles surrounding it makes it highly dangerous to approach unequipped.",
    type: ["Rock", "Poison"],
    baseHp: 95, baseAtk: 75, baseDef: 135, baseSpd: 40,
    rarity: "rare", catchRate: 15,
    sizeScale: 1.3,
    expYield: 185,
    moves: ["Sludge Bomb", "Stealth Rock", "Toxic Slam", "Stone Edge"],
    learnableMoves: ["Sand Attack", "Poison Fog", "Rock Throw", "Acid", "Stealth Rock", "Sludge Bomb", "Cross Poison", "Toxic Slam", "Stone Edge", "Gunk Shot", "Earthquake"],
    abilities: ["Thick Fat", "Poison Spores"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "chrysotoxfront.png",
    backSprite: "chrysotoxback.png",
    habitat: [],
    evolvesFrom: "fibrostis",
  },


  cindercap: {
    id: "cindercap", name: "Cindercap",
    flavor: "Warm cinders glow under the cap on its back. It darts through brushfires and leaves harmless sparks behind.",
    type: ["Fire"],
    baseHp: 56, baseAtk: 74, baseDef: 44, baseSpd: 70,
    rarity: "uncommon", catchRate: 30,
    sizeScale: 0.7,
    expYield: 74,
    moves: ["Flame Dash", "Tackle", "Will-O-Wisp", "Growl"],
    learnableMoves: ["Flame Dash", "Tackle", "Will-O-Wisp", "Growl", "Inferno Rush", "Fire Fang"],
    abilities: ["Flame Body", "Flash Fire"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "cindercap(front).png",
    backSprite: "cindercap(back).png",
    habitat: ["Route 2", "Safari Zone"],
    evolvesInto: "pyrecap", evolvesAt: 16,
  },


  pyrecap: {
    id: "pyrecap", name: "Pyrecap",
    flavor: "Smoke plumes vent from its shoulders as it circles prey and sears the ground with each step.",
    type: ["Fire"],
    baseHp: 74, baseAtk: 91, baseDef: 63, baseSpd: 86,
    rarity: "uncommon", catchRate: 24,
    sizeScale: 0.92,
    expYield: 132,
    moves: ["Flame Dash", "Fire Fang", "Will-O-Wisp", "Inferno Rush"],
    learnableMoves: ["Flame Dash", "Fire Fang", "Will-O-Wisp", "Inferno Rush", "Blaze Tackle", "Solar Flare"],
    abilities: ["Flame Body", "Flash Fire"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "pyrecap(front).png",
    backSprite: "pyrecap(back).png",
    habitat: [],
    evolvesFrom: "cindercap",
    evolvesInto: "infernomorel", evolvesAt: 34,
  },


  infernomorel: {
    id: "infernomorel", name: "Infernomorel",
    flavor: "Its blazing crown flares wide like a furnace canopy, and whole clearings shimmer in the heat around it.",
    type: ["Fire", "Dark"],
    baseHp: 98, baseAtk: 118, baseDef: 84, baseSpd: 102,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.2,
    expYield: 228,
    moves: ["Inferno Rush", "Blaze Tackle", "Solar Flare", "Will-O-Wisp"],
    learnableMoves: ["Inferno Rush", "Blaze Tackle", "Solar Flare", "Will-O-Wisp", "Dark Fire", "Flare Blitz"],
    abilities: ["Flame Body", "Flash Fire"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "infernomorel(front).png",
    backSprite: "infernomorel(back).png",
    habitat: [],
    evolvesFrom: "pyrecap",
  },


  glimfin: {
    id: "glimfin", name: "Glimfin",
    flavor: "It glides just under the lake surface, pulsing with a pale current that lures smaller Ewamon close.",
    type: ["Water", "Electric"],
    baseHp: 60, baseAtk: 52, baseDef: 50, baseSpd: 82,
    rarity: "uncommon", catchRate: 28,
    sizeScale: 0.72,
    expYield: 78,
    moves: ["Bubble Beam", "Thunder Claw", "Quick Attack", "Light Screen"],
    learnableMoves: ["Bubble Beam", "Thunder Claw", "Quick Attack", "Light Screen", "Aqua Blade", "Volt Crash"],
    abilities: ["Swift Swim", "Volt Absorb"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "glimfin(front).png",
    backSprite: "glimfin(back).png",
    habitat: ["Cerulean City", "Route 21"],
    evolvesInto: "voltide", evolvesAt: 18,
  },


  voltide: {
    id: "voltide", name: "Voltide",
    flavor: "Its lure burns brighter during storms, and it slices through lake currents with crackling fin-blades.",
    type: ["Water", "Electric"],
    baseHp: 78, baseAtk: 71, baseDef: 68, baseSpd: 99,
    rarity: "uncommon", catchRate: 22,
    sizeScale: 0.95,
    expYield: 138,
    moves: ["Bubble Beam", "Thunder Claw", "Aqua Blade", "Light Screen"],
    learnableMoves: ["Bubble Beam", "Thunder Claw", "Aqua Blade", "Light Screen", "Volt Crash", "Hydro Crush"],
    abilities: ["Swift Swim", "Volt Absorb"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "voltide(front).png",
    backSprite: "voltide(back).png",
    habitat: [],
    evolvesFrom: "glimfin",
    evolvesInto: "abysspark", evolvesAt: 35,
  },


  abysspark: {
    id: "abysspark", name: "Abysspark",
    flavor: "A deepwater predator wrapped in living lightning. Sailors say its lure is the last light seen before a squall.",
    type: ["Water", "Electric"],
    baseHp: 102, baseAtk: 92, baseDef: 84, baseSpd: 116,
    rarity: "rare", catchRate: 9,
    sizeScale: 1.25,
    expYield: 236,
    moves: ["Aqua Blade", "Thunder Claw", "Volt Crash", "Hydro Crush"],
    learnableMoves: ["Aqua Blade", "Thunder Claw", "Volt Crash", "Hydro Crush", "Ocean Crash", "Volt Dragon"],
    abilities: ["Swift Swim", "Volt Absorb"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "abysspark(front).png",
    backSprite: "abysspark(back).png",
    habitat: [],
    evolvesFrom: "voltide",
  },


  alloylark: {
    id: "alloylark", name: "Alloylark",
    flavor: "Its wings sing like sharpened chimes whenever it dives. Flocks gather where old metal ruins catch the wind.",
    type: ["Steel", "Flying"],
    baseHp: 74, baseAtk: 84, baseDef: 78, baseSpd: 72,
    rarity: "uncommon", catchRate: 24,
    sizeScale: 0.9,
    expYield: 118,
    moves: ["Peck", "Steel Slash", "Aerial Ace", "Iron Defense"],
    learnableMoves: ["Peck", "Steel Slash", "Aerial Ace", "Iron Defense", "Smart Strike", "Flash Cannon", "Sky Pierce"],
    abilities: ["Intimidate", "Lightning Rod"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "alloylark(front).png",
    backSprite: "alloylark(back).png",
    habitat: ["Route 1", "Victory Road"],
    evolvesInto: "rivetalon", evolvesAt: 36,
  },


  rivetalon: {
    id: "rivetalon", name: "Rivetalon",
    flavor: "It shears stormclouds apart with turbine wings and drops in silence before the first thunderclap lands. Ancient watchtowers were built to mirror its silhouette in iron.",
    type: ["Steel", "Flying"],
    baseHp: 102, baseAtk: 118, baseDef: 96, baseSpd: 104,
    rarity: "rare", catchRate: 9,
    sizeScale: 1.2,
    expYield: 232,
    moves: ["Steel Slash", "Aerial Ace", "Smart Strike", "Sky Pierce"],
    learnableMoves: ["Peck", "Steel Slash", "Aerial Ace", "Iron Defense", "Smart Strike", "Flash Cannon", "Sky Pierce"],
    abilities: ["Intimidate", "Lightning Rod"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "rivetalon(front).png",
    backSprite: "rivetalon(back).png",
    habitat: [],
    evolvesFrom: "alloylark",
  },


  hexroach: {
    id: "hexroach", name: "Hexroach",
    flavor: "It lurks under damp roots and ruin stones, glowing brighter as its venom sacs fill. Few trainers enjoy hearing the scratch of its legs at night.",
    type: ["Poison", "Bug"],
    baseHp: 68, baseAtk: 79, baseDef: 64, baseSpd: 66,
    rarity: "uncommon", catchRate: 28,
    sizeScale: 0.78,
    expYield: 96,
    moves: ["Acid", "Bug Bite", "String Shot", "Cross Poison"],
    learnableMoves: ["Acid", "Bug Bite", "String Shot", "Cross Poison", "Signal Beam", "X-Scissor", "Sludge Bomb"],
    abilities: ["Poison Spores", "Rough Skin"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "hexroach(front).png",
    backSprite: "hexroach(back).png",
    habitat: ["Route 2", "Safari Zone"],
    evolvesInto: "blighthex", evolvesAt: 35,
  },


  blighthex: {
    id: "blighthex", name: "Blighthex",
    flavor: "A plague-lord of collapsed ruins, it marks prey with glowing venom sigils before the swarm closes in. Old ward stones crack when too many gather beneath them.",
    type: ["Poison", "Bug"],
    baseHp: 98, baseAtk: 109, baseDef: 84, baseSpd: 96,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.15,
    expYield: 226,
    moves: ["Cross Poison", "X-Scissor", "Signal Beam", "Sludge Bomb"],
    learnableMoves: ["Acid", "Bug Bite", "Cross Poison", "Signal Beam", "X-Scissor", "Sludge Bomb", "String Shot"],
    abilities: ["Poison Spores", "Rough Skin"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "blighthex(front).png",
    backSprite: "blighthex(back).png",
    habitat: [],
    evolvesFrom: "hexroach",
  },


  scraphog: {
    id: "scraphog", name: "Scraphog",
    flavor: "It noses through ruined camps and hammers loose scrap into plates with its tusks. The stronger the metal taste in the dirt, the happier it gets.",
    type: ["Steel", "Ground"],
    baseHp: 72, baseAtk: 70, baseDef: 78, baseSpd: 38,
    rarity: "uncommon", catchRate: 34,
    sizeScale: 0.85,
    expYield: 72,
    moves: ["Mud-Slap", "Steel Slash", "Bite", "Iron Defense"],
    learnableMoves: ["Mud-Slap", "Steel Slash", "Bite", "Iron Defense", "Smart Strike", "Bulldoze", "Gyro Ball", "Earthquake"],
    abilities: ["Thick Fat", "Solid Rock"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "scraphog(front).png",
    backSprite: "scraphog(back).png",
    habitat: ["Safari Zone", "Victory Road"],
    evolvesInto: "trenchtusk", evolvesAt: 26,
  },


  trenchtusk: {
    id: "trenchtusk", name: "Trenchtusk",
    flavor: "It plows stone like wet soil and leaves plated furrows wherever it charges. Old fort engineers copied its layered armor pattern onto siege shields.",
    type: ["Steel", "Ground"],
    baseHp: 112, baseAtk: 104, baseDef: 122, baseSpd: 52,
    rarity: "rare", catchRate: 12,
    sizeScale: 1.25,
    expYield: 198,
    moves: ["Smart Strike", "Bulldoze", "Gyro Ball", "Earthquake"],
    learnableMoves: ["Mud-Slap", "Steel Slash", "Iron Defense", "Smart Strike", "Bulldoze", "Gyro Ball", "Earthquake"],
    abilities: ["Thick Fat", "Solid Rock"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "trenchtusk(front).png",
    backSprite: "trenchtusk(back).png",
    habitat: [],
    evolvesFrom: "scraphog",
  },


  coalette: {
    id: "coalette", name: "Coalette",
    flavor: "It tunnels under kiln roads and keeps embers tucked under its chin like stolen gems. Black soot circles mark where a family of them slept beneath warm stone.",
    type: ["Fire", "Ground"],
    baseHp: 62, baseAtk: 74, baseDef: 48, baseSpd: 58,
    rarity: "uncommon", catchRate: 34,
    sizeScale: 0.72,
    expYield: 70,
    moves: ["Flame Dash", "Mud Shot", "Bite", "Sand Attack"],
    learnableMoves: ["Flame Dash", "Mud Shot", "Bite", "Sand Attack", "Fire Fang", "Bulldoze", "Inferno Rush", "Blaze Tackle", "Earthquake"],
    abilities: ["Flash Fire", "Thick Fat"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "coalette(front).png",
    backSprite: "coalette(back).png",
    habitat: ["Safari Zone", "Victory Road"],
    evolvesInto: "caldermole", evolvesAt: 24,
  },


  caldermole: {
    id: "caldermole", name: "Caldermole",
    flavor: "Its back glows like a cracked furnace door and sprays molten dirt when it digs. Miners know to evacuate a shaft if the walls start breathing heat in its rhythm.",
    type: ["Fire", "Ground"],
    baseHp: 94, baseAtk: 112, baseDef: 72, baseSpd: 84,
    rarity: "rare", catchRate: 12,
    sizeScale: 1.05,
    expYield: 192,
    moves: ["Inferno Rush", "Fire Fang", "Bulldoze", "Earthquake"],
    learnableMoves: ["Flame Dash", "Mud Shot", "Fire Fang", "Bulldoze", "Inferno Rush", "Blaze Tackle", "Earthquake"],
    abilities: ["Flash Fire", "Thick Fat"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "caldermole(front).png",
    backSprite: "caldermole(back).png",
    habitat: [],
    evolvesFrom: "coalette",
  },


  ripshell: {
    id: "ripshell", name: "Ripshell",
    flavor: "Its shell rings like a struck bell when it plants its stance in fast water. River fighters used to train by trying to push one backward and learning they could not.",
    type: ["Water", "Fighting"],
    baseHp: 108, baseAtk: 108, baseDef: 94, baseSpd: 62,
    rarity: "uncommon", catchRate: 16,
    sizeScale: 1.1,
    expYield: 190,
    moves: ["Aqua Blade", "Close Combat", "Bulk Up", "Body Slam"],
    learnableMoves: ["Bubble Beam", "Low Kick", "Mach Punch", "Aqua Blade", "Bulk Up", "Body Slam", "Close Combat"],
    abilities: ["Swift Swim", "Intimidate"],
    role: SPECIES_ROLES.TANK,
    frontSprite: "ripshell(front).png",
    backSprite: "ripshell(back).png",
    habitat: ["Victory Road"],
  },


  bloomsprite: {
    id: "bloomsprite", name: "Bloomsprite",
    flavor: "A forest fairy that tends to sick plants by night and battles poachers by day.",
    type: ["Grass", "Fairy"],
    baseHp: 70, baseAtk: 62, baseDef: 66, baseSpd: 84,
    rarity: "uncommon", catchRate: 28, expYield: 148,
    sizeScale: 0.8,
    moves: ["Fairy Wind", "Vine Lash", "Dazzling Gleam", "Nature Drain"],
    learnableMoves: ["Fairy Wind", "Vine Lash", "Dazzling Gleam", "Nature Drain", "Moonblast", "Leaf Blade", "Synthesis", "Play Rough"],
    abilities: ["Chlorophyll", "Regenerator"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "bloomsprite(front).png", backSprite: "bloomsprite(back).png",
    habitat: [], evolvesInto: null, evolvesAt: null,
  },


  umbrit: {
    id: "umbrit", name: "Umbrit",
    flavor: "A small wandering shadow that drifts through walls without a sound. Locals mistake it for a child in a cloak — until they notice its feet never touch the ground.",
    type: ["Ghost", "Dark"],
    baseHp: 50, baseAtk: 60, baseDef: 38, baseSpd: 78,
    rarity: "uncommon", catchRate: 30,
    sizeScale: 0.68,
    expYield: 68,
    moves: ["Shadow Sneak", "Bite", "Hex", "Night Slash"],
    learnableMoves: ["Shadow Sneak", "Bite", "Hex", "Night Slash", "Shadow Ball", "Dark Pulse", "Sucker Punch", "Nasty Plot", "Crunch"],
    abilities: ["Levitate", "Intimidate"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "umbrit(front).png", backSprite: "umbrit(back).png",
    habitat: ["Phantom Route"],
    evolvesInto: "voidraith", evolvesAt: 28,
  },


  voidraith: {
    id: "voidraith", name: "Voidraith",
    flavor: "An ancient wraith that feeds on the memories of the living. The void-energy crackling at its fingertips can unravel a trained team's will to fight in a single touch.",
    type: ["Ghost", "Dark"],
    baseHp: 82, baseAtk: 105, baseDef: 68, baseSpd: 112,
    rarity: "epic", catchRate: 8,
    sizeScale: 1.1,
    expYield: 238,
    moves: ["Shadow Ball", "Dark Pulse", "Phantom Strike", "Nasty Plot"],
    learnableMoves: ["Shadow Ball", "Dark Pulse", "Phantom Strike", "Nasty Plot", "Night Slash", "Crunch", "Sucker Punch", "Hex", "Mystic Blast", "Poltergeist"],
    abilities: ["Levitate", "Wonder Guard"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "voidraith(front).png", backSprite: "voidraith(back).png",
    habitat: [],
    evolvesFrom: "umbrit",
  },


  acier: {
    id: "acier", name: "Acier",
    flavor: "Forged in ancient wars, Acier's blades never dull. It is said a single swing can cleave mountains. Infamous for its greed, this weapon is rumored to have claimed the blades of legends, having stolen Ichigo's Zangetsu and Asta's Demon-Slayer sword to fuel its own insatiable power.",
    type: ["Steel", "Fighting"],
    baseHp: 80, baseAtk: 95, baseDef: 110, baseSpd: 60,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.15,
    expYield: 180,
    moves: ["Steel Slash", "Iron Defense", "Six-Blade Storm", "Metal Burst"],
    learnableMoves: ["Steel Slash", "Iron Defense", "Six-Blade Storm", "Metal Burst", "Power Jab", "Champion Punch"],
    abilities: ["Intimidate", "Iron Barbs"],
    role: SPECIES_ROLES.PHYSICAL_DEFENDER,
    frontSprite: "acierfront.png",
    backSprite: "acierback.png",
    habitat: [],
    evolvesInto: null, evolvesAt: null,
  },


  miscarmen: {
    id: "miscarmen", name: "Miscarmen",
    flavor: "A ghost wreathed in violet fire. It dances alone at dusk, mourning something long forgotten.",
    type: ["Psychic"],
    baseHp: 88, baseAtk: 85, baseDef: 60, baseSpd: 80,
    rarity: "rare", catchRate: 12,
    sizeScale: 0.95,
    expYield: 170,
    moves: ["Ghost Flame", "Confusion", "Will-O-Wisp", "Psych Wave"],
    learnableMoves: ["Ghost Flame", "Confusion", "Will-O-Wisp", "Psych Wave", "Shadow Ball", "Mind Crush", "Brain Pulse"],
    abilities: ["Regenerator", "Levitate"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "miscarmenfront.png",
    backSprite: "miscarmenback.png",
    habitat: ["Pallet Town", "Route 21", "Cerulean City", "Safari Zone"],
    evolvesInto: "mismagmen", evolvesAt: 18,
  },


  mismagmen: {
    id: "mismagmen", name: "Mismagmen",
    flavor: "A psychic phantom that projects illusions. Its eyes can see into the minds of those who meet its gaze.",
    type: ["Ghost", "Psychic"],
    baseHp: 104, baseAtk: 100, baseDef: 82, baseSpd: 102,
    rarity: "rare", catchRate: 8,
    sizeScale: 1.1,
    expYield: 185,
    moves: ["Psych Wave", "Ghost Mist", "Mind Crush", "Hypno Fog"],
    learnableMoves: ["Psych Wave", "Ghost Mist", "Mind Crush", "Hypno Fog", "Shadow Ball", "Brain Pulse"],
    abilities: ["Regenerator", "Wonder Guard"],
    role: SPECIES_ROLES.SPECIAL_DEFENDER,
    frontSprite: "mismagmenfront.png",
    backSprite: "mismagmenback.png",
    habitat: [],
    evolvesFrom: "miscarmen",
  },


  moflame: {
    id: "moflame", name: "Moflame",
    flavor: "A wolf of living fire. It runs so fast its paws never touch the ground.",
    type: ["Fire"],
    baseHp: 90, baseAtk: 105, baseDef: 60, baseSpd: 100,
    rarity: "rare", catchRate: 10,
    sizeScale: 1.1,
    expYield: 175,
    moves: ["Flame Dash", "Fire Fang", "Inferno Rush", "Blaze Tackle"],
    learnableMoves: ["Flame Dash", "Fire Fang", "Inferno Rush", "Blaze Tackle", "Solar Flare", "Soul Burn"],
    abilities: ["Flash Fire", "Speed Boost"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "moflamefront.png",
    backSprite: "moflameback.png",
    habitat: ["Route 2", "Safari Zone", "Victory Road"],
    evolvesInto: "moblaze", evolvesAt: 26,
  },


  moblaze: {
    id: "moblaze", name: "Moblaze",
    flavor: "Its five tails burn with the intensity of a dying star. It moves with a grace that belies its massive power.",
    type: ["Fire"],
    baseHp: 110, baseAtk: 135, baseDef: 85, baseSpd: 120,
    rarity: "epic",
    catchRate: 5,
    sizeScale: 1.3,
    expYield: 270,
    moves: ["Flame Dash", "Inferno Rush", "Flare Blitz", "Dragon Rush"],
    learnableMoves: ["Flame Dash", "Inferno Rush", "Flare Blitz", "Dragon Rush", "Solar Flare", "Dragon Claw"],
    abilities: ["Flash Fire", "Speed Boost"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "moblazefront.png",
    backSprite: "moblazeback.png",
    habitat: [],
    evolvesFrom: "moflame",
  },


  yahit: {
    id: "yahit", name: "Yahit",
    flavor: "A disciplined street brawler that trains by punching stone posts at sunrise. It bows before every fight, no matter the opponent.",
    type: ["Fighting"],
    baseHp: 85, baseAtk: 95, baseDef: 70, baseSpd: 80,
    rarity: "rare", catchRate: 20,
    sizeScale: 1,
    expYield: 140,
    moves: ["Power Jab", "Iron Fist", "Champion Punch", "Quick Attack"],
    learnableMoves: ["Power Jab", "Iron Fist", "Champion Punch", "Quick Attack", "Body Slam"],
    abilities: ["Competitive", "Intimidate"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "yahitfront.png",
    backSprite: "yahitback.png",
    habitat: ["Route 2", "Victory Road"],
    evolvesInto: "yaschamp", evolvesAt: 20,
  },


  yaschamp: {
    id: "yaschamp", name: "Yaschamp",
    flavor: "Crowds gather the moment Yaschamp enters a ring. Its fists move so quickly that the air pops like firecrackers around them.",
    type: ["Fighting"],
    baseHp: 120, baseAtk: 135, baseDef: 95, baseSpd: 85,
    rarity: "epic", catchRate: 3,
    sizeScale: 1.2,
    expYield: 270,
    moves: ["Champion Punch", "Power Jab", "Iron Fist", "Knockout Blow"],
    learnableMoves: ["Champion Punch", "Power Jab", "Iron Fist", "Knockout Blow", "Body Slam"],
    abilities: ["Competitive", "Intimidate"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "yaschampfront.png",
    backSprite: "yaschampback.png",
    habitat: [],
    evolvesFrom: "yahit", evolvesInto: "yasprime", evolvesAt: 36,
  },


  yasprime: {
  id: "yasprime", name: "Yasprime",
  flavor: "The peak of fighting spirit made flesh. Legends say Yasprime can stop a charging beast with a single planted step.",
  type: ["Fighting"],
  baseHp: 125, baseAtk: 140, baseDef: 105, baseSpd: 85,
  rarity: "epic", catchRate: 3,
  sizeScale: 1.3,
  expYield: 285,
  moves: ["Prime Uppercut", "Body Slam", "Iron Fist", "Knockout Blow"],
  learnableMoves: ["Prime Uppercut", "Body Slam", "Iron Fist", "Knockout Blow"],
  abilities: ["Competitive", "Wonder Guard"],
  role: SPECIES_ROLES.PHYSICAL_ATTACKER,
  frontSprite: "yasprimefront.png",
  backSprite: "yasprimeback.png",
  habitat: [],
  evolvesFrom: "yaschamp",
},


  serpyre: {
    id: "serpyre", name: "Serpyre",
    flavor: "A young drake that sheds warm embers as it coils through the air. It is fascinated by bright lights and open flames.",
    type: ["Dragon"],
    baseHp: 80, baseAtk: 90, baseDef: 70, baseSpd: 85,
    rarity: "rare",
    catchRate: 15,
    sizeScale: 0.95,
    expYield: 160,
    moves: ["Dragon Rush", "Quick Attack", "Wing Gust", "Aerial Ace"],
    learnableMoves: ["Dragon Rush", "Quick Attack", "Wing Gust", "Aerial Ace", "Dragon Claw", "Dragon Breath"],
    abilities: ["Flash Fire", "Speed Boost"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "serpyrefront.png",
    backSprite: "serpyreback.png",
    habitat: ["Route 2", "Safari Zone", "Victory Road"],
    evolvesInto: "pyrothal", evolvesAt: 28,
  },


  pyrothal: {
    id: "pyrothal", name: "Pyrothal",
    flavor: "Its molten breath can turn cliffsides to glass. Pyrothal nests near volcano mouths where even hardened trainers fear to climb.",
    type: ["Fire", "Dragon"],
    baseHp: 112, baseAtk: 128, baseDef: 98, baseSpd: 92,
    rarity: "epic",
    catchRate: 8,
    sizeScale: 1.35,
    expYield: 260,
    moves: ["Inferno Rush", "Flame Dash", "Dragon Rush", "Blaze Tackle"],
    learnableMoves: ["Inferno Rush", "Flame Dash", "Dragon Rush", "Blaze Tackle", "Dragon Claw", "Dragon Breath"],
    abilities: ["Flash Fire", "Speed Boost"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "pyrothalfront.png",
    backSprite: "pyrothalback.png",
    habitat: [],
    evolvesFrom: "serpyre",
  },


  wraithtide: {
    id: "wraithtide", name: "Wraithtide",
    flavor: "A drowned phantom of the deep whose body dissolves into cold mist below the waist.",
    type: ["Water", "Ghost"],
    baseHp: 88, baseAtk: 92, baseDef: 70, baseSpd: 104,
    rarity: "rare", catchRate: 14, expYield: 198,
    sizeScale: 1.1,
    moves: ["Aqua Blade", "Shadow Strike", "Lick", "Hex"],
    learnableMoves: ["Aqua Blade", "Shadow Strike", "Lick", "Hex", "Shadow Ball", "Hydro Crush", "Night Slash", "Ghost Mist"],
    abilities: ["Levitate", "Water Absorb"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "wraithtide(front).png", backSprite: "wraithtide(back).png",
    habitat: [], evolvesInto: null, evolvesAt: null,
  },


  flowbot: {
    id: "flowbot", name: "Flowbot",
    flavor: "FlowBot is an AI-powered Ewamon that is the embodiment of Flowmatic, helping automate workflows and guide users through intelligent process orchestration.",
    type: ["Electric", "Steel"],
    baseHp: 90, baseAtk: 100, baseDef: 125, baseSpd: 90,
    rarity: "epic",
    catchRate: 5,
    sizeScale: 1.05,
    expYield: 265,
    moves: ["Volt Crash", "Steel Slash", "Iron Defense", "Thunder Claw"],
    learnableMoves: ["Volt Crash", "Steel Slash", "Iron Defense", "Thunder Claw", "Volt Dragon", "Six-Blade Storm"],
    abilities: ["Lightning Rod", "Regenerator"],
    role: SPECIES_ROLES.MIXED_DEFENDER,
    frontSprite: "flowbotfront.png",
    backSprite: "flowbotback.png",
    habitat: ["Route 1"],
  },


  kygra: {
    id: "kygra", name: "Kygra",
    flavor: "A steel-plated sea predator of immense speed. It can pierce armored hulls with ease.",
    type: ["Water"],
    baseHp: 95, baseAtk: 115, baseDef: 80, baseSpd: 115,
    rarity: "epic", catchRate: 5,
    sizeScale: 1.3,
    expYield: 250,
    moves: ["Aqua Blade", "Tidal Slash", "Trident Surge", "Steel Tide"],
    learnableMoves: ["Aqua Blade", "Tidal Slash", "Trident Surge", "Steel Tide", "Hydro Crush", "Ocean Crash"],
    abilities: ["Swift Swim", "Volt Absorb"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "kygrafront.png",
    backSprite: "kygraback.png",
    habitat: ["Cerulean City", "Safari Zone", "Victory Road", "Route 21"],
    evolvesInto: null, evolvesAt: null,
  },


  raidori: {
    id: "raidori", name: "Raidori",
    flavor: "A legendary bolt-serpent that flies at the speed of lightning. Only seen during storms.",
    type: ["Electric"],
    baseHp: 100, baseAtk: 120, baseDef: 105, baseSpd: 100,
    rarity: "epic", catchRate: 5,
    sizeScale: 1.4,
    expYield: 240,
    moves: ["Thunder Claw", "Lightning Mane", "Volt Dragon", "Dragon Rush"],
    learnableMoves: ["Thunder Claw", "Lightning Mane", "Volt Dragon", "Dragon Rush", "Volt Crash", "Draco Impact"],
    abilities: ["Lightning Rod", "Intimidate"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "raidorifront.png",
    backSprite: "raidoriback.png",
    habitat: ["Cerulean City", "Safari Zone", "Victory Road"],
  },


  // ── Pseudo-legendary line: Malice → Devourest → Necrogeist (Ghost/Fairy) ──
  // Slotted between Raidori and Glacinid — i.e. right before the legendary
  // block in dex order. Strong but NOT legendary: final-stage BST sits just
  // under the legendary tier.
  malice: {
    id: "malice", name: "Malice",
    flavor: "A sliver of spite that slipped free of a forgotten grudge. It drifts through haunted glades, nipping at any warmth it finds and giggling in a voice no one can quite place.",
    type: ["Ghost", "Fairy"],
    baseHp: 62, baseAtk: 58, baseDef: 60, baseSpd: 52,
    rarity: "rare", catchRate: 20,
    sizeScale: 0.6,
    expYield: 66,
    moves: ["Lick", "Fairy Wind", "Quick Attack", "Charm"],
    learnableMoves: ["Lick", "Fairy Wind", "Quick Attack", "Charm", "Ghost Mist", "Dazzling Gleam", "Shadow Sneak"],
    abilities: ["Levitate", "Natural Cure"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "malice(front).png",
    backSprite: "malice(back).png",
    habitat: [],
    evolvesInto: "devourest", evolvesAt: 30,
  },


  devourest: {
    id: "devourest", name: "Devourest",
    flavor: "Grown bold on a glut of stolen feelings, it wreathes itself in cold violet flame. The hush of a forest just before Devourest feeds is said to be the loudest silence there is.",
    type: ["Ghost", "Fairy"],
    baseHp: 88, baseAtk: 92, baseDef: 86, baseSpd: 74,
    rarity: "rare", catchRate: 10,
    sizeScale: 0.95,
    expYield: 154,
    moves: ["Shadow Ball", "Dazzling Gleam", "Ghost Mist", "Play Rough"],
    learnableMoves: ["Shadow Ball", "Dazzling Gleam", "Ghost Mist", "Play Rough", "Hex", "Moonblast", "Shadow Sneak", "Phantom Strike"],
    abilities: ["Levitate", "Competitive"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "devourest(front).png",
    backSprite: "devourest(back).png",
    habitat: [],
    evolvesFrom: "malice",
    evolvesInto: "necrogeist", evolvesAt: 50,
  },


  necrogeist: {
    id: "necrogeist", name: "Necrogeist",
    flavor: "The grudge made sovereign. Necrogeist crowns itself in spectral light and drags a silent court of lost spirits in its wake. Veteran trainers speak of it the way they speak of the legendaries — in a lowered voice.",
    type: ["Ghost", "Fairy"],
    baseHp: 118, baseAtk: 138, baseDef: 112, baseSpd: 102,
    rarity: "epic", catchRate: 5,
    sizeScale: 1.4,
    expYield: 280,
    moves: ["Phantom Strike", "Moonblast", "Poltergeist", "Play Rough"],
    learnableMoves: ["Phantom Strike", "Moonblast", "Poltergeist", "Play Rough", "Shadow Ball", "Dazzling Gleam", "Shadow Sneak", "Hex", "Ghost Flame"],
    abilities: ["Levitate", "Intimidate"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "necrogeist(front).png",
    backSprite: "necrogeist(back).png",
    habitat: [],
    evolvesFrom: "devourest",
  },


  glacinid: {
    id: "glacinid", name: "Glacinid",
    flavor: "This frostbound dragon leaves glittering ice trails in the clouds. Villages celebrate its appearance as a sign of a calm winter.",
    type: ["Ice", "Dragon"],
    baseHp: 128, baseAtk: 140, baseDef: 112, baseSpd: 124,
    rarity: "legendary",
    catchRate: 3,
    sizeScale: 1.45,
    expYield: 310,
    moves: ["Frost Bite", "Glacier Crash", "Dragon Rush", "Sky Pierce"],
    learnableMoves: ["Frost Bite", "Glacier Crash", "Dragon Rush", "Sky Pierce", "Frozen Tempest", "Draco Impact"],
    abilities: ["Thick Fat", "Competitive"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "glacinidfront.gif",
    backSprite: "glacinidback.gif",
    habitat: ["Cerulean City", "Safari Zone", "Victory Road", "Route 21"],
  },


  galaxion: {
    id: "galaxion", name: "Galaxion",
    flavor: "Said to have fallen from a burning star, Galaxion bends heat and thought together. Looking into its aura feels like staring into deep space.",
    type: ["Fire", "Psychic"],
    baseHp: 136, baseAtk: 132, baseDef: 110, baseSpd: 124,
    rarity: "legendary",
    catchRate: 2,
    sizeScale: 1.45,
    expYield: 320,
    moves: ["Cosmic Pyre", "Mind Crush", "Spectral Burn", "Shadow Ball"],
    learnableMoves: ["Cosmic Pyre", "Inferno Rush", "Mind Crush", "Spectral Burn", "Shadow Ball", "Solar Flare", "Brain Pulse"],
    abilities: ["Flash Fire", "Regenerator"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "galaxionfront.gif",
    backSprite: "galaxionback.gif",
    habitat: ["Cerulean City", "Victory Road", "Route 21"],
  },


  voltaura: {
    id: "voltaura", name: "Voltaura",
    flavor: "Legend says Voltaura was born from a lightning strike that hit a fallen star. It moves so quickly that it appears in multiple places at once, leaving a trail of shimmering fairy dust.",
    type: ["Electric", "Fairy"],
    baseHp: 112, baseAtk: 146, baseDef: 96, baseSpd: 150,
    rarity: "legendary", catchRate: 2,
    sizeScale: 1.2,
    expYield: 320,
    moves: ["Sparking Grace", "Thunder Claw", "Volt Crash", "Fairy Wind"],
    learnableMoves: ["Sparking Grace", "Thunder Claw", "Volt Crash", "Fairy Wind", "Dazzling Gleam", "Thunderbolt"],
    abilities: ["Lightning Rod", "Competitive"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "voltaura(front).gif",
    backSprite: "voltaura(back).gif",
    habitat: ["Victory Road"],
    evolvesInto: null, evolvesAt: null,
  },


  voidraxis: {
    id: "voidraxis", name: "Voidraxis",
    flavor: "It existed before the first sunrise — or perhaps it ate the star that should have been the first sunrise. Its passage through the sky leaves not a trail but an absence. No trainer has ever seen its face clearly and remembered it.",
    type: ["Cosmic", "Dragon"],
    baseHp: 125, baseAtk: 135, baseDef: 88, baseSpd: 192,
    rarity: "legendary", catchRate: 3,
    sizeScale: 1.5,
    expYield: 360,
    moves: ["Rift Collapse", "Eclipse Void", "Dragon Rush", "Draco Impact"],
    learnableMoves: ["Rift Collapse", "Eclipse Void", "Dragon Rush", "Draco Impact", "Starfall", "Dragon Claw", "Outrage", "Dragon Breath"],
    abilities: ["Void Sovereign", "Intimidate"],
    role: SPECIES_ROLES.SPEED,
    frontSprite: "voidraxis(front).png",
    backSprite: "voidraxis(back).png",
    habitat: [],
    evolvesInto: null, evolvesAt: null,
  },


  sunjaw: {
    id: "sunjaw", name: "Sunjaw",
    flavor: "A sun-crowned brawler said to laugh louder the harder the clash gets. Its burning fists stretch through the air like coiled comet chains.",
    type: ["Fire", "Fighting"],
    baseHp: 126, baseAtk: 152, baseDef: 108, baseSpd: 126,
    rarity: "legendary", catchRate: 3,
    sizeScale: 1.4,
    expYield: 320,
    moves: ["Sunbreaker Barrage", "Champion Punch", "Flare Blitz", "Mach Punch"],
    learnableMoves: ["Sunbreaker Barrage", "Champion Punch", "Flare Blitz", "Mach Punch", "Iron Fist", "Close Combat", "Blaze Tackle"],
    abilities: ["Intimidate", "Flame Body"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "sunjaw(front).png",
    backSprite: "sunjaw(back).png",
    habitat: [],
    evolvesInto: null, evolvesAt: null,
  },


  raikitsune: {
    id: "raikitsune", name: "Raikitsune",
    flavor: "Its nine thunder tails split storms into rings of blue fire. Old league stories say a single howl from it can light an entire route.",
    type: ["Electric", "Fire"],
    baseHp: 118, baseAtk: 140, baseDef: 100, baseSpd: 150,
    rarity: "legendary", catchRate: 3,
    sizeScale: 1.35,
    expYield: 320,
    moves: ["Foxfire Voltage", "Volt Crash", "Thunder Claw", "Flame Dash"],
    learnableMoves: ["Foxfire Voltage", "Volt Crash", "Thunder Claw", "Flame Dash", "Wild Charge", "Discharge", "Solar Flare"],
    abilities: ["Speed Boost", "Flash Fire"],
    role: SPECIES_ROLES.MIXED_ATTACKER,
    frontSprite: "raikitsune(front).png",
    backSprite: "raikitsune(back).png",
    habitat: [],
    evolvesInto: null, evolvesAt: null,
  },


  bankaiser: {
    id: "bankaiser", name: "Bankaiser",
    flavor: "A gravesteel emperor born from a sealed blade oath. The red line on its armor glows only when it draws power for a finishing cut.",
    type: ["Ghost", "Steel"],
    baseHp: 124, baseAtk: 152, baseDef: 116, baseSpd: 120,
    rarity: "legendary", catchRate: 3,
    sizeScale: 1.4,
    expYield: 320,
    moves: ["Bankai Sever", "Steel Slash", "Shadow Strike", "Shadow Sneak"],
    learnableMoves: ["Bankai Sever", "Steel Slash", "Shadow Strike", "Shadow Sneak", "Six-Blade Storm", "Night Slash", "Metal Burst"],
    abilities: ["Intimidate", "Rough Skin"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "bankaiser(front).png",
    backSprite: "bankaiser(back).png",
    habitat: [],
    evolvesInto: null, evolvesAt: null,
  },


  zenryu: {
    id: "zenryu", name: "Zenryu",
    flavor: "Its aura condenses into silver dragon rings before every strike. Champions regard it as a test of instinct more than power.",
    type: ["Dragon", "Fighting"],
    baseHp: 128, baseAtk: 148, baseDef: 112, baseSpd: 130,
    rarity: "legendary", catchRate: 3,
    sizeScale: 1.45,
    expYield: 340,
    moves: ["Celestial Burst", "Draco Impact", "Kamehameha", "Mach Punch"],
    learnableMoves: ["Celestial Burst", "Draco Impact", "Kamehameha", "Mach Punch", "Dragon Rush", "Champion Punch", "Outrage"],
    abilities: ["Speed Boost", "Competitive"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "zenryu(front).png",
    backSprite: "zenryu(back).png",
    habitat: [],
    evolvesInto: null, evolvesAt: null,
  },


  lumyth: {
    id: "lumyth", name: "Lumyth",
    flavor: "A mirage-like entity said to only appear once a century under a prismatic moon. It playfully bends reality to grant the desires of pure-hearted trainers, vanishing leaving only a trail of stardust.",
    type: ["Cosmic", "Psychic"],
    baseHp: 120, baseAtk: 120, baseDef: 120, baseSpd: 120,
    rarity: "mythical", catchRate: 1,
    sizeScale: 1.15,
    expYield: 350,
    moves: ["Cosmic Miracle", "Starfall", "Psych Wave", "Calm Mind"],
    learnableMoves: ["Fairy Wind", "Light Screen", "Dazzling Gleam", "Phantom Strike", "Calm Mind", "Heal Pulse", "Moonblast", "Cosmic Miracle", "Starfall", "Future Sight"],
    abilities: ["Wonder Guard", "Regenerator"],
    role: SPECIES_ROLES.SPECIAL_ATTACKER,
    frontSprite: "lumythfront.png",
    backSprite: "lumythback.png",
    habitat: ["Victory Road"],
    evolvesInto: null, evolvesAt: null,
  },


  noxmyth: {
    id: "noxmyth", name: "Noxmyth",
    flavor: "The dark sovereign of the eclipse. Where Lumyth creates starlight, Noxmyth absorbs it. Its armored wings act as event horizons, drawing in all surrounding energy until only silence remains.",
    type: ["Cosmic", "Dark"],
    baseHp: 120, baseAtk: 120, baseDef: 120, baseSpd: 120,
    rarity: "mythical", catchRate: 1,
    sizeScale: 1.35,
    expYield: 350,
    moves: ["Stellar Devour", "Eclipse Void", "Dark Pulse", "Nasty Plot"],
    learnableMoves: ["Stellar Devour", "Bite", "Crunch", "Shadow Ball", "Dark Pulse", "Nasty Plot", "Sucker Punch", "Phantom Strike", "Eclipse Void", "Starfall", "Abyssal Roar"],
    abilities: ["Intimidate", "Competitive"],
    role: SPECIES_ROLES.PHYSICAL_ATTACKER,
    frontSprite: "noxmythfront.png",
    backSprite: "noxmythback.png",
    habitat: ["Victory Road"],
    evolvesInto: null, evolvesAt: null,
  },


};

const MOVES = {

  // ─── NORMAL ─────────────────────────────────────
  "Growl":            { power: 0,   type: "Normal",   pp: 40, effect: "lower_atk", accuracy: 100 },
  "Peck":             { power: 35,  type: "Normal",   pp: 35, effect: null,        accuracy: 100 },
  "Quick Attack":     { power: 40,  type: "Normal",   pp: 30, effect: "first",     accuracy: 100 },
  "Resilient Strike": { power: 70,  type: "Normal",   pp: 20, effect: null,        accuracy: 100 },
  "Body Slam":        { power: 85,  type: "Normal",   pp: 15, effect: "paralyze",  accuracy: 100 },
  "Feather Dance":    { power: 0,   type: "Normal",   pp: 15, effect: "lower_atk", accuracy: 100 },
  "Tackle":           { power: 40,  type: "Normal",   pp: 35, effect: null,        accuracy: 100 },
  "Kamehameha":       { power: 150, type: "Normal",   pp: 5,  effect: null,        accuracy: 90 },

  // ─── FIGHTING ───────────────────────────────────
  "Power Jab":        { power: 80,  type: "Fighting", pp: 15, effect: null,        accuracy: 100 },
  "Iron Fist":        { power: 90,  type: "Fighting", pp: 10, effect: null,        accuracy: 100 },
  "Champion Punch":   { power: 100, type: "Fighting", pp: 10, effect: null,        accuracy: 100 },
  "Knockout Blow":    { power: 130, type: "Fighting", pp: 5,  effect: "flinch",    accuracy: 85 },
  "Prime Uppercut":   { power: 150, type: "Fighting", pp: 5,  effect: "flinch",    accuracy: 80 },
  "Sunbreaker Barrage": { power: 125, type: "Fighting", pp: 5, effect: "flinch",   accuracy: 90 },

  // ─── FLYING ─────────────────────────────────────
  "Wing Gust":        { power: 55,  type: "Flying",   pp: 25, effect: null,        accuracy: 100 },
  "Aerial Ace":       { power: 60,  type: "Flying",   pp: 20, effect: null,        accuracy: 100 },
  "Sky Pierce":       { power: 90,  type: "Flying",   pp: 10, effect: "crit",      accuracy: 95 },
  "Hurricane Wing":   { power: 110, type: "Flying",   pp: 5,  effect: "confuse",   accuracy: 80 },

  // ─── POISON ─────────────────────────────────────
  "Stink Cloud":      { power: 60,  type: "Poison",   pp: 20, effect: "poison",    accuracy: 85 },
  "Toxic Slam":       { power: 70,  type: "Poison",   pp: 20, effect: "poison",    accuracy: 85 },
  "Poison Fog":       { power: 0,   type: "Poison",   pp: 15, effect: "poison",    accuracy: 75 },
  "Venom Fang":       { power: 75,  type: "Poison",   pp: 15, effect: "poison",    accuracy: 95 },

  // ─── STEEL ──────────────────────────────────────
  "Steel Slash":      { power: 85,  type: "Steel",    pp: 20, effect: null,        accuracy: 100 },
  "Steel Tide":       { power: 90,  type: "Steel",    pp: 10, effect: null,        accuracy: 100 },
  "Metal Burst":      { power: 75,  type: "Steel",    pp: 10, effect: null,        accuracy: 100 },
  "Iron Defense":     { power: 0,   type: "Steel",    pp: 15, effect: "raise_def", accuracy: 100 },
  "Six-Blade Storm":  { power: 120, type: "Steel",    pp: 5,  effect: null,        accuracy: 90 },

  // ─── FIRE ───────────────────────────────────────
  "Fire Fang":        { power: 65,  type: "Fire",     pp: 15, effect: "burn",      accuracy: 95 },
  "Flame Dash":       { power: 90,  type: "Fire",     pp: 15, effect: null,        accuracy: 100 },
  "Blaze Tackle":     { power: 85,  type: "Fire",     pp: 10, effect: null,        accuracy: 100 },
  "Flare Blitz":      { power: 120, type: "Fire",     pp: 5,  effect: "recoil",    accuracy: 100 },
  "Dark Fire":        { power: 95,  type: "Fire",     pp: 10, effect: null,        accuracy: 95 },
  "Spectral Burn":    { power: 90,  type: "Fire",     pp: 10, effect: null,        accuracy: 100 },
  "Inferno Rush":     { power: 110, type: "Fire",     pp: 5,  effect: null,        accuracy: 85 },
  "Inferno Shade":    { power: 110, type: "Fire",     pp: 5,  effect: null,        accuracy: 85 },
  "Will-O-Wisp":      { power: 0,   type: "Fire",     pp: 15, effect: "burn",      accuracy: 85 },
  "Soul Burn":        { power: 100, type: "Fire",     pp: 10, effect: "burn",      accuracy: 90 },
  "Solar Flare":      { power: 120, type: "Fire",     pp: 5,  effect: null,        accuracy: 85 },
  "Cosmic Pyre":      { power: 130, type: "Fire",     pp: 5,  effect: "burn",      accuracy: 90 },
  "Foxfire Voltage":  { power: 125, type: "Electric", pp: 5, effect: "paralyze",   accuracy: 90 },

  // ─── WATER ──────────────────────────────────────
  "Aqua Blade":       { power: 95,  type: "Water",    pp: 15, effect: null,        accuracy: 100 },
  "Tidal Slash":      { power: 85,  type: "Water",    pp: 15, effect: null,        accuracy: 100 },
  "Trident Surge":    { power: 110, type: "Water",    pp: 5,  effect: null,        accuracy: 90 },
  "Ocean Crash":      { power: 100, type: "Water",    pp: 10, effect: "lower_def", accuracy: 95 },
  "Hydro Crush":      { power: 105, type: "Water",    pp: 10, effect: null,        accuracy: 95 },

  // ─── GRASS ──────────────────────────────────────
  "Leaf Blade":       { power: 90,  type: "Grass",    pp: 15, effect: null,        accuracy: 100 },
  "Vine Lash":        { power: 70,  type: "Grass",    pp: 20, effect: null,        accuracy: 100 },
  "Vine Whip":        { power: 45,  type: "Grass",    pp: 25, effect: null,        accuracy: 100 },
  "Nature Drain":     { power: 60,  type: "Grass",    pp: 20, effect: "drain",     accuracy: 100 },
  "Forest Fury":      { power: 100, type: "Grass",    pp: 10, effect: null,        accuracy: 90 },
  "Petal Blizzard":   { power: 110, type: "Grass",    pp: 5,  effect: null,        accuracy: 90 },
  "Solar Beam":       { power: 120, type: "Grass",    pp: 5,  effect: null,        accuracy: 100 },
  "Solar Absorb":     { power: 0,   type: "Grass",    pp: 15, effect: "heal",      accuracy: 100 },
  "Sunny Day":        { power: 0,   type: "Grass",    pp: 10, effect: "sun",       accuracy: 100 },
  "Wood Hammer":      { power: 120, type: "Grass",    pp: 10, effect: "recoil",    accuracy: 100 },
  "Power Whip":       { power: 120, type: "Grass",    pp: 10, effect: null,        accuracy: 85 },
  "Synthesis":        { power: 0,   type: "Grass",    pp: 5,  effect: "heal",      accuracy: 100 },
  "Forest's Wrath":   { power: 130, type: "Grass",    pp: 5,  effect: "lower_spd", accuracy: 90 },

  // ─── ELECTRIC ───────────────────────────────────
  "Thunder Fang":     { power: 65,  type: "Electric", pp: 15, effect: "paralyze",  accuracy: 95 },
  "Lightning Mane":   { power: 75,  type: "Electric", pp: 15, effect: null,        accuracy: 100 },
  "Thunder Claw":     { power: 90,  type: "Electric", pp: 15, effect: "paralyze",  accuracy: 90 },
  "Volt Crash":       { power: 105, type: "Electric", pp: 10, effect: "paralyze",  accuracy: 90 },
  "Sparking Grace":   { power: 125, type: "Electric", pp: 5, effect: "crit", accuracy: 100 },

  // ─── ICE ────────────────────────────────────────
  "Frost Bite":       { power: 65,  type: "Ice",      pp: 20, effect: "freeze",    accuracy: 95 },
  "Ice Shard":        { power: 40,  type: "Ice",      pp: 30, effect: "first",     accuracy: 100 },
  "Glacier Crash":    { power: 95,  type: "Ice",      pp: 10, effect: null,        accuracy: 90 },
  "Frozen Tempest":   { power: 125, type: "Ice",      pp: 5,  effect: "freeze",    accuracy: 90 },
  "Arctic Veil":      { power: 0,   type: "Ice",      pp: 15, effect: "raise_def", accuracy: 100 },

  // ─── ROCK ───────────────────────────────────────
  "Crystal Slam":     { power: 100, type: "Rock",     pp: 10, effect: null,        accuracy: 95 },
  "Seismic Crush":    { power: 120, type: "Rock",     pp: 5,  effect: "flinch",    accuracy: 85 },
  "Gem Storm":        { power: 85,  type: "Rock",     pp: 10, effect: null,        accuracy: 100 },
  "Stone Spike":      { power: 70,  type: "Rock",     pp: 20, effect: null,        accuracy: 100 },
  "Boulder Crash":    { power: 110, type: "Rock",     pp: 5,  effect: null,        accuracy: 90 },
  "Ancient Power":    { power: 80,  type: "Rock",     pp: 10, effect: "raise_all", accuracy: 90 },
  "Rock Throw":       { power: 50,  type: "Rock",     pp: 20, effect: null,        accuracy: 90 },
  "Rock Slide":       { power: 75,  type: "Rock",     pp: 10, effect: "flinch",    accuracy: 90 },
  "Stone Edge":       { power: 100, type: "Rock",     pp: 5,  effect: "crit",      accuracy: 80 },

  // ─── GROUND ─────────────────────────────────────
  "Sand Attack":      { power: 0,   type: "Ground",   pp: 15, effect: "lower_def", accuracy: 100 },
  "Mud-Slap":         { power: 55,  type: "Ground",   pp: 20, effect: "lower_def", accuracy: 95 },
  "Sand Tomb":        { power: 70,  type: "Ground",   pp: 15, effect: "trap",      accuracy: 85 },
  "Earthquake":       { power: 100, type: "Ground",   pp: 10, effect: null,        accuracy: 100 },
  "Sandstorm":        { power: 0,   type: "Ground",   pp: 10, effect: "weather",   accuracy: 100 },
  "Citrus Toss":      { power: 80,  type: "Ground",   pp: 15, effect: null,        accuracy: 100 },
  "Zest Blast":       { power: 110, type: "Ground",   pp: 5,  effect: "lower_def", accuracy: 90 },

  // ─── PSYCHIC ────────────────────────────────────
  "Light Screen":     { power: 0,   type: "Psychic",  pp: 30, effect: "raise_def", accuracy: 100 },
  "Calm Mind":        { power: 0,   type: "Psychic",  pp: 20, effect: "raise_def", accuracy: 100 },
  "Psych Wave":       { power: 70,  type: "Psychic",  pp: 20, effect: null,        accuracy: 100 },
  "Mind Crush":       { power: 85,  type: "Psychic",  pp: 10, effect: null,        accuracy: 95 },
  "Hypno Fog":        { power: 0,   type: "Psychic",  pp: 20, effect: "sleep",     accuracy: 55 },
  "Brain Pulse":      { power: 95,  type: "Psychic",  pp: 10, effect: "confuse",   accuracy: 90 },

  // ─── GHOST ──────────────────────────────────────
  "Ghost Mist":       { power: 65,  type: "Ghost",    pp: 20, effect: "confuse",   accuracy: 100 },
  "Shadow Ball":      { power: 80,  type: "Ghost",    pp: 15, effect: "lower_def", accuracy: 100 },
  "Ghost Flame":      { power: 80,  type: "Ghost",    pp: 15, effect: "burn",      accuracy: 85 },
  "Phantom Strike":   { power: 90,  type: "Ghost",    pp: 10, effect: null,        accuracy: 100 },
  "Bankai Sever":     { power: 125, type: "Steel",    pp: 5, effect: "crit",       accuracy: 95 },

  // ─── DARK ───────────────────────────────────────
  "Shadow Bolt":      { power: 65,  type: "Dark",     pp: 20, effect: null,        accuracy: 100 },
  "Night Slash":      { power: 70,  type: "Dark",     pp: 15, effect: "crit",      accuracy: 100 },
  "Shadow Strike":    { power: 75,  type: "Dark",     pp: 15, effect: null,        accuracy: 100 },
  "Dark Pulse":       { power: 80,  type: "Dark",     pp: 15, effect: "flinch",    accuracy: 100 },
  "Dark Lasso":       { power: 60,  type: "Dark",     pp: 20, effect: "trap",      accuracy: 90 },
  "Abyssal Roar":     { power: 0,   type: "Dark",     pp: 10, effect: "lower_def", accuracy: 100 },
  // Aonred signature moves
  "Dragon Fire":      { power: 110, type: "Fire",     pp: 10, effect: "burn",      accuracy: 90 },
  "Mystic Blast":     { power: 90,  type: "Dark",     pp: 10, effect: "confuse",   accuracy: 90 },
  "Elemental Fury":   { power: 135, type: "Fire",     pp: 5,  effect: null,        accuracy: 80 },

  // ─── DRAGON ─────────────────────────────────────
  "Dragon Rush":      { power: 100, type: "Dragon",   pp: 10, effect: "flinch",    accuracy: 75 },
  "Volt Dragon":      { power: 120, type: "Dragon",   pp: 5,  effect: null,        accuracy: 90 },
  "Draco Impact":     { power: 110, type: "Dragon",   pp: 5,  effect: "lower_atk", accuracy: 90 },
  "Dragon Burst":     { power: 95,  type: "Dragon",   pp: 10, effect: null,        accuracy: 100 },
  "Dragon Breath":    { power: 60,  type: "Dragon",   pp: 20, effect: "paralyze",  accuracy: 100 },
  "Dragon Claw":      { power: 85,  type: "Dragon",   pp: 15, effect: null,        accuracy: 100 },
  "Celestial Burst":  { power: 135, type: "Dragon",   pp: 5,  effect: null,        accuracy: 90 },

  // ─── FAIRY ──────────────────────────────────────
  "Thunderbolt":      { power: 90,  type: "Electric", pp: 15, effect: "paralyze",  accuracy: 100 },
  "Fairy Wind": { power: 40, type: "Fairy", pp: 30, effect: null, accuracy: 100 },
  "Fairy Lock":       { power: 0,   type: "Fairy",    pp: 10, effect: "trap",      accuracy: 100 },
  "Dazzling Gleam": { power: 80, type: "Fairy", pp: 15, effect: null, accuracy: 100 },
  "Moonblast": { power: 95, type: "Fairy", pp: 10, effect: "lower_spAtk", accuracy: 100 },

  // ─── BUG ────────────────────────────────────────
  "Bug Bite":     { power: 60,  type: "Bug", pp: 20, effect: null, accuracy: 100 },
  "String Shot":  { power: 0,   type: "Bug", pp: 40, effect: "lower_spd", accuracy: 95 },
  "Signal Beam":  { power: 75,  type: "Bug", pp: 15, effect: "confuse", accuracy: 100 },
  "X-Scissor":    { power: 80,  type: "Bug", pp: 15, effect: null, accuracy: 100 },
  "Silver Wind":  { power: 60,  type: "Bug", pp: 5,  effect: "raise_all", accuracy: 100 },
  "Megahorn":     { power: 120, type: "Bug", pp: 10, effect: null, accuracy: 85 },

  // ─── WATER (expanded) ───────────────────────────
  "Bubble Beam":  { power: 65,  type: "Water",  pp: 20, effect: "lower_spd", accuracy: 100 },
  "Water Pulse":  { power: 60,  type: "Water",  pp: 20, effect: "confuse",   accuracy: 100 },
  "Scald":        { power: 80,  type: "Water",  pp: 15, effect: "burn",      accuracy: 100 },
  "Whirlpool":    { power: 35,  type: "Water",  pp: 15, effect: "trap",      accuracy: 85  },
  "Dive":         { power: 80,  type: "Water",  pp: 10, effect: null,        accuracy: 100 },
  "Soak":         { power: 0,   type: "Water",  pp: 20, effect: "lower_def", accuracy: 100 },

  // ─── FIRE (expanded) ────────────────────────────
  "Ember":        { power: 40,  type: "Fire",   pp: 25, effect: "burn",      accuracy: 100 },
  "Heat Wave":    { power: 95,  type: "Fire",   pp: 10, effect: "burn",      accuracy: 90  },
  "Overheat":     { power: 130, type: "Fire",   pp: 5,  effect: "lower_atk", accuracy: 90  },

  // ─── ELECTRIC (expanded) ────────────────────────
  "Spark":        { power: 65,  type: "Electric", pp: 20, effect: "paralyze", accuracy: 100 },
  "Charge Beam":  { power: 50,  type: "Electric", pp: 10, effect: "raise_atk", accuracy: 90 },
  "Discharge":    { power: 80,  type: "Electric", pp: 15, effect: "paralyze", accuracy: 100 },
  "Wild Charge":  { power: 90,  type: "Electric", pp: 15, effect: "recoil",   accuracy: 100 },

  // ─── GRASS (already large, minor additions) ─────
  "Giga Drain":   { power: 75,  type: "Grass",  pp: 10, effect: "drain",     accuracy: 100 },
  "Energy Ball":  { power: 90,  type: "Grass",  pp: 10, effect: "lower_def", accuracy: 100 },

  // ─── ICE (expanded) ─────────────────────────────
  "Powder Snow":  { power: 40,  type: "Ice",    pp: 25, effect: "freeze",    accuracy: 100 },
  "Blizzard":     { power: 110, type: "Ice",    pp: 5,  effect: "freeze",    accuracy: 70  },
  "Ice Beam":     { power: 90,  type: "Ice",    pp: 10, effect: "freeze",    accuracy: 100 },
  "Hail":         { power: 0,   type: "Ice",    pp: 10, effect: "weather",   accuracy: 100 },

  // ─── PSYCHIC (expanded) ─────────────────────────
  "Confusion":    { power: 50,  type: "Psychic", pp: 25, effect: "confuse",  accuracy: 100 },
  "Future Sight": { power: 120, type: "Psychic", pp: 10, effect: null,       accuracy: 100 },
  "Heal Pulse":   { power: 0,   type: "Psychic", pp: 10, effect: "heal",     accuracy: 100 },
  "Extrasensory": { power: 80,  type: "Psychic", pp: 20, effect: "flinch",   accuracy: 100 },

  // ─── GHOST (expanded) ───────────────────────────
  "Hex":          { power: 65,  type: "Ghost",  pp: 10, effect: null,        accuracy: 100 },
  "Poltergeist":  { power: 110, type: "Ghost",  pp: 5,  effect: null,        accuracy: 90  },
  "Shadow Sneak": { power: 40,  type: "Ghost",  pp: 30, effect: "first",     accuracy: 100 },
  "Lick":         { power: 30,  type: "Ghost",  pp: 30, effect: "paralyze",  accuracy: 100 },

  // ─── DARK (expanded) ────────────────────────────
  "Bite":         { power: 60,  type: "Dark",   pp: 25, effect: "flinch",    accuracy: 100 },
  "Crunch":       { power: 80,  type: "Dark",   pp: 15, effect: "lower_def", accuracy: 100 },
  "Snarl":        { power: 55,  type: "Dark",   pp: 15, effect: "lower_atk", accuracy: 95  },
  "Nasty Plot":   { power: 0,   type: "Dark",   pp: 20, effect: "raise_atk", accuracy: 100 },
  "Sucker Punch": { power: 70,  type: "Dark",   pp: 5,  effect: "first",     accuracy: 100 },

  // ─── FIGHTING (expanded) ────────────────────────
  "Mach Punch":   { power: 40,  type: "Fighting", pp: 30, effect: "first",   accuracy: 100 },
  "Close Combat": { power: 120, type: "Fighting", pp: 5,  effect: "lower_def", accuracy: 100 },
  "Low Kick":     { power: 60,  type: "Fighting", pp: 20, effect: null,      accuracy: 100 },
  "Bulk Up":      { power: 0,   type: "Fighting", pp: 20, effect: "raise_def", accuracy: 100 },
  "Counter":      { power: 60,  type: "Fighting", pp: 20, effect: null,      accuracy: 100 },

  // ─── STEEL (expanded) ───────────────────────────
  "Flash Cannon": { power: 80,  type: "Steel",  pp: 10, effect: "lower_def", accuracy: 100 },
  "Smart Strike": { power: 70,  type: "Steel",  pp: 10, effect: null,        accuracy: 100 },
  "Gyro Ball":    { power: 80,  type: "Steel",  pp: 5,  effect: null,        accuracy: 100 },
  "Autotomize":   { power: 0,   type: "Steel",  pp: 15, effect: "raise_spd", accuracy: 100 },

  // ─── ROCK (expanded) ────────────────────────────
  "Stealth Rock": { power: 0,   type: "Rock",   pp: 20, effect: "lower_def", accuracy: 100 },
  "Power Gem":    { power: 80,  type: "Rock",   pp: 20, effect: null,        accuracy: 100 },

  // ─── GROUND (expanded) ──────────────────────────
  "Bulldoze":     { power: 60,  type: "Ground", pp: 20, effect: "lower_spd", accuracy: 100 },
  "Mud Shot":     { power: 55,  type: "Ground", pp: 15, effect: "lower_spd", accuracy: 95  },
  "Shore Up":     { power: 0,   type: "Ground", pp: 10, effect: "heal",      accuracy: 100 },

  // ─── POISON (expanded) ──────────────────────────
  "Acid":         { power: 40,  type: "Poison", pp: 30, effect: "lower_def", accuracy: 100 },
  "Sludge Bomb":  { power: 90,  type: "Poison", pp: 10, effect: "poison",    accuracy: 100 },
  "Cross Poison": { power: 70,  type: "Poison", pp: 20, effect: "poison",    accuracy: 100 },
  "Gunk Shot":    { power: 120, type: "Poison", pp: 5,  effect: "poison",    accuracy: 80  },

  // ─── DRAGON (expanded) ──────────────────────────
  "Outrage":      { power: 120, type: "Dragon", pp: 10, effect: "confuse",   accuracy: 100 },
  "Twister":      { power: 40,  type: "Dragon", pp: 20, effect: "flinch",    accuracy: 100 },
  "Scale Shot":   { power: 25,  type: "Dragon", pp: 20, effect: "lower_def", accuracy: 90  },

  // ─── FAIRY (expanded) ───────────────────────────
  "Charm":        { power: 0,   type: "Fairy",  pp: 20, effect: "lower_atk", accuracy: 100 },
  "Play Rough":   { power: 90,  type: "Fairy",  pp: 10, effect: "lower_atk", accuracy: 90  },
  "Misty Terrain":{ power: 0,   type: "Fairy",  pp: 10, effect: "raise_def", accuracy: 100 },
  "Sparkling Aria":{ power: 90, type: "Fairy",  pp: 10, effect: null,        accuracy: 100 },

  // ─── FLYING (expanded) ──────────────────────────
  "Brave Bird":   { power: 120, type: "Flying", pp: 15, effect: "recoil",    accuracy: 100 },
  "Acrobatics":   { power: 55,  type: "Flying", pp: 15, effect: null,        accuracy: 100 },
  "Roost":        { power: 0,   type: "Flying", pp: 10, effect: "heal",      accuracy: 100 },

  // ─── NORMAL (expanded) ──────────────────────────
  "Double Edge":  { power: 120, type: "Normal", pp: 15, effect: "recoil",    accuracy: 100 },
  "Hyper Beam":   { power: 150, type: "Normal", pp: 5,  effect: null,        accuracy: 90  },
  "Protect":      { power: 0,   type: "Normal", pp: 10, effect: "raise_def", accuracy: 100 },
  "Howl":         { power: 0,   type: "Normal", pp: 40, effect: "raise_atk", accuracy: 100 },
  "Slash":        { power: 70,  type: "Normal", pp: 20, effect: "crit",      accuracy: 100 },
  "Endeavor":     { power: 80,  type: "Normal", pp: 5,  effect: null,        accuracy: 100 },

  // ─── COSMIC ─────────────────────────────────────
  "Cosmic Miracle": { power: 120, type: "Cosmic", pp: 5,  effect: "heal",      accuracy: 100 },
  "Eclipse Void":   { power: 130, type: "Cosmic", pp: 5,  effect: "lower_atk", accuracy: 90  },
  "Starfall":       { power: 90,  type: "Cosmic", pp: 10, effect: "lower_spd", accuracy: 100 },
  "Rift Collapse":  { power: 140, type: "Cosmic", pp: 5,  effect: "lower_def", accuracy: 90  },
  "Stellar Devour": { power: 130, type: "Dark",   pp: 5,  effect: "lower_atk", accuracy: 90  },

};

const TYPE_CHART = {
  Normal:   { Rock: 0.5, Steel: 0.5, Ghost: 0 },
  Fire:     { Grass: 2, Ice: 2, Bug: 2, Steel: 2, Fire: 0.5, Water: 0.5, Rock: 0.5, Dragon: 0.5 },
  Water:    { Fire: 2, Ground: 2, Rock: 2, Water: 0.5, Grass: 0.5, Dragon: 0.5 },
  Grass:    { Water: 2, Ground: 2, Rock: 2, Fire: 0.5, Grass: 0.5, Poison: 0.5, Flying: 0.5, Bug: 0.5, Dragon: 0.5, Steel: 0.5 },
  Electric: { Water: 2, Flying: 2, Electric: 0.5, Grass: 0.5, Dragon: 0.5, Ground: 0 },
  Ice:      { Dragon: 2, Flying: 2, Grass: 2, Ground: 2, Fire: 0.5, Water: 0.5, Ice: 0.5, Steel: 0.5 },
  Fighting: { Normal: 2, Rock: 2, Steel: 2, Ice: 2, Dark: 2, Poison: 0.5, Bug: 0.5, Psychic: 0.5, Flying: 0.5, Fairy: 0.5, Ghost: 0 },
  Poison:   { Grass: 2, Fairy: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0 },
  Ground:   { Fire: 2, Electric: 2, Poison: 2, Rock: 2, Steel: 2, Grass: 0.5, Bug: 0.5, Flying: 0 },
  Flying:   { Grass: 2, Fighting: 2, Bug: 2, Electric: 0.5, Rock: 0.5, Steel: 0.5 },
  Psychic:  { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
  Bug:      { Grass: 2, Psychic: 2, Dark: 2, Fire: 0.5, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Ghost: 0.5, Steel: 0.5, Fairy: 0.5 },
  Rock:     { Fire: 2, Ice: 2, Flying: 2, Bug: 2, Fighting: 0.5, Ground: 0.5, Steel: 0.5 },
  Ghost:    { Ghost: 2, Psychic: 2, Normal: 0, Dark: 0.5 },
  Dragon:   { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Steel:    { Ice: 2, Rock: 2, Fairy: 2, Cosmic: 2, Steel: 0.5, Fire: 0.5, Water: 0.5, Electric: 0.5 },
  Fairy:    { Fighting: 2, Dragon: 2, Dark: 2, Poison: 0.5, Steel: 0.5, Fire: 0.5, Cosmic: 0.5 },
  Dark:     { Ghost: 2, Psychic: 2, Cosmic: 2, Fighting: 0.5, Dark: 0.5, Fairy: 0.5 },
  Cosmic:   { Psychic: 2, Fairy: 2, Dark: 0.5, Steel: 0.5, Cosmic: 0.5 },
};

// ─── STAT CALCULATIONS ────────────────────────────────────────────────────────
function calcStat(base, level) { return Math.floor((base * level) / 50) + level + 10; }
function calcMaxHp(base, level) { return Math.floor((base * level) / 50) + level + 20; }

function getTypeMultiplier(moveType, defenderTypes) {
  let mult = 1;
  for (const defType of defenderTypes) {
    mult *= TYPE_CHART[moveType]?.[defType] ?? 1;
  }
  return mult;
}

function calcDamage(attacker, defender, moveName) {
  const move = MOVES[moveName];
  if (!move || move.power === 0) return 0;
  const species = EWAMON_SPECIES[defender.speciesId];
  const typeMult = getTypeMultiplier(move.type, species?.type || ["Normal"]);
  const base = ((2 * attacker.level / 5 + 2) * move.power * attacker.atk / defender.def) / 50 + 2;
  const rand = 0.85 + Math.random() * 0.15;
  const crit = Math.random() < 0.0625 ? 1.5 : 1;
  return Math.max(1, Math.floor(base * rand * crit * typeMult));
}

function createEwamonInstance(speciesId, level = 5) {
  const species = EWAMON_SPECIES[speciesId];
  if (!species) throw new Error(`Unknown species: ${speciesId}`);
  const maxHp = calcMaxHp(species.baseHp, level);
  return {
    speciesId,
    nickname: species.name,
    level,
    hp: maxHp, maxHp,
    atk: calcStat(species.baseAtk, level),
    def: calcStat(species.baseDef, level),
    spd: calcStat(species.baseSpd, level),
    exp: 0, expToNext: level * 100,
    moves: species.moves.slice(0, 4),
    pp: Object.fromEntries(species.moves.slice(0, 4).map(m => [m, MOVES[m]?.pp || 20])),
    status: null,
    selectedAbility: species.abilities?.[0] || null,
  };
}

module.exports = { EWAMON_SPECIES, MOVES, TYPE_CHART, ABILITIES, ITEMS, SPECIES_ROLES, ORBS, LEGACY_ORB_ID_MAP, resolveOrbId, getOrbCatchMultiplier, calcDamage, calcStat, calcMaxHp, createEwamonInstance };
