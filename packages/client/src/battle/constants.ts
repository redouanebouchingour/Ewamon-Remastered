/**
 * SPEC §20.5.3 — battle timing constants (ms unless stated). The one table the timeline builder, the player and
 * the director read; `timeline.test.ts` asserts the numbers.
 */

/** 3 frames at 60 Hz: `time { scale: 0, ms: 50 }` on every `damage` with `cause: 'move'` and `amount > 0`. */
export const HITSTOP_FRAMES = 3;
export const HITSTOP_MS = 50;

/** `damage.effectiveness >= 2`: screen-space chromatic offset, ease-out. */
export const CHROMA_SUPER = { amount: 0.012, ms: 120 } as const;

/** Camera shake per `damage` with `cause: 'move'`, `frac = amount / maxHp`, in world units. */
export function SHAKE_AMP(frac: number): number {
  return Math.min(0.5, 0.08 + 0.6 * frac);
}
export const SHAKE_MS = 180;

/** `damage.crit`: slow-motion starting at the impact. */
export const CRIT_SLOWMO = { scale: 0.35, ms: 400 } as const;

/** `faint`: camera `ko`, `pose: 'faint'` at 0, the next frame at +900. */
export const KO_HOLD = 900;

/** HP bar drain for every `damage` / `heal`: `min(1000, 350 + 650 * frac)`. */
export function HP_DRAIN(frac: number): number {
  return Math.min(1000, 350 + 650 * Math.max(0, frac));
}

/** `switchOut` + `switchIn` (exit 350, enter 450). */
export const SWITCH_MS = 800;
export const SWITCH_OUT_MS = 350;
export const SWITCH_IN_MS = 450;
/** Phase D4: the shiny sparkle after a shiny's switch-in. */
export const SHINY_MS = 900;
/** `formChange` (a battle form): the burst, the sprite swapping at 40 %, the line. */
export const FORM_MS = 1100;

export const STATUS_MS = 500;
export const STAGE_MS = 400;
/** Every `log` frame keeps its line visible ≥ 600 ms before the next log frame. */
export const LOG_DWELL_MIN = 600;

export const ORB_THROW = 600;
export const ORB_SHAKE = 700;
export const ORB_GAP = 400;
export const ORB_RESULT = 900;

export const WEATHER_MS = 700;

/** Compression threshold: recover/status/stage/log dwell scale by `9000 / duration`, floor 0.5×. */
export const TURN_BUDGET = 9000;
export const COMPRESS_FLOOR = 0.5;

/** `SceneDirector.enterBattle` / `exitBattle` (Pillar 7). */
export const PUSH_IN = 600;
export const RELEASE = 600;

/** `stage.undress(400)` on exit (§20.4.3). */
export const UNDRESS_MS = 400;

/** The first frames of a battle (createBattle's switch-ins) — `enter` pose length. */
export const ENTER_MS = 450;

/** Fixed simulation step (the TimelinePlayer advances at the World3D fixed step). */
export const STEP_MS = 1000 / 60;
