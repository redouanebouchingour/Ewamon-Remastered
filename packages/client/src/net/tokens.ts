/**
 * Token storage (SPEC §20.1.2): the refresh token is an opaque string in localStorage['ewa.refresh.v1'];
 * the access token lives in memory only (useSessionStore), its expiry decoded from the JWT `exp` claim.
 */

export const REFRESH_KEY = 'ewa.refresh.v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (_e) {
    return null;
  }
}

export function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_KEY) ?? null;
}

export function hasRefreshToken(): boolean {
  const t = getRefreshToken();
  return t !== null && t.length > 0;
}

export function setRefreshToken(token: string): void {
  storage()?.setItem(REFRESH_KEY, token);
}

export function clearRefreshToken(): void {
  storage()?.removeItem(REFRESH_KEY);
}

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The JWT `exp` claim as unix ms; 0 when the token is malformed (treated as already expired). */
export function jwtExpiryMs(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) return 0;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]!)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch (_e) {
    return 0;
  }
}
