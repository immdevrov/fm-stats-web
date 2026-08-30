import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import type { Player, LeagueRanking } from '../../types/types';
import type { PlayerAnnotation, PlayerList } from '../../types/annotations';

export interface FmStatsDB extends DBSchema {
  players: {
    key: number;
    value: Player;
    indexes: { 'by-name': string; 'by-club': string; 'by-position': string };
  };
  leagueRankings: { key: number; value: LeagueRanking };
  compareList: { key: string; value: { id: string; uids: number[] } };
  playerAnnotations: { key: number; value: PlayerAnnotation };
  playerLists: { key: string; value: PlayerList };
}

const DB_NAME = 'fm-stats-db';
const DB_VERSION = 4;

type UpgradeTx = IDBPTransaction<FmStatsDB, StoreNames<FmStatsDB>[], 'versionchange'>;

async function migrateCustomPositions(tx: UpgradeTx): Promise<void> {
  const playerStore = tx.objectStore('players');
  const annotationStore = tx.objectStore('playerAnnotations');
  let cursor = await playerStore.openCursor();
  while (cursor) {
    const player = cursor.value;
    if (player.CustomPosition) {
      await annotationStore.put({
        uid: player.UID,
        customPosition: player.CustomPosition,
        lastKnownName: player.Name,
        lastKnownClub: player.Club,
      });
      delete player.CustomPosition;
      await cursor.update(player);
    }
    cursor = await cursor.continue();
  }
}

let dbPromise: Promise<IDBPDatabase<FmStatsDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FmStatsDB>> {
  // A rejection here (e.g. an aborted upgrade) is deliberately cached: a half-migrated
  // schema can't be trusted, so every call fails until the page reloads rather than retrying.
  if (!dbPromise) {
    dbPromise = openDB<FmStatsDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
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
        if (oldVersion < 4) {
          db.createObjectStore('playerAnnotations', { keyPath: 'uid' });
          db.createObjectStore('playerLists', { keyPath: 'id' });
          if (oldVersion > 0) {
            migrateCustomPositions(tx).catch(() => tx.abort());
          }
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
