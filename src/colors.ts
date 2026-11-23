// CSS color handling for the light compositing — scene-owned by design
// (the lighting engine package stays color-agnostic and never parses
// colors). Turns a supported CSS color into an `rgba()` string with an
// alpha multiplier applied, without assuming six-digit hex.
//
// Supported forms: #rgb, #rrggbb, #rrggbbaa (the embedded alpha multiplies
// in) and the rgb()/rgba() functional notations (comma-separated,
// numbers 0-255 or percentages). Anything else — named colors, gradients,
// malformed input — returns null and the caller falls back.

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const clampChannel = (value: number): number =>
  Math.min(255, Math.max(0, Math.round(value)));

// Parses one hex color (#rgb / #rrggbb / #rrggbbaa) into channels, or null.
const parseHex = (
  color: string,
): { r: number; g: number; b: number; a: number } | null => {
  if (!color.startsWith('#')) return null;
  const hex = color.slice(1);
  const expand = (part: string): number =>
    parseInt(part.length === 1 ? part + part : part, 16);
  if (hex.length === 3) {
    const r = expand(hex[0]);
    const g = expand(hex[1]);
    const b = expand(hex[2]);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b, a: 1 };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    if ([r, g, b, a].some(Number.isNaN)) return null;
    return { r, g, b, a };
  }
  return null;
};

// Parses an rgb()/rgba() functional color (comma-separated channels, each
// a number 0-255 or a percentage; optional alpha 0..1 or a percentage).
const parseFunctional = (
  color: string,
): { r: number; g: number; b: number; a: number } | null => {
  const match = color.match(/^rgba?\(([^)]*)\)$/i);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => part.trim());
  if (parts.length !== 3 && parts.length !== 4) return null;
  const channel = (part: string): number | null => {
    if (part.endsWith('%')) {
      const value = parseFloat(part.slice(0, -1));
      return Number.isNaN(value) ? null : (value * 255) / 100;
    }
    const value = parseFloat(part);
    return Number.isNaN(value) ? null : value;
  };
  const channels = parts.slice(0, 3).map(channel);
  if (channels.some((c) => c === null)) return null;
  let a = 1;
  if (parts.length === 4) {
    const alphaPart = parts[3];
    const value = alphaPart.endsWith('%')
      ? parseFloat(alphaPart.slice(0, -1)) / 100
      : parseFloat(alphaPart);
    if (Number.isNaN(value)) return null;
    a = value;
  }
  const [r, g, b] = channels as number[];
  return { r, g, b, a };
};

// The color as an `rgba()` string with `alpha` (0..1, clamped) multiplied
// into the color's own alpha, or null for unsupported color forms.
export const colorWithAlpha = (color: string, alpha: number): string | null => {
  const parsed = parseHex(color) ?? parseFunctional(color);
  if (!parsed) return null;
  return `rgba(${clampChannel(parsed.r)}, ${clampChannel(parsed.g)}, ${clampChannel(parsed.b)}, ${clamp01(alpha) * clamp01(parsed.a)})`;
};

// A gradient-stop color: `colorWithAlpha`, falling back for unsupported
// forms — fully transparent stays transparent (so additive and mask
// compositing both read it as "no contribution"), anything else keeps the
// raw color string and lets canvas parse it (alpha not applied, the
// historical fallback).
export const gradientStopColor = (color: string, alpha: number): string =>
  colorWithAlpha(color, alpha) ?? (alpha <= 0 ? 'rgba(0, 0, 0, 0)' : color);
