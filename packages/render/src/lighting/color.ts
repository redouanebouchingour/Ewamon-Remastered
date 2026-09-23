/** Pure sRGB helpers shared by the lighting modules (no `three` import). */

/** '#rrggbb' → sRGB components 0..1. */
export function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new RangeError(`bad colour '${hex}'`);
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** IEC 61966-2-1 sRGB → linear, one channel. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Rec. 709 relative luminance of a linear RGB triple. */
export function luminance709(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
