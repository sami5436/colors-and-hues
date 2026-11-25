import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { JoinRoomForm } from "@/components/entry-forms";
import { RoomClient } from "@/components/room/room-client";
import { Wordmark } from "@/components/ui";
import { normalizeCode } from "@/lib/game";
import { getPool } from "@/lib/server/db";
import { loadRoom, realtimeUrl } from "@/lib/server/realtime";
import { getPlayer } from "@/lib/server/session";

const serverClock = () => Date.now();

export async function generateMetadata({ params }: PageProps<"/r/[code]">): Promise<Metadata> {
  const code = normalizeCode((await params).code);
  const title = `Join room ${code} · Colors & Hues`;
  const description = "You're invited to a game of Colors & Hues. Tap the link, pick a name, play.";
  return {
    title,
    description,
    openGraph: { title, description, url: `/r/${code}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-5">
      <header className="pb-10">
        <Wordmark />
      </header>
      {children}
    </div>
  );
}

export default function RoomPage({ params }: PageProps<"/r/[code]">) {
  return (
    <Suspense fallback={<RoomFallback />}>
      <RoomContent params={params} />
    </Suspense>
  );
}

function RoomFallback() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between border-b border-rule py-4">
        <Wordmark />
      </header>
      <p className="py-8 text-sm text-muted">Opening the room...</p>
    </div>
  );
}

async function RoomContent({ params }: { params: PageProps<"/r/[code]">["params"] }) {
  // Request time only: the sealed query is a bearer token and must never be cached.
  await connection();
  const code = normalizeCode((await params).code);
  const player = await getPlayer(code);

  if (!player) {
    const { rowCount } = await getPool().query("SELECT 1 FROM rooms WHERE code = $1", [code]);
    return (
      <Shell>
        {rowCount ? (
          <JoinRoomForm initialCode={code} />
        ) : (
          <div>
            <h1 className="font-display text-4xl leading-none">No room called {code || "that"}.</h1>
            <p className="mt-3 text-sm text-ink-2">It may have closed, or the code has a typo.</p>
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-paper"
            >
              Back to start
            </Link>
          </div>
        )}
      </Shell>
    );
  }

  const { row, sealedQuery } = await loadRoom(code);
  if (!row) {
    return (
      <Shell>
        <h1 className="font-display text-4xl leading-none">This room has closed.</h1>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 w-fit items-center rounded-md bg-ink px-4 text-sm font-medium text-paper"
        >
          Back to start
        </Link>
      </Shell>
    );
  }

  return (
    <RoomClient
      key={sealedQuery.queryFingerprint}
      url={realtimeUrl()}
      code={code}
      me={player}
      initialRow={row}
      sealedQuery={sealedQuery}
      serverNow={serverClock()}
    />
  );
}
