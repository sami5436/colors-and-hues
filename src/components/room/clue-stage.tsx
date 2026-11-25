"use client";

import { useEffect, useState, type FormEvent } from "react";

import { nextRound, placeMarker, skipAhead, submitClue } from "@/app/actions";

import { Board, type Marker } from "../board";
import { Button, inputClass } from "../ui";
import { roundEyebrow, StageHeader, useGame } from "./shared";

/** The giver's target, fetched privately. The live room feed never carries it before the reveal. */
function useSecretTarget(code: string, roundNo: number, enabled: boolean) {
  const [secret, setSecret] = useState<{ round: number; cell: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`/api/rooms/${code}/secret`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { target_cell: number; round_no: number } | null) => {
        if (!cancelled && body) setSecret({ round: body.round_no, cell: body.target_cell });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, roundNo, enabled]);
  return enabled && secret?.round === roundNo ? secret.cell : null;
}

function Clues({ clue1, clue2 }: { clue1: string | null; clue2: string | null }) {
  if (!clue1) return null;
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
      <p className="font-display text-4xl italic leading-none sm:text-5xl">&ldquo;{clue1}&rdquo;</p>
      {clue2 && (
        <p className="font-display text-3xl italic leading-none text-ink-2 sm:text-4xl">then &ldquo;{clue2}&rdquo;</p>
      )}
    </div>
  );
}

function ClueForm({ first }: { first: boolean }) {
  const { room, run, busy } = useGame();
  const [value, setValue] = useState("");
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const max = first ? 1 : 2;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await run(() => submitClue(room.code, value))) setValue("");
  }

  return (
    <form onSubmit={submit} className="mb-5 flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={32}
          placeholder={first ? "One word" : "One or two words"}
          aria-label={first ? "First clue" : "Second clue"}
          className={`${inputClass} h-12 text-base`}
        />
        <p className={`mt-1 text-xs ${words > max ? "text-accent" : "text-muted"}`}>
          {words > max
            ? `Too many words. ${first ? "Just one" : "Two at most"}.`
            : "Avoid naming the color outright. Make them think."}
        </p>
      </div>
      <Button type="submit" size="lg" disabled={busy || words === 0 || words > max}>
        Give clue
      </Button>
    </form>
  );
}

function HostSkip({ label }: { label: string }) {
  const { room, isHost, run, busy } = useGame();
  if (!isHost) return null;
  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => skipAhead(room.code, room.phase))}>
      {label}
    </Button>
  );
}

