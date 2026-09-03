import type { Page } from '@playwright/test';
import { DB_VERSION } from '../../src/services/db/connection';
import { PLAYER_FIELDS } from '../../src/services/db/pack';

const DB_NAME = 'fm-stats-db';

function makePlayer(uid: number, name: string) {
  return {
    UID: uid,
    Name: name,
    Age: 25,
    Weight: 80,
    Height: 180,
    RcInjury: false,
    Nat: 'ENG',
    Division: 'Premier League',
    Club: 'Test FC',
    Wage: 10000,
    Expires: null,
    Position: [{ type: 'ST' }],
    SecPosition: null,
    Starts: 20,
    Mins: 1800,
    PasPercentage: 80,
    AssistsPer90: 0,
    xAPer90: 0,
    PrPassesPer90: 0,
    OPKPPer90: 0,
    ChCPer90: 0,
    OPCrPercentage: 0,
    OPCrsCPer90: 0,
    ConvPercentage: 0,
    xGOP: 0,
    ShTPer90: 0,
    ShotsOutsideBoxPer90: 0,
    goals90: 0,
    NPxGPer90: 0,
    GlMst: 0,
    TckPer90: 0,
    TckR: 0,
    ClrPer90: 0,
    IntPer90: 0,
    KTckPer90: 0,
    KHdrsPer90: 0,
    AerAPer90: 0,
    HdrPercentage: 0,
    HdrsWPer90: 0,
    BlkPer90: 0,
    PossWonPer90: 0,
    PossLostPer90: 0,
    SprintsPer90: 0,
    DrbPer90: 0,
    DistPer90: 0,
    PresCPer90: 0,
    PresAPer90: 0,
    Svt: 0,
    Svp: 0,
    Svh: 0,
    xGPPer90: 0,
    exsvPercentage: 0,
    svPercentage: 0,
    ConPer90: 0,
  };
}

/**
 * Seeds the app's IndexedDB directly (real browser storage, no app code involved)
 * with a player roster and a compare list. Call after the app has loaded once
 * (so the DB/object stores exist), then reload the page to pick up the seed.
 */
export async function seedPlayersAndCompareList(
  page: Page,
  players: Array<{ uid: number; name: string }>,
  compareUids: number[]
) {
  await page.evaluate(
    ({ dbName, dbVersion, players, compareUids, fields }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(
            ['snapshots', 'playerSnapshots', 'compareList', 'settings'],
            'readwrite'
          );
          const snapshotId = 'seed-snapshot';
          tx.objectStore('snapshots').clear();
          tx.objectStore('playerSnapshots').clear();
          tx.objectStore('snapshots').put({
            id: snapshotId,
            date: '2035-01-24',
            label: null,
            playerCount: players.length,
            importedAt: 1,
            fields,
          });
          const packedStore = tx.objectStore('playerSnapshots');
          for (const p of players) {
            const record = p as unknown as Record<string, unknown>;
            packedStore.put({
              s: snapshotId,
              u: record.UID,
              v: fields.map((field) => record[field]),
            });
          }
          tx.objectStore('compareList').put({ id: 'default', uids: compareUids });
          tx.objectStore('settings').put({ key: 'activeSnapshot', value: snapshotId });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    {
      dbName: DB_NAME,
      dbVersion: DB_VERSION,
      players: players.map((p) => makePlayer(p.uid, p.name)),
      compareUids,
      fields: [...PLAYER_FIELDS],
    }
  );
}

export async function seedSnapshots(
  page: Page,
  snapshots: Array<{
    id: string;
    date: string | null;
    players: Array<{ uid: number; name: string; club?: string }>;
  }>,
  activeId?: string
) {
  await page.evaluate(
    ({ dbName, dbVersion, snapshots, activeId, fields }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['snapshots', 'playerSnapshots', 'settings'], 'readwrite');
          tx.objectStore('snapshots').clear();
          tx.objectStore('playerSnapshots').clear();
          const meta = tx.objectStore('snapshots');
          const rows = tx.objectStore('playerSnapshots');
          snapshots.forEach((snapshot, index) => {
            meta.put({
              id: snapshot.id,
              date: snapshot.date,
              label: null,
              playerCount: snapshot.players.length,
              importedAt: index + 1,
              fields,
            });
            for (const player of snapshot.players) {
              const record = player as unknown as Record<string, unknown>;
              rows.put({
                s: snapshot.id,
                u: record.UID,
                v: fields.map((field) => record[field]),
              });
            }
          });
          tx.objectStore('settings').put({ key: 'activeSnapshot', value: activeId });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    {
      dbName: DB_NAME,
      dbVersion: DB_VERSION,
      activeId: activeId ?? snapshots[0].id,
      fields: [...PLAYER_FIELDS],
      snapshots: snapshots.map((snapshot) => ({
        ...snapshot,
        players: snapshot.players.map((p) => ({
          ...makePlayer(p.uid, p.name),
          Club: p.club ?? 'Test FC',
        })),
      })),
    }
  );
}

export async function seedAnnotation(
  page: Page,
  annotation: { uid: number; unwanted?: boolean; note?: string; lastKnownName?: string }
) {
  await page.evaluate(
    ({ dbName, dbVersion, annotation }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['playerAnnotations'], 'readwrite');
          tx.objectStore('playerAnnotations').put(annotation);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, annotation }
  );
}

export async function seedCompareList(page: Page, uids: number[]) {
  await page.evaluate(
    ({ dbName, dbVersion, uids }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['compareList'], 'readwrite');
          tx.objectStore('compareList').put({ id: 'default', uids });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, uids }
  );
}

export async function seedSettings(page: Page, entries: Record<string, unknown>) {
  await page.evaluate(
    ({ dbName, dbVersion, entries }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['settings'], 'readwrite');
          for (const [key, value] of Object.entries(entries)) {
            tx.objectStore('settings').put({ key, value });
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, entries }
  );
}

export async function seedList(page: Page, list: { id: string; name: string; uids: number[] }) {
  await page.evaluate(
    ({ dbName, dbVersion, list }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['playerLists'], 'readwrite');
          tx.objectStore('playerLists').put({ ...list, order: 0, createdAt: new Date() });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
    },
    { dbName: DB_NAME, dbVersion: DB_VERSION, list }
  );
}
