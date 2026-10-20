/**
 * Zone sculpts (`sculpt.ts`): every zone's hand-authored macro shape, so no two places read alike. Coordinates are
 * world metres (x east, z south); a route's `road_main` runs from the west edge (−120, 0) to the east edge (120, 0).
 * Authored points (npcs, trainers, items, lore, warps, the spawn) keep a flat, dry 4 m clearing of their own, so a
 * shape keeps ≥ 9 m off any point it should not swallow; validate proves every point, door and exit stays reachable.
 */
import type { ZoneId } from '../types';
import type { SVec2, SculptLift, ZoneSculpt } from '../sculpt';

/**
 * A rock face along a linked edge, over the lateral coordinates `from`..`to` (`half`: the playable half-extent). A
 * handover lands on the same lateral coordinate of the neighbour (server `entryPoint`, §30.2.7), so where the
 * neighbour's entry line is cut off (a caldera rim, a ravine floor, a crag top) the edge here is closed: no one
 * crosses there to land where they cannot walk on.
 *
 * The face climbs 12 m over 12 m from 10 m inside the playable edge to the margin, steeper than 35° the whole way, so
 * it holds no walkable ground: the trigger line (6 m in) cannot be reached in front of it, and an arrival from the
 * neighbour that lands on it (6.5 m in) snaps to the open ground at its foot (`nearestWalkable`, 8 m), never onto a
 * ledge. In front of an end the trigger line opens 2.7–5 m past `to` (or before `from`), ragged outline included.
 */
function shoulder(dir: 'n' | 'e' | 's' | 'w', half: number, from: number, to: number): SculptLift {
  const o = half + 24;
  const i = half - 4;
  const poly: SVec2[] =
    dir === 'e' ? [[i, from], [o, from], [o, to], [i, to]]
    : dir === 'w' ? [[-o, from], [-i, from], [-i, to], [-o, to]]
    : dir === 's' ? [[from, i], [to, i], [to, o], [from, o]]
    : [[from, -o], [to, -o], [to, -i], [from, -i]];
  return { poly, h: 12, edge: 12, ragged: 1 };
}

