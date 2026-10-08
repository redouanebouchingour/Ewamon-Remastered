/**
 * What a signature effect layer (sigfx/*) gets from the overlay: the shared positioning classes of
 * SignatureCinematic.module.css. An effect is one `<svg className={k.svg}>`; its groups stand at
 *   - `k.atA`: the attacker's centre, scaled to its sprite (500 units = its height, feet at y 250);
 *   - `k.atD`: the target's centre, scaled to its sprite (300 units = its height, feet at y 150);
 *   - `k.line`: the attacker's centre rotated towards the target (+x), 900 units = the viewport height; the target
 *     stands at x = var(--dist) (use `calc(var(--dist) * 1px)` in keyframes);
 *   - `k.rot` (inside `k.atD`): the line's direction at the target.
 * Every element transforms about its own centre; add `k.vb` to transform about its local origin (travel elements).
 * Each effect animates on its own full clock: `animation: <name> <total>ms … calc(<delay>ms - var(--skip)) both`.
 */
export interface FxKit {
  readonly svg: string;
  readonly atA: string;
  readonly atD: string;
  readonly line: string;
  readonly rot: string;
  readonly vb: string;
}

export interface FxProps {
  readonly k: FxKit;
}
