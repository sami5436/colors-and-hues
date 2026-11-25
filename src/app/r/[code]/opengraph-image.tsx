import { ImageResponse } from "next/og";

import { normalizeCode } from "@/lib/game";
import { BoardArt, INK, MUTED, OG_SIZE, ogFonts, PAPER, Wordmark } from "@/lib/og";

export const alt = "Invite to a Colors & Hues room";
export const size = OG_SIZE;
export const contentType = "image/png";

// The invite card people see when a room link is pasted into iMessage, Slack or Discord.
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PAPER,
        padding: "56px 64px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Wordmark size={44} />
        <div style={{ display: "flex", fontSize: 22, color: MUTED, letterSpacing: 3 }}>YOU&apos;RE INVITED</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 36 }}>
        <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 112, color: INK }}>Join room</div>
        <div style={{ display: "flex", fontSize: 112, fontWeight: 700, letterSpacing: 18, color: INK }}>{code}</div>
      </div>
      <BoardArt width={1072} rows={3} gap={4} />
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
