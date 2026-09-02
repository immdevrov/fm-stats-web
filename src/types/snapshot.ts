import type { Player } from './types';

export interface Snapshot {
  id: string;
  date: string | null;
  label: string | null;
  playerCount: number;
  importedAt: number;
  fields: string[];
}

export interface PackedPlayer {
  s: string;
  u: number;
  v: unknown[];
}

export interface PlayerHistoryEntry {
  snapshot: Snapshot;
  player: Player;
}
