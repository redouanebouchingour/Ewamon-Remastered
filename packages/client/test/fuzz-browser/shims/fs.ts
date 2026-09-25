/**
 * `node:fs` for the worker bundle (aliased in `../vite.config.ts`). Core's legacy-content fixture reads exactly one
 * file, `.design/legacy/ewamon.js`; the browser gets the same bytes inlined at build time (`?raw`). The fixture's
 * `new URL('…/ewamon.js', import.meta.url)` is rewritten by Vite to the emitted asset (`assets/ewamon-<hash>.js`),
 * so the basename is matched. Any other read throws, so a new fs dependency in the fuzz path fails loudly instead
 * of fuzzing different data.
 */
import ewamonSource from '../../../../../.design/legacy/ewamon.js?raw';

const EWAMON = /(^|\/)ewamon(-[\w-]+)?\.js$/;

export function readFileSync(path: unknown, _encoding?: unknown): string {
  if (EWAMON.test(String(path).replace(/\\/g, '/'))) return ewamonSource;
  throw new Error(`fuzz-browser shim: readFileSync(${String(path)}) is not available in the browser`);
}
