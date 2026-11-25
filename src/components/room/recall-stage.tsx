"use client";

import { useState } from "react";

import { nextRound, skipAhead, submitMix } from "@/app/actions";
import { hslHex, prefersDarkText, hslToRgb } from "@/lib/color";
import { MEMORIZE_MS, MIX_MS, recallDistance } from "@/lib/game";

import { Button } from "../ui";
import { Countdown, roundEyebrow, StageHeader, useGame, useTicker } from "./shared";

function Swatch({ hex, className = "", children }: { hex: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-black/10 ${className}`} style={{ background: hex }}>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  max,
  onChange,
  track,
  unit = "",
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  track: string;
  unit?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-xs font-medium uppercase tracking-[0.08em] text-muted">
        {label}
        <span className="font-mono normal-case tracking-normal text-ink-2">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider"
        style={{ background: track }}
      />
    </label>
  );
}

function Mixer() {
  const { room, run, busy } = useGame();
  const [h, setH] = useState(() => Math.floor(Math.random() * 360));
  const [s, setS] = useState(50);
  const [l, setL] = useState(50);
  const hex = hslHex(h, s, l);

  const hueTrack = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => hslHex(i * 30, s, l)).join(", ")})`;
  const satTrack = `linear-gradient(to right, ${hslHex(h, 0, l)}, ${hslHex(h, 100, l)})`;
  const lightTrack = `linear-gradient(to right, #000, ${hslHex(h, s, 50)}, #fff)`;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
      <Swatch hex={hex} className="aspect-[4/3] md:aspect-auto md:min-h-72" />
      <div className="flex flex-col justify-between gap-5">
        <div className="space-y-5">
          <Slider label="Hue" value={h} max={359} onChange={setH} track={hueTrack} unit="°" />
          <Slider label="Saturation" value={s} max={100} onChange={setS} track={satTrack} unit="%" />
          <Slider label="Lightness" value={l} max={100} onChange={setL} track={lightTrack} unit="%" />
        </div>
        <Button size="lg" disabled={busy} onClick={() => run(() => submitMix(room.code, { h, s, l }))}>
          Lock it in
        </Button>
      </div>
    </div>
  );
}

export function RecallStage() {
  const game = useGame();
  const { room, me, isHost, run, busy } = game;
  const mine = room.guesses.find((g) => g.player_id === me.id);
  const waitingOn = room.players.filter(
    (p) => !game.isAway(p) && !room.guesses.some((g) => g.player_id === p.id),
  ).length;

  // Hide the color locally the moment the memorize timer hits zero, before the server catches up.
  const t = useTicker(game.now, 100, room.phase === "memorize");
  const expired = room.phase === "memorize" && room.phase_ends_at !== null && t >= room.phase_ends_at;

  if (room.phase === "memorize") {
    const hex =
      room.target_h !== null && room.target_s !== null && room.target_l !== null
        ? hslHex(room.target_h, room.target_s, room.target_l)
        : null;
    return (
      <div>
        <StageHeader eyebrow={roundEyebrow(room)} title={expired ? "Gone." : "Memorize this."} />
        <Swatch
          hex={hex && !expired ? hex : "var(--paper-2)"}
          className="aspect-[16/9] w-full transition-colors duration-300"
        />
        <div className="mt-4">
          {room.phase_ends_at && <Countdown endsAt={room.phase_ends_at} totalMs={MEMORIZE_MS} />}
        </div>
      </div>
    );
  }

  if (room.phase === "mix") {
    return (
      <div>
        <StageHeader
          eyebrow={roundEyebrow(room)}
          title={mine ? "Locked in." : "Mix it back."}
          aside={
            isHost && waitingOn > 0 ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => skipAhead(room.code, "mix"))}>
                Reveal now
              </Button>
            ) : null
          }
        />
        <div className="mb-5">{room.phase_ends_at && <Countdown endsAt={room.phase_ends_at} totalMs={MIX_MS} />}</div>
        {mine ? (
          <p className="text-sm text-ink-2">Waiting on {waitingOn} more. Your color stays hidden until the reveal.</p>
        ) : (
          <Mixer />
        )}
      </div>
    );
  }

  return <RecallReveal />;
}

function RecallReveal() {
  const { room, me, isHost, run, busy } = useGame();
  if (room.target_h === null || room.target_s === null || room.target_l === null) return null;
  const target: [number, number, number] = [room.target_h, room.target_s, room.target_l];
  const targetHex = hslHex(...target);
  const names = new Map(room.players.map((p) => [p.id, p.name]));
  const results = room.guesses
    .filter((g) => g.h !== null && g.s !== null && g.l !== null)
    .map((g) => {
      const hsl: [number, number, number] = [g.h!, g.s!, g.l!];
      return {
        id: g.player_id,
        name: names.get(g.player_id) ?? "Left",
        hsl,
        points: g.points ?? 0,
        d: recallDistance(hsl, target),
      };
    })
    .sort((a, b) => b.points - a.points || a.d - b.d);
  const dark = prefersDarkText(hslToRgb(...target));

  return (
    <div>
      <StageHeader eyebrow={roundEyebrow(room)} title="How close?" />
      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <Swatch hex={targetHex} className="flex aspect-[4/3] flex-col justify-end p-4 md:aspect-auto md:min-h-80">
          <p className={`text-xs font-medium uppercase tracking-[0.12em] ${dark ? "text-black/60" : "text-white/70"}`}>
            The color
          </p>
          <p className={`font-mono text-sm ${dark ? "text-black" : "text-white"}`}>
            {targetHex.toUpperCase()} · hsl({target.join(", ")})
          </p>
        </Swatch>
        <ul className="grid content-start gap-2">
          {results.length === 0 && <li className="text-sm text-muted">Nobody locked in a color this round.</li>}
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-md border border-rule bg-card p-2 pr-3">
              <div className="flex h-11 w-16 shrink-0 overflow-hidden rounded border border-black/10">
                <span className="flex-1" style={{ background: targetHex }} />
                <span className="flex-1" style={{ background: hslHex(...r.hsl) }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${r.id === me.id ? "font-semibold" : "font-medium"}`}>{r.name}</p>
                <p className="font-mono text-xs text-muted">ΔE {(r.d * 100).toFixed(1)}</p>
              </div>
              <span className="font-mono text-lg tabular-nums">+{r.points}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6 flex items-center gap-4 border-t border-rule pt-6">
        {isHost ? (
          <Button size="lg" disabled={busy} onClick={() => run(() => nextRound(room.code, room.round_no))}>
            {room.round_no >= room.total_rounds ? "See final scores" : "Next round"}
          </Button>
        ) : (
          <p className="text-sm text-muted">The host will start the next round.</p>
        )}
      </div>
    </div>
  );
}
