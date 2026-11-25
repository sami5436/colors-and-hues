import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { cellHex, COLS, ROWS } from "./game";

export const OG_SIZE = { width: 1200, height: 630 };
export const PAPER = "#f3f0e8";
export const INK = "#171614";
export const ACCENT = "#d2492a";
export const MUTED = "#77726a";

export async function ogFonts() {
  const [regular, italic] = await Promise.all([
    readFile(join(process.cwd(), "assets/InstrumentSerif-Regular.ttf")),
    readFile(join(process.cwd(), "assets/InstrumentSerif-Italic.ttf")),
  ]);
  return [
    { name: "Instrument Serif", data: regular, style: "normal" as const, weight: 400 as const },
    { name: "Instrument Serif", data: italic, style: "italic" as const, weight: 400 as const },
  ];
}

/** The game board, drawn with plain flex boxes so Satori can render it. */
export function BoardArt({ width, rows = ROWS, gap = 3 }: { width: number; rows?: number; gap?: number }) {
  const cell = (width - gap * (COLS - 1)) / COLS;
  const startRow = Math.floor((ROWS - rows) / 2);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: "flex", gap }}>
          {Array.from({ length: COLS }, (_, c) => (
            <div
              key={c}
              style={{
                width: cell,
                height: cell,
                borderRadius: 3,
                background: cellHex((startRow + r) * COLS + c),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Wordmark({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: size, color: INK, letterSpacing: -1 }}>
      Colors&nbsp;<span style={{ fontStyle: "italic", color: ACCENT }}>&amp;</span>&nbsp;Hues
    </div>
  );
}
