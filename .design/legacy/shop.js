const express = require("express");
const router = express.Router();
const Player = require("../models/Player");
const { applyRareCandyLevel } = require("../utils/expUtils");
const { ITEMS, MOVES, ORBS } = require("../data/ewamon");
const { ensureLiveOpsState, buildCompactLiveOpsSummary, applyLiveOpsEvent } = require("../utils/liveOps");
const { hasStatus, hasAnyMajor, removeStatus, clearStatus, getStatuses, SHORTHAND_TO_LONG } = require("../utils/statusUtils");

// Map shop short-codes ("psn", "brn", …) to the long-form status names used
// elsewhere on the Ewamon `status` array. Includes "psn"/"tox" both mapping to
// long-form variants so the antidote cures either one.
const shortToLong = (code) => SHORTHAND_TO_LONG[code] || code;

const SHOP_ITEMS = {
  potion:         { name: "Potion",         icon: "💊", desc: "Heals 20 HP to one party Ewamon.",                   price: 150,   sellPrice: 75,   maxStack: 99 },
  superpotion:    { name: "Super Potion",   icon: "💉", desc: "Heals 50 HP to one party Ewamon.",                   price: 400,   sellPrice: 200,  maxStack: 99 },
  hyper_potion:   { name: "Hyper Potion",   icon: "💉", desc: "Heals 100 HP to one party Ewamon.",                  price: 900,   sellPrice: 450,  maxStack: 99 },
  max_potion:     { name: "Max Potion",     icon: "💊", desc: "Fully restores one party Ewamon's HP.",              price: 800,   sellPrice: 400,  maxStack: 99 },
  full_restore:   { name: "Full Restore",   icon: "✨", desc: "Fully restores HP and cures all status conditions.", price: 1800,  sellPrice: 900,  maxStack: 99 },
  revive:         { name: "Revive",         icon: "✨", desc: "Revives a fainted Ewamon to half HP.",               price: 800,   sellPrice: 400,  maxStack: 99 },
  max_revive:     { name: "Max Revive",     icon: "⭐", desc: "Revives a fainted Ewamon to full HP.",               price: 2000,  sellPrice: 1000, maxStack: 99 },
  antidote:       { name: "Antidote",       icon: "🌿", desc: "Cures the poisoned status condition.",               price: 100,   sellPrice: 50,   maxStack: 99 },
  burn_heal:      { name: "Burn Heal",      icon: "🧊", desc: "Cures the burned status condition.",                 price: 150,   sellPrice: 75,   maxStack: 99 },
  ice_heal:       { name: "Ice Heal",       icon: "🌡️", desc: "Cures the frozen status condition.",                 price: 150,   sellPrice: 75,   maxStack: 99 },
  awakening:      { name: "Awakening",      icon: "☕", desc: "Wakes up a sleeping Ewamon.",                        price: 100,   sellPrice: 50,   maxStack: 99 },
  paralyze_heal:  { name: "Paralyze Heal",  icon: "⚡", desc: "Cures the paralyzed status condition.",              price: 100,   sellPrice: 50,   maxStack: 99 },
  full_heal:      { name: "Full Heal",      icon: "💊", desc: "Cures any status condition (burn, poison, etc.).",   price: 300,   sellPrice: 150,  maxStack: 99 },
  elixir:         { name: "Elixir",         icon: "🔷", desc: "Restores 10 PP for all moves of one Ewamon.",        price: 800,   sellPrice: 400,  maxStack: 99 },
  max_ether:      { name: "Max Ether",      icon: "🔷", desc: "Restores all PP for all moves of one Ewamon.",       price: 1500,  sellPrice: 750,  maxStack: 99 },
  // Capture orbs are sourced from ORBS in data/ewamon.js; entries are
  // spread below so price/sellPrice/desc stay consistent with battle logic.
  ...Object.fromEntries(Object.values(ORBS).map(orb => [orb.id, {
    name: orb.name,
    sprite: `/sprites/items/orbs/${orb.sprite}`,
    category: "orb",
    desc: orb.desc,
    price: orb.price,
    sellPrice: orb.sellPrice,
    maxStack: orb.maxStack,
    rarity: orb.rarity,
  }])),
  escape_rope:    { name: "Escape Rope",    icon: "🪢", desc: "Instantly flees from wild battles.",                 price: 550,   sellPrice: 275,  maxStack: 99 },
  repel:          { name: "Repel",          icon: "🛡️",  desc: "Suppresses wild encounters for 50 steps.",          price: 500,   sellPrice: 250,  maxStack: 99 },
  lure:           { name: "Lure",           icon: "🎣", desc: "Triples wild encounter rate for 30 steps.",          price: 400,   sellPrice: 200,  maxStack: 99 },
  rarecandy:      { name: "Rare Candy",     icon: "🍬", desc: "Raises an Ewamon's level by 1.",                     price: 2500,  sellPrice: 1250, maxStack: 99 },
  nugget:         { name: "Nugget",         icon: "💰", desc: "A shiny gold nugget. Sell it for a good price.",     price: 10000, sellPrice: 5000, maxStack: 99 },
  big_nugget:     { name: "Big Nugget",     icon: "💎", desc: "A massive gold nugget worth a fortune.",             price: 40000, sellPrice: 20000, maxStack: 99 },
  stardust:       { name: "Stardust",       icon: "✨", desc: "A beautiful red sand. Sell for a good price.",       price: 1000,  sellPrice: 500,  maxStack: 99 },
  star_piece:     { name: "Star Piece",     icon: "⭐", desc: "A shard of a beautiful gem. Sell for great profit.", price: 4000,  sellPrice: 2000, maxStack: 99 },
};

