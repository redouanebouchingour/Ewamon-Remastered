/**
 * Registers World3D with the world host on first use. GameCanvas calls `ensureWorldFactory()` before
 * `acquireWorld`, so `/login` and jsdom tests (capability forced false) never import three.js (§20.10.2 rule 7).
 */
import { setWorldFactory } from './worldHost';

let loading: Promise<void> | null = null;

export function ensureWorldFactory(): Promise<void> {
  loading ??= import('./World3D').then((m) => setWorldFactory(m.createWorld3D));
  return loading;
}
