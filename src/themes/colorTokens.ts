export type Rgb = readonly [number, number, number];

const HEX = /^#([\da-f]{6})$/i;

export function parseHex(color: string): Rgb | null {
  const match = HEX.exec(color.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function toHex(color: Rgb): string {
  return `#${color.map(channel => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0')).join('')}`;
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: Rgb): number {
  return 0.2126 * channelLuminance(color[0])
    + 0.7152 * channelLuminance(color[1])
    + 0.0722 * channelLuminance(color[2]);
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function mixColors(first: string, second: string, amount: number): string {
  const a = parseHex(first);
  const b = parseHex(second);
  if (!a || !b) return first;
  const ratio = Math.max(0, Math.min(1, amount));
  return toHex([
    a[0] + (b[0] - a[0]) * ratio,
    a[1] + (b[1] - a[1]) * ratio,
    a[2] + (b[2] - a[2]) * ratio,
  ]);
}

/** Pick the stronger dark/light foreground for a solid accent surface. */
export function readableForeground(background: string): string {
  const rgb = parseHex(background);
  if (!rgb) return '#ffffff';
  return contrastRatio(rgb, parseHex('#ffffff')!) >= contrastRatio(rgb, parseHex('#101828')!)
    ? '#ffffff'
    : '#101828';
}

/** Adjust only solid fills when neither white nor dark text reaches AA. */
export function accessibleSolidColor(color: string, minimum = 4.5): string {
  const foreground = readableForeground(color);
  if (contrastRatio(parseHex(color)!, parseHex(foreground)!) >= minimum) return color;
  const target = foreground === '#ffffff' ? '#000000' : '#ffffff';
  let candidate: string;
  for (let step = 1; step <= 24; step += 1) {
    candidate = mixColors(color, target, step / 24);
    if (contrastRatio(parseHex(candidate)!, parseHex(foreground)!) >= minimum) return candidate;
  }
  return target;
}

/**
 * Keep a theme's accent hue while making accent text readable on its document
 * surface. Large filled controls continue to use the original accent colour.
 */
export function accessibleTextColor(color: string, background: string, mode: 'light' | 'dark', minimum = 4.5): string {
  const source = parseHex(color);
  const surface = parseHex(background);
  if (!source || !surface) return color;
  if (contrastRatio(source, surface) >= minimum) return color;
  const target = mode === 'light' ? '#000000' : '#ffffff';
  let candidate: string;
  for (let step = 1; step <= 24; step += 1) {
    candidate = mixColors(color, target, step / 24);
    if (contrastRatio(parseHex(candidate)!, surface) >= minimum) return candidate;
  }
  return target;
}
