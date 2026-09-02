import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import type { Player, LeagueRanking } from '../../types/types';
import type { PlayerAnnotation, PlayerList } from '../../types/annotations';
import type { Snapshot, PackedPlayer } from '../../types/snapshot';
import { PLAYER_FIELDS, pack } from './pack';

export interface FmStatsDB extends DBSchema {
  players: {
    key: number;
    value: Player;
    indexes: { 'by-name': string; 'by-club': string; 'by-position': string };
  };
  snapshots: { key: string; value: Snapshot };
  playerSnapshots: {
    key: [string, number];
    value: PackedPlayer;
    indexes: { 'by-uid': number };
  };
  leagueRankings: { key: number; value: LeagueRanking };
  compareList: { key: string; value: { id: string; uids: number[] } };
  playerAnnotations: { key: number; value: PlayerAnnotation };
  playerLists: { key: string; value: PlayerList };
  settings: { key: string; value: { key: string; value: unknown } };
}

const DB_NAME = 'fm-stats-db';
export const DB_VERSION = 6;

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

async function migrateToSnapshots(db: IDBPDatabase<FmStatsDB>, tx: UpgradeTx): Promise<void> {
  const snapshotId = crypto.randomUUID();
  const target = tx.objectStore('playerSnapshots');
  const source = tx.objectStore('players');

  // Only IDB requests may be awaited in this loop: a versionchange transaction
  // auto-commits once the microtask queue drains with no request pending.
  let count = 0;
  let cursor = await source.openCursor();
  while (cursor) {
    const player = cursor.value;
    await target.put({ s: snapshotId, u: player.UID, v: pack(player, PLAYER_FIELDS) });
    count++;
    cursor = await cursor.continue();
  }

  if (count > 0) {
    await tx.objectStore('snapshots').put({
      id: snapshotId,
      date: null,
      label: 'Imported data',
      playerCount: count,
      importedAt: Date.now(),
      fields: [...PLAYER_FIELDS],
    });
  }

  await source.clear();
  db.deleteObjectStore('players');
}

let dbPromise: Promise<IDBPDatabase<FmStatsDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FmStatsDB>> {
  // A rejection here (e.g. an aborted upgrade) is deliberately cached: a half-migrated
  // schema can't be trusted, so every call fails until the page reloads rather than retrying.
  if (!dbPromise) {
    dbPromise = openDB<FmStatsDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 2) {
          db.createObjectStore('leagueRankings', { keyPath: 'rank' });
        }
        if (oldVersion < 3) {
          db.createObjectStore('compareList', { keyPath: 'id' });
        }
        if (oldVersion < 4) {
          db.createObjectStore('playerAnnotations', { keyPath: 'uid' });
          db.createObjectStore('playerLists', { keyPath: 'id' });
        }
        if (oldVersion < 5) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (oldVersion < 6) {
          db.createObjectStore('snapshots', { keyPath: 'id' });
          const packed = db.createObjectStore('playerSnapshots', { keyPath: ['s', 'u'] });
          packed.createIndex('by-uid', 'u', { unique: false });
        }

        const hadPlayers = db.objectStoreNames.contains('players');
        const chain =
          oldVersion > 0 && oldVersion < 4 && hadPlayers
            ? migrateCustomPositions(tx)
            : Promise.resolve();

        if (hadPlayers) {
          chain.then(() => migrateToSnapshots(db, tx)).catch(() => tx.abort());
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