// Held items with prices (no stacking)
const HELD_ITEMS_SHOP = {
  // Type boosters
  "Charcoal":          { price: 3000,  desc: "+20% Fire move power" },
  "Mystic Water":      { price: 3000,  desc: "+20% Water move power" },
  "Miracle Seed":      { price: 3000,  desc: "+20% Grass move power" },
  "Magnet":            { price: 3000,  desc: "+20% Electric move power" },
  "NeverMeltIce":      { price: 3000,  desc: "+20% Ice move power" },
  "Twisted Spoon":     { price: 3000,  desc: "+20% Psychic move power" },
  "Mirrorcoat":        { price: 3000,  desc: "+20% Psychic move power" },
  "Black Belt":        { price: 3000,  desc: "+20% Fighting move power" },
  "Sharp Beak":        { price: 3000,  desc: "+20% Flying move power" },
  "Poison Barb":       { price: 3000,  desc: "+20% Poison move power" },
  "Soft Sand":         { price: 3000,  desc: "+20% Ground move power" },
  "Hard Stone":        { price: 3000,  desc: "+20% Rock move power" },
  "Metal Coat":        { price: 3000,  desc: "+20% Steel move power" },
  "Dragon Fang":       { price: 3500,  desc: "+20% Dragon move power" },
  "Black Sludge":      { price: 3000,  desc: "+20% Poison move power" },
  "Silk Scarf":        { price: 3000,  desc: "+20% Normal move power" },
  // Combat items
  "Choice Band":       { price: 5000,  desc: "+25% Attack, locked to one move" },
  "Choice Scarf":      { price: 5000,  desc: "+25% Speed, locked to one move" },
  "Choice Specs":      { price: 5000,  desc: "+25% Sp.Atk, locked to one move" },
  "Assault Vest":      { price: 4500,  desc: "+25% Sp.Def, can't use status moves" },
  "Life Orb":          { price: 6000,  desc: "+30% move power, costs 10% HP per attack" },
  "Rocky Helmet":      { price: 4000,  desc: "Attacker takes 1/6 HP damage on contact" },
  "Focus Sash":        { price: 5500,  desc: "Survive one KO hit at full HP" },
  "Eviolite":          { price: 5000,  desc: "+50% Def and Sp.Def for unevolved Ewamon" },
  // Healing items
  "Sitrus Berry":      { price: 2000,  desc: "Restores 1/4 HP when below 50%" },
  "Oran Berry":        { price: 1500,  desc: "Restores 10 HP when below 25%" },
  "Leftovers":         { price: 4500,  desc: "Restores 1/16 HP every turn" },
  // Utility
  "Speed Scarf":       { price: 3500,  desc: "+10% Speed boost" },
  "Heavy Duty Boots":  { price: 4000,  desc: "Negates entry hazard damage" },
  "Smoke Ball":        { price: 2500,  desc: "Guarantees escape from wild battles" },
  "Shell Bell":        { price: 4000,  desc: "Restores HP equal to 1/8 of damage dealt" },
};

function toInventoryMap(player) {
  if (!(player.inventory instanceof Map)) {
    player.inventory = new Map(Object.entries(player.inventory || {}));
  }
  return player.inventory;
}

// GET /api/shop — list items
router.get("/", (req, res) => {
  res.json({ items: SHOP_ITEMS, heldItems: HELD_ITEMS_SHOP });
});

