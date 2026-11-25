"use client";

import { startGame, updateSettings } from "@/app/actions";
import { ROUND_OPTIONS, type Mode } from "@/lib/game";

import { Button } from "../ui";
import { StageHeader, useGame } from "./shared";

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`rounded-md border px-3.5 py-2 text-left text-sm transition-colors disabled:cursor-default ${
                active ? "border-ink bg-ink text-paper" : "border-rule-strong bg-card text-ink enabled:hover:border-ink"
              } ${disabled && !active ? "opacity-50" : ""}`}
            >
              <span className="font-medium">{o.label}</span>
              {o.hint && <span className={`block text-xs ${active ? "text-paper/70" : "text-muted"}`}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Lobby() {
  const { room, isHost, host, run, busy } = useGame();
  const needsMore = room.mode === "clue" && room.players.length < 2;

  return (
    <div>
      <StageHeader eyebrow="Lobby" title={isHost ? "Get everyone in." : "You're in."} />

      <div className="rounded-lg border border-rule bg-card p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Room code</p>
        <p className="mt-2 font-mono text-6xl font-semibold tracking-[0.3em] sm:text-7xl">{room.code}</p>
        <p className="mt-3 text-sm text-ink-2">
          Friends can enter this code on the home page, or open the invite link from the button up top.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <Segmented<Mode>
          label="Mode"
          value={room.mode}
          disabled={!isHost || busy}
          onChange={(mode) => run(() => updateSettings(room.code, { mode }))}
          options={[
            { value: "clue", label: "Clue", hint: "Describe a hidden square" },
            { value: "recall", label: "Recall", hint: "Rebuild a color from memory" },
          ]}
        />
        <Segmented<number>
          label="Rounds"
          value={room.total_rounds}
          disabled={!isHost || busy}
          onChange={(rounds) => run(() => updateSettings(room.code, { rounds }))}
          options={ROUND_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
        {isHost ? (
          <>
            <Button size="lg" disabled={busy || needsMore} onClick={() => run(() => startGame(room.code))}>
              Start game
            </Button>
            <p className="text-sm text-muted">
              {needsMore
                ? "Clue mode needs at least one more player."
                : `${room.players.length} ready. Start when everyone's in.`}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-2">
            Waiting for <span className="font-medium">{host?.name ?? "the host"}</span> to start the game.
          </p>
        )}
      </div>
    </div>
  );
}
