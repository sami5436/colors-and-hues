"use client";

import type { SealedLiveQuery } from "@neon/realtime/client";
import { createRealtimeClient } from "@neon/realtime/client";
// @neon/realtime-react ships without a "use client" directive: import it only from client modules.
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { timerElapsed, type ActionResult } from "@/app/actions";
import type { RoomRow } from "@/lib/room-types";

import { Wordmark } from "../ui";
import { ClueStage } from "./clue-stage";
import { FinalStage } from "./final-stage";
import { Lobby } from "./lobby";
import { RecallStage } from "./recall-stage";
import { Scoreboard } from "./scoreboard";
import { awayCheck, GameProvider, normalizeRoom, useTicker, type Game } from "./shared";
import { TopBarActions } from "./top-bar";

type Props = {
  url: string;
  code: string;
  me: { id: string; name: string };
  initialRow: RoomRow;
  sealedQuery: SealedLiveQuery<RoomRow>;
  serverNow: number;
};

export function RoomClient(props: Props) {
  const [client] = useState(() => createRealtimeClient({ url: props.url }));
  return (
    <RealtimeProvider client={client}>
      <LiveRoom {...props} />
    </RealtimeProvider>
  );
}

function LiveRoom({ code, me, initialRow, sealedQuery, serverNow }: Props) {
  // Keep the first sealed query: a new object would restart the subscription. Renewals go through refreshQuery.
  const router = useRouter();
  const [query] = useState(sealedQuery);
  const refreshQuery = useCallback(async () => {
    const res = await fetch(`/api/rooms/${code}/live`, { method: "POST", cache: "no-store" });
    if (res.status === 401) {
      router.refresh();
      throw new Error("Left the room");
    }
    if (!res.ok) throw new Error(`Couldn't renew the room feed (${res.status})`);
    return (await res.json()) as SealedLiveQuery<RoomRow>;
  }, [code, router]);

  const { data, status } = useLiveQuery(query, { initialData: [initialRow], refreshQuery });

  // Server clock offset, so countdowns agree across devices. Refined by each heartbeat.
  const [offset, setOffset] = useState(0);
  const [initialOffset] = useState(() => serverNow - Date.now());
  const effectiveOffset = offset || initialOffset;
  const now = useCallback(() => Date.now() + effectiveOffset, [effectiveOffset]);

  // Heartbeat keeps this player marked present. It also refines the clock offset.
  useEffect(() => {
    let cancelled = false;
    async function beat() {
      const sent = Date.now();
      try {
        const res = await fetch(`/api/rooms/${code}/heartbeat`, { method: "POST", cache: "no-store" });
        if (res.status === 401 && !cancelled) router.refresh();
        if (!res.ok) return;
        const body = (await res.json()) as { now: number };
        const received = Date.now();
        if (!cancelled) setOffset(body.now - (sent + received) / 2 || 1);
      } catch {
        // Offline for a moment; the next beat will catch up.
      }
    }
    beat();
    const id = setInterval(beat, 20_000);
    const onVisible = () => document.visibilityState === "visible" && beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code, router]);

  const row = data?.[0];
  const room = useMemo(() => (row ? normalizeRoom(row) : null), [row]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => Promise<ActionResult | void>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (result && !result.ok) {
        setError(result.error);
        return false;
      }
      return true;
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4500);
    return () => clearTimeout(id);
  }, [error]);

  // When a timed phase runs out, nudge the server. It checks the deadline itself.
  const tick = useTicker(now, 500, Boolean(room?.phase_ends_at));
  const nudged = useRef<string>("");
  useEffect(() => {
    if (!room?.phase_ends_at || tick < room.phase_ends_at + 300) return;
    const key = `${room.round_no}:${room.phase}`;
    if (nudged.current === key) return;
    nudged.current = key;
    timerElapsed(code, room.phase, room.round_no).catch(() => {
      nudged.current = "";
    });
  }, [tick, room?.phase_ends_at, room?.phase, room?.round_no, code]);

  const awayBucket = Math.floor(tick / 5000);
  const game: Game | null = useMemo(() => {
    if (!room) return null;
    const isAway = awayCheck(now());
    return {
      room,
      me,
      isHost: room.host_id === me.id,
      isGiver: room.giver_id === me.id,
      host: room.players.find((p) => p.id === room.host_id),
      giver: room.players.find((p) => p.id === room.giver_id),
      now,
      isAway,
      busy,
      run,
    };
    // awayBucket re-evaluates away status every few seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, me, now, busy, run, awayBucket]);

  if (!game) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-5">
        <Wordmark />
        <h1 className="mt-10 font-display text-4xl leading-none">This room has closed.</h1>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 w-fit items-center rounded-md bg-ink px-4 text-sm font-medium text-paper"
        >
          Back to start
        </Link>
      </div>
    );
  }

  const stillInRoom = game.room.players.some((p) => p.id === me.id);
  const stage =
    game.room.phase === "lobby" ? (
      <Lobby />
    ) : game.room.phase === "final" ? (
      <FinalStage />
    ) : game.room.mode === "clue" ? (
      <ClueStage />
    ) : (
      <RecallStage />
    );

  return (
    <GameProvider value={game}>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-3 border-b border-rule py-4">
          <Wordmark />
          <TopBarActions code={code} />
        </header>

        {status === "error" && (
          <div className="mt-4 flex items-center justify-between rounded-md border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm">
            <span>Lost the live connection to this room.</span>
            <button className="font-medium underline underline-offset-4" onClick={() => window.location.reload()}>
              Reconnect
            </button>
          </div>
        )}
        {status === "stale" && <p className="mt-4 text-sm text-muted">Reconnecting to the room...</p>}
        {!stillInRoom && (
          <p className="mt-4 rounded-md border border-rule bg-card px-4 py-2.5 text-sm">
            You&apos;re no longer in this room.
          </p>
        )}

        <main className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_288px] lg:gap-10 lg:py-8">
          <section className="min-w-0">{stage}</section>
          <aside className="lg:border-l lg:border-rule lg:pl-8">
            <Scoreboard />
          </aside>
        </main>
      </div>

      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4 transition-all duration-200 ${
          error ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        {error && <p className="rounded-md bg-ink px-4 py-2.5 text-sm text-paper shadow-lg">{error}</p>}
      </div>
    </GameProvider>
  );
}
