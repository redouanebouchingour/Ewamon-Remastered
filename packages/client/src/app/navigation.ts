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

/**
 * The battle / trade blockers' test (§20.1.3): opening or switching a panel waits, but closing one (back to the bare
 * `/play`) always goes through, so a panel that was open when the battle or trade began can still be shut.
 */
export function blocksPanelNavigation({ currentLocation, nextLocation }: { readonly currentLocation: { readonly pathname: string }; readonly nextLocation: { readonly pathname: string } }): boolean {
  return currentLocation.pathname !== nextLocation.pathname && nextLocation.pathname !== '/play' && nextLocation.pathname !== '/play/';
}
