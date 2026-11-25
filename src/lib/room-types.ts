import type { Mode, Phase } from "./game";

export type PlayerInfo = {
  id: string;
  name: string;
  seat: number;
  score: number;
  last_seen: string;
};

export type GuessInfo = {
  player_id: string;
  slot: 1 | 2;
  cell: number | null;
  h: number | null;
  s: number | null;
  l: number | null;
  points: number | null;
};

export type RoomRow = {
  code: string;
  mode: Mode;
  phase: Phase;
  round_no: number;
  total_rounds: number;
  host_id: string | null;
  giver_id: string | null;
  clue1: string | null;
  clue2: string | null;
  giver_points: number | null;
  phase_ends_at: Date | string | null;
  target_cell: number | null;
  target_h: number | null;
  target_s: number | null;
  target_l: number | null;
  players: PlayerInfo[] | string;
  guesses: GuessInfo[] | string;
};
