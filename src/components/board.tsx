"use client";

import { memo, useEffect, useRef } from "react";

import { prefersDarkText } from "@/lib/color";
import { CELL_COUNT, cellHex, cellRgb, COLS } from "@/lib/game";

export type Marker = { cell: number; label: string; mine?: boolean; points?: number | null; dim?: boolean };

type Props = {
  markers?: Marker[];
  target?: number | null;
  targetLabel?: string;
  selected?: number | null;
  onPick?: (cell: number) => void;
  disabled?: boolean;
  compact?: boolean;
};

const cells = Array.from({ length: CELL_COUNT }, (_, i) => i);

export const Board = memo(function Board({
  markers = [],
  target = null,
  targetLabel,
  selected = null,
  onPick,
  disabled,
  compact,
}: Props) {
  const byCell = new Map(markers.map((m) => [m.cell, m]));
  const scroller = useRef<HTMLDivElement>(null);

  // On narrow screens the board scrolls sideways. Bring the target into view when it appears.
  useEffect(() => {
    const el = scroller.current;
    if (!el || target === null || el.scrollWidth <= el.clientWidth) return;
    const x = (((target % COLS) + 0.5) / COLS) * el.scrollWidth - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, x), behavior: "smooth" });
  }, [target]);
  const interactive = Boolean(onPick) && !disabled;

  return (
    <div>
      <div ref={scroller} className={compact ? "" : "-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"}>
        <div
          className={`grid gap-px overflow-hidden rounded-md border border-rule-strong bg-rule-strong ${compact ? "" : "min-w-[600px]"}`}
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          role={interactive ? "grid" : undefined}
          aria-label="Color board"
        >
          {cells.map((i) => {
            const marker = byCell.get(i);
            const isTarget = target === i;
            const isSelected = selected === i;
            const taken = Boolean(marker);
            const dark = prefersDarkText(cellRgb(i));
            return (
              <button
                key={i}
                type="button"
                tabIndex={interactive && !taken ? 0 : -1}
                disabled={!interactive || taken}
                onClick={() => onPick?.(i)}
                aria-label={`Square ${i + 1}${isTarget ? ", target" : ""}${marker ? `, ${marker.label}` : ""}`}
                className={`relative aspect-square ${
                  interactive && !taken
                    ? "cursor-pointer hover:z-10 hover:scale-[1.35] hover:rounded-sm hover:shadow-md"
                    : "cursor-default"
                } transition-transform duration-100`}
                style={{ background: cellHex(i) }}
              >
                {isTarget && (
                  <span
                    className="pointer-events-none absolute -inset-[3px] z-20 rounded-[3px] border-[3px]"
                    style={{
                      borderColor: dark ? "#171614" : "#fbfaf6",
                      boxShadow: `0 0 0 2px ${dark ? "#fbfaf6" : "#171614"}`,
                    }}
                  />
                )}
                {isSelected && !marker && (
                  <span className="pointer-events-none absolute inset-[18%] z-20 rounded-full border-2 border-dashed border-ink bg-card/60" />
                )}
                {marker && (
                  <span
                    className={`pointer-events-none absolute left-1/2 top-1/2 z-30 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] font-bold uppercase leading-none shadow-sm ${
                      marker.mine ? "border-ink bg-ink text-paper" : "border-ink bg-card text-ink"
                    } ${marker.dim ? "opacity-60" : ""}`}
                  >
                    {marker.label.slice(0, 1)}
                    {marker.points != null && (
                      <span className="absolute -right-2 -top-2 rounded-full bg-accent px-1 py-px text-[9px] font-semibold text-white">
                        {marker.points}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {!compact && <p className="mt-2 text-xs text-muted sm:hidden">Swipe the board to see every hue.</p>}
      {targetLabel && target !== null && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span
            className="inline-block size-3 rounded-sm border-2 border-ink"
            style={{ background: cellHex(target) }}
          />
          {targetLabel}
        </p>
      )}
    </div>
  );
});