export function ClueStage() {
  const game = useGame();
  const { room, me, isGiver, giver, isHost, run, busy } = game;
  const phase = room.phase;
  const secret = useSecretTarget(room.code, room.round_no, isGiver && phase !== "reveal");
  // Selection is tied to the phase it was made in, so it clears itself when the phase moves on.
  const [pick, setPick] = useState<{ key: string; cell: number } | null>(null);
  const pickKey = `${room.round_no}:${phase}`;
  const selected = pick?.key === pickKey ? pick.cell : null;
  const setSelected = (cell: number) => setPick({ key: pickKey, cell });

  const slot = phase === "guess2" ? 2 : 1;
  const guessing = phase === "guess1" || phase === "guess2";
  const myMarker = room.guesses.find((g) => g.player_id === me.id && g.slot === slot);
  const canPick = guessing && !isGiver && !myMarker;

  const names = new Map(room.players.map((p) => [p.id, p.name]));
  const markers: Marker[] = room.guesses
    .filter((g) => g.cell !== null)
    .map((g) => ({
      cell: g.cell!,
      label: names.get(g.player_id) ?? "?",
      mine: g.player_id === me.id,
      points: phase === "reveal" ? g.points : null,
      dim: phase === "guess2" && g.slot === 1,
    }));

  const guessers = room.players.filter((p) => p.id !== room.giver_id);
  const waitingOn = guessers.filter(
    (p) => !game.isAway(p) && !room.guesses.some((g) => g.player_id === p.id && g.slot === slot),
  ).length;

  const giverName = giver?.name ?? "The clue giver";
  let title: React.ReactNode;
  let note: React.ReactNode = null;

  if (phase === "clue1" || phase === "clue2") {
    title = isGiver
      ? phase === "clue1"
        ? "Describe your square."
        : "Add a second clue."
      : `${giverName} is thinking...`;
    note = isGiver
      ? phase === "clue1"
        ? "Your square is outlined below. Only you can see it."
        : "Look where the markers landed and steer them closer."
      : phase === "clue1"
        ? "A clue is on its way."
        : "A second clue is coming. You'll get another marker.";
  } else if (guessing) {
    title = isGiver
      ? "Watch them hunt."
      : myMarker
        ? "Marker down."
        : slot === 1
          ? "Where is it?"
          : "Place your second marker.";
    note = isGiver
      ? `Waiting on ${waitingOn} ${waitingOn === 1 ? "guess" : "guesses"}.`
      : myMarker
        ? `Waiting on ${waitingOn} more.`
        : "Tap a square, then confirm.";
  } else {
    title = "The reveal.";
  }

  const target = phase === "reveal" ? room.target_cell : secret;

  return (
    <div>
      <StageHeader
        eyebrow={`${roundEyebrow(room)} · ${giver ? `${giver.name} gives clues` : "Clue round"}`}
        title={title}
        aside={
          (phase === "clue1" || phase === "clue2") && !isGiver ? (
            <HostSkip label={phase === "clue1" ? "Skip this round" : "Skip second clue"} />
          ) : guessing && waitingOn > 0 ? (
            <HostSkip label="Stop waiting" />
          ) : null
        }
      />

      <Clues clue1={room.clue1} clue2={room.clue2} />
      {isGiver && (phase === "clue1" || phase === "clue2") && <ClueForm first={phase === "clue1"} />}

      <Board
        markers={markers}
        target={target}
        targetLabel={phase === "reveal" ? "The answer" : isGiver ? "Your square" : undefined}
        selected={canPick ? selected : null}
        onPick={canPick ? setSelected : undefined}
      />

      {(canPick || note) && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {canPick && (
            <Button
              size="lg"
              disabled={busy || selected === null}
              onClick={() => selected !== null && run(() => placeMarker(room.code, selected))}
            >
              {selected === null ? "Pick a square" : "Place marker"}
            </Button>
          )}
          {note && <p className="text-sm text-ink-2">{note}</p>}
        </div>
      )}

      {phase === "reveal" && <ClueReveal />}
      {phase === "reveal" && (
        <div className="mt-6 flex items-center gap-4 border-t border-rule pt-6">
          {isHost ? (
            <Button size="lg" disabled={busy} onClick={() => run(() => nextRound(room.code, room.round_no))}>
              {room.round_no >= room.total_rounds ? "See final scores" : "Next round"}
            </Button>
          ) : (
            <p className="text-sm text-muted">The host will start the next round.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ClueReveal() {
  const { room, me } = useGame();
  const giver = room.players.find((p) => p.id === room.giver_id);
  const rows = room.players
    .filter((p) => p.id !== room.giver_id)
    .map((p) => {
      const mine = room.guesses.filter((g) => g.player_id === p.id);
      return { p, best: mine.length ? Math.max(...mine.map((g) => g.points ?? 0)) : null };
    })
    .sort((a, b) => (b.best ?? -1) - (a.best ?? -1));

  return (
    <div className="mt-6 grid gap-x-8 gap-y-1 sm:grid-cols-2">
      {giver && (
        <p className="flex items-baseline justify-between border-b border-rule py-2 text-sm sm:col-span-2">
          <span>
            <span className="font-medium">{giver.name}</span>
            <span className="text-muted"> gave the clues and earns the table average</span>
          </span>
          <span className="font-mono tabular-nums">+{room.giver_points ?? 0}</span>
        </p>
      )}
      {rows.map(({ p, best }) => (
        <p key={p.id} className="flex items-baseline justify-between border-b border-rule py-2 text-sm">
          <span className={p.id === me.id ? "font-medium" : ""}>{p.name}</span>
          <span className="font-mono tabular-nums">
            {best === null ? <span className="text-muted">no guess</span> : `+${best}`}
          </span>
        </p>
      ))}
    </div>
  );
}
