import type { Page } from '@playwright/test';

const DB_NAME = 'fm-stats-db';
const DB_VERSION = 4;

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
    ({ dbName, dbVersion, players, compareUids }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['players', 'compareList'], 'readwrite');
          const playerStore = tx.objectStore('players');
          playerStore.clear();
          for (const p of players) playerStore.put(p);
          tx.objectStore('compareList').put({ id: 'default', uids: compareUids });
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
    }
  );
}
