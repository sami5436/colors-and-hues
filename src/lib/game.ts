// Game rules shared by server and browser. No server-only imports here.

import { hslToRgb, oklabDistance, oklchToRgb, rgbToHex, type RGB } from "./color";

export const COLS = 28;
export const ROWS = 12;
export const CELL_COUNT = COLS * ROWS;

export const MEMORIZE_MS = 5_000;
export const MIX_MS = 35_000;
/** A player who hasn't pinged in this long is treated as away. */
export const AWAY_AFTER_MS = 45_000;
export const MAX_PLAYERS = 12;
export const ROUND_OPTIONS = [3, 5, 8, 10] as const;

export type Mode = "clue" | "recall";
export type Phase = "lobby" | "clue1" | "guess1" | "clue2" | "guess2" | "memorize" | "mix" | "reveal" | "final";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODE_LENGTH = 4;

export function normalizeCode(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, CODE_LENGTH);
}

// ---------- Clue mode board ----------

const cellRgbCache: RGB[] = [];

/** Board cell color. Columns walk the hue wheel, rows go from pale to deep. */
export function cellRgb(index: number): RGB {
  const cached = cellRgbCache[index];
  if (cached) return cached;
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const t = row / (ROWS - 1);
  const hue = (col / COLS) * 360 + 18;
  const L = 0.94 - t * 0.64;
  const C = 0.035 + 0.17 * Math.sin(Math.PI * Math.min(1, t * 1.15));
  const rgb = oklchToRgb(L, C, hue);
  cellRgbCache[index] = rgb;
  return rgb;
}

export const cellHex = (index: number) => rgbToHex(cellRgb(index));

/** Grid distance between two cells. Columns wrap, since hue is a circle. */
export function cellDistance(a: number, b: number) {
  const dcRaw = Math.abs((a % COLS) - (b % COLS));
  const dc = Math.min(dcRaw, COLS - dcRaw);
  const dr = Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS));
  return Math.hypot(dc, dr);
}

/** Points for a single marker in clue mode. */
export function cluePoints(guess: number, target: number) {
  const d = cellDistance(guess, target);
  if (d === 0) return 5;
  if (d <= 1) return 4;
  if (d <= 1.5) return 3;
  if (d <= 2.3) return 2;
  if (d <= 3.2) return 1;
  return 0;
}

// ---------- Recall mode ----------

export function recallDistance(a: [number, number, number], b: [number, number, number]) {
  return oklabDistance(hslToRgb(...a), hslToRgb(...b));
}

export function recallPoints(a: [number, number, number], b: [number, number, number]) {
  return Math.round(10 * Math.exp(-recallDistance(a, b) / 0.12));
}

// ---------- Clue validation ----------

export function cleanClue(raw: string, maxWords: number) {
  const words = raw.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (words.length === 0 || words.length > maxWords) return null;
  const clue = words.join(" ");
  if (clue.length > 32) return null;
  return clue;
}
