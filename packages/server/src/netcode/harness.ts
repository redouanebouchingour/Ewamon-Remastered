/**
 * §30.10.3 netcode harness contract — the assertions `tools/netcode-harness` (and `aoi-fanout.test.ts`) apply to a
 * run's numbers. Pure: runs in, violations out; no Colyseus, no I/O.
 *
 * "msgsOut/s" is read as websocket FRAMES the server sends per second (schema patch frames + message frames, see
 * IMPLEMENTATION-NOTES Q17): with a per-client `StateView` a client gets ONE patch frame per tick however many
 * neighbours changed, which is what makes the fan-out linear in N. Entity updates ("PlayerState patches") are bounded
 * separately (per client by its 3×3 population, in total by 0.3 × the quadratic relay model).
 */

export const TICK_HZ = 20;
/** upper bound of one PlayerState delta on the wire: 3 float32 + 2 bool + uint32 seq + field headers */
export const PLAYER_DELTA_BYTES = 48;
export const SLACK = 1.2;
export const EXPONENT_MAX = 1.3;
export const QUADRATIC_SHARE_MAX = 0.3;
export const TICK_P99_MAX_MS = 25;
export const AOI_ADDS_SETTLED_PER_SEC = 50;

/** One bot's view of a run. */
export interface ClientSample {
  readonly id: string;
  /** mean of (state.players.size − 1) over the run */
  readonly neighbours: number;
  /** mean of state.spawns.size over the run */
  readonly spawns: number;
  /** schema patch bytes/s the server sent this client */
  readonly patchBytesPerSec: number;
  /** PlayerState updates (entity × patch) this client decoded per second, own included */
  readonly playerPatchesPerSec: number;
  readonly cheater?: boolean;
  /** movement rejections this client caused (speed / unwalkable / bounds / staleSeq) */
  readonly rejected?: number;
}

export interface HarnessRun {
  readonly n: number;
  readonly clients: readonly ClientSample[];
  /** frames/s the server sent in aggregate (patch frames + message frames) */
  readonly framesOutPerSec: number;
  readonly tickMsP99: number;
  readonly rejected: { readonly speed: number; readonly unwalkable: number; readonly bounds: number; readonly staleSeq: number };
}

/** Least-squares slope of log(y) against log(n) — the power-law exponent. */
export function powerLawExponent(points: readonly { readonly n: number; readonly y: number }[]): number {
  const pts = points.filter((p) => p.n > 0 && p.y > 0);
  if (pts.length < 2) return Number.NaN;
  const xs = pts.map((p) => Math.log(p.n));
  const ys = pts.map((p) => Math.log(p.y));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return num / den;
}

/** The legacy relay's quadratic model: every player's 20 Hz update to every other player. */
export function quadraticModel(n: number): number {
  return TICK_HZ * n * (n - 1);
}

export interface RunReport {
  readonly violations: readonly string[];
  readonly meanNeighbours: number;
  readonly framesBound: number;
  readonly totalPlayerPatchesPerSec: number;
  readonly quadratic: number;
}

/** §30.10.3 assertions 1, 3 (at N = 200) and 4 for one run. */
export function checkRun(run: HarnessRun, opts: { readonly checkTick?: boolean } = {}): RunReport {
  const v: string[] = [];
  const honest = run.clients.filter((c) => c.cheater !== true);
  const meanNeighbours = honest.length === 0 ? 0 : honest.reduce((a, c) => a + c.neighbours, 0) / honest.length;
  const framesBound = run.n * (meanNeighbours + 1) * TICK_HZ * SLACK;
  if (run.framesOutPerSec > framesBound) v.push(`framesOut/s ${run.framesOutPerSec.toFixed(1)} > N × (mean neighbours + 1) × 20 × 1.2 = ${framesBound.toFixed(1)}`);
  for (const c of honest) {
    const bytesBound = (c.neighbours + c.spawns + 1) * PLAYER_DELTA_BYTES * TICK_HZ * SLACK;
    if (c.patchBytesPerSec > bytesBound) v.push(`client ${c.id}: patchBytes/s ${c.patchBytesPerSec.toFixed(0)} > ${bytesBound.toFixed(0)}`);
  }
  const totalPlayerPatchesPerSec = run.clients.reduce((a, c) => a + c.playerPatchesPerSec, 0);
  const quadratic = quadraticModel(run.n);
  if (totalPlayerPatchesPerSec > QUADRATIC_SHARE_MAX * quadratic) v.push(`PlayerState patches/s ${totalPlayerPatchesPerSec.toFixed(0)} > 0.3 × quadratic ${quadratic}`);
  if (opts.checkTick === true && run.tickMsP99 >= TICK_P99_MAX_MS) v.push(`tickMsP99 ${run.tickMsP99.toFixed(2)} ≥ ${TICK_P99_MAX_MS}`);
  const r = run.rejected;
  if (honest.length === run.clients.length && (r.speed > 0 || r.unwalkable > 0 || r.bounds > 0 || r.staleSeq > 0)) v.push(`honest bots were rejected: ${JSON.stringify(r)}`);
  for (const c of honest) if ((c.rejected ?? 0) > 0) v.push(`honest client ${c.id} had ${c.rejected} rejected inputs`);
  return { violations: v, meanNeighbours, framesBound, totalPlayerPatchesPerSec, quadratic };
}

/** §30.10.3 assertion 2 over the three runs. */
export function checkScaling(runs: readonly HarnessRun[]): { readonly exponent: number; readonly violations: readonly string[] } {
  const exponent = powerLawExponent(runs.map((r) => ({ n: r.n, y: r.framesOutPerSec })));
  const violations = Number.isFinite(exponent) && exponent < EXPONENT_MAX ? [] : [`framesOut/s power-law exponent ${exponent.toFixed(3)} ≥ ${EXPONENT_MAX}`];
  return { exponent, violations };
}
