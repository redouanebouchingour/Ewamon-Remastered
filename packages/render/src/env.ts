/**
 * Build-mode probe. SPEC §10.2.3 says `MaterialBudget.assert` "throws in dev builds
 * (import.meta.env.DEV); logs in prod". `import.meta.env` is injected by Vite (and Vitest); anywhere
 * else it is absent, and we default to dev semantics (throw) so a violation is never silent.
 */
export function isDevBuild(): boolean {
  const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
  return env?.DEV ?? true;
}
