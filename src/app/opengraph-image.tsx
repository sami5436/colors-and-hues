import { ImageResponse } from "next/og";

import { BoardArt, INK, MUTED, OG_SIZE, ogFonts, PAPER, Wordmark } from "@/lib/og";

export const alt = "Colors & Hues, a party game about the colors between words";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
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
        <div style={{ display: "flex", fontSize: 22, color: MUTED, letterSpacing: 3 }}>A PARTY GAME FOR 2 TO 12</div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Instrument Serif",
          fontSize: 104,
          lineHeight: 0.95,
          color: INK,
        }}
      >
        <div style={{ display: "flex" }}>Find the color</div>
        <div style={{ display: "flex", fontStyle: "italic" }}>behind the word.</div>
      </div>
      <BoardArt width={1072} rows={4} gap={4} />
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}
