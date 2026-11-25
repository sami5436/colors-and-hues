import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { getPool } from "./db";

const cookieName = (code: string) => `cah_${code}`;
const UUID = /^[0-9a-f-]{36}$/;

export const newToken = () => randomBytes(24).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function setPlayerCookie(code: string, playerId: string, token: string) {
  const store = await cookies();
  store.set(cookieName(code), `${playerId}.${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function clearPlayerCookie(code: string) {
  const store = await cookies();
  store.delete(cookieName(code));
}

/** The player this browser is in the given room, verified against the stored token hash. */
export async function getPlayer(code: string): Promise<{ id: string; name: string } | null> {
  const store = await cookies();
  const raw = store.get(cookieName(code))?.value;
  if (!raw) return null;
  const dot = raw.indexOf(".");
  const id = raw.slice(0, dot);
  const token = raw.slice(dot + 1);
  if (!UUID.test(id) || !token) return null;
  const { rows } = await getPool().query<{ name: string; token_hash: string }>(
    "SELECT name, token_hash FROM players WHERE id = $1 AND room_code = $2",
    [id, code],
  );
  const row = rows[0];
  if (!row) return null;
  const a = Buffer.from(row.token_hash, "hex");
  const b = Buffer.from(hashToken(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { id, name: row.name };
}
