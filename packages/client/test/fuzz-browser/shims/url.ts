/** `node:url` for the worker bundle (aliased in `../vite.config.ts`): the fixture only turns a URL into a path for `readFileSync`. */
export function fileURLToPath(url: URL | string): string {
  return decodeURIComponent(new URL(String(url)).pathname);
}
