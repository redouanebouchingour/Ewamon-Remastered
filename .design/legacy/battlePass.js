// ─── BATTLE PASS REWARDS ────────────────────────────────────────────────────
// Index corresponds to trainer level (index 0 unused, levels 1-100).
// reward.type: "standard" (default) | "mythical_choice" | "grand"
// Rarities: common | uncommon | rare | epic | legendary | mythical

const BATTLE_PASS_REWARDS = [
  null, // index 0 — unused

  // ── 1–10: Starter Stretch ─────────────────────────────────────────────────
  { money: 200,  items: { potion: 3, spark_orb: 3 },              label: "Rookie Pack",        rarity: "common"    }, // 1
  { money: 300,  items: { spark_orb: 5 },                         label: "Ball Basics",        rarity: "common"    }, // 2
  { money: 250,  items: { potion: 4 },                              label: "Field Kit",          rarity: "common"    }, // 3
  { money: 400,  items: { crest_orb: 2 },                          label: "Upgrade Pack",       rarity: "common"    }, // 4
  { money: 600,  items: { crest_orb: 3, revive: 1 },               label: "Scout Cache",        rarity: "uncommon"  }, // 5
  { money: 400,  items: { spark_orb: 5 },                         label: "Ball Stash",         rarity: "common"    }, // 6
  { money: 350,  items: { potion: 4 },                              label: "Medic's Bag",        rarity: "common"    }, // 7
  { money: 600,  items: { crest_orb: 3 },                          label: "Catcher's Kit",      rarity: "common"    }, // 8
  { money: 450,  items: { revive: 2 },                              label: "Second Wind",        rarity: "common"    }, // 9
  { money: 1200, items: { prism_orb: 2, max_revive: 1 },           label: "Explorer's Cache",   rarity: "rare"      }, // 10

  // ── 11–20: Journeyman ─────────────────────────────────────────────────────
  { money: 600,  items: { crest_orb: 3 },                          label: "Path Pack",          rarity: "common"    }, // 11
  { money: 700,  items: { repel: 2 },                               label: "Silent Steps",       rarity: "common"    }, // 12
  { money: 600,  items: { revive: 2 },                              label: "Battle Reserve",     rarity: "common"    }, // 13
  { money: 800,  items: { prism_orb: 2 },                          label: "Precision Pack",     rarity: "uncommon"  }, // 14
  { money: 1000, items: { crest_orb: 4, revive: 2 },               label: "Tracker Gear",       rarity: "uncommon"  }, // 15
  { money: 700,  items: { prism_orb: 2 },                          label: "Hunter's Kit",       rarity: "common"    }, // 16
  { money: 600,  items: { lure: 2 },                                label: "Lure Bundle",        rarity: "common"    }, // 17
  { money: 800,  items: { prism_orb: 2, revive: 2 },               label: "Field Cache",        rarity: "common"    }, // 18
  { money: 900,  items: { max_revive: 2 },                          label: "Revival Stash",      rarity: "uncommon"  }, // 19
  { money: 2500, items: { prism_orb: 5, max_revive: 2 },           label: "Veteran's Cache",    rarity: "rare"      }, // 20

  // ── 21–30: Challenger ─────────────────────────────────────────────────────
  { money: 900,  items: { prism_orb: 3 },                          label: "Pro Kit",            rarity: "common"    }, // 21
  { money: 1000, items: { max_revive: 2 },                          label: "Lifeline Pack",      rarity: "common"    }, // 22
  { money: 900,  items: { max_ether: 2 },                           label: "Ether Reserve",      rarity: "common"    }, // 23
  { money: 1100, items: { prism_orb: 3, max_revive: 1 },           label: "Challenger Pack",    rarity: "uncommon"  }, // 24
  { money: 2000, items: { prism_orb: 4, max_ether: 2 },            label: "Elite Cache",        rarity: "uncommon"  }, // 25
  { money: 1100, items: { max_revive: 2 },                          label: "Resilience Pack",    rarity: "common"    }, // 26
  { money: 1000, items: { repel: 3, lure: 2 },                      label: "Explorer Bundle",    rarity: "common"    }, // 27
  { money: 1200, items: { prism_orb: 3, max_ether: 2 },            label: "Power Cache",        rarity: "uncommon"  }, // 28
  { money: 1400, items: { max_revive: 3 },                          label: "Endurance Pack",     rarity: "uncommon"  }, // 29
  { money: 4000, items: { prism_orb: 6, max_revive: 3, max_ether: 3 }, label: "League Cache",   rarity: "epic"      }, // 30

  // ── 31–40: Masters ────────────────────────────────────────────────────────
  { money: 1400, items: { prism_orb: 3 },                          label: "Climber's Kit",      rarity: "uncommon"  }, // 31
  { money: 1200, items: { max_ether: 3 },                           label: "PP Reserve",         rarity: "uncommon"  }, // 32
  { money: 1500, items: { max_revive: 3 },                          label: "Fortress Pack",      rarity: "uncommon"  }, // 33
  { money: 1600, items: { prism_orb: 4, max_ether: 2 },            label: "Challenger Pack",    rarity: "uncommon"  }, // 34
  { money: 2500, items: { prism_orb: 5, max_revive: 3 },           label: "Masters Cache",      rarity: "rare"      }, // 35
  { money: 1800, items: { max_ether: 4 },                           label: "Surge Pack",         rarity: "uncommon"  }, // 36
  { money: 1500, items: { prism_orb: 4 },                          label: "Precision Kit",      rarity: "uncommon"  }, // 37
  { money: 1800, items: { max_revive: 4, max_ether: 2 },            label: "Elite Reserve",      rarity: "rare"      }, // 38
  { money: 2000, items: { prism_orb: 5, max_ether: 3 },            label: "Apex Pack",          rarity: "rare"      }, // 39
  { money: 6000, items: { prism_orb: 8, max_revive: 5, max_ether: 5 }, label: "Champion's Vault", rarity: "epic"   }, // 40

  // ── 41–49: Mythic Approach ────────────────────────────────────────────────
  { money: 2200, items: { prism_orb: 5 },                          label: "Pinnacle Kit",       rarity: "rare"      }, // 41
  { money: 2000, items: { max_ether: 5 },                           label: "Surge Reserve",      rarity: "rare"      }, // 42
  { money: 2500, items: { max_revive: 5 },                          label: "Guardian Pack",      rarity: "rare"      }, // 43
  { money: 2800, items: { prism_orb: 6, max_ether: 4 },            label: "Titan Pack",         rarity: "rare"      }, // 44
  { money: 3500, items: { prism_orb: 6, max_revive: 4, max_ether: 4 }, label: "Legend's Cache", rarity: "epic"      }, // 45
  { money: 2800, items: { max_revive: 5, max_ether: 5 },            label: "Mythic Prep",        rarity: "rare"      }, // 46
  { money: 2500, items: { prism_orb: 6, lure: 3 },                 label: "Mythic Hunt",        rarity: "rare"      }, // 47
  { money: 3500, items: { prism_orb: 8, max_revive: 5 },           label: "Final Approach",     rarity: "epic"      }, // 48
  { money: 4500, items: { max_revive: 8, max_ether: 8 },            label: "Mythic Eve",         rarity: "epic"      }, // 49

  // ── 50: MYTHICAL CHOICE ───────────────────────────────────────────────────
  { type: "mythical_choice", choices: ["lumyth", "noxmyth"], money: 5000,
    label: "Mythical Encounter", rarity: "mythical" },                          // 50

  // ── 51–60: Post-Myth Surge ────────────────────────────────────────────────
  { money: 3500, items: { prism_orb: 5, max_ether: 5 },            label: "Post-Myth Cache",    rarity: "rare"      }, // 51
  { money: 3000, items: { max_revive: 5 },                          label: "Resilient Pack",     rarity: "rare"      }, // 52
  { money: 3500, items: { max_ether: 6 },                           label: "Power Surge",        rarity: "rare"      }, // 53
  { money: 4000, items: { prism_orb: 6, max_revive: 4 },           label: "Apex Cache",         rarity: "epic"      }, // 54
  { money: 5000, items: { prism_orb: 8, max_ether: 6 },            label: "Supremacy Pack",     rarity: "epic"      }, // 55
  { money: 3500, items: { max_revive: 6 },                          label: "Fortress Reserve",   rarity: "rare"      }, // 56
  { money: 4000, items: { prism_orb: 6, lure: 3 },                 label: "Hunt Cache",         rarity: "rare"      }, // 57
  { money: 4500, items: { max_ether: 7, max_revive: 5 },            label: "Endgame Pack",       rarity: "epic"      }, // 58
  { money: 5000, items: { prism_orb: 8, max_revive: 6 },           label: "Legend Kit",         rarity: "epic"      }, // 59
  { money: 9000, items: { prism_orb: 10, max_revive: 8, max_ether: 8 }, label: "Elite Vault",   rarity: "epic"      }, // 60

  // ── 61–70: Celestial ──────────────────────────────────────────────────────
  { money: 4500, items: { prism_orb: 6, max_ether: 6 },            label: "Peak Pack",          rarity: "epic"      }, // 61
  { money: 5000, items: { max_revive: 7 },                          label: "Titan Reserve",      rarity: "epic"      }, // 62
  { money: 5500, items: { max_ether: 8 },                           label: "Arcane Stash",       rarity: "epic"      }, // 63
  { money: 6000, items: { prism_orb: 8, max_revive: 6 },           label: "Pinnacle Cache",     rarity: "epic"      }, // 64
  { money: 7000, items: { prism_orb: 10, max_ether: 8 },           label: "Sovereign Pack",     rarity: "legendary" }, // 65
  { money: 5500, items: { max_revive: 8 },                          label: "Endurance Vault",    rarity: "epic"      }, // 66
  { money: 6000, items: { prism_orb: 8, lure: 5 },                 label: "Grand Hunt",         rarity: "epic"      }, // 67
  { money: 7000, items: { max_ether: 10, max_revive: 8 },           label: "Zenith Pack",        rarity: "legendary" }, // 68
  { money: 7500, items: { prism_orb: 10, max_revive: 8 },          label: "Emperor Kit",        rarity: "legendary" }, // 69
  { money: 12000, items: { prism_orb: 12, max_revive: 10, max_ether: 10 }, label: "Grand Vault", rarity: "legendary" }, // 70

  // ── 71–80: Cosmic ─────────────────────────────────────────────────────────
  { money: 7000, items: { prism_orb: 8, max_ether: 8 },            label: "Celestial Pack",     rarity: "legendary" }, // 71
  { money: 7500, items: { max_revive: 10 },                         label: "Phoenix Reserve",    rarity: "legendary" }, // 72
  { money: 8000, items: { max_ether: 12 },                          label: "Cosmic Stash",       rarity: "legendary" }, // 73
  { money: 8500, items: { prism_orb: 10, max_revive: 8 },          label: "Astral Cache",       rarity: "legendary" }, // 74
  { money: 9000, items: { prism_orb: 12, max_ether: 10 },          label: "Nebula Pack",        rarity: "legendary" }, // 75
  { money: 8000, items: { max_revive: 10 },                         label: "Void Reserve",       rarity: "legendary" }, // 76
  { money: 8500, items: { prism_orb: 10, lure: 5 },                label: "Apex Hunt",          rarity: "legendary" }, // 77
  { money: 9000, items: { max_ether: 12, max_revive: 10 },          label: "Eclipse Pack",       rarity: "legendary" }, // 78
  { money: 9500, items: { prism_orb: 12, max_revive: 10 },         label: "Supernova Kit",      rarity: "legendary" }, // 79
  { money: 15000, items: { prism_orb: 15, max_revive: 12, max_ether: 12 }, label: "Cosmic Vault", rarity: "legendary" }, // 80

  // ── 81–90: Origin ─────────────────────────────────────────────────────────
  { money: 9000, items: { prism_orb: 10, max_ether: 10 },          label: "Prism Pack",         rarity: "legendary" }, // 81
  { money: 9500, items: { max_revive: 12 },                         label: "Eternal Reserve",    rarity: "legendary" }, // 82
  { money: 10000, items: { max_ether: 15 },                         label: "Origin Stash",       rarity: "legendary" }, // 83
  { money: 10500, items: { prism_orb: 12, max_revive: 10 },        label: "Omega Cache",        rarity: "legendary" }, // 84
  { money: 11000, items: { prism_orb: 15, max_ether: 12 },         label: "Eternal Pack",       rarity: "legendary" }, // 85
  { money: 10000, items: { max_revive: 12 },                        label: "Infinity Reserve",   rarity: "legendary" }, // 86
  { money: 10500, items: { prism_orb: 12, lure: 8 },               label: "Endless Hunt",       rarity: "legendary" }, // 87
  { money: 11000, items: { max_ether: 15, max_revive: 12 },         label: "Apex Void Pack",     rarity: "legendary" }, // 88
  { money: 11500, items: { prism_orb: 15, max_revive: 12 },        label: "Genesis Kit",        rarity: "legendary" }, // 89
  { money: 18000, items: { prism_orb: 20, max_revive: 15, max_ether: 15 }, label: "Legendary Vault", rarity: "legendary" }, // 90

  // ── 91–99: Transcendence ──────────────────────────────────────────────────
  { money: 11000, items: { prism_orb: 12, max_ether: 12 },         label: "Transcendent Pack",  rarity: "legendary" }, // 91
  { money: 12000, items: { max_revive: 15 },                        label: "Infinite Reserve",   rarity: "legendary" }, // 92
  { money: 13000, items: { max_ether: 18 },                         label: "Arcane Apex",        rarity: "legendary" }, // 93
  { money: 14000, items: { prism_orb: 15, max_revive: 12 },        label: "Supreme Cache",      rarity: "legendary" }, // 94
  { money: 15000, items: { prism_orb: 18, max_ether: 15 },         label: "Divine Pack",        rarity: "legendary" }, // 95
  { money: 13000, items: { max_revive: 15 },                        label: "Sacred Reserve",     rarity: "legendary" }, // 96
  { money: 14000, items: { prism_orb: 15, lure: 10 },              label: "Final Hunt",         rarity: "legendary" }, // 97
  { money: 15000, items: { max_ether: 18, max_revive: 15 },         label: "Zenith Apex",        rarity: "legendary" }, // 98
  { money: 17000, items: { prism_orb: 20, max_revive: 15 },        label: "Omega Eve",          rarity: "legendary" }, // 99

  // ── 100: GRAND FINALE ─────────────────────────────────────────────────────
  { type: "grand",
    money: 20000,
    items: { aether_orb: 1 },
    ewamon: { speciesId: "zenryu", variantKey: "dusk", isAlpha: true, level: 100 },
    label: "Grand Finale",
    rarity: "mythical" },                                                        // 100
];

const RARITY_LABELS = {
  common:    "Common",
  uncommon:  "Uncommon",
  rare:      "Rare",
  epic:      "Epic",
  legendary: "Legendary",
  mythical:  "Mythical",
};

module.exports = { BATTLE_PASS_REWARDS, RARITY_LABELS };
