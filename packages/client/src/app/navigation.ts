/**
 * A navigation seam for non-React code (the world's `E` on a shop door opens `/play/shop`): PlayShell registers
 * React Router's `navigate` once; world code calls `navigateTo`. No-op until registered.
 */
type Navigate = (to: string) => void;

let nav: Navigate | null = null;

export function setNavigator(n: Navigate | null): void {
  nav = n;
}

export function navigateTo(to: string): void {
  nav?.(to);
}
