"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { ActionResult } from "@/app/actions";
import { AWAY_AFTER_MS } from "@/lib/game";
import type { GuessInfo, PlayerInfo, RoomRow } from "@/lib/room-types";

export type Room = Omit<RoomRow, "players" | "guesses" | "phase_ends_at"> & {
  players: PlayerInfo[];
  guesses: GuessInfo[];
  phase_ends_at: number | null;
};

export type Game = {
  room: Room;
  me: { id: string; name: string };
  isHost: boolean;
  isGiver: boolean;
  host: PlayerInfo | undefined;
  giver: PlayerInfo | undefined;
  /** Current time on the server's clock, in ms. */
  now: () => number;
  isAway: (p: PlayerInfo) => boolean;
  busy: boolean;
  run: (fn: () => Promise<ActionResult | void>) => Promise<boolean>;
};

const GameContext = createContext<Game | null>(null);

export function GameProvider({ value, children }: { value: Game; children: ReactNode }) {
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const game = useContext(GameContext);
  if (!game) throw new Error("useGame outside GameProvider");
  return game;
}

const parseJson = <T,>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v);

export function normalizeRoom(row: RoomRow): Room {
  return {
    ...row,
    players: parseJson(row.players),
    guesses: parseJson(row.guesses),
    phase_ends_at: row.phase_ends_at ? new Date(row.phase_ends_at).getTime() : null,
  };
}

export const awayCheck = (now: number) => (p: PlayerInfo) => now - new Date(p.last_seen).getTime() > AWAY_AFTER_MS;

/** Re-renders on an interval and returns the server-corrected time. */
export function useTicker(now: () => number, everyMs = 250, active = true) {
  const [t, setT] = useState(now);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT(now()), everyMs);
    return () => clearInterval(id);
  }, [now, everyMs, active]);
  return t;
}

export function Countdown({ endsAt, totalMs }: { endsAt: number; totalMs: number }) {
  const { now } = useGame();
  const t = useTicker(now, 200);
  const left = Math.max(0, endsAt - t);
  const fraction = Math.min(1, left / totalMs);
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
        <div
          className="h-full origin-left rounded-full bg-ink transition-transform duration-200 ease-linear"
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-sm tabular-nums text-ink-2">{Math.ceil(left / 1000)}s</span>
    </div>
  );
}

export function StageHeader({ eyebrow, title, aside }: { eyebrow: string; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{eyebrow}</p>
        <h1 className="mt-1.5 font-display text-4xl leading-[1.02] tracking-tight sm:text-5xl">{title}</h1>
      </div>
      {aside}
    </div>
  );
}

export function roundEyebrow(room: Room) {
  return `Round ${room.round_no} of ${room.total_rounds}`;
}
