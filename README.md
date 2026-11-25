# Colors & Hues

A multiplayer color party game. Create a room, share the four letter code, and play from any phone or laptop.

**Modes**

- **Clue**: one player secretly sees a square on a 28 x 12 color board and gives a one word clue, then a second clue of up to two words. Everyone else drops markers. Closest marker scores up to 5, and the clue giver earns the table average.
- **Recall**: a color shows for five seconds, then everyone rebuilds it with hue, saturation and lightness sliders. Scored by perceptual (OKLab) distance, up to 10 points.

## Stack

- Next.js 16 (App Router, server actions)
- Neon Postgres 18 with [Neon Realtime](https://neon.com/docs/realtime/overview): each room is one live SQL query, sealed per request on the server. The query masks the target by phase, so the answer never reaches guessers before the reveal.
- Tailwind CSS 4
- No accounts. Players are identified by an httpOnly cookie holding a random token; only its SHA-256 hash is stored.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the three values
npm run dev
```

Apply `db/schema.sql` to a Neon branch that has Realtime enabled, and add `http://localhost:3000` to the branch's Realtime allowed origins.

## Environment

| Variable | What it is |
| - | - |
| `DATABASE_URL` | Neon connection string |
| `NEON_REALTIME_URL` | Realtime endpoint from the Neon console |
| `NEON_REALTIME_SECRET` | Realtime secret, server only |
