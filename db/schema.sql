-- Neon Postgres 18 with Realtime enabled on the branch.
CREATE TABLE rooms (
  code text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'clue' CHECK (mode IN ('clue','recall')),
  phase text NOT NULL DEFAULT 'lobby',
  round_no int NOT NULL DEFAULT 0,
  total_rounds int NOT NULL DEFAULT 5,
  host_id uuid,
  giver_id uuid,
  clue1 text,
  clue2 text,
  target_cell int,
  target_h int,
  target_s int,
  target_l int,
  giver_points int,
  phase_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  seat int NOT NULL,
  score int NOT NULL DEFAULT 0,
  last_seen timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_room_seat_idx ON players(room_code, seat);

CREATE TABLE guesses (
  room_code text NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  round_no int NOT NULL,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot IN (1,2)),
  cell int,
  h int,
  s int,
  l int,
  points int,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code, round_no, player_id, slot)
);