// POST /api/shop/buy — buy a consumable item (server-validated)
router.post("/buy", async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const player = req.player;

    const item = SHOP_ITEMS[itemId];
    if (!item) return res.status(400).json({ error: "Unknown item" });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
      return res.status(400).json({ error: "Invalid quantity" });

    const totalCost = item.price * quantity;
    if (player.money < totalCost)
      return res.status(400).json({ error: "Not enough money" });

    const currentQty = player.inventory.get(itemId) || 0;
    if (currentQty + quantity > item.maxStack)
      return res.status(400).json({ error: `Max stack (${item.maxStack}) reached` });

    // Atomic update
    const updated = await Player.findByIdAndUpdate(
      player._id,
      {
        $inc: { money: -totalCost, [`inventory.${itemId}`]: quantity },
      },
      { new: true, select: "-password" }
    );

    res.json({ success: true, money: updated.money, inventory: Object.fromEntries(updated.inventory) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/shop/buy-held-item — buy a held item (one per purchase)
router.post("/buy-held-item", async (req, res) => {
  try {
    const { itemId } = req.body;
    const player = await Player.findById(req.player._id);

    const item = HELD_ITEMS_SHOP[itemId];
    if (!item) return res.status(400).json({ error: "Item not found in shop" });

    if (player.money < item.price)
      return res.status(400).json({ error: "Not enough money" });

    // Check if player already owns this item (held items shouldn't stack)
    const currentQty = player.inventory.get(itemId) || 0;
    if (currentQty > 0)
      return res.status(400).json({ error: "You already own this item. Equip it on an Ewamon first." });

    // Purchase the item
    player.money -= item.price;
    player.inventory.set(itemId, 1);
    await player.save();

    res.json({
      success: true,
      message: `Purchased ${itemId}!`,
      money: player.money,
      inventory: Object.fromEntries(player.inventory)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/shop/use — use an item (server-validated)
router.post("/use", async (req, res) => {
  try {
    const { itemId, partyIndex, quantity = 1 } = req.body;
    const player = await Player.findById(req.player._id);
    ensureLiveOpsState(player);
    toInventoryMap(player);

    const qty = player.inventory.get(itemId) || 0;
    if (qty <= 0) return res.status(400).json({ error: "None in inventory" });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ error: "Invalid quantity" });
    }
    if (quantity > qty) return res.status(400).json({ error: "Not enough in inventory" });

    const target = player.party[partyIndex];
    if (!target) return res.status(400).json({ error: "Invalid party slot" });

    let healed = 0;
    let leveledUp = false;
    let evolution = null;
    const evolutions = [];
    let levelsGained = 0;
    if (itemId === "potion") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (target.hp >= target.maxHp) return res.status(400).json({ error: "Already at full HP" });
      healed = Math.min(20, target.maxHp - target.hp);
      target.hp += healed;
    } else if (itemId === "superpotion") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (target.hp >= target.maxHp) return res.status(400).json({ error: "Already at full HP" });
      healed = Math.min(50, target.maxHp - target.hp);
      target.hp += healed;
    } else if (itemId === "revive") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (target.hp > 0) return res.status(400).json({ error: "Ewamon not fainted" });
      target.hp = Math.floor(target.maxHp / 2);
      healed = target.hp;
    } else if (itemId === "rarecandy") {
      for (let i = 0; i < quantity; i += 1) {
        const result = applyRareCandyLevel(target, player.collection, player.seen);
        levelsGained += 1;
        if (result.evolution) evolutions.push(result.evolution);
      }
      leveledUp = levelsGained > 0;
      evolution = evolutions[evolutions.length - 1] || null;
    } else if (itemId === "hyper_potion") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (target.hp >= target.maxHp) return res.status(400).json({ error: "Already at full HP" });
      healed = Math.min(100, target.maxHp - target.hp);
      target.hp += healed;
    } else if (itemId === "max_potion") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (target.hp >= target.maxHp) return res.status(400).json({ error: "Already at full HP" });
      healed = target.maxHp - target.hp;
      target.hp = target.maxHp;
    } else if (itemId === "full_restore") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      const hasAnyStatus = getStatuses(target).length > 0;
      if (target.hp >= target.maxHp && !hasAnyStatus) return res.status(400).json({ error: "Already at full HP with no status" });
      healed = target.maxHp - target.hp;
      target.hp = target.maxHp;
      clearStatus(target);
    } else if (itemId === "max_revive") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (target.hp > 0) return res.status(400).json({ error: "Ewamon not fainted" });
      target.hp = target.maxHp;
      healed = target.hp;
    } else if (itemId === "antidote") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (!hasStatus(target, "poison") && !hasStatus(target, "tox")) return res.status(400).json({ error: "Ewamon is not poisoned" });
      removeStatus(target, "poison"); removeStatus(target, "tox");
      healed = 1;
    } else if (itemId === "burn_heal") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (!hasStatus(target, "burn")) return res.status(400).json({ error: "Ewamon is not burned" });
      removeStatus(target, "burn");
      healed = 1;
    } else if (itemId === "ice_heal") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (!hasStatus(target, "freeze")) return res.status(400).json({ error: "Ewamon is not frozen" });
      removeStatus(target, "freeze");
      healed = 1;
    } else if (itemId === "awakening") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (!hasStatus(target, "sleep")) return res.status(400).json({ error: "Ewamon is not asleep" });
      removeStatus(target, "sleep");
      healed = 1;
    } else if (itemId === "paralyze_heal") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (!hasStatus(target, "paralyze")) return res.status(400).json({ error: "Ewamon is not paralyzed" });
      removeStatus(target, "paralyze");
      healed = 1;
    } else if (itemId === "full_heal") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      if (getStatuses(target).length === 0) return res.status(400).json({ error: "No status condition to cure" });
      clearStatus(target);
      healed = 1;
    } else if (itemId === "elixir") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      const ppMap = target.pp instanceof Map ? target.pp : new Map(Object.entries(target.pp || {}));
      for (const moveName of (target.moves || [])) {
        const maxPp = MOVES[moveName]?.pp || 20;
        const cur = ppMap.get(moveName) || 0;
        ppMap.set(moveName, Math.min(maxPp, cur + 10));
      }
      target.pp = ppMap;
      healed = 1;
    } else if (itemId === "max_ether") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      const ppMap = target.pp instanceof Map ? target.pp : new Map(Object.entries(target.pp || {}));
      for (const moveName of (target.moves || [])) {
        const maxPp = MOVES[moveName]?.pp || 20;
        ppMap.set(moveName, maxPp);
      }
      target.pp = ppMap;
    } else if (itemId === "repel") {
      player.repelSteps = (player.repelSteps || 0) + 50 * quantity;
      player.inventory.set(itemId, qty - quantity);
      await player.save();
      return res.json({ success: true, healed: 0, leveledUp: false, quantityUsed: quantity, repelSteps: player.repelSteps, party: player.party, inventory: Object.fromEntries(player.inventory), liveOpsSummary: buildCompactLiveOpsSummary(player) });
    } else if (itemId === "lure") {
      player.lureSteps = (player.lureSteps || 0) + 30 * quantity;
      player.inventory.set(itemId, qty - quantity);
      await player.save();
      return res.json({ success: true, healed: 0, leveledUp: false, quantityUsed: quantity, lureSteps: player.lureSteps, party: player.party, inventory: Object.fromEntries(player.inventory), liveOpsSummary: buildCompactLiveOpsSummary(player) });
    } else if (itemId === "escape_rope") {
      if (quantity > 1) return res.status(400).json({ error: "This item can only be used one at a time" });
      player.inventory.set(itemId, qty - 1);
      await player.save();
      return res.json({ success: true, healed: 0, leveledUp: false, quantityUsed: 1, escapedWild: true, party: player.party, inventory: Object.fromEntries(player.inventory), liveOpsSummary: buildCompactLiveOpsSummary(player) });
    } else if (itemId === "stardust" || itemId === "star_piece" || itemId === "nugget" || itemId === "big_nugget") {
      return res.status(400).json({ error: "This item can only be sold, not used." });
    } else {
      return res.status(400).json({ error: "Item cannot be used this way" });
    }

    if (itemId !== "rarecandy" && (healed > 0 || itemId === "full_heal")) {
      applyLiveOpsEvent(player, "heal");
    }
    player.inventory.set(itemId, qty - quantity);
    await player.save();

    res.json({
      success: true,
      healed,
      leveledUp,
      quantityUsed: quantity,
      levelsGained,
      newLevel: target.level,
      evolution,
      evolutions,
      party: player.party,
      inventory: Object.fromEntries(player.inventory),
      liveOpsSummary: buildCompactLiveOpsSummary(player),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/use-batch", async (req, res) => {
  try {
    const { target = "party", ewamonId } = req.body || {};
    const player = await Player.findById(req.player._id);
    ensureLiveOpsState(player);
    toInventoryMap(player);

    const partyIndexes = target === "single"
      ? [player.party.findIndex(ewamon => String(ewamon._id) === String(ewamonId))]
      : player.party.map((_, index) => index);
    const validIndexes = partyIndexes.filter(index => index >= 0);
    if (!validIndexes.length) return res.status(400).json({ error: "No valid Ewamon selected" });

    const usage = {};
    let healedTargets = 0;

    function spendItem(itemId, count = 1) {
      const current = Number(player.inventory.get(itemId) || 0);
      if (current < count) return false;
      player.inventory.set(itemId, current - count);
      usage[itemId] = Number(usage[itemId] || 0) + count;
      return true;
    }

    validIndexes.forEach(index => {
      const ewamon = player.party[index];
      let touched = false;

      if (ewamon.hp <= 0) {
        if (spendItem("revive", 1)) {
          ewamon.hp = Math.max(1, Math.floor(ewamon.maxHp / 2));
          touched = true;
        } else {
          return;
        }
      }

      if (getStatuses(ewamon).length > 0 && spendItem("full_heal", 1)) {
        clearStatus(ewamon);
        touched = true;
      }

      let deficit = Math.max(0, ewamon.maxHp - ewamon.hp);
      while (deficit > 0) {
        if (deficit > 50 && spendItem("max_potion", 1)) {
          ewamon.hp = ewamon.maxHp;
        } else if (deficit >= 50 && spendItem("superpotion", 1)) {
          ewamon.hp = Math.min(ewamon.maxHp, ewamon.hp + 50);
        } else if (spendItem("potion", 1)) {
          ewamon.hp = Math.min(ewamon.maxHp, ewamon.hp + 20);
        } else if (deficit > 0 && spendItem("superpotion", 1)) {
          ewamon.hp = Math.min(ewamon.maxHp, ewamon.hp + 50);
        } else if (deficit > 0 && spendItem("max_potion", 1)) {
          ewamon.hp = ewamon.maxHp;
        } else {
          break;
        }
        touched = true;
        deficit = Math.max(0, ewamon.maxHp - ewamon.hp);
      }

      if (touched) healedTargets += 1;
    });

    if (!healedTargets) return res.status(400).json({ error: "No valid healing items available or no healing needed" });

    applyLiveOpsEvent(player, "heal");
    await player.save();
    res.json({
      success: true,
      target,
      healedTargets,
      itemsUsed: usage,
      party: player.party,
      inventory: Object.fromEntries(player.inventory),
      liveOpsSummary: buildCompactLiveOpsSummary(player),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/shop/sell — sell an item at 50% buy price
router.post("/sell", async (req, res) => {
  try {
    const { itemId, quantity = 1 } = req.body;
    const player = await Player.findById(req.player._id);

    const item = SHOP_ITEMS[itemId];
    if (!item) return res.status(400).json({ error: "Unknown item" });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
      return res.status(400).json({ error: "Invalid quantity" });

    const currentQty = player.inventory.get(itemId) || 0;
    if (currentQty < quantity)
      return res.status(400).json({ error: "Not enough in inventory" });

    const sellPrice = Math.floor(item.price * 0.5) * quantity;

    player.inventory.set(itemId, currentQty - quantity);
    player.money += sellPrice;
    await player.save();

    res.json({ success: true, earned: sellPrice, money: player.money, inventory: Object.fromEntries(player.inventory) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/shop/sell-held-item — sell a held item
router.post("/sell-held-item", async (req, res) => {
  try {
    const { itemId } = req.body;
    const player = await Player.findById(req.player._id);

    const item = HELD_ITEMS_SHOP[itemId];
    if (!item) return res.status(400).json({ error: "Item not found" });

    const currentQty = player.inventory.get(itemId) || 0;
    if (currentQty <= 0)
      return res.status(400).json({ error: "You don't own this item" });

    // Can't sell if equipped on an Ewamon
    const isEquipped = player.party.some(e => e.heldItem === itemId) ||
                       player.box.some(e => e.heldItem === itemId);
    if (isEquipped)
      return res.status(400).json({ error: "Can't sell item while equipped. Unequip it first." });

    const sellPrice = Math.floor(item.price * 0.5);
    player.inventory.set(itemId, 0);
    player.money += sellPrice;
    await player.save();

    res.json({
      success: true,
      earned: sellPrice,
      money: player.money,
      inventory: Object.fromEntries(player.inventory)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
module.exports.SHOP_ITEMS = SHOP_ITEMS;

