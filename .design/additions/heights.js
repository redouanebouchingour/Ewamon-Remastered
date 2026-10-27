// Every creature's height in metres: how tall it stands, top of the head (or crest, flame, ears) to the ground, as its
// sprite draws it. The content generator writes it to `SpeciesDef.heightM` (and a battle form's `heightM`, keyed
// `<species>_<form>`, when the form stands taller than the species); the dex shows it, and the renderer draws the
// creature exactly this tall in battle, as a follower and in the wild (`SpriteFrame.bodyV`: the share of its card the
// body fills). A long creature (a fish, a serpent, a wolf) is measured upright, so its length follows from its sprite.
//
// Judged by eye from the sprites, the flavor text and the line it belongs to. The player character is 1.55 m: a
// starter reaches the knee, a final stage stands at or above the shoulder, a legendary towers.
//
// Dependency-free CommonJS, evaluated the same way as ewamon.js.

const EWAMON_HEIGHTS = {
  // the starter lines
  bramblecub: 0.5, briarbear: 1.2, thornback: 2.1,
  cindercap: 0.45, pyrecap: 0.9, infernomorel: 1.7,
  glimfin: 0.35, voltide: 0.5, abysspark: 0.9,

  // the other lines, in dex order
  smellduck: 0.5, bloomduck: 0.9,
  budwing: 0.4, bloomdrake: 0.9, florasage: 1.8,
  fennorange: 0.45, berkest: 0.9, clementar: 1.7,
  glimp: 0.35, glimmereen: 0.6,
  shiveruff: 0.5, blizzhowl: 1.1, auroracle: 1.4,
  pebblit: 0.35, lithokrysm: 1.4, prismolith: 1.9,
  nettlewisp: 0.5, briarvaunt: 1.6,
  ampmite: 0.2, luxtrik: 0.5,
  gustuff: 0.5, cirrileap: 1.0,
  brookrawl: 1.1,
  zaptus: 0.45, nebucloak: 1.0, archonosis: 1.7,
  grubolt: 0.5, ironcarab: 0.9,
  embrock: 0.6, magmolith: 1.4,
  mudbub: 0.5, bogmaw: 1.0,
  mufflo: 0.6, wooltug: 0.9, rambull: 1.6,
  stormchick: 0.3, thundrix: 1.3,
  scalewisp: 0.5, rexaloft: 1.9,
  tidalfang: 0.6, abyssrake: 2.6,
  glacifang: 0.5, blizzraak: 1.9,
  mossling: 0.3, verdatide: 1.6,
  slushpup: 0.4, frofloe: 1.1,
  glowtent: 0.5, toxiveil: 1.4,
  snapling: 0.5, venobulb: 1.3,
  seedrift: 0.3, blossomsail: 0.9,
  coldplate: 0.8, glaciarm: 2.0,
  wickling: 0.3, ignispectre: 1.8,
  dreambud: 0.4, starwhim: 1.2,
  shardling: 0.7, gemknight: 1.8,
  murkrat: 0.4, toxshade: 1.3,
  pebfist: 0.9, geoboxer: 1.8,
  flampling: 0.3, solpyre: 1.7,
  resilian: 0.4, resilith: 0.9, resilithorn: 1.8,
  rimeidol: 0.5, murmink: 0.8, velvetomb: 1.4,
  darkone: 0.8, darkyon: 1.6, aonred: 2.0,
  nerohat: 0.5, fedoraith: 1.3,
  tidespine: 1.0, tsunamite: 2.2,
  fibrostis: 0.8, chrysotox: 2.3,
  alloylark: 0.6, rivetalon: 1.4,
  hexroach: 0.4, blighthex: 1.0,
  scraphog: 0.6, trenchtusk: 1.3,
  coalette: 0.5, caldermole: 1.3,
  ripshell: 1.3,
  bloomsprite: 0.3,
  umbrit: 1.0, voidraith: 2.0,
  acier: 1.9,
  miscarmen: 0.5, mismagmen: 1.3,
  moflame: 0.9, moblaze: 1.3,
  yahit: 1.1, yaschamp: 1.6, yasprime: 2.0,
  serpyre: 0.8, pyrothal: 1.9,
  wraithtide: 1.6,
  flowbot: 1.6,
  kygra: 1.6, kykaiser: 2.4,
  raidori: 1.5,
  malice: 0.5, devourest: 1.1, necrogeist: 2.2,
  hollowmane: 2.0,
  dustcub: 0.6, badlander: 1.7, lawlander: 1.7,
  veilpup: 0.6, hollowolf: 1.6,
  castlemaw: 1.8,
  cryptorb: 0.6, ultraze: 2.1, vysion: 1.9,
  puffinch: 0.25, gustling: 0.6, galeforth: 1.4,
  corvlet: 0.4, ravenmourne: 1.4, augurvane: 1.3,
  sproutgrub: 0.3, leafcoon: 0.7, mantleaf: 1.5,
  snowlet: 0.3, hoarfrowl: 1.5,
  tuskling: 0.8, shagtusk: 1.8, rimetusk: 3.6,
  scorpit: 0.25, dunevenom: 1.3,
  shalewing: 0.5, petraptor: 2.4,
  twinklit: 0.3, lumistar: 0.8, stellaria: 1.6,
  meteorb: 0.5, craterhulk: 2.8,
  gravelwisp: 0.5, tombdune: 2.2,
  gnashfin: 0.6, dreadmaw: 2.4,
  kindlegrub: 0.4, pyremoth: 1.2,
  joeyjab: 0.6, roobrawler: 1.8,
  burrowyrm: 0.6, dunescale: 1.1, mesadrake: 2.4,

  // legendaries
  glacinid: 3.2, galaxion: 3.0, voltaura: 2.0, voidraxis: 4.0, sunjaw: 2.6,
  raikitsune: 2.2, bankaiser: 3.0, zenryu: 2.6, hyoryu: 3.5, astaroth: 3.2,

  // mythicals
  lumyth: 1.2, noxmyth: 2.2,
  elemutt: 0.5, katamute: 1.3, ravatar: 2.6,

  // battle forms (`<species>_<form>`): the form rises, flares or bulks past the species' own height
  abysspark_tenjin: 1.0,
  acier_majin: 2.1,
  badlander_majin: 1.9,
  castlemaw_rage: 2.0,
  clementar_majin: 1.8,
  gemknight_tenjin: 2.0,
  glimmereen_tenjin: 0.7,
  hollowmane_rage: 2.3,
  hyoryu_majin: 3.8,
  infernomorel_majin: 1.9,
  lawlander_tenjin: 1.8,
  necrogeist_majin: 2.4,
  raidori_tenjin: 1.7,
  ravatar_avatar: 3.0,
  solpyre_tenjin: 1.9,
  thornback_tenjin: 2.3,
  toxshade_majin: 1.5,
  zenryu_majin: 2.8,
};

module.exports = { EWAMON_HEIGHTS };
