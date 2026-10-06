/**
 * Handover II (IMPLEMENTATION-NOTES): the zone build as resumable steps. A builder written as a generator yields a short
 * label between units of work (a terrain chunk, a building, a scatter kind, …); `drain` runs it to the end in one call
 * (the synchronous `buildZone`, tests, the harness), `runSliced` runs it in time slices between frames (the off-scene
 * prepare). Both run the same code in the same order, so the result — and the geometry digest — is identical.
 */

/** A resumable build: yields step labels, returns the result. */
export type Steps<T> = Generator<string, T, void>;

/** Runs `g` to the end synchronously. */
export function drain<T>(g: Steps<T>): T {
  for (;;) {
    const r = g.next();
    if (r.done === true) return r.value;
  }
}

/** What a sliced run measured (the longest step bounds the longest slice: a step is never split). */
export interface SliceStats {
  slices: number;
  steps: number;
  /** wall ms of all slices (not counting the waits between them) */
  workMs: number;
  maxSliceMs: number;
  maxStepMs: number;
  maxStepLabel: string;
}

export function createSliceStats(): SliceStats {
  return { slices: 0, steps: 0, workMs: 0, maxSliceMs: 0, maxStepMs: 0, maxStepLabel: '' };
}

export interface SliceOptions {
  /** Steps run back to back until a slice has taken this long (a step that starts is finished). */
  readonly sliceMs: number;
  readonly now: () => number;
  /** Resolves when the next slice may run (default `nextSlice`). */
  readonly wait?: () => Promise<void>;
  readonly stats?: SliceStats;
  /** Checked before every slice after the first: true stops the run (`g.return()`) and rejects with `STEPS_CANCELLED`. */
  readonly cancelled?: () => boolean;
  /** Once true the rest runs without waiting (someone is waiting for the result: the crossing adopts it). */
  readonly urgent?: () => boolean;
}

/** The rejection of a sliced run stopped by `cancelled()`. */
export const STEPS_CANCELLED = new Error('@ewa/render: sliced build cancelled');

/**
 * Runs `g` in slices of about `sliceMs`, awaiting `wait()` between them so frames render in between. A slice ends
 * after the step that crossed the budget; the longest step therefore bounds the longest slice.
 */
export async function runSliced<T>(g: Steps<T>, o: SliceOptions): Promise<T> {
  const wait = o.wait ?? nextSlice;
  const st = o.stats;
  for (;;) {
    const t0 = o.now();
    const budget = o.sliceMs;
    let t = t0;
    for (;;) {
      const r = g.next();
      const t1 = o.now();
      if (st !== undefined) {
        st.steps++;
        if (t1 - t > st.maxStepMs) { st.maxStepMs = t1 - t; st.maxStepLabel = r.done === true ? '(end)' : r.value; }
      }
      t = t1;
      if (r.done === true) {
        if (st !== undefined) { st.slices++; st.workMs += t1 - t0; st.maxSliceMs = Math.max(st.maxSliceMs, t1 - t0); }
        return r.value;
      }
      if (t1 - t0 >= budget && o.urgent?.() !== true) break;
    }
    if (st !== undefined) { st.slices++; st.workMs += t - t0; st.maxSliceMs = Math.max(st.maxSliceMs, t - t0); }
    await wait();
    if (o.cancelled?.() === true) { g.return(undefined as never); throw STEPS_CANCELLED; }
  }
}

/**
 * The next slice: a task (not a microtask), so the event loop can run a frame first. `scheduler.postTask` at
 * 'user-visible' priority where it exists (behind input and rendering, ahead of idle work), else `setTimeout(0)`.
 */
export function nextSlice(): Promise<void> {
  const s = (globalThis as { scheduler?: { postTask?(cb: () => void, o: { priority: string }): Promise<void> } }).scheduler;
  if (s?.postTask) return s.postTask(() => undefined, { priority: 'user-visible' });
  return new Promise((r) => setTimeout(r, 0));
}

/**
 * One slice per rendered frame (the off-scene prepare): resolves in a task right after the next animation frame
 * callback — the frame is submitted, and on a GPU-bound frame the main thread has nothing to do until the next one, so
 * the slice lands in that gap instead of in front of a frame. Without `requestAnimationFrame` (node), or when no frame
 * comes within `stallMs` (a hidden tab), the next slice runs on a task.
 */
export function nextFrame(stallMs = 250): Promise<void> {
  const raf = (globalThis as { requestAnimationFrame?: (cb: (t: number) => void) => number }).requestAnimationFrame;
  if (typeof raf !== 'function') return nextSlice();
  return new Promise<void>((resolve) => {
    let done = false;
    const go = (): void => { if (!done) { done = true; resolve(); } };
    const timer = setTimeout(go, stallMs);
    raf(() => { clearTimeout(timer); setTimeout(go, 0); });
  });
}