export const SCULPTS: Readonly<Partial<Record<ZoneId, ZoneSculpt>>> = {
  // The fen: the road leaves Mirevale between hedgerows, crosses the mire on the boardwalk causeway, then bridges the
  // Pell stream and climbs out east. A hedge-topped bluff walls the north (a ramp up to the thicket), wet meadow south.
  mire_route: {
    rough: 0.8,
    ponds: 1,
    lifts: [
      // the north bluff
      { poly: [[-112, -112], [40, -112], [34, -70], [16, -52], [-14, -44], [-40, -46], [-66, -38], [-96, -34], [-112, -36]], h: 4, edge: 3.2, ragged: 3 },
      // a low knoll the road skirts in the east
      { poly: [[78, 14], [100, 10], [108, 30], [96, 52], [76, 46]], h: 2.4, edge: 2.2, ragged: 2 },
      // the caldera's outer flank: Cinderhold is entered only through its west pass; Mirevale's north bluff
      shoulder('e', 104, -130, -10.2), shoulder('e', 104, 13.2, 130), shoulder('w', 104, -130, -46.2),
    ],
    hills: [
      { x: -40, z: 80, r: 30, h: 2.5 }, { x: 20, z: 92, r: 26, h: 2 }, { x: 88, z: -70, r: 24, h: 3 }, { x: -90, z: 64, r: 22, h: 1.6 },
    ],
    lakes: [
      // the mire, both sides of the causeway (Wynn's spot at (10, −8) stays on the bank)
      { poly: [[-12, -1], [-24, -10], [-20, -22], [-6, -20], [0, -10], [2, -4], [12, 1], [22, 8], [26, 18], [12, 26], [-6, 22], [-20, 6]], depth: 1.1, shore: 5, ragged: 1.5 },
    ],
    rivers: [
      { points: [[62, -112], [56, -84], [50, -54], [54, -26], [62, -4], [66, 20], [62, 48], [54, 80], [50, 112]], width: 5, depth: 1.2, bank: 3 },
    ],
    roads: [
      { id: 'road_main', kind: 'road', width: 3.5, points: [[-120, 0], [-92, 0], [-76, 3], [-58, 2], [-40, -1], [-24, 0], [0, 0], [22, 0], [38, 4], [54, 6], [70, 2], [86, -4], [104, -2], [120, 0]] },
      // up the bluff to the thicket
      { id: 'trail_bluff', kind: 'path', width: 2, points: [[-84, 1], [-86, -16], [-82, -34], [-80, -48]] },
      // up the knoll
      { id: 'trail_knoll', kind: 'path', width: 1.8, points: [[88, -4], [93, 8], [93, 24], [88, 34]] },
      // the meadow loop past the forager and Pim
      { id: 'trail_meadow', kind: 'path', width: 1.8, points: [[-46, -1], [-38, 14], [-28, 30], [-18, 44], [-4, 52], [12, 50], [30, 36], [40, 6]] },
    ],
    grass: [
      { x: -70, z: 24, rx: 13, rz: 7, yaw: 0.15 },
      { x: -48, z: -72, rx: 16, rz: 10, yaw: -0.2 },
      { x: 30, z: 26, rx: 11, rz: 7, yaw: 0.4 },
      { x: 84, z: -34, rx: 9, rz: 12, yaw: 0.1 },
      { x: -40, z: 44, rx: 8, rz: 6, yaw: -0.3 },
      { x: 4, z: 74, rx: 12, rz: 7, yaw: 0.2 },
    ],
    fences: [
      [[-104, -6], [-96, -6], [-88, -5]],
      [[-104, 6], [-96, 6], [-80, 8]],
      [[-60, -44], [-40, -50], [-20, -48]],
    ],
    props: [
      // the travellers' camp
      { kind: 'tent', x: 38, z: -18, yaw: 0.4 }, { kind: 'campfire', x: 43, z: -20 },
      { kind: 'sign', x: -90, z: -8, yaw: 0 },
      { kind: 'log', x: 46, z: -12, yaw: 1.2 },
      { kind: 'stump', x: 44, z: -8 },
      { kind: 'rock_l', x: -30, z: -60 },
      { kind: 'rock_m', x: -26, z: -62 },
    ],
    outcrops: [
      { n: 6, r: [4, 7], h: [1.4, 2.4], edge: 2.6, seed: 0x31e1 },
      { n: 4, r: [2, 3.5], h: [1.5, 2.5], edge: 0.7, seed: 0x31e2 },
    ],
  },

  // The ash flats: a lava-floored ravine splits the route north to south and the lava bridge spans it; basalt columns
  // stand in the east, a cinder cone with a crater smokes in the north-east, ash dunes roll in the south-west.
  ash_route: {
    rough: 0.9,
    ponds: 0,
    lifts: [
      { line: { points: [[-12, -114], [-16, -80], [-12, -50], [-20, -22], [-19, -5], [-18, 10], [-26, 36], [-18, 66], [-22, 96], [-16, 114]], width: 10 }, h: -7, edge: 3, ragged: 1.5, bridged: true },
      // the cone's crater
      { circle: { x: 70, z: -70, r: 7 }, h: -5, edge: 3.5, ragged: 1 },
      // Cinderhold's east pass; Saltmourn's headland
      shoulder('w', 104, -130, -6.7), shoulder('w', 104, 8.2, 130), shoulder('e', 104, -130, -50.7),
    ],
    hills: [{ x: 70, z: -70, r: 28, h: 8 }, { x: -60, z: 72, r: 24, h: 3 }, { x: -90, z: -60, r: 20, h: 2.5 }, { x: 30, z: 92, r: 22, h: 2 }],
    rivers: [{ points: [[-12, -114], [-16, -80], [-12, -50], [-20, -22], [-19, -5], [-18, 10], [-26, 36], [-18, 66], [-22, 96], [-16, 114]], width: 4.5, depth: 0.5, bank: 1.5 }],
    roads: [
      { id: 'road_main', kind: 'road', width: 3.5, points: [[-120, 0], [-92, 0], [-74, -6], [-54, -10], [-34, -8], [-19, -5], [-4, 0], [12, 4], [26, 8], [42, 4], [58, -6], [76, -10], [96, -4], [120, 0]] },
      // the burner's camp and the cone path
      { id: 'trail_camp', kind: 'path', width: 1.8, points: [[-46, -9], [-44, -20], [-40, -30]] },
      { id: 'trail_cone', kind: 'path', width: 2, points: [[60, -7], [54, -24], [56, -42], [66, -56], [82, -70], [92, -84]] },
    ],
    setPiece: { x: -19, z: -5, yaw: -0.33 },
    grass: [
      { x: -64, z: 20, rx: 9, rz: 6, yaw: 0.2 }, { x: 40, z: 30, rx: 12, rz: 8, yaw: -0.3 }, { x: -56, z: -50, rx: 10, rz: 7, yaw: 0.4 },
      { x: 72, z: 22, rx: 8, rz: 10, yaw: 0 }, { x: 8, z: 70, rx: 14, rz: 7, yaw: 0.1 }, { x: 10, z: -50, rx: 10, rz: 8, yaw: -0.2 },
    ],
    props: [
      // the travellers' camp
      { kind: 'tent', x: -50, z: -38, yaw: 0.8 }, { kind: 'campfire', x: -42, z: -40 },
      { kind: 'log', x: -36, z: -36, yaw: 0.4 }, { kind: 'crate', x: -46, z: -26 }, { kind: 'barrel', x: -45, z: -24 }, { kind: 'stump', x: -34, z: -26 },
      { kind: 'sign', x: -36, z: -4, yaw: 0 },
    ],
    outcrops: [
      { n: 12, r: [1.4, 3], h: [3, 6.5], edge: 0.45, ragged: 0.6, seed: 0xa5e1, area: { x0: 10, x1: 104, z0: -40, z1: 100 } },
      { n: 5, r: [3, 5], h: [1.5, 2.5], edge: 0.8, seed: 0xa5e2, area: { x0: -104, x1: -30, z0: -104, z1: 104 } },
    ],
  },

  // The long strand: the coast road runs above a wide beach; the sea fills the north-east (the swimmer waits at the
  // pier's end), the wreck lies on the sand, a salt lagoon sits behind the dunes in the south-west.
  tide_route: {
    rough: 0.7,
    ponds: 0,
    lakes: [
      { poly: [[-6, -125], [125, -125], [125, -24], [100, -24], [90, -38], [78, -36], [62, -42], [44, -42], [28, -38], [14, -40], [4, -52], [-2, -72], [-8, -100]], depth: 2.2, shore: 9, ragged: 2 },
      { poly: [[-104, 41], [-90, 44], [-70, 52], [-62, 66], [-74, 84], [-98, 86], [-108, 70]], depth: 1.2, shore: 6, ragged: 2 },
      { poly: [[58, 60], [72, 58], [78, 68], [70, 76], [58, 72]], depth: 0.9, shore: 3, ragged: 1 },
    ],
    hills: [{ x: 0, z: 52, r: 20, h: 2.5 }, { x: 60, z: 88, r: 18, h: 2 }, { x: -30, z: 62, r: 22, h: 3 }, { x: -60, z: -60, r: 24, h: 3 }],
    // a sea stack where Stormrook's west edge is a pinnacle top
    lifts: [shoulder('e', 104, 12.5, 13)],
    roads: [
      { id: 'road_main', kind: 'road', width: 3.5, points: [[-120, 0], [-92, 0], [-70, -6], [-48, -4], [-30, 2], [-10, -8], [10, -16], [30, -20], [50, -16], [70, -8], [88, -6], [104, -4], [120, 0]] },
      { id: 'pier_swimmer', kind: 'path', width: 2.2, points: [[22, -20], [21, -34], [20, -46], [20, -56]] },
      { id: 'trail_dunes', kind: 'path', width: 1.8, points: [[-30, 3], [-20, 24], [0, 34], [24, 32], [40, 26], [56, 44]] },
    ],
    setPiece: { x: 46, z: -31, yaw: 0.15 },
    grass: [
      { x: -52, z: 24, rx: 10, rz: 6, yaw: 0.1 }, { x: 18, z: 44, rx: 12, rz: 7, yaw: -0.2 }, { x: 92, z: 34, rx: 8, rz: 10, yaw: 0 },
      { x: -62, z: -50, rx: 12, rz: 8, yaw: 0.3 }, { x: -20, z: 84, rx: 12, rz: 7, yaw: 0 },
    ],
    fences: [[[-56, 40], [-44, 46], [-30, 46]], [[60, 6], [80, 4], [96, 8]]],
    props: [
      // the travellers' camp
      { kind: 'tent', x: -6, z: 22, yaw: 0.3 }, { kind: 'campfire', x: -11, z: 17 },{ kind: 'barrel', x: 24, z: -24 }, { kind: 'crate', x: 18, z: -25 }, { kind: 'log', x: 64, z: -26, yaw: 0.3 }, { kind: 'sign', x: 26, z: -16, yaw: 0 }],
    outcrops: [{ n: 8, r: [2, 4], h: [1.5, 3], edge: 0.6, seed: 0x71de, area: { x0: -100, x1: 100, z0: 10, z1: 100 } }],
  },

  // The gorge line: a river gorge cuts the moor and the galvan span carries the road over it; a higher moor walls the
  // north (a ramp up to the stones), granite tors break the heather everywhere else.
  galvan_route: {
    rough: 0.9,
    ponds: 0,
    lifts: [
      { line: { points: [[6, -114], [10, -80], [4, -50], [0, -24], [4, -3], [14, 30], [6, 60], [0, 90], [4, 114]], width: 14 }, h: -6, edge: 2.6, ragged: 2, bridged: true },
      { poly: [[-112, -112], [112, -112], [112, -64], [70, -58], [30, -66], [-10, -62], [-50, -58], [-90, -56], [-112, -60]], h: 3.5, edge: 2.4, ragged: 3 },
      // Stormrook's ravine (north) and its low terrace (south) meet the west edge
      shoulder('w', 104, -130, -48.2), shoulder('w', 104, 52.2, 130),
    ],
    rivers: [{ points: [[6, -114], [10, -80], [4, -50], [0, -24], [4, -3], [14, 30], [6, 60], [0, 90], [4, 114]], width: 6, depth: 1.2, bank: 1.5 }],
    hills: [{ x: -60, z: 60, r: 26, h: 3 }, { x: 70, z: 70, r: 24, h: 3.5 }, { x: 80, z: -30, r: 18, h: 2 }],
    roads: [
      { id: 'road_main', kind: 'road', width: 3.5, points: [[-120, 0], [-92, 0], [-72, 4], [-50, 10], [-30, 6], [-12, 0], [4, -3], [20, -6], [38, -2], [56, 8], [76, 12], [96, 6], [120, 0]] },
      { id: 'trail_moor', kind: 'path', width: 2, points: [[-80, 6], [-82, -20], [-80, -46], [-74, -68]] },
      { id: 'trail_east_moor', kind: 'path', width: 2, points: [[60, 9], [64, -20], [60, -48], [52, -74]] },
    ],
    setPiece: { x: 4, z: -3, yaw: 0.19 },
    grass: [
      { x: -58, z: 30, rx: 12, rz: 8, yaw: 0.2 }, { x: 38, z: 30, rx: 10, rz: 7, yaw: -0.1 }, { x: 70, z: -24, rx: 9, rz: 8, yaw: 0 },
      { x: -28, z: -82, rx: 12, rz: 8, yaw: 0.2 }, { x: -40, z: 70, rx: 12, rz: 7, yaw: -0.2 }, { x: 40, z: -86, rx: 12, rz: 7, yaw: 0 },
    ],
    props: [
      // the travellers' camp
      { kind: 'tent', x: -32, z: 48, yaw: 0.3 }, { kind: 'campfire', x: -27, z: 52 },{ kind: 'sign', x: -76, z: 10, yaw: 0 }],
    outcrops: [{ n: 11, r: [2.5, 5], h: [2, 4.5], edge: 0.6, seed: 0x6a17 }],
  },

  // The deep cut: the road runs in a canyon sawn through a red mesa; ramps climb to the mesa top at four places, and
  // hoodoos stand on the tableland above. The arch spans the canyon at its narrows.
  deepcut_route: {
    rough: 0.7,
    ponds: 0,
    lifts: [
      { line: { points: [[-125, 0], [-92, 0], [-70, 4], [-46, -6], [-22, -10], [0, -6], [22, 2], [44, 0], [66, -6], [88, -4], [125, 0]], width: 22 }, h: -6.5, edge: 3, ragged: 2.5 },
    ],
    roads: [
      { id: 'road_main', kind: 'road', width: 3.5, points: [[-120, 0], [-92, 0], [-70, 4], [-46, -6], [-22, -10], [0, -6], [22, 2], [44, 0], [66, -6], [88, -4], [120, 0]] },
      { id: 'ramp_nw', kind: 'path', width: 2.2, points: [[-56, -4], [-54, -18], [-58, -32], [-64, -42]] },
      { id: 'ramp_sw', kind: 'path', width: 2.2, points: [[-14, -6], [-18, 8], [-22, 24], [-22, 40]] },
      { id: 'ramp_ne', kind: 'path', width: 2.2, points: [[32, 2], [30, -12], [24, -24], [30, -40], [48, -40]] },
      { id: 'ramp_se', kind: 'path', width: 2.2, points: [[56, -3], [56, 10], [52, 22], [60, 40], [76, 54]] },
    ],
    setPiece: { x: 0, z: -6, yaw: 0.05 },
    grass: [
      { x: -66, z: -66, rx: 12, rz: 8, yaw: 0.2 }, { x: 34, z: -56, rx: 12, rz: 8, yaw: -0.1 }, { x: -50, z: 42, rx: 12, rz: 8, yaw: 0.3 },
      { x: 84, z: 36, rx: 10, rz: 8, yaw: 0 }, { x: 8, z: 62, rx: 10, rz: 6, yaw: 0.2 },
    ],
    props: [
      // the travellers' camp
      { kind: 'tent', x: 8, z: -42, yaw: 0.6 }, { kind: 'campfire', x: 13, z: -38 },
      { kind: 'cart', x: -30, z: -2, yaw: 0.3 }, { kind: 'crate', x: 12, z: -4 }, { kind: 'barrel', x: 15, z: -7 }, { kind: 'sign', x: -60, z: 6, yaw: 0 },
      { kind: 'rock_l', x: 72, z: 9 }, { kind: 'rock_l', x: -80, z: -4 },
    ],
    outcrops: [
      { n: 9, r: [1.8, 3], h: [5, 9], edge: 0.4, ragged: 0.6, seed: 0xdee1 },
      { n: 6, r: [5, 8], h: [2, 3], edge: 0.6, seed: 0xdee2 },
    ],
  },

  // The hollow way: west and east the road sinks between earth banks under the trees; in the middle the lantern road
  // runs open. A graveyard hill rises in the south-west, a black bog lies north with a plank walk across it.
  hollow_route: {
    rough: 0.9,
    ponds: 0,
    lifts: [
      { line: { points: [[-84, -4], [-72, -6], [-50, -8], [-30, -2], [-22, 0]], width: 9 }, h: -2.6, edge: 2.4, ragged: 1 },
      { line: { points: [[26, 1], [30, 0], [50, -6], [70, -4], [84, 2]], width: 9 }, h: -2.6, edge: 2.4, ragged: 1 },
      { poly: [[-78, 28], [-50, 24], [-26, 38], [-22, 70], [-50, 84], [-82, 72]], h: 2.8, edge: 2.2, ragged: 2.5 },
      // Vesperveil's canal cuts its east edge off in the south
      shoulder('w', 104, 57.2, 130),
    ],
    lakes: [{ poly: [[0, -36], [30, -34], [44, -50], [36, -76], [10, -84], [-12, -66], [-10, -46]], depth: 1.3, shore: 5, ragged: 2 }],
    roads: [
      { id: 'road_main', kind: 'road', width: 3.5, points: [[-120, 0], [-92, 0], [-72, -6], [-50, -8], [-30, -2], [-10, 4], [10, 4], [30, 0], [50, -6], [70, -4], [90, 4], [120, 0]] },
      { id: 'trail_graves', kind: 'path', width: 1.8, points: [[-16, 3], [-24, 16], [-34, 30], [-40, 44]] },
      { id: 'walk_bog', kind: 'path', width: 2.2, points: [[-14, 3], [-16, -24], [-6, -50], [16, -62], [40, -60], [56, -48]] },
    ],
    grass: [
      { x: -86, z: 20, rx: 8, rz: 6, yaw: 0 }, { x: 30, z: 40, rx: 12, rz: 8, yaw: 0.2 }, { x: 82, z: -24, rx: 9, rz: 7, yaw: -0.1 },
      { x: -60, z: -58, rx: 10, rz: 7, yaw: 0.3 }, { x: 80, z: 60, rx: 10, rz: 8, yaw: 0 },
    ],
    props: [
      // the travellers' camp
      { kind: 'tent', x: 22, z: 24, yaw: -0.5 }, { kind: 'campfire', x: 18, z: 30 },
      { kind: 'rock_m', x: -56, z: 62 }, { kind: 'rock_m', x: -48, z: 66 }, { kind: 'rock_m', x: -60, z: 46 }, { kind: 'rock_m', x: -30, z: 60 },
      { kind: 'stump', x: -44, z: 36 }, { kind: 'sign', x: -18, z: 10, yaw: 0 },
    ],
    outcrops: [{ n: 8, r: [3, 6], h: [1.2, 2], edge: 2.6, seed: 0x4011 }],
  },

  // The old siege lines: two earthwork ramparts cross the field north to south, the road passing their gates; shell
  // craters pock the ground between, and the trebuchet still stands on its hill in the east.
  siege_route: {
    rough: 0.8,
    ponds: 0,
    lifts: [
      { line: { points: [[-46, -114], [-48, -70], [-46, -40], [-44, -10], [-42, 20], [-44, 50], [-40, 90], [-44, 114]], width: 5 }, h: 3, edge: 1.6, ragged: 0.8, bridged: true, dress: 'palisade' },
      { line: { points: [[38, -114], [38, -80], [36, -40], [38, -8], [40, 30], [44, 70], [42, 114]], width: 5 }, h: 3, edge: 1.6, ragged: 0.8, bridged: true, dress: 'palisade' },
      { circle: { x: 0, z: -18, r: 6 }, h: -1.6, edge: 4 }, { circle: { x: -12, z: 30, r: 5 }, h: -1.3, edge: 4 },
      { circle: { x: 14, z: -66, r: 6 }, h: -1.5, edge: 4 }, { circle: { x: -76, z: 40, r: 5 }, h: -1.2, edge: 4 }, { circle: { x: 80, z: -44, r: 5 }, h: -1.3, edge: 4 },
      // Skyrend's massif stands on its west edge in the north
      shoulder('e', 104, -130, -54.7),
    ],
    hills: [{ x: 82, z: 10, r: 22, h: 4 }, { x: -80, z: -30, r: 20, h: 2 }],
    roads: [
      { id: 'road_main', kind: 'road', width: 3.5, points: [[-120, 0], [-92, 0], [-74, 4], [-56, 0], [-44, -6], [-26, 6], [-6, 4], [14, -4], [38, -8], [58, -6], [74, -14], [96, -8], [120, 0]] },
      // the sally port through the north of the west rampart, and the south gate of the east one
      { id: 'trail_sally', kind: 'path', width: 2, points: [[-70, 2], [-62, -40], [-46, -52], [-30, -56]] },
      { id: 'trail_south_gate', kind: 'path', width: 2, points: [[24, -6], [30, 30], [42, 50], [56, 50]] },
    ],
    setPiece: { x: 84, z: 12, yaw: 0.6 },
    grass: [
      { x: -82, z: 30, rx: 12, rz: 8, yaw: 0.2 }, { x: -10, z: -42, rx: 12, rz: 8, yaw: -0.2 }, { x: 10, z: 40, rx: 12, rz: 7, yaw: 0.1 },
      { x: 70, z: -40, rx: 9, rz: 8, yaw: 0 }, { x: 64, z: 72, rx: 10, rz: 8, yaw: 0.3 },
    ],
    props: [
      // the travellers' camp
      { kind: 'tent', x: -26, z: -28, yaw: 0 }, { kind: 'tent', x: -17, z: -30, yaw: 0.2 }, { kind: 'campfire', x: -21, z: -22 },
      { kind: 'cart', x: -30, z: 14, yaw: 1.2 }, { kind: 'crate', x: 4, z: 10 }, { kind: 'crate', x: 6, z: 11 }, { kind: 'barrel', x: 58, z: -14 },
      { kind: 'log', x: -20, z: -12, yaw: 0.8 }, { kind: 'sign', x: -54, z: -6, yaw: 0 },
    ],
    outcrops: [{ n: 6, r: [2.5, 4], h: [1.5, 2.5], edge: 0.6, seed: 0x5e9e }],
  },

  // The ascent: three tiers climb eastward behind cliffs; the road switchbacks up the first and takes the ascent stair
  // up the second. A tarn lies in the north-west cirque with a fishing pier; crags stand on every tier.
  ascent_route: {
    rough: 0.8,
    ponds: 0,
    lifts: [
      { poly: [[-38, -125], [125, -125], [125, 125], [-34, 125], [-30, 70], [-42, 30], [-36, -10], [-44, -50], [-36, -90]], h: 4, edge: 2.4, ragged: 2.5 },
      { poly: [[44, -125], [125, -125], [125, 125], [40, 125], [42, 60], [30, 24], [36, 4], [38, -10], [46, -40], [44, -80]], h: 4, edge: 2.4, ragged: 2.5 },
      // Skyrend's massif (north) and a crag (south) on its east line; the tarn keeps off the edge below the massif
      shoulder('w', 104, -130, -51.2), shoulder('w', 104, 14, 14.5),
    ],
    lakes: [{ poly: [[-94, -36], [-88, -28], [-78, -44], [-84, -58], [-86, -60]], depth: 1.6, shore: 4, ragged: 1.5 }],
    roads: [
      { id: 'road_main', kind: 'road', width: 3.5, points: [[-120, 0], [-92, 0], [-72, -4], [-56, -10], [-48, -22], [-36, -30], [-20, -24], [-8, -10], [6, 0], [20, 4], [34, 4], [50, 2], [68, 8], [90, 2], [120, 0]] },
      { id: 'pier_tarn', kind: 'path', width: 2, points: [[-80, -2], [-82, -20], [-86, -34], [-86, -44]] },
      { id: 'trail_cirque', kind: 'path', width: 1.8, points: [[-60, -14], [-62, -40], [-68, -62]] },
    ],
    setPiece: { x: 34, z: 4, yaw: 1.5708 },
    grass: [
      { x: -82, z: 22, rx: 10, rz: 7, yaw: 0 }, { x: -10, z: 60, rx: 12, rz: 8, yaw: 0.2 }, { x: 0, z: -60, rx: 12, rz: 8, yaw: -0.2 },
      { x: 72, z: 52, rx: 10, rz: 9, yaw: 0 }, { x: 80, z: -60, rx: 10, rz: 8, yaw: 0.3 },
    ],
    props: [
      // the travellers' camp
      { kind: 'tent', x: -26, z: -48, yaw: 0.5 }, { kind: 'campfire', x: -20, z: -44 },{ kind: 'sign', x: -50, z: -4, yaw: 0 }, { kind: 'log', x: -24, z: -34, yaw: 0.5 }],
    outcrops: [{ n: 10, r: [2, 4], h: [2.5, 5], edge: 0.6, seed: 0xa5c3 }],
  },

  // ─── towns ───────────────────────────────────────────────────────────────

  // Home: the village sits in a green valley under the heart tree. A bluff closes the north behind the archive, the
  // Mire brook curls round the south (the lane crosses it on a footbridge), an orchard is fenced off to the west.
  mirevale: {
    rough: 0.9,
    ponds: 0,
    lifts: [{ poly: [[-90, -90], [90, -90], [90, -48], [50, -44], [20, -52], [-10, -54], [-40, -48], [-70, -44], [-90, -46]], h: 4, edge: 2.6, ragged: 2.5 }],
    hills: [{ x: 62, z: -28, r: 16, h: 2 }, { x: -64, z: 40, r: 16, h: 1.6 }],
    rivers: [{ points: [[-90, 26], [-62, 36], [-34, 50], [-6, 58], [22, 60], [48, 52], [70, 58], [92, 50]], width: 6, depth: 1.1, bank: 2.5 }],
    roads: [{ id: 'lane_s', kind: 'lane', width: 3, points: [[0, 13.4], [0, 30], [1, 46], [2, 64], [4, 72]] }],
    fences: [[[-58, -14], [-40, -14]], [[-58, 14], [-40, 14]], [[-58, -14], [-58, 14]]],
    props: [
      { kind: 'tree_oak', x: -54, z: -8, scale: 0.8 }, { kind: 'tree_oak', x: -46, z: -8, scale: 0.75 }, { kind: 'tree_oak', x: -54, z: 1, scale: 0.8 },
      { kind: 'tree_oak', x: -46, z: 1, scale: 0.7 }, { kind: 'tree_oak', x: -54, z: 9, scale: 0.8 }, { kind: 'tree_oak', x: -46, z: 9, scale: 0.75 },
      { kind: 'cart', x: -36, z: 4, yaw: 1.4 },
    ],
  },

  // A town in a caldera: the crater rim rings it, cut by the two road passes; obsidian spires stand inside the rim and
  // a lava lake glows at the foot of the south lane.
  cinderhold: {
    rough: 0.8,
    ponds: 0,
    lifts: [{
      line: { points: [[63, 0], [60.9, 16.3], [54.6, 31.5], [44.5, 44.5], [31.5, 54.6], [16.3, 60.9], [0, 63], [-16.3, 60.9], [-31.5, 54.6], [-44.5, 44.5], [-54.6, 31.5], [-60.9, 16.3], [-63, 0], [-60.9, -16.3], [-54.6, -31.5], [-44.5, -44.5], [-31.5, -54.6], [-16.3, -60.9], [0, -63], [16.3, -60.9], [31.5, -54.6], [44.5, -44.5], [54.6, -31.5], [60.9, -16.3], [63, 0], [60.9, 16.3]], width: 12 },
      h: 6, edge: 3, ragged: 2, bridged: true,
    }],
    lakes: [{ poly: [[-24, 44], [0, 40], [20, 46], [22, 58], [0, 62], [-20, 58]], depth: 0.8, shore: 4, ragged: 1 }],
    roads: [
      // a viewing jetty out over the lava
      { id: 'jetty_lava', kind: 'path', width: 2, points: [[1, 34], [1, 42], [3, 50]] },
      { id: 'road_w', kind: 'road', width: 3.5, points: [[-13.4, 0], [-30, 1], [-50, 0], [-66, -1], [-80, 0]] },
      { id: 'road_e', kind: 'road', width: 3.5, points: [[13.4, 0], [30, -1], [50, 0], [66, 1], [80, 0]] },
    ],
    outcrops: [{ n: 8, r: [1.4, 2.4], h: [3.5, 6], edge: 0.45, ragged: 0.5, seed: 0xc1d3, ring: [38, 54], axes: 9 }],
  },

  // The harbour: the sea fills the south, two piers run out from the quay (the lane and the harbourmaster's), a
  // headland rises in the north-west and rocks break the shore.
  saltmourn: {
    rough: 0.7,
    ponds: 0,
    lakes: [{ poly: [[-125, 56], [-60, 58], [-30, 54], [-14, 52], [6, 54], [16, 60], [40, 60], [60, 56], [125, 58], [125, 125], [-125, 125]], depth: 2, shore: 6, ragged: 1.5 }],
    lifts: [{ poly: [[-90, -90], [-36, -90], [-44, -58], [-60, -48], [-90, -50]], h: 5, edge: 2.5, ragged: 2 }],
    roads: [
      { id: 'lane_s', kind: 'lane', width: 3, points: [[0, 13.4], [0, 30], [-2, 44], [-4, 58], [-6, 72]] },
      { id: 'pier_harbour', kind: 'path', width: 2.2, points: [[24, 48], [24, 60], [26, 72]] },
    ],
    outcrops: [{ n: 6, r: [1.5, 3], h: [1.2, 2.5], edge: 0.6, seed: 0x5a17, area: { x0: -64, x1: 64, z0: 34, z1: 64 }, ring: [40, 90], axes: 8 }],
    props: [{ kind: 'barrel', x: 20, z: 50 }, { kind: 'crate', x: 28, z: 52 }, { kind: 'crate', x: -8, z: 50 }],
  },

  // On the storm crag: a ravine falls away behind the gym, the town drops a terrace to the south (the lane steps down),
  // and lightning-struck pinnacles ring the outskirts.
  stormrook: {
    rough: 0.9,
    ponds: 0,
    lifts: [
      { line: { points: [[-90, -54], [-60, -50], [-30, -56], [0, -52], [30, -56], [60, -50], [90, -54]], width: 10 }, h: -8, edge: 2.4, ragged: 2 },
      { poly: [[-90, 46], [-40, 48], [0, 46], [40, 50], [90, 48], [90, 90], [-90, 90]], h: -2.8, edge: 2, ragged: 2 },
    ],
    roads: [{ id: 'lane_s', kind: 'lane', width: 3, points: [[0, 13.4], [0, 30], [0, 44], [-2, 60]] }],
    outcrops: [{ n: 7, r: [1.5, 3], h: [4, 8], edge: 0.45, ragged: 0.5, seed: 0x5707, ring: [42, 64], axes: 9 }],
  },

  // The quarry town: the great pit opens south in three benches, and the south road switchbacks down them to the
  // Rift; spoil heaps stand behind the workings in the north.
  marrowdig: {
    rough: 0.8,
    ponds: 0,
    lifts: [
      { poly: [[-90, 50], [-60, 44], [-20, 40], [20, 42], [60, 46], [90, 50], [90, 90], [-90, 90]], h: -3, edge: 2, ragged: 1.5 },
      { poly: [[-90, 62], [-60, 60], [-44, 54], [40, 56], [70, 64], [90, 66], [90, 90], [-90, 90]], h: -3, edge: 2, ragged: 1.5 },
      { poly: [[-90, 72], [-30, 66], [30, 68], [60, 72], [90, 76], [90, 90], [-90, 90]], h: -3, edge: 2, ragged: 1.5 },
    ],
    hills: [{ x: -42, z: -50, r: 14, h: 4 }, { x: 42, z: -54, r: 12, h: 3.5 }, { x: -60, z: -20, r: 10, h: 2.5 }],
    roads: [{ id: 'road_s', kind: 'road', width: 3.5, points: [[0, 13.4], [0, 32], [-8, 44], [-26, 50], [-40, 56], [-20, 62], [10, 64], [30, 70], [16, 76], [0, 80]] }],
    props: [{ kind: 'cart', x: -30, z: 46, yaw: 0.4 }, { kind: 'crate', x: 14, z: 60 }, { kind: 'barrel', x: 16, z: 61 }],
  },

  // Lantern town on the black mere: a canal runs down the east (the east road bridges it), the mere lies south-east,
  // and the cemetery stands on its mound in the south-west.
  vesperveil: {
    rough: 0.8,
    ponds: 0,
    lifts: [
      { poly: [[-54, 18], [-22, 22], [-18, 44], [-40, 54], [-58, 42]], h: 2.6, edge: 2.2, ragged: 1.5 },
      // the Deep Cut's mesa top meets its east line there
      shoulder('w', 64, -36.3, -26.2),
    ],
    rivers: [{ points: [[70, -80], [58, -50], [60, -20], [56, 10], [62, 40], [50, 70], [40, 90]], width: 5, depth: 1.2, bank: 2.5 }],
    lakes: [{ poly: [[16, 46], [36, 40], [46, 52], [38, 64], [16, 62]], depth: 1.2, shore: 4, ragged: 1.5 }],
    roads: [
      { id: 'road_e', kind: 'road', width: 3.5, points: [[13.4, 0], [30, 1], [46, 0], [62, -1], [80, 0]] },
      { id: 'trail_graves', kind: 'path', width: 1.8, points: [[-12, 12], [-18, 20], [-26, 28]] },
    ],
    props: [{ kind: 'rock_m', x: -44, z: 40 }, { kind: 'rock_m', x: -36, z: 46 }, { kind: 'rock_m', x: -48, z: 30 }],
  },

  // The walled city: a curtain wall rings the town with towers at its corners and gatehouses on the two roads; the
  // wall-watch and the vault (the bankaiser's ground) lie outside it to the north-east.
  forgewall: {
    rough: 0.7,
    ponds: 0,
    lifts: [
      {
        line: { points: [[-46, 0], [-46, -36], [-38, -46], [0, -46], [38, -46], [46, -36], [46, 0], [46, 36], [38, 46], [0, 46], [-38, 46], [-46, 36], [-46, 0], [-46, -36]], width: 3 },
        h: 4.5, edge: 1.4, bridged: true, dress: 'wall',
      },
      { circle: { x: -43, z: -43, r: 3.5 }, h: 7, edge: 1, dress: 'tower' }, { circle: { x: 43, z: -43, r: 3.5 }, h: 7, edge: 1, dress: 'tower' },
      { circle: { x: -43, z: 43, r: 3.5 }, h: 7, edge: 1, dress: 'tower' }, { circle: { x: 43, z: 43, r: 3.5 }, h: 7, edge: 1, dress: 'tower' },
      { circle: { x: -46, z: -8.5, r: 2.6 }, h: 6.5, edge: 1, dress: 'tower' }, { circle: { x: -46, z: 8.5, r: 2.6 }, h: 6.5, edge: 1, dress: 'tower' },
      { circle: { x: 46, z: -8.5, r: 2.6 }, h: 6.5, edge: 1, dress: 'tower' }, { circle: { x: 46, z: 8.5, r: 2.6 }, h: 6.5, edge: 1, dress: 'tower' },
      // a pocket on the siege lines' west line, south of the road
      shoulder('e', 64, 51.7, 52.8),
    ],
    hills: [{ x: -66, z: -60, r: 14, h: 3 }, { x: -64, z: 62, r: 14, h: 2.5 }, { x: 66, z: 64, r: 12, h: 3 }],
    roads: [
      { id: 'road_w', kind: 'road', width: 3.5, points: [[-13.4, 0], [-30, 0], [-46, 0], [-62, 0], [-80, 0]] },
      { id: 'road_e', kind: 'road', width: 3.5, points: [[13.4, 0], [30, 0], [46, 0], [62, 0], [80, 0]] },
    ],
  },

  // The mountain col: the massif climbs in two steps behind the shrine, twin peaks stand to the south, and the
  // town keeps the saddle between them; wind-cut crags ring the outskirts.
  skyrend: {
    rough: 0.9,
    ponds: 1,
    lifts: [
      { poly: [[-90, -90], [90, -90], [90, -52], [50, -48], [20, -56], [-10, -50], [-40, -56], [-70, -48], [-90, -52]], h: 6, edge: 3, ragged: 3 },
      { poly: [[-90, -90], [90, -90], [90, -66], [40, -64], [0, -70], [-40, -66], [-90, -68]], h: 6, edge: 3, ragged: 3 },
    ],
    hills: [{ x: -40, z: 64, r: 24, h: 9 }, { x: 42, z: 68, r: 22, h: 10 }],
    outcrops: [{ n: 6, r: [1.5, 3], h: [3, 6], edge: 0.5, seed: 0x5c1e, ring: [40, 62], axes: 9 }],
  },

  // The capital: the royal canal runs down the west flank (the west road crosses it on a bridge), a long basin lies
  // south of the cathedral square, and formal gardens rise in the corners.
  solenne: {
    rough: 0.5,
    ponds: 0,
    rivers: [
      { points: [[-60, -90], [-60, -40], [-58, 0], [-60, 40], [-60, 90]], width: 5, depth: 1.2, bank: 2 },
    ],
    lakes: [{ poly: [[-30, 50], [30, 48], [40, 62], [-36, 64]], depth: 1, shore: 3 }],
    lifts: [
      { poly: [[-48, -60], [-30, -60], [-30, -44], [-48, -44]], h: 1.6, edge: 1.4 },
      { poly: [[30, 34], [44, 34], [44, 44], [30, 44]], h: 1.2, edge: 1.4 },
    ],
    roads: [{ id: 'road_w', kind: 'road', width: 3.5, points: [[-13.4, 0], [-30, 0], [-46, 0], [-62, 0], [-80, 0]] }],
  },

  // ─── story zones ─────────────────────────────────────────────────────────

  // The sunken amphitheatre: the engine sits at the bottom of a stepped bowl, a ring of standing stones on its rim,
  // crystal crags beyond.
  eclipse_shrine: {
    rough: 0.8,
    ponds: 0,
    lifts: [
      { circle: { x: 0, z: 0, r: 44 }, h: -2.5, edge: 2.2, ragged: 1 },
      { circle: { x: 0, z: 0, r: 28 }, h: -2.5, edge: 2.2, ragged: 0.6 },
      { circle: { x: 43.2, z: 28.9, r: 1.6 }, h: 6, edge: 0.6 }, { circle: { x: 28.9, z: 43.2, r: 1.6 }, h: 6, edge: 0.6 },
      { circle: { x: 10.1, z: 51, r: 1.6 }, h: 6, edge: 0.6 }, { circle: { x: -10.1, z: 51, r: 1.6 }, h: 6, edge: 0.6 },
      { circle: { x: -43.2, z: -28.9, r: 1.6 }, h: 6, edge: 0.6 }, { circle: { x: -28.9, z: -43.2, r: 1.6 }, h: 6, edge: 0.6 },
      { circle: { x: -10.1, z: -51, r: 1.6 }, h: 6, edge: 0.6 }, { circle: { x: 10.1, z: -51, r: 1.6 }, h: 6, edge: 0.6 },
      { circle: { x: 28.9, z: -43.2, r: 1.6 }, h: 6, edge: 0.6 },
      // a crag on the Ascent's east line, in the far north
      shoulder('w', 84, -130, -83.7),
    ],
    roads: [
      { id: 'road_w', kind: 'road', width: 4, points: [[-13.4, 0], [-30, 0], [-50, 1], [-70, 0], [-100, 0]] },
      { id: 'road_e', kind: 'road', width: 4, points: [[13.4, 0], [30, 0], [50, -1], [70, 0], [100, 0]] },
    ],
    outcrops: [{ n: 8, r: [2, 3.5], h: [5, 9], edge: 0.45, ragged: 0.6, seed: 0xec11, ring: [60, 96], axes: 10 }],
  },

  // The summit: the observatory dome stands on a shelf; behind it the mountain climbs in two cliffed steps (paths
  // switchback up each) to the lens terrace, with shoulders falling away east and west.
  umbral_observatory: {
    rough: 0.9,
    ponds: 1,
    lifts: [
      { poly: [[-110, -110], [110, -110], [110, -30], [60, -26], [20, -30], [-20, -28], [-60, -30], [-110, -28]], h: 3.5, edge: 2.4, ragged: 2 },
      { poly: [[-110, -110], [110, -110], [110, -62], [40, -66], [0, -64], [-40, -66], [-110, -62]], h: 3.5, edge: 2.4, ragged: 2 },
    ],
    hills: [{ x: -74, z: -6, r: 30, h: 7 }, { x: 74, z: -10, r: 30, h: 7 }],
    roads: [
      { id: 'trail_shelf', kind: 'path', width: 2.2, points: [[-4, -14], [-18, -24], [-22, -36], [-10, -44]] },
      { id: 'trail_lens', kind: 'path', width: 2.2, points: [[12, -48], [26, -58], [18, -70], [6, -74]] },
    ],
  },

  // The processional: the avenue climbs from the south in two great steps to the spire and its summit stage, with
  // celestial pillars standing round the outskirts.
  celestial_spire: {
    rough: 0.7,
    ponds: 0,
    lifts: [
      { poly: [[-110, -110], [110, -110], [110, 40], [50, 42], [30, 40], [-20, 46], [-50, 50], [-110, 50]], h: 3, edge: 2.2, ragged: 1.5 },
      { poly: [[-110, -110], [110, -110], [110, -36], [-110, -36]], h: 3, edge: 2.2, ragged: 1.5 },
      // Solenne's raised garden lies under its north edge in the west
      shoulder('s', 84, -44.8, -32.2),
    ],
    roads: [
      { id: 'road_s', kind: 'road', width: 4, points: [[0, 13.4], [0, 30], [0, 50], [0, 70], [0, 100]] },
      { id: 'trail_summit', kind: 'path', width: 2.4, points: [[0, -13.4], [0, -30], [2, -46]] },
    ],
    outcrops: [{ n: 10, r: [2, 3.5], h: [8, 13], edge: 0.4, ragged: 0.6, seed: 0xce1e, ring: [55, 96], axes: 10 }],
  },

  // The shattered ground: three chasms run out from the maw, black pools lie west (a jetty reaches into the south
  // one), and broken spires stand everywhere.
  the_rift: {
    rough: 1,
    ponds: 0,
    lifts: [
      { line: { points: [[14, -22], [50, -40], [96, -62]], width: 8 }, h: -9, edge: 2, ragged: 1.5 },
      { line: { points: [[-22, -6], [-60, -22], [-100, -30]], width: 8 }, h: -9, edge: 2, ragged: 1.5 },
      { line: { points: [[18, 18], [60, 40], [100, 52]], width: 8 }, h: -9, edge: 2, ragged: 1.5 },
    ],
    lakes: [
      { poly: [[-72, -40], [-50, -36], [-40, -50], [-54, -62], [-72, -58]], depth: 1.6, shore: 4, ragged: 1.5 },
      { poly: [[-70, 44], [-46, 46], [-40, 60], [-58, 70], [-72, 62]], depth: 1.6, shore: 4, ragged: 1.5 },
    ],
    roads: [{ id: 'jetty_pool', kind: 'path', width: 2, points: [[-13, 4], [-30, 30], [-44, 48], [-52, 56]] }],
    outcrops: [{ n: 12, r: [1.5, 3], h: [5, 10], edge: 0.4, ragged: 0.6, seed: 0x7a1f, axes: 8 }],
  },
};
