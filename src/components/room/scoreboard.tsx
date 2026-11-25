"use client";

import { takeOverHost } from "@/app/actions";
import type { PlayerInfo } from "@/lib/room-types";

import { Initial } from "../ui";
import { useGame } from "./shared";

function statusFor(p: PlayerInfo, game: ReturnType<typeof useGame>) {
  const { room } = game;
  if (game.isAway(p)) return "away";
  if (room.phase === "lobby" || room.phase === "final" || room.phase === "reveal" || room.phase === "memorize")
    return null;
  if (room.mode === "clue") {
    if (p.id === room.giver_id) return room.phase === "clue1" || room.phase === "clue2" ? "writing clue" : null;
    if (room.phase === "guess1" || room.phase === "guess2") {
      const slot = room.phase === "guess2" ? 2 : 1;
      return room.guesses.some((g) => g.player_id === p.id && g.slot === slot) ? "placed" : "choosing";
    }
    return null;
  }
  if (room.phase === "mix") return room.guesses.some((g) => g.player_id === p.id) ? "locked in" : "mixing";
  return null;
}

export function Scoreboard() {
  const game = useGame();
  const { room, me, host, isHost, run, busy } = game;
  const inLobby = room.phase === "lobby";
  const players = inLobby ? room.players : [...room.players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  const hostAway = host ? game.isAway(host) : true;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">{inLobby ? "Players" : "Scores"}</h2>
        <span className="font-mono text-xs text-muted">{room.players.length}/12</span>
      </div>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {players.map((p) => {
          const status = statusFor(p, game);
          const done = status === "placed" || status === "locked in";
          return (
            <li key={p.id} className={`flex items-center gap-3 py-2.5 ${status === "away" ? "opacity-45" : ""}`}>
              <Initial name={p.name} filled={p.id === me.id} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.name}
                  {p.id === me.id && <span className="ml-1.5 font-normal text-muted">you</span>}
                </p>
                <p className="flex gap-2 text-xs text-muted">
                  {p.id === room.host_id && <span>host</span>}
                  {room.mode === "clue" && p.id === room.giver_id && !inLobby && room.phase !== "final" && (
                    <span className="text-accent">clue giver</span>
                  )}
                  {status && <span className={done ? "text-ok" : ""}>{status}</span>}
                </p>
              </div>
              {!inLobby && <span className="font-mono text-base tabular-nums">{p.score}</span>}
            </li>
          );
        })}
      </ul>
      {!isHost && hostAway && (
        <button
          disabled={busy}
          onClick={() => run(() => takeOverHost(room.code))}
          className="mt-3 text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
        >
          Host seems away. Take over hosting
        </button>
      )}
    </div>
  );
}
