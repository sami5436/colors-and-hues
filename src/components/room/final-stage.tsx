"use client";

import { backToLobby, startGame } from "@/app/actions";

import { Button } from "../ui";
import { StageHeader, useGame } from "./shared";

export function FinalStage() {
  const { room, me, isHost, run, busy } = useGame();
  const ranked = [...room.players].sort((a, b) => b.score - a.score || a.seat - b.seat);
  const top = ranked[0]?.score ?? 0;
  const winners = ranked.filter((p) => p.score === top);
  const title =
    winners.length === 1 ? (winners[0].id === me.id ? "You win." : `${winners[0].name} wins.`) : `A tie at ${top}.`;

  return (
    <div>
      <StageHeader eyebrow={`Game over · ${room.total_rounds} rounds`} title={title} />
      <ol className="max-w-xl border-t border-ink">
        {ranked.map((p, i) => (
          <li key={p.id} className="flex items-baseline gap-4 border-b border-rule py-3">
            <span className="w-6 font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
            <span
              className={`flex-1 ${i === 0 ? "font-display text-3xl leading-none" : "text-base"} ${p.id === me.id ? "underline decoration-accent decoration-2 underline-offset-4" : ""}`}
            >
              {p.name}
            </span>
            <span className={`font-mono tabular-nums ${i === 0 ? "text-2xl" : "text-base"}`}>{p.score}</span>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {isHost ? (
          <>
            <Button size="lg" disabled={busy} onClick={() => run(() => startGame(room.code))}>
              Play again
            </Button>
            <Button size="lg" variant="outline" disabled={busy} onClick={() => run(() => backToLobby(room.code))}>
              Change settings
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">The host can start another game.</p>
        )}
      </div>
    </div>
  );
}
