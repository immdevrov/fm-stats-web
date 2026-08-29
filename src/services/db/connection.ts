import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Player, LeagueRanking } from '../../types/types';

export interface FmStatsDB extends DBSchema {
  players: {
    key: number;
    value: Player;
    indexes: { 'by-name': string; 'by-club': string; 'by-position': string };
  };
  leagueRankings: { key: number; value: LeagueRanking };
  compareList: { key: string; value: { id: string; uids: number[] } };
}

const DB_NAME = 'fm-stats-db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<FmStatsDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FmStatsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FmStatsDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('players')) {
          const playerStore = db.createObjectStore('players', { keyPath: 'UID' });
          playerStore.createIndex('by-name', 'Name', { unique: false });
          playerStore.createIndex('by-club', 'Club', { unique: false });
          playerStore.createIndex('by-position', 'Position', { unique: false });
        }
        if (oldVersion < 2) {
          db.createObjectStore('leagueRankings', { keyPath: 'rank' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('compareList', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function wrapError(action: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new Error(`Failed to ${action}: ${message}`);
}
