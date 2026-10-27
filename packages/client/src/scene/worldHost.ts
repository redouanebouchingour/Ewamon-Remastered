/**
 * The seam between the DOM shell (part 1) and the 3D world (part 2, SPEC §20.4.2).
 *
 * `GameCanvas` calls `acquireWorld(canvas)` in its one effect and `releaseWorld()` in the cleanup. The world is a
 * module singleton with a refcount; `releaseWorld` schedules `dispose()` on a `setTimeout(…, 0)` that a
 * re-acquire cancels, so React 19 StrictMode's synthetic unmount/remount costs nothing and the WebGPU device is
 * created once.
 *
 * Part 2 implements World3D and registers its constructor with `setWorldFactory(createWorld3D)` (e.g. from
 * `src/scene/World3D.ts`, imported lazily by GameCanvas so /login costs no three.js). Until then the canvas stays
 * bare and the shell works without it.
 */

/** What part 2's World3D exposes to the host. `start()` begins the rAF loop; `dispose()` tears everything down. */
export interface WorldInstance {
  start(): void;
  stop(): void;
  dispose(): void;
}

export type WorldFactory = (canvas: HTMLCanvasElement) => WorldInstance | Promise<WorldInstance>;

let factory: WorldFactory | null = null;
let world: WorldInstance | null = null;
let pending: Promise<WorldInstance> | null = null;
let boundCanvas: HTMLCanvasElement | null = null;
let refs = 0;
let disposeTimer: ReturnType<typeof setTimeout> | null = null;
let capabilityOverride: boolean | null = null;
let capabilityProbed: boolean | null = null;

/** Part 2 registers World3D here. */
export function setWorldFactory(f: WorldFactory | null): void {
  factory = f;
}

/**
 * The capability check that keeps the renderer out of environments that cannot host it (jsdom, old browsers).
 * `test/routes.test.tsx` forces it to false (§50.4.7: no route mounts a WebGPURenderer in jsdom).
 */
export function worldCapability(): boolean {
  if (capabilityOverride !== null) return capabilityOverride;
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;
  if ('gpu' in navigator) return true;
  if (capabilityProbed === null) capabilityProbed = probeWebGL2();
  return capabilityProbed;
}

/**
 * Probed once and the context freed at once. The shell calls `worldCapability()` on every render, and each probe used
 * to leave a live WebGL2 context behind: past the browser's cap (16 in Chrome) it drops the oldest one, the world's,
 * which is how opening a menu lost the canvas on the WebGL2 fallback.
 */
function probeWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl === null) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch (_e) {
    return false;
  }
}

export function setWorldCapabilityOverride(v: boolean | null): void {
  capabilityOverride = v;
}

export function acquireWorld(canvas: HTMLCanvasElement): void {
  refs += 1;
  if (disposeTimer !== null) {
    clearTimeout(disposeTimer);
    disposeTimer = null;
  }
  if (factory === null || !worldCapability()) return;
  if ((world !== null || pending !== null) && boundCanvas === canvas) return;
  boundCanvas = canvas;
  const made = factory(canvas);
  pending = Promise.resolve(made);
  void pending.then(
    (w) => {
      pending = null;
      if (refs === 0 || boundCanvas !== canvas) {
        w.dispose();
        return;
      }
      world = w;
      w.start();
    },
    (e: unknown) => {
      pending = null;
      console.error('world failed to start', e);
    },
  );
}

export function releaseWorld(): void {
  refs = Math.max(0, refs - 1);
  if (refs > 0) return;
  if (disposeTimer !== null) clearTimeout(disposeTimer);
  disposeTimer = setTimeout(() => {
    disposeTimer = null;
    if (refs > 0) return;
    world?.stop();
    world?.dispose();
    world = null;
    boundCanvas = null;
  }, 0);
}

export function currentWorld(): WorldInstance | null {
  return world;
}
