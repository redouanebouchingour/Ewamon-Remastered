/** Forge biome (forgewall, siege_route): steel plate, rivets, anvils, coal, granite, banners, chain. */
import type { SurfaceRecipe } from '../recipe';
import { aux, clamp, each, hex, mix, scale3, setRgb, smoothstep, tiled } from './lib';
import { cloth, lava, masonry, metal } from './families';

export const FILE = 'recipes/forge.ts';

/** Chain links: alternating flat (along u) and edge-on links, rows along v, dark recess behind. */
const chain: SurfaceRecipe = {
  id: 'chain', hero: false, metres: 1, normalStrength: 0.8, wrap: 'repeat', rdo: 4,
  height(h, c) {
    const det = tiled(c.noise, 32, 32, 1);
    const link = aux(h, 'link');
    const rows = 4, per = 6;                                     // 4 chains across the tile, 6 links per tile along u
    each(h, (u, v, i) => {
      const row = Math.floor(v * rows);
      const lv = (v * rows - row - 0.5) * 2;                     // −1..1 across the chain
      const fu = u * per * 2;
      const k = Math.floor(fu);
      const lu = (fu - k - 0.5) * 2;                             // −1..1 along one half-link
      let hh = 0.05, on = 0;
      if (k % 2 === 0) {
        // flat link: a rounded-rectangle ring seen from above
        const ex = (Math.abs(lu) * 1.35) ** 2 + (lv * 1.6) ** 2;
        const ring = Math.abs(Math.sqrt(ex) - 1.05);
        if (ring < 0.28) { hh = 0.45 + 0.5 * Math.sqrt(1 - (ring / 0.28) ** 2); on = 1; }
      } else {
        // edge-on link: a bar along u
        const bar = Math.abs(lv);
        if (bar < 0.2 && Math.abs(lu) < 1.25) { hh = 0.55 + 0.45 * Math.sqrt(1 - (bar / 0.2) ** 2); on = 1; }
      }
      h.data[i] = clamp(hh + 0.04 * det.fbm(u, v, 2), 0, 1);
      link[i] = on;
    });
  },
  albedo(rgb, h, c) {
    const base = hex('#3d3a38'), rust = hex('#5a3322');
    const rn = tiled(c.noise, 8, 8, 2);
    const link = aux(h, 'link');
    each(rgb, (u, v, i) => {
      const r = smoothstep(0.55, 0.75, rn.fbm(u, v, 4));
      const cc = link[i]! ? scale3(base, 0.8 + 0.4 * h.data[i]!) : scale3(base, 0.25);
      setRgb(rgb, i, [mix(cc[0], rust[0], r * 0.6), mix(cc[1], rust[1], r * 0.6), mix(cc[2], rust[2], r * 0.6)]);
    });
  },
  orm(o, h) {
    const link = aux(h, 'link');
    for (let i = 0; i < o.rough.length; i++) {
      o.rough[i] = link[i]! ? 0.42 : 0.8;
      o.metal[i] = link[i]! ? 1 : 0.3;
      o.ao[i] = link[i]! ? 1 : 0.35;
    }
  },
};

export const FORGE_RECIPES: readonly SurfaceRecipe[] = [
  metal({ id: 'forge_steel_plate', hero: true, metres: 2, strength: 0.6, rdo: 4, base: '#6e7174', metal: 1.0, rough: [0.28, 0.55],
    panels: [2, 3], seamPx: 6, rivets: { perEdge: 6, rPx: 9 }, brushed: { dir: 'u', amount: 0.2 }, tone: 0.08 }),
  metal({ id: 'rivet_iron', hero: false, metres: 1, strength: 0.7, rdo: 4, base: '#4d4a47', metal: 0.9, rough: [0.45, 0.75],
    panels: [2, 2], seamPx: 4, rivets: { perEdge: 7, rPx: 8 }, hammered: 0.12, rust: { color: '#5a3322', amount: 0.3 } }),
  metal({ id: 'anvil_black', hero: false, metres: 1, strength: 0.4, rdo: 4, base: '#1f1e1e', metal: 0.95, rough: [0.3, 0.6], hammered: 0.25,
    brushed: { dir: 'u', amount: 0.08 } }),
  lava({ id: 'coal_glow', hero: false, metres: 1, strength: 0.8, rdo: 4, kind: 'coal', crust: '#2a2320', hot: '#8a3a18', rough: [0.9, 0.6], cells: 7 }),
  masonry({ id: 'castle_granite', hero: true, metres: 3, strength: 0.8, rdo: 4, base: '#77736d', mortar: '#55524d', rough: [0.75, 0.9],
    layout: { kind: 'ashlar', rows: 4, min: 2, max: 3, rowJitter: 0.25, jointJitter: 0.3 }, mortarPx: 6, bevelPx: 16, face: 0.3, tone: 0.1,
    speck: { color: '#b5b0a8', amount: 0.5 }, chip: true }),
  cloth({ id: 'banner_cloth', hero: false, metres: 1, strength: 0.35, rdo: 4, kind: 'weave', base: '#8a2a2a', accent: '#c9a24a', rough: 0.85,
    weave: [64, 64], card: 'banner', wrap: 'clamp' }),
  chain,
];
