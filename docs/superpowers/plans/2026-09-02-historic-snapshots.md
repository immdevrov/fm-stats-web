# Historic Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let FM Jotter hold several dated imports from one save, switch the whole app between them, and show a player's history across them.

**Architecture:** Each import becomes a dated *snapshot*. Player rows are stored packed (values only, field names held once per snapshot) under a composite key `[snapshotId, uid]`, with a `by-uid` index so one player's history across all snapshots is a single indexed read. A `SnapshotProvider` context owns the active snapshot id and lazily loads exactly one roster into memory; every view reads that instead of calling the database directly.

**Tech Stack:** React 19, TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Chakra UI 3, `idb` 8 over IndexedDB, react-router 7, Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-02-historic-snapshots-design.md` — read it before starting. The plan argues from the spec; where they disagree, the spec wins.

## Global Constraints

- **Database version goes 5 → 6.** No other version bump in this plan.
- **Ordering is always by `date`, never by import time.** "Newest" means greatest `date`. Undated sorts oldest and is never newest.
- **Nothing above `src/services/db/` ever sees a packed record.** Every db function returns `Player`.
- **Percentile cohorts never span snapshots.**
- **No generic code comments.** Only comment genuinely non-obvious code. Project rule, enforced by a hook.
- **Interface prefix `I`, private service methods prefix `_`, functional components only.**
- **Strict TypeScript.** Unused locals and parameters are build errors — `npm run build` must pass at the end of every task.
- **Commit messages: one short line, no attribution of any kind.**
- **Tests are behaviour-only Playwright**, few, and each must be mutation-checked: break the behaviour, watch the test fail, restore it. The single exception is Task 2's pack/unpack round-trip, which is a pure-function test justified in the spec.

## File Structure

**Created:**
| File | Responsibility |
|---|---|
| `src/types/snapshot.ts` | `Snapshot`, `PackedPlayer`, `PlayerHistoryEntry` types |
| `src/services/db/pack.ts` | `PLAYER_FIELDS`, `pack`, `unpack` — the only place that knows the packed layout |
| `src/services/db/snapshots.ts` | Snapshot CRUD, chunked writes, roster and history reads |
| `src/utils/snapshot-order.ts` | `sortSnapshots`, `newestSnapshot` — the single ordering rule |
| `src/utils/import-date.ts` | `deriveDateFromFilename`, `isoToDisplay`, `displayToIso` |
| `src/contexts/SnapshotContext.tsx` | `SnapshotProvider`, `useSnapshots`, `useRoster` |
| `src/components/ui/import-save-dialog.tsx` | The save gate + date field, replacing the preserve dialog |
| `src/components/SnapshotSwitcher.tsx` | Sidebar select + Historic badge |
| `src/components/SnapshotTable.tsx` | Import view snapshot management + storage panel |
| `src/components/PlayerHistory.tsx` | Profile history section, including Rank this row |
| `browser-tests/pack.spec.ts` | pack/unpack round-trip |
| `browser-tests/snapshots.spec.ts` | Behaviour tests 1–5 from the spec |

**Modified:** `src/utils/utils.ts` (date bug), `src/services/db/connection.ts` (v6 + migration), `src/services/db/players.ts`, `src/services/db/settings.ts`, `src/services/db/index.ts`, `src/parser/html-parser.ts` (column guard), `src/components/Layout.tsx`, `src/components/Navigation.tsx`, `src/views/ImportView.tsx`, `src/views/PlayerProfileView.tsx`, `src/utils/planner.ts`, `src/types/planner.ts`, `src/contexts/SquadPlanContext.tsx`, `src/components/planner/PlannerToolbar.tsx`, `src/components/planner/PlannerCard.tsx`, `browser-tests/helpers/seed.ts`, `CLAUDE.md`, plus the eleven roster call sites in Task 8.

**Deleted:** `src/components/ui/import-preserve-dialog.tsx`.

---

# Phase 1 — Storage

At the end of this phase the app behaves exactly as it does today, but every player lives in a snapshot. No UI changes.

---

### Task 1: Fix the off-by-one month in `parseCustomDate`

`parseCustomDate` passes a 1-indexed month to `new Date(year, month, day)`, which wants 0-indexed. `"24/01/2035"` becomes 24 February 2035, and `"31/12/2035"` becomes 31 January **2036**.

This is invisible today because every date in the app goes through this one function, so the shifts cancel out. It stops being invisible the moment a correctly-parsed snapshot date is compared against a `Player.Expires` parsed here — which is exactly what Task 16 does. Fix it first.

**Files:**
- Modify: `src/utils/utils.ts:47-50`
- Test: `browser-tests/pack.spec.ts` (created here, extended in Task 2)

**Interfaces:**
- Consumes: nothing.
- Produces: `parseCustomDate(dateStr: string): Date` — now correct. Callers unchanged: `html-parser.ts` (`Expires`), `utils/planner.ts` (`parseHorizon`).

- [ ] **Step 1: Write the failing test**

Create `browser-tests/pack.spec.ts`. This file needs no `page` fixture — Playwright's runner executes it in Node and these are pure functions.

```ts
import { test, expect } from '@playwright/test';
import { parseCustomDate } from '../src/utils/utils';

test('parseCustomDate reads the month as written', () => {
  const january = parseCustomDate('24/01/2035');
  expect(january.getFullYear()).toBe(2035);
  expect(january.getMonth()).toBe(0);
  expect(january.getDate()).toBe(24);
});

test('parseCustomDate does not roll December into the next year', () => {
  const december = parseCustomDate('31/12/2035');
  expect(december.getFullYear()).toBe(2035);
  expect(december.getMonth()).toBe(11);
  expect(december.getDate()).toBe(31);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test browser-tests/pack.spec.ts`
Expected: FAIL — first test reports `expect(received).toBe(0)` with received `1`; second reports year `2036`.

- [ ] **Step 3: Write the fix**

In `src/utils/utils.ts`, replace the body of `parseCustomDate`:

```ts
export function parseCustomDate(dateStr: string) {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test browser-tests/pack.spec.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Confirm nothing else assumed the bug**

Run: `npx playwright test && npm run build`
Expected: all tests pass, build clean. The compare-list test does not touch dates; the planner compared two equally-shifted dates, so it is unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/utils/utils.ts browser-tests/pack.spec.ts
git commit -m "fix month off-by-one in parseCustomDate"
```

---

### Task 2: Packed record format

The storage saving is in key names, not values. A plain `Player` re-stores ~55 key strings per record; packing stores the values in a fixed order and the names once per snapshot.

**Files:**
- Create: `src/types/snapshot.ts`
- Create: `src/services/db/pack.ts`
- Modify: `browser-tests/pack.spec.ts`

**Interfaces:**
- Consumes: `Player` from `src/types/types.ts`.
- Produces:
  - `PLAYER_FIELDS: readonly string[]` — every `Player` key except `UID` and `CustomPosition`.
  - `pack(player: Player, fields: readonly string[]): unknown[]`
  - `unpack(uid: number, values: unknown[], fields: readonly string[]): Player`
  - `Snapshot`, `PackedPlayer`, `PlayerHistoryEntry` types.

- [ ] **Step 1: Write the failing test**

Append to `browser-tests/pack.spec.ts`:

```ts
import { PLAYER_FIELDS, pack, unpack } from '../src/services/db/pack';
import type { Player } from '../src/types/types';

function samplePlayer(): Player {
  const player = { UID: 42, Name: 'Test Player' } as Player;
  for (const field of PLAYER_FIELDS) {
    if (field in player) continue;
    (player as unknown as Record<string, unknown>)[field] = 0;
  }
  player.Expires = null;
  player.Position = [{ type: 'D', side: ['R', 'C'] }];
  player.SecPosition = [{ type: 'WB', side: ['R'] }];
  player.RcInjury = true;
  player.Club = 'Test FC';
  player.Nat = 'ENG';
  player.Division = 'Premier League';
  return player;
}

test('pack and unpack round-trip a fully populated player', () => {
  const player = samplePlayer();
  const restored = unpack(player.UID, pack(player, PLAYER_FIELDS), PLAYER_FIELDS);
  expect(restored).toEqual(player);
});

test('unpack preserves a real Expires date', () => {
  const player = { ...samplePlayer(), Expires: new Date(2035, 0, 24) };
  const restored = unpack(player.UID, pack(player, PLAYER_FIELDS), PLAYER_FIELDS);
  expect(restored.Expires).toBeInstanceOf(Date);
  expect(restored.Expires?.getMonth()).toBe(0);
});

test('unpack decodes against the field list a snapshot was written with', () => {
  const player = samplePlayer();
  const oldFields = PLAYER_FIELDS.filter((f) => f !== 'DistPer90');
  const restored = unpack(player.UID, pack(player, oldFields), oldFields);

  expect(restored.Name).toBe('Test Player');
  expect(restored.Club).toBe('Test FC');
  expect('DistPer90' in restored).toBe(false);
});

test('PLAYER_FIELDS excludes the key and the derived override', () => {
  expect(PLAYER_FIELDS).not.toContain('UID');
  expect(PLAYER_FIELDS).not.toContain('CustomPosition');
});
```

The third test is the important one: it proves an older snapshot written before a stat was added still decodes correctly, which is the whole reason `fields` is stored per snapshot.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test browser-tests/pack.spec.ts`
Expected: FAIL — cannot resolve `../src/services/db/pack`.

- [ ] **Step 3: Write the types**

Create `src/types/snapshot.ts`:

```ts
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
```

- [ ] **Step 4: Write the pack module**

Create `src/services/db/pack.ts`:

```ts
import type { Player } from '../../types/types';

export const PLAYER_FIELDS: readonly string[] = [
  'Name', 'Age', 'Weight', 'Height', 'RcInjury', 'Nat', 'Division', 'Club',
  'Wage', 'Expires', 'Position', 'SecPosition', 'Starts', 'Mins',
  'PasPercentage', 'AssistsPer90', 'xAPer90', 'PrPassesPer90', 'OPKPPer90',
  'ChCPer90', 'OPCrPercentage', 'OPCrsCPer90', 'ConvPercentage', 'xGOP',
  'ShTPer90', 'ShotsOutsideBoxPer90', 'goals90', 'NPxGPer90', 'GlMst',
  'TckPer90', 'TckR', 'IntPer90', 'ClrPer90', 'KTckPer90', 'KHdrsPer90',
  'AerAPer90', 'HdrPercentage', 'HdrsWPer90', 'BlkPer90', 'PossWonPer90',
  'PossLostPer90', 'SprintsPer90', 'DrbPer90', 'DistPer90', 'PresCPer90',
  'PresAPer90', 'Svt', 'Svp', 'Svh', 'xGPPer90', 'exsvPercentage',
  'svPercentage', 'ConPer90',
];

export function pack(player: Player, fields: readonly string[]): unknown[] {
  const record = player as unknown as Record<string, unknown>;
  return fields.map((field) => record[field]);
}

export function unpack(uid: number, values: unknown[], fields: readonly string[]): Player {
  const record: Record<string, unknown> = { UID: uid };
  fields.forEach((field, index) => {
    record[field] = values[index];
  });
  return record as unknown as Player;
}
```

`CustomPosition` is deliberately absent: it is an annotation merged on read, and `players.ts` already strips it before writing.

- [ ] **Step 5: Verify PLAYER_FIELDS is complete**

Run this and confirm it prints nothing:

```bash
node -e "
const fs=require('fs');
const t=fs.readFileSync('src/types/types.ts','utf8');
const body=t.slice(t.indexOf('export type Player'),t.indexOf('};',t.indexOf('export type Player')));
const keys=[...body.matchAll(/^\s{2}(\w+)\??:/gm)].map(m=>m[1]).filter(k=>k!=='UID'&&k!=='CustomPosition');
const p=fs.readFileSync('src/services/db/pack.ts','utf8');
const packed=[...p.matchAll(/'([A-Za-z0-9]+)'/g)].map(m=>m[1]);
const missing=keys.filter(k=>!packed.includes(k));
if(missing.length) console.log('MISSING FROM PLAYER_FIELDS:',missing);
"
```

Expected: no output. Any name printed must be added to `PLAYER_FIELDS`, appended at the end — never inserted in the middle, because order is the contract.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx playwright test browser-tests/pack.spec.ts && npm run build`
Expected: PASS, 6 tests. Build clean.

- [ ] **Step 7: Commit**

```bash
git add src/types/snapshot.ts src/services/db/pack.ts browser-tests/pack.spec.ts
git commit -m "add packed player record format"
```

---

### Task 3: Database version 6 and the migration

**Files:**
- Modify: `src/services/db/connection.ts`

**Interfaces:**
- Consumes: `PLAYER_FIELDS`, `pack` from Task 2; `Snapshot`, `PackedPlayer` types.
- Produces: `DB_VERSION = 6`; stores `snapshots` (keyPath `id`) and `playerSnapshots` (keyPath `['s','u']`, index `by-uid` on `u`). The `players` store is emptied and dropped.

- [ ] **Step 1: Add the stores to the schema type**

In `src/services/db/connection.ts`, add the imports and two schema entries, and remove the `players` entry:

```ts
import type { Snapshot, PackedPlayer } from '../../types/snapshot';
import { PLAYER_FIELDS, pack } from './pack';

export interface FmStatsDB extends DBSchema {
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
```

The `Player` import in this file is now only used by the v4 migration; leave it.

- [ ] **Step 2: Bump the version**

```ts
export const DB_VERSION = 6;
```

- [ ] **Step 3: Write the migration**

Add above `getDB`, beside `migrateCustomPositions`:

```ts
async function migrateToSnapshots(db: IDBPDatabase<FmStatsDB>, tx: UpgradeTx): Promise<void> {
  const snapshotId = crypto.randomUUID();
  const target = tx.objectStore('playerSnapshots');
  const source = tx.objectStore('players' as never) as unknown as {
    openCursor: () => Promise<{ value: Player; continue: () => Promise<unknown> } | null>;
    clear: () => Promise<void>;
  };

  let count = 0;
  let cursor = await source.openCursor();
  while (cursor) {
    const player = cursor.value;
    await target.put({ s: snapshotId, u: player.UID, v: pack(player, PLAYER_FIELDS) });
    count++;
    cursor = (await cursor.continue()) as typeof cursor;
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
  db.deleteObjectStore('players' as never);
}
```

The loop awaits only IndexedDB requests. A `versionchange` transaction commits as soon as the microtask queue drains with no request pending, so awaiting anything else here — a timer, a `fetch`, a `Promise.all` over pre-gathered rows — closes the transaction mid-migration and loses the copy. The `clear()` before `deleteObjectStore` is the safety net: if the delete fails, the space is already reclaimed and the store is dropped by a later version.

- [ ] **Step 4: Wire it into the upgrade**

Replace the `upgrade` callback body. Note the `players` store is only created when the database is brand new *and* then immediately superseded — so for a fresh install, skip it entirely:

```ts
upgrade(db, oldVersion, _newVersion, tx) {
  if (oldVersion > 0 && oldVersion < 2) {
    db.createObjectStore('leagueRankings', { keyPath: 'rank' });
  } else if (oldVersion === 0) {
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
  const chain = oldVersion > 0 && oldVersion < 4 && hadPlayers
    ? migrateCustomPositions(tx)
    : Promise.resolve();

  if (hadPlayers) {
    chain.then(() => migrateToSnapshots(db, tx)).catch(() => tx.abort());
  }
}
```

`migrateCustomPositions` must finish before `migrateToSnapshots` reads the store, or custom positions would be packed into the snapshot instead of moved to annotations. Chaining is what guarantees that.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: clean. If TypeScript complains about `'players' as never`, that is the intended escape hatch for a store no longer in the schema type — leave the cast.

- [ ] **Step 6: Verify the migration by hand**

```bash
npm run dev
```

In a browser with existing v5 data: open the app, then in DevTools → Application → IndexedDB → `fm-stats-db`. Confirm version 6, a `snapshots` store with one record (`date: null`, `label: "Imported data"`, `playerCount` matching your old roster), a `playerSnapshots` store with that many rows, and no `players` store. On a 50k roster this takes a few seconds — do not reload during it.

If the migration aborts, take the spec's documented fallback rather than patching around it: delete the database in DevTools and re-import. Annotations, lists, rankings, club and plan live in stores the upgrade does not touch, but a deleted database loses those too — so export nothing and simply accept the re-import, or roll back this task and retry.

- [ ] **Step 7: Commit**

```bash
git add src/services/db/connection.ts
git commit -m "migrate players into dated snapshots at database version 6"
```

---

### Task 4: Snapshot ordering helper

One rule, one file, so no view invents its own.

**Files:**
- Create: `src/utils/snapshot-order.ts`
- Modify: `browser-tests/pack.spec.ts`

**Interfaces:**
- Consumes: `Snapshot`.
- Produces: `sortSnapshots(snapshots: Snapshot[]): Snapshot[]` (newest date first, undated last, `importedAt` descending as tiebreak) and `newestSnapshot(snapshots: Snapshot[]): Snapshot | null` (never returns an undated snapshot unless it is the only one).

- [ ] **Step 1: Write the failing test**

Append to `browser-tests/pack.spec.ts`:

```ts
import { sortSnapshots, newestSnapshot } from '../src/utils/snapshot-order';
import type { Snapshot } from '../src/types/snapshot';

function snap(id: string, date: string | null, importedAt = 0): Snapshot {
  return { id, date, label: null, playerCount: 1, importedAt, fields: [] };
}

test('snapshots sort by date regardless of import order', () => {
  const backfilled = [snap('b', '2035-01-24', 1), snap('c', '2036-05-01', 2), snap('a', '2033-08-10', 3)];
  expect(sortSnapshots(backfilled).map((s) => s.id)).toEqual(['c', 'b', 'a']);
});

test('an undated snapshot sorts oldest and is never the newest', () => {
  const withUndated = [snap('u', null, 9), snap('d', '2033-08-10', 1)];
  expect(sortSnapshots(withUndated).map((s) => s.id)).toEqual(['d', 'u']);
  expect(newestSnapshot(withUndated)?.id).toBe('d');
});

test('an undated snapshot alone is the newest', () => {
  expect(newestSnapshot([snap('u', null)])?.id).toBe('u');
});

test('importedAt breaks a tie between equal dates', () => {
  const sameDay = [snap('first', '2035-01-24', 1), snap('second', '2035-01-24', 2)];
  expect(sortSnapshots(sameDay).map((s) => s.id)).toEqual(['second', 'first']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test browser-tests/pack.spec.ts`
Expected: FAIL — cannot resolve `../src/utils/snapshot-order`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/snapshot-order.ts`:

```ts
import type { Snapshot } from '../types/snapshot';

export function sortSnapshots(snapshots: Snapshot[]): Snapshot[] {
  return [...snapshots].sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return b.date.localeCompare(a.date);
    }
    return b.importedAt - a.importedAt;
  });
}

export function newestSnapshot(snapshots: Snapshot[]): Snapshot | null {
  return sortSnapshots(snapshots)[0] ?? null;
}
```

`sortSnapshots` puts undated last, so `newestSnapshot` returns one only when nothing dated exists — which is the required behaviour in both directions.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test browser-tests/pack.spec.ts && npm run build`
Expected: PASS, 10 tests. Build clean.

- [ ] **Step 5: Commit**

```bash
git add src/utils/snapshot-order.ts browser-tests/pack.spec.ts
git commit -m "add snapshot ordering by date"
```

---

### Task 5: Snapshot database module

**Files:**
- Create: `src/services/db/snapshots.ts`
- Modify: `src/services/db/settings.ts`
- Modify: `src/services/db/index.ts`

**Interfaces:**
- Consumes: `PLAYER_FIELDS`, `pack`, `unpack`, `sortSnapshots`, `newestSnapshot`, `Snapshot`, `PlayerHistoryEntry`.
- Produces, all on the `db` facade:
  - `createSnapshot(players: Player[], meta: { date: string; label?: string | null }, onProgress?: (written: number, total: number) => void): Promise<string>` — returns the new snapshot id.
  - `listSnapshots(): Promise<Snapshot[]>` — sorted, newest first.
  - `getSnapshotRoster(snapshotId: string): Promise<Player[]>`
  - `getSnapshotPlayer(snapshotId: string, uid: number): Promise<Player | undefined>` — a single keyed read, no roster load.
  - `purgeOrphanedRows(): Promise<number>` — deletes rows whose snapshot record is missing, returns how many.
  - `getPlayerHistory(uid: number): Promise<PlayerHistoryEntry[]>` — sorted by snapshot date, newest first.
  - `deleteSnapshot(snapshotId: string): Promise<void>`
  - `updateSnapshot(snapshotId: string, patch: Partial<Pick<Snapshot,'date'|'label'>>): Promise<void>`
  - `getActiveSnapshotId(): Promise<string | null>` — resolves a missing or dangling id to the newest.
  - `setActiveSnapshotId(id: string | null): Promise<void>`
  - `clearAllSnapshots(): Promise<void>`

- [ ] **Step 1: Add the setting accessor**

In `src/services/db/settings.ts`, add the key constant beside the other two and the accessor pair at the end:

```ts
const ACTIVE_SNAPSHOT = 'activeSnapshot';

export async function getStoredActiveSnapshot(): Promise<string | null> {
  const value = await _get(ACTIVE_SNAPSHOT);
  return typeof value === 'string' ? value : null;
}

export function setActiveSnapshotId(id: string | null): Promise<void> {
  return _set(ACTIVE_SNAPSHOT, id, 'save active snapshot');
}
```

The raw getter is named `getStoredActiveSnapshot` because `snapshots.ts` wraps it with the fallback and exports the resolved `getActiveSnapshotId` under the plainer name.

- [ ] **Step 2: Write the snapshot module**

Create `src/services/db/snapshots.ts`:

```ts
import { getDB, wrapError } from './connection';
import { getStoredActiveSnapshot, setActiveSnapshotId } from './settings';
import { PLAYER_FIELDS, pack, unpack } from './pack';
import { sortSnapshots, newestSnapshot } from '../../utils/snapshot-order';
import type { Player } from '../../types/types';
import type { Snapshot, PlayerHistoryEntry } from '../../types/snapshot';

const CHUNK_SIZE = 2000;

function rosterRange(snapshotId: string): IDBKeyRange {
  return IDBKeyRange.bound([snapshotId], [snapshotId, []]);
}

export async function listSnapshots(): Promise<Snapshot[]> {
  try {
    const db = await getDB();
    return sortSnapshots(await db.getAll('snapshots'));
  } catch (error) {
    throw wrapError('list snapshots', error);
  }
}

export async function createSnapshot(
  players: Player[],
  meta: { date: string; label?: string | null },
  onProgress?: (written: number, total: number) => void
): Promise<string> {
  try {
    const db = await getDB();
    const id = crypto.randomUUID();
    const fields = [...PLAYER_FIELDS];

    for (let start = 0; start < players.length; start += CHUNK_SIZE) {
      const chunk = players.slice(start, start + CHUNK_SIZE);
      const tx = db.transaction('playerSnapshots', 'readwrite');
      await Promise.all(
        chunk.map((player) =>
          tx.store.put({ s: id, u: player.UID, v: pack(player, fields) })
        )
      );
      await tx.done;
      onProgress?.(Math.min(start + CHUNK_SIZE, players.length), players.length);
    }

    await db.put('snapshots', {
      id,
      date: meta.date,
      label: meta.label ?? null,
      playerCount: players.length,
      importedAt: Date.now(),
      fields,
    });

    return id;
  } catch (error) {
    throw wrapError('create snapshot', error);
  }
}

export async function getSnapshotRoster(snapshotId: string): Promise<Player[]> {
  try {
    const db = await getDB();
    const snapshot = await db.get('snapshots', snapshotId);
    if (!snapshot) return [];
    const rows = await db.getAll('playerSnapshots', rosterRange(snapshotId));
    return rows.map((row) => unpack(row.u, row.v, snapshot.fields));
  } catch (error) {
    throw wrapError('get snapshot roster', error);
  }
}

export async function getSnapshotPlayer(
  snapshotId: string,
  uid: number
): Promise<Player | undefined> {
  try {
    const db = await getDB();
    const snapshot = await db.get('snapshots', snapshotId);
    if (!snapshot) return undefined;
    const row = await db.get('playerSnapshots', [snapshotId, uid]);
    return row ? unpack(row.u, row.v, snapshot.fields) : undefined;
  } catch (error) {
    throw wrapError('get snapshot player', error);
  }
}

export async function purgeOrphanedRows(): Promise<number> {
  try {
    const db = await getDB();
    const known = new Set((await db.getAll('snapshots')).map((snapshot) => snapshot.id));
    let removed = 0;
    let cursor = await db.transaction('playerSnapshots', 'readwrite').store.openCursor();
    while (cursor) {
      if (!known.has(cursor.value.s)) {
        await cursor.delete();
        removed++;
      }
      cursor = await cursor.continue();
    }
    return removed;
  } catch (error) {
    throw wrapError('purge orphaned rows', error);
  }
}

export async function getPlayerHistory(uid: number): Promise<PlayerHistoryEntry[]> {
  try {
    const db = await getDB();
    const rows = await db.getAllFromIndex('playerSnapshots', 'by-uid', uid);
    const snapshots = new Map((await db.getAll('snapshots')).map((s) => [s.id, s]));

    const entries: PlayerHistoryEntry[] = [];
    for (const row of rows) {
      const snapshot = snapshots.get(row.s);
      if (!snapshot) continue;
      entries.push({ snapshot, player: unpack(row.u, row.v, snapshot.fields) });
    }

    const order = new Map(sortSnapshots([...snapshots.values()]).map((s, i) => [s.id, i]));
    return entries.sort((a, b) => order.get(a.snapshot.id)! - order.get(b.snapshot.id)!);
  } catch (error) {
    throw wrapError('get player history', error);
  }
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  try {
    const db = await getDB();
    let cursor = await db
      .transaction('playerSnapshots', 'readwrite')
      .store.openCursor(rosterRange(snapshotId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await db.delete('snapshots', snapshotId);

    if ((await getStoredActiveSnapshot()) === snapshotId) {
      await setActiveSnapshotId(newestSnapshot(await db.getAll('snapshots'))?.id ?? null);
    }
  } catch (error) {
    throw wrapError('delete snapshot', error);
  }
}

export async function updateSnapshot(
  snapshotId: string,
  patch: Partial<Pick<Snapshot, 'date' | 'label'>>
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('snapshots', snapshotId);
    if (!existing) return;
    await db.put('snapshots', { ...existing, ...patch });
  } catch (error) {
    throw wrapError('update snapshot', error);
  }
}

export async function getActiveSnapshotId(): Promise<string | null> {
  const db = await getDB();
  const all = await db.getAll('snapshots');
  if (all.length === 0) return null;

  const stored = await getStoredActiveSnapshot();
  if (stored && all.some((snapshot) => snapshot.id === stored)) return stored;

  const fallback = newestSnapshot(all)?.id ?? null;
  await setActiveSnapshotId(fallback);
  return fallback;
}

export async function clearAllSnapshots(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(['snapshots', 'playerSnapshots'], 'readwrite');
    await Promise.all([tx.objectStore('snapshots').clear(), tx.objectStore('playerSnapshots').clear()]);
    await tx.done;
    await setActiveSnapshotId(null);
  } catch (error) {
    throw wrapError('clear snapshots', error);
  }
}
```

`getActiveSnapshotId` is where the dangling-id fallback lives, so no caller has to remember it. `createSnapshot` writes the metadata record last: an interrupted import leaves rows under an id nothing names, which Task 13 reports, rather than a snapshot the switcher offers but cannot load.

- [ ] **Step 3: Export from the facade**

In `src/services/db/index.ts`:

```ts
import * as snapshots from './snapshots';

export const db = {
  ...players,
  ...rankings,
  ...compare,
  ...annotations,
  ...settings,
  ...snapshots,
};
```

`snapshots` must come after `settings` so its resolved `getActiveSnapshotId` is what callers get.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/services/db/snapshots.ts src/services/db/settings.ts src/services/db/index.ts
git commit -m "add snapshot database module"
```

---

### Task 6: Point the existing player reads at the active snapshot

Nothing above `services/db` changes in this task. `getPlayersByClub` and `getPlayersByPosition` survive here as in-memory filters purely so the app keeps working; Task 8 deletes them.

**Files:**
- Modify: `src/services/db/players.ts`
- Modify: `browser-tests/helpers/seed.ts`

**Interfaces:**
- Consumes: `getActiveSnapshotId`, `getSnapshotRoster` from Task 5.
- Produces: `getAllPlayers()`, `getPlayer(uid)`, `getPlayersByClub(club)`, `getPlayersByPosition(position)`, `searchPlayersByName(term)`, `getPlayerCount()` — same signatures, now reading the active snapshot. `savePlayer`, `savePlayers`, `deletePlayer`, `clearAllPlayers` are removed; `createSnapshot` and `clearAllSnapshots` replace them.

- [ ] **Step 1: Rewrite the read functions**

Replace the whole of `src/services/db/players.ts` with:

```ts
import { getDB, wrapError } from './connection';
import { getActiveSnapshotId, getSnapshotRoster, getSnapshotPlayer } from './snapshots';
import type { Player } from '../../types/types';
import type { PlayerPositions } from '../../fields/positions';

async function withCustomPositions(players: Player[]): Promise<Player[]> {
  if (players.length === 0) return players;
  const db = await getDB();
  const annotations = await db.getAll('playerAnnotations');
  const byUid = new Map(
    annotations
      .filter((a) => a.customPosition)
      .map((a) => [a.uid, a.customPosition as PlayerPositions])
  );
  if (byUid.size === 0) return players;
  return players.map((player) => {
    const customPosition = byUid.get(player.UID);
    return customPosition ? { ...player, CustomPosition: customPosition } : player;
  });
}

async function activeRoster(): Promise<Player[]> {
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return [];
  return await withCustomPositions(await getSnapshotRoster(snapshotId));
}

export async function getAllPlayers(): Promise<Player[]> {
  try {
    return await activeRoster();
  } catch (error) {
    throw wrapError('get players', error);
  }
}

export async function getPlayer(uid: number): Promise<Player | undefined> {
  try {
    const snapshotId = await getActiveSnapshotId();
    if (!snapshotId) return undefined;
    const player = await getSnapshotPlayer(snapshotId, uid);
    if (!player) return undefined;
    const [merged] = await withCustomPositions([player]);
    return merged;
  } catch (error) {
    throw wrapError('get player', error);
  }
}

export async function getPlayersByClub(club: string): Promise<Player[]> {
  try {
    return (await activeRoster()).filter((player) => player.Club === club);
  } catch (error) {
    throw wrapError('get players by club', error);
  }
}

export async function getPlayersByPosition(position: string): Promise<Player[]> {
  try {
    return (await activeRoster()).filter((player) =>
      player.Position.some((entry) => entry.type === position)
    );
  } catch (error) {
    throw wrapError('get players by position', error);
  }
}

export async function searchPlayersByName(searchTerm: string): Promise<Player[]> {
  try {
    const lowerSearch = searchTerm.toLowerCase();
    return (await activeRoster()).filter((player) =>
      player.Name.toLowerCase().includes(lowerSearch)
    );
  } catch (error) {
    throw wrapError('search players', error);
  }
}

export async function getPlayerCount(): Promise<number> {
  try {
    return (await activeRoster()).length;
  } catch (error) {
    throw wrapError('get player count', error);
  }
}

export async function updatePlayerPosition(
  uid: number,
  customPosition: PlayerPositions
): Promise<void> {
  try {
    const db = await getDB();
    const player = await getPlayer(uid);
    const existing = await db.get('playerAnnotations', uid);
    await db.put('playerAnnotations', {
      ...existing,
      uid,
      customPosition,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    });
  } catch (error) {
    throw wrapError('update player position', error);
  }
}

export async function clearPlayerCustomPosition(uid: number): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('playerAnnotations', uid);
    if (!existing) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { customPosition: _removed, ...rest } = existing;
    await db.put('playerAnnotations', rest);
  } catch (error) {
    throw wrapError('clear player custom position', error);
  }
}

export async function clearAllCustomPositions(): Promise<void> {
  try {
    const db = await getDB();
    const annotations = await db.getAll('playerAnnotations');
    const withCustom = annotations.filter((a) => a.customPosition);
    if (withCustom.length === 0) return;
    const tx = db.transaction('playerAnnotations', 'readwrite');
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      withCustom.map(({ customPosition: _removed, ...rest }) => tx.store.put(rest))
    );
    await tx.done;
  } catch (error) {
    throw wrapError('clear custom positions', error);
  }
}
```

`getPlayer` reads one row by composite key rather than filtering a loaded roster. `PlayerProfileView` calls it after every annotation edit, and on a 50k snapshot a roster load per edit would be visible.

- [ ] **Step 2: Fix ImportView's now-missing calls**

`ImportView` still calls `db.clearAllPlayers()` and `db.savePlayers()`, which no longer exist. Keep it compiling with the smallest possible bridge until Task 11 rewrites it properly — in `src/views/ImportView.tsx`, replace those two lines inside `performImport`:

```ts
await db.clearAllSnapshots();
await db.createSnapshot(players, { date: new Date().toISOString().slice(0, 10) });
```

This is scaffolding, not the design: it dates the snapshot from the machine clock, which the spec forbids. Task 11 replaces it.

- [ ] **Step 3: Update the test seed helper**

The helper writes to the `players` store, which no longer exists. In `browser-tests/helpers/seed.ts`, replace the `page.evaluate` body so it seeds a snapshot instead. Add the import at the top:

```ts
import { PLAYER_FIELDS } from '../../src/services/db/pack';
```

and replace the evaluate call with:

```ts
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
```

- [ ] **Step 4: Run the full suite**

Run: `npx playwright test && npm run build`
Expected: all pass. The compare-list test is the regression guard for this whole phase — it drives the real app against seeded snapshot data.

- [ ] **Step 5: Verify the app by hand**

```bash
npm run dev
```

Visit `/players`, `/teams`, `/scouting` and one player profile. Everything should render exactly as before the migration. This is the checkpoint for Phase 1: same behaviour, different storage.

- [ ] **Step 6: Commit**

```bash
git add src/services/db/players.ts src/views/ImportView.tsx browser-tests/helpers/seed.ts
git commit -m "read players from the active snapshot"
```

---

# Phase 2 — Reading

Still one snapshot, still no switcher. This phase is the refactor, and it pays for itself on a 50k roster before any historic data exists: `PlayerProfileView` loads the roster twice today, and `MyTeamView` and `SquadPlanner` each load it on the same screen.

---

### Task 7: Snapshot context

**Files:**
- Create: `src/contexts/SnapshotContext.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: `db.listSnapshots`, `db.getActiveSnapshotId`, `db.setActiveSnapshotId`, `db.getAllPlayers`, `db.deleteSnapshot`, `db.updateSnapshot`, `newestSnapshot`.
- Produces:
  - `useSnapshots(): { snapshots, activeId, active, isNewest, isLoaded, setActive, refresh, removeSnapshot, editSnapshot }`
  - `useRoster(): { players: Player[] | null; isLoading: boolean }`

- [ ] **Step 1: Write the context**

Create `src/contexts/SnapshotContext.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { db } from "../services/db";
import { newestSnapshot } from "../utils/snapshot-order";
import type { Snapshot } from "../types/snapshot";
import type { Player } from "../types/types";

interface SnapshotContextValue {
  snapshots: Snapshot[];
  activeId: string | null;
  active: Snapshot | null;
  isNewest: boolean;
  isLoaded: boolean;
  setActive: (id: string) => void;
  refresh: () => Promise<void>;
  removeSnapshot: (id: string) => Promise<void>;
  editSnapshot: (id: string, patch: Partial<Pick<Snapshot, "date" | "label">>) => Promise<void>;
  roster: Player[] | null;
  rosterLoading: boolean;
  requestRoster: () => void;
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [roster, setRoster] = useState<Player[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterWanted, setRosterWanted] = useState(false);

  const refresh = useCallback(async () => {
    const [list, id] = await Promise.all([db.listSnapshots(), db.getActiveSnapshotId()]);
    setSnapshots(list);
    setActiveId(id);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!rosterWanted || !isLoaded) return;
    if (!activeId) {
      setRoster([]);
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    db.getAllPlayers()
      .then((players) => {
        if (!cancelled) setRoster(players);
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rosterWanted, isLoaded, activeId]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    setRoster(null);
    db.setActiveSnapshotId(id);
  }, []);

  const removeSnapshot = useCallback(
    async (id: string) => {
      await db.deleteSnapshot(id);
      setRoster(null);
      await refresh();
    },
    [refresh]
  );

  const editSnapshot = useCallback(
    async (id: string, patch: Partial<Pick<Snapshot, "date" | "label">>) => {
      await db.updateSnapshot(id, patch);
      await refresh();
    },
    [refresh]
  );

  const requestRoster = useCallback(() => setRosterWanted(true), []);

  const active = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === activeId) ?? null,
    [snapshots, activeId]
  );

  const isNewest = useMemo(
    () => snapshots.length === 0 || newestSnapshot(snapshots)?.id === activeId,
    [snapshots, activeId]
  );

  return (
    <SnapshotContext.Provider
      value={{
        snapshots,
        activeId,
        active,
        isNewest,
        isLoaded,
        setActive,
        refresh,
        removeSnapshot,
        editSnapshot,
        roster,
        rosterLoading,
        requestRoster,
      }}
    >
      {children}
    </SnapshotContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSnapshots() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error("useSnapshots must be used within SnapshotProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRoster() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error("useRoster must be used within SnapshotProvider");
  const { requestRoster, roster, rosterLoading } = ctx;

  useEffect(() => {
    requestRoster();
  }, [requestRoster]);

  return { players: roster, isLoading: rosterLoading };
}
```

`rosterWanted` is the whole reason for the split. The sidebar calls `useSnapshots()` on every page; without this flag that would drag a 50k-row load onto `/import` and `/leagues`, which render no players. Only a component that calls `useRoster()` sets the flag.

- [ ] **Step 2: Mount it in Layout**

In `src/components/Layout.tsx`, add the import and wrap **outside** `CompareProvider` — `CompareContext` reads the roster, so it must be inside:

```tsx
import { SnapshotProvider } from "../contexts/SnapshotContext";

export function Layout() {
  return (
    <SnapshotProvider>
      <CompareProvider>
        <PlayerNotesProvider>
          <MyTeamProvider>
            <SquadPlanProvider>
              {/* ...existing body unchanged... */}
            </SquadPlanProvider>
          </MyTeamProvider>
        </PlayerNotesProvider>
      </CompareProvider>
    </SnapshotProvider>
  );
}
```

- [ ] **Step 3: Verify the build and tests**

Run: `npm run build && npx playwright test`
Expected: clean build, tests pass. Nothing consumes the context yet, so behaviour is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/SnapshotContext.tsx src/components/Layout.tsx
git commit -m "add snapshot context with lazy roster loading"
```

---

### Task 8: Move every roster read onto the context

Eleven call sites, all the same shape: delete the `useEffect` that calls `db.getAllPlayers()`, take `players` from `useRoster()`, gate on `players === null`.

**Files:**
- Modify: `src/contexts/CompareContext.tsx:19-25`
- Modify: `src/components/planner/SquadPlanner.tsx:16-18`
- Modify: `src/views/CompareView.tsx:68`
- Modify: `src/views/LeaguesView.tsx:51`
- Modify: `src/views/ListsView.tsx:50`
- Modify: `src/views/MyTeamView.tsx:24,32`
- Modify: `src/views/PlayerProfileView.tsx:536,674`
- Modify: `src/views/PlayersView.tsx:63`
- Modify: `src/views/ScoutingView.tsx:327`
- Modify: `src/views/TeamProfileView.tsx:41`
- Modify: `src/views/TeamsView.tsx:50`
- Modify: `src/services/db/players.ts`

**Interfaces:**
- Consumes: `useRoster()` from Task 7.
- Produces: `db.getPlayersByClub` and `db.getPlayersByPosition` no longer exist.

- [ ] **Step 1: CompareContext**

It must wait for the roster rather than fetching its own:

```tsx
import { useRoster } from "./SnapshotContext";

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareList, setCompareList] = useState<number[]>([]);
  const loaded = useRef(false);
  const { players } = useRoster();

  useEffect(() => {
    if (players === null) return;
    db.getCompareList().then((uids) => {
      const validUids = new Set(players.map((p) => p.UID));
      setCompareList(uids.filter((uid) => validUids.has(uid)));
      loaded.current = true;
    });
  }, [players]);
```

The rest of the provider is unchanged.

- [ ] **Step 2: SquadPlanner**

```tsx
import { useRoster } from "../../contexts/SnapshotContext";

export function SquadPlanner({ club, players }: { club: string; players: Player[] }) {
  const { lists } = usePlayerNotes();
  const { plan, isLoaded, setFormation, refreshSnapshots } = useSquadPlan();
  const { players: allPlayers } = useRoster();
```

Delete the `useState<Player[] | null>(null)` line and the `useEffect` that called `db.getAllPlayers()`. The existing `if (!isLoaded || allPlayers === null)` guard already covers the null case. Remove the `db` import if nothing else in the file uses it — `noUnusedLocals` will fail the build if you leave it.

- [ ] **Step 3: The list views that load only players**

`TeamsView:50`, `PlayersView:63`, `ListsView:50` and `LeaguesView:51` each load inside an async function in a `useEffect`. `TeamsView` as the worked example:

```tsx
import { useRoster } from "../contexts/SnapshotContext";

export function TeamsView() {
  useDocumentTitle("Teams");
  const navigate = useNavigate();
  const { players } = useRoster();
  // ...existing state unchanged...

  useEffect(() => {
    if (players === null) return;
    try {
      const clubMap = new Map<string, { league: string; wages: number[]; ages: number[] }>();
      // ...body unchanged; delete only the `const players = await db.getAllPlayers();` line...
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    } finally {
      setIsLoading(false);
    }
  }, [players]);
```

Drop the `async` wrapper only where nothing else in the effect awaits. `LeaguesView` also awaits rankings — keep its wrapper.

- [ ] **Step 4: The views that also load rankings**

`CompareView:68`, `PlayerProfileView:536`, `PlayerProfileView:674` and `ScoutingView:327` use `Promise.all([db.getAllPlayers(), db.getLeagueRankings()])`. Keep the rankings call, drop the players half:

```tsx
useEffect(() => {
  if (players === null) return;
  db.getLeagueRankings().then((rankings) => {
    // ...body unchanged, using `players` from the hook...
  });
}, [players]);
```

`PlayerProfileView` has two of these. Call `useRoster()` once at the top of the component and let both effects depend on the same `players`; that is the duplicate load this phase removes.

- [ ] **Step 5: MyTeamView and TeamProfileView**

These call `db.getPlayersByClub`, which is being deleted. Filter the roster instead.

`MyTeamView.tsx:24,32` — both effects collapse into one memo:

```tsx
const { players: allPlayers } = useRoster();

const squad = useMemo(
  () => (allPlayers && myClub ? allPlayers.filter((p) => p.Club === myClub) : null),
  [allPlayers, myClub]
);

const clubs = useMemo(
  () => (allPlayers ? [...new Set(allPlayers.map((p) => p.Club))].sort() : []),
  [allPlayers]
);
```

`TeamProfileView.tsx:41`:

```tsx
const { players: allPlayers } = useRoster();

const teamPlayers = useMemo(
  () => (allPlayers ? allPlayers.filter((p) => p.Club === decodedTeamName) : null),
  [allPlayers, decodedTeamName]
);
```

Keep each view's existing loading and empty states, driven by `=== null` where a removed `isLoading` setter leaves a gap.

- [ ] **Step 6: Delete the dead db functions**

In `src/services/db/players.ts`, delete `getPlayersByClub` and `getPlayersByPosition` entirely.

- [ ] **Step 7: Verify no direct roster reads remain**

```bash
grep -rn "db.getAllPlayers\|db.getPlayersByClub\|db.getPlayersByPosition" src --include=*.tsx --include=*.ts | grep -v "services/db/"
```

Expected: no output. The only remaining `getAllPlayers` caller is `SnapshotContext`.

- [ ] **Step 8: Verify the build, tests and app**

Run: `npm run build && npx playwright test`
Expected: clean build, tests pass.

```bash
npm run dev
```

Visit `/my-team`, `/my-team/planner`, `/leagues`, `/teams`, a team profile, `/players`, a player profile, `/scouting`, `/lists`, `/compare`. Each must render as before, and the planner should appear noticeably faster than it used to.

- [ ] **Step 9: Commit**

```bash
git add src/contexts src/components src/views src/services/db/players.ts
git commit -m "read the roster from context instead of the database"
```

---

# Phase 3 — Import and switching

This phase first produces a second snapshot.

---

### Task 9: Derive the date from the filename

**Files:**
- Create: `src/utils/import-date.ts`
- Modify: `browser-tests/pack.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `deriveDateFromFilename(filename: string): string | null` — ISO `YYYY-MM-DD`, or null.
  - `displayToIso(display: string): string | null` — `DD/MM/YYYY` to ISO, or null.
  - `isoToDisplay(iso: string | null): string` — ISO to `DD/MM/YYYY`, `""` for null.

- [ ] **Step 1: Write the failing test**

Append to `browser-tests/pack.spec.ts`:

```ts
import { deriveDateFromFilename, displayToIso, isoToDisplay } from '../src/utils/import-date';

test('derives the date from a team_date filename', () => {
  expect(deriveDateFromFilename('emmen_24_01_2035.html')).toBe('2035-01-24');
});

test('accepts hyphens and a club name containing digits', () => {
  expect(deriveDateFromFilename('fc-utrecht-2-24-01-2035.htm')).toBe('2035-01-24');
});

test('rejects a filename with no trailing date', () => {
  expect(deriveDateFromFilename('squad-export.html')).toBeNull();
});

test('rejects an impossible date', () => {
  expect(deriveDateFromFilename('emmen_32_01_2035.html')).toBeNull();
  expect(deriveDateFromFilename('emmen_24_13_2035.html')).toBeNull();
});

test('converts between display and iso', () => {
  expect(displayToIso('24/01/2035')).toBe('2035-01-24');
  expect(displayToIso('nonsense')).toBeNull();
  expect(isoToDisplay('2035-01-24')).toBe('24/01/2035');
  expect(isoToDisplay(null)).toBe('');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test browser-tests/pack.spec.ts`
Expected: FAIL — cannot resolve `../src/utils/import-date`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/import-date.ts`:

```ts
const TRAILING_DATE = /(\d{1,2})[_-](\d{1,2})[_-](\d{4})$/;

function toIso(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  const candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function deriveDateFromFilename(filename: string): string | null {
  const stem = filename.replace(/\.[^.]+$/, '');
  const match = stem.match(TRAILING_DATE);
  if (!match) return null;
  return toIso(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function displayToIso(display: string): string | null {
  const parts = display.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  return toIso(day, month, year);
}

export function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
```

`toIso` round-trips through `Date` so 31 February is rejected rather than rolling into March.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test browser-tests/pack.spec.ts && npm run build`
Expected: PASS, 15 tests. Build clean.

- [ ] **Step 5: Commit**

```bash
git add src/utils/import-date.ts browser-tests/pack.spec.ts
git commit -m "derive the import date from the filename"
```

---

### Task 10: Refuse a file with missing columns

`transformPlayerStats` reads `record["Pas %"].replace(...)` at `html-parser.ts:132` and `record["xSv %"].replace(...)` at `:163` with no guard, so a file lacking either throws a bare `TypeError`. Back-filling an older export is what provokes it.

**Files:**
- Modify: `src/parser/html-parser.ts`
- Modify: `browser-tests/pack.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `REQUIRED_COLUMNS: readonly string[]` and `findMissingColumns(headers: string[]): string[]`, exported from `src/parser/html-parser.ts`.

- [ ] **Step 1: Write the failing test**

Append to `browser-tests/pack.spec.ts`:

```ts
import { REQUIRED_COLUMNS, findMissingColumns } from '../src/parser/html-parser';

test('reports the columns an old export is missing', () => {
  const headers = REQUIRED_COLUMNS.filter((c) => c !== 'Pas %' && c !== 'xSv %');
  expect(findMissingColumns([...headers])).toEqual(['Pas %', 'xSv %']);
});

test('a complete header list reports nothing missing', () => {
  expect(findMissingColumns([...REQUIRED_COLUMNS, 'Extra Column'])).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test browser-tests/pack.spec.ts`
Expected: FAIL — `REQUIRED_COLUMNS` is not exported.

- [ ] **Step 3: Write the implementation**

Add to `src/parser/html-parser.ts`, above `transformPlayerStats`:

```ts
export const REQUIRED_COLUMNS: readonly string[] = [
  'UID', 'Name', 'Age', 'Nat', 'Division', 'Club', 'Position', 'Sec. Position',
  'Wage', 'Expires', 'Height', 'Weight', 'Rc Injury', 'Starts', 'Mins',
  'Pas %', 'Asts/90', 'xA/90', 'Pr passes/90', 'OP-KP/90', 'Ch C/90',
  'OP-Cr %', 'OP-Crs C/90', 'Conv %', 'xG-OP', 'ShT/90',
  'Shots Outside Box/90', 'NP-xG/90', 'Gls/90', 'Gl Mst', 'Tck/90', 'Tck R',
  'Int/90', 'Clr/90', 'K Tck/90', 'K Hdrs/90', 'Aer A/90', 'Hdr %',
  'Hdrs W/90', 'Blk/90', 'Poss Won/90', 'Poss Lost/90', 'Sprints/90',
  'Drb/90', 'Dist/90', 'Pres C/90', 'Pres A/90', 'Svt', 'Svp', 'Svh',
  'xSv %', 'Sv %', 'xGP/90', 'Con/90',
];

export function findMissingColumns(headers: string[]): string[] {
  const present = new Set(headers.map((header) => header.trim()));
  return REQUIRED_COLUMNS.filter((column) => !present.has(column));
}
```

- [ ] **Step 4: Verify the list matches what the transform reads**

```bash
node -e "
const fs=require('fs');
const src=fs.readFileSync('src/parser/html-parser.ts','utf8');
const body=src.slice(src.indexOf('export function transformPlayerStats'));
const read=new Set([...body.matchAll(/record\[\"([^\"]+)\"\]/g)].map(m=>m[1]));
for(const m of body.matchAll(/record\.(\w+)/g)) read.add(m[1]);
const listed=new Set([...src.slice(src.indexOf('REQUIRED_COLUMNS'),src.indexOf('findMissingColumns')).matchAll(/'([^']+)'/g)].map(m=>m[1]));
const missing=[...read].filter(c=>!listed.has(c));
if(missing.length) console.log('READ BUT NOT REQUIRED:',missing);
"
```

Expected: no output.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx playwright test browser-tests/pack.spec.ts && npm run build`
Expected: PASS, 17 tests. Build clean.

- [ ] **Step 6: Commit**

```bash
git add src/parser/html-parser.ts browser-tests/pack.spec.ts
git commit -m "report missing columns before importing"
```

---

### Task 11: The import save gate

**Files:**
- Create: `src/components/ui/import-save-dialog.tsx`
- Delete: `src/components/ui/import-preserve-dialog.tsx`
- Modify: `src/views/ImportView.tsx`

**Interfaces:**
- Consumes: `deriveDateFromFilename`, `displayToIso`, `isoToDisplay`, `findMissingColumns`, `db.createSnapshot`, `db.clearAllSnapshots`, `db.deleteSnapshot`, `useSnapshots`.
- Produces: `ImportSaveDialog` with props `{ isOpen, filename, snapshots, onClose, onConfirm }`, where `onConfirm: (choice: { mode: "same" | "new"; date: string; replacesId: string | null }) => void`.

- [ ] **Step 1: Write the dialog**

Create `src/components/ui/import-save-dialog.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Button, Dialog, Input, Portal, RadioGroup, Text, VStack } from "@chakra-ui/react";
import { deriveDateFromFilename, displayToIso, isoToDisplay } from "../../utils/import-date";
import type { Snapshot } from "../../types/snapshot";

export function ImportSaveDialog({
  isOpen,
  filename,
  snapshots,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  filename: string;
  snapshots: Snapshot[];
  onClose: () => void;
  onConfirm: (choice: { mode: "same" | "new"; date: string; replacesId: string | null }) => void;
}) {
  const [mode, setMode] = useState<"same" | "new" | null>(null);
  const [dateText, setDateText] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setMode(null); // eslint-disable-line react-hooks/set-state-in-effect
    setDateText(isoToDisplay(deriveDateFromFilename(filename))); // eslint-disable-line react-hooks/set-state-in-effect
  }, [isOpen, filename]);

  const iso = displayToIso(dateText);
  const clash = iso ? snapshots.find((s) => s.date === iso) : undefined;
  const canImport = mode !== null && iso !== null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Import {filename}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <RadioGroup.Root
                  value={mode ?? ""}
                  onValueChange={(e) => setMode(e.value as "same" | "new")}
                >
                  <VStack align="stretch" gap={2}>
                    <RadioGroup.Item value="same">
                      <RadioGroup.ItemHiddenInput />
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText>
                        Same save — add this as another date point
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                    <RadioGroup.Item value="new">
                      <RadioGroup.ItemHiddenInput />
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText>
                        New save — erase everything first
                      </RadioGroup.ItemText>
                    </RadioGroup.Item>
                  </VStack>
                </RadioGroup.Root>

                {mode === "new" && (
                  <Text fontSize="sm" color="spicyPaprika.500">
                    Every snapshot, custom position, list, price, note, league ranking, your
                    club and your squad plan will be deleted. This cannot be undone.
                  </Text>
                )}

                <VStack align="stretch" gap={1}>
                  <Text fontSize="sm" color="fg.muted">
                    What in-game date is this data?
                  </Text>
                  <Input
                    placeholder="DD/MM/YYYY"
                    value={dateText}
                    onChange={(e) => setDateText(e.target.value)}
                    maxW="160px"
                  />
                  {dateText !== "" && iso === null && (
                    <Text fontSize="sm" color="spicyPaprika.500">
                      Not a date. Use DD/MM/YYYY.
                    </Text>
                  )}
                  {mode === "same" && clash && (
                    <Text fontSize="sm" color="fg.muted">
                      A snapshot already exists for this date. Importing replaces it.
                    </Text>
                  )}
                </VStack>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorPalette={mode === "new" ? "spicyPaprika" : "glaucous"}
                disabled={!canImport}
                onClick={() =>
                  onConfirm({
                    mode: mode!,
                    date: iso!,
                    replacesId: mode === "same" ? (clash?.id ?? null) : null,
                  })
                }
              >
                {mode === "new" ? "Erase and import" : "Import"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Rewire ImportView**

In `src/views/ImportView.tsx`: delete the `ImportPreserveDialog` import and its JSX, delete the `preserveOptions` state and the `available` computation block, and rename the notes refresh so it does not collide — `const { refresh: notesRefresh } = usePlayerNotes();`. Then:

```tsx
import { ImportSaveDialog } from "../components/ui/import-save-dialog";
import { findMissingColumns, parseHtmlTable, transformPlayerStats } from "../parser/html-parser";
import { useSnapshots } from "../contexts/SnapshotContext";

const { snapshots, refresh, setActive } = useSnapshots();
const [pendingName, setPendingName] = useState<string | null>(null);
const [progress, setProgress] = useState<{ written: number; total: number } | null>(null);
const pendingPlayers = useRef<Player[] | null>(null);

const handleFileSelect = async (file: File) => {
  setIsImporting(true);
  setImportStatus(null);
  try {
    const rawRecords = parseHtmlTable(await file.text());
    if (rawRecords.length === 0) {
      throw new Error("Could not extract table data from the HTML file.");
    }

    const missing = findMissingColumns(Object.keys(rawRecords[0]));
    if (missing.length > 0) {
      throw new Error(
        `This export is missing ${missing.length} column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Re-run the search in Football Manager with the full column set.`
      );
    }

    const players = transformPlayerStats(rawRecords);
    if (players.length === 0) throw new Error("No player data found in the file.");

    pendingPlayers.current = players;
    setIsImporting(false);
    setPendingName(file.name);
  } catch (error) {
    handleImportError(error);
  }
};

const performImport = async (choice: {
  mode: "same" | "new";
  date: string;
  replacesId: string | null;
}) => {
  const players = pendingPlayers.current;
  if (!players) return;
  try {
    setIsImporting(true);

    if (choice.mode === "new") {
      await db.clearAllSnapshots();
      await db.clearLeagueRankings();
      await db.clearListsAndAnnotations(true);
      await db.setMyClub(null);
      await db.setSquadPlan(null);
    } else if (choice.replacesId) {
      await db.deleteSnapshot(choice.replacesId);
    }

    const id = await db.createSnapshot(players, { date: choice.date }, (written, total) =>
      setProgress({ written, total })
    );

    await navigator.storage?.persist?.().catch(() => undefined);
    await refresh();
    setActive(id);
    await notesRefresh();

    const successMessage = `Imported ${players.length} player${players.length !== 1 ? "s" : ""}`;
    setImportStatus({ success: true, count: players.length, message: successMessage });
    toaster.create({
      title: "Import Successful",
      description: successMessage,
      type: "success",
      duration: 5000,
    });
  } catch (error) {
    handleImportError(error);
  } finally {
    setIsImporting(false);
    setProgress(null);
    pendingPlayers.current = null;
  }
};
```

Replace the spinner block so it reports progress:

```tsx
{isImporting && (
  <VStack gap={2}>
    <Spinner size="lg" colorPalette="glaucous" />
    <Text color="fg.muted">
      {progress
        ? `Saving ${progress.written.toLocaleString()} of ${progress.total.toLocaleString()} players…`
        : "Processing file…"}
    </Text>
  </VStack>
)}
```

And replace the dialog at the bottom of the JSX:

```tsx
<ImportSaveDialog
  isOpen={pendingName !== null}
  filename={pendingName ?? ""}
  snapshots={snapshots}
  onClose={() => {
    setPendingName(null);
    pendingPlayers.current = null;
    setImportStatus(null);
  }}
  onConfirm={async (choice) => {
    setPendingName(null);
    await performImport(choice);
  }}
/>
```

- [ ] **Step 3: Delete the preserve dialog**

```bash
git rm src/components/ui/import-preserve-dialog.tsx
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: clean. If `PreserveCategory` is referenced anywhere still, remove that reference — the type is gone with the file.

- [ ] **Step 5: Verify by hand**

```bash
npm run dev
```

Import a real export named `<club>_DD_MM_YYYY.html`. The dialog must prefill the date, keep Import disabled until a save mode is chosen, show a rising count while writing, and land on the new snapshot. Import a second file with a different date as *Same save*, then confirm two records in DevTools → IndexedDB → `snapshots`.

- [ ] **Step 6: Commit**

```bash
git add -A src/views/ImportView.tsx src/components/ui
git commit -m "ask which save an import belongs to and when it was taken"
```

---

### Task 12: The sidebar switcher

**Files:**
- Create: `src/components/SnapshotSwitcher.tsx`
- Modify: `src/components/Navigation.tsx`

**Interfaces:**
- Consumes: `useSnapshots`, `isoToDisplay`.
- Produces: `SnapshotSwitcher` — no props.

- [ ] **Step 1: Write the component**

Create `src/components/SnapshotSwitcher.tsx`:

```tsx
import { Badge, NativeSelect, Text, VStack } from "@chakra-ui/react";
import { useSnapshots } from "../contexts/SnapshotContext";
import { isoToDisplay } from "../utils/import-date";
import type { Snapshot } from "../types/snapshot";

function snapshotLabel(snapshot: Snapshot): string {
  const date = snapshot.date ? isoToDisplay(snapshot.date) : "Undated";
  return snapshot.label ? `${date} — ${snapshot.label}` : date;
}

export function SnapshotSwitcher() {
  const { snapshots, activeId, active, isNewest, isLoaded, setActive } = useSnapshots();

  if (!isLoaded || snapshots.length === 0) return null;

  return (
    <VStack align="stretch" gap={1}>
      {snapshots.length === 1 ? (
        <Text fontSize="sm" color="fg.muted">
          {active ? snapshotLabel(active) : ""}
        </Text>
      ) : (
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            value={activeId ?? ""}
            onChange={(e) => setActive(e.currentTarget.value)}
            aria-label="Data date"
          >
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshotLabel(snapshot)}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      )}

      {!isNewest && (
        <Badge colorPalette="spicyPaprika" alignSelf="flex-start">
          Historic
        </Badge>
      )}
    </VStack>
  );
}
```

`snapshots` arrives already sorted newest first from `listSnapshots`, so the select needs no ordering of its own.

- [ ] **Step 2: Mount it in Navigation**

In `src/components/Navigation.tsx`, add the import and place it directly under the heading, above the nav items:

```tsx
import { SnapshotSwitcher } from "./SnapshotSwitcher";

      <Heading size="lg" colorPalette="glaucous" color="fg.emphasized">
        FM Jotter
      </Heading>

      <SnapshotSwitcher />
```

- [ ] **Step 3: Verify by hand**

Run: `npm run build && npm run dev`

With two snapshots: the sidebar shows a select. Choosing the older one shows the Historic badge and changes what `/players` renders; choosing the newest hides it. Navigating to `/import` must not trigger a roster load — the switcher uses `useSnapshots`, not `useRoster`.

- [ ] **Step 4: Commit**

```bash
git add src/components/SnapshotSwitcher.tsx src/components/Navigation.tsx
git commit -m "add the sidebar snapshot switcher"
```

---

### Task 13: Snapshot management on the Import view

**Files:**
- Create: `src/components/SnapshotTable.tsx`
- Modify: `src/views/ImportView.tsx`

**Interfaces:**
- Consumes: `useSnapshots`, `isoToDisplay`, `displayToIso`, `db.purgeOrphanedRows`, `ConfirmDialog`, `toaster`.
- Produces: `SnapshotTable` — no props.

- [ ] **Step 1: Confirm the ConfirmDialog contract**

```bash
sed -n '1,40p' src/components/ui/confirm-dialog.tsx
```

The component below assumes props `{ isOpen, onClose, onConfirm, title, message, options }`, matching `PlannerToolbar`'s usage. If the real signature differs, follow the real one.

- [ ] **Step 2: Write the component**

Create `src/components/SnapshotTable.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Badge, Button, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { useSnapshots } from "../contexts/SnapshotContext";
import { displayToIso, isoToDisplay } from "../utils/import-date";
import { db } from "../services/db";
import { toaster } from "./ui/toaster";
import { ConfirmDialog } from "./ui/confirm-dialog";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function SnapshotTable() {
  const { snapshots, activeId, isLoaded, setActive, removeSnapshot, editSnapshot } = useSnapshots();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [dateText, setDateText] = useState("");
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    navigator.storage?.estimate?.().then((estimate) => {
      if (estimate.usage !== undefined && estimate.quota !== undefined) {
        setUsage({ used: estimate.usage, quota: estimate.quota });
      }
    });
  }, [snapshots]);

  if (!isLoaded || snapshots.length === 0) return null;

  return (
    <VStack align="stretch" gap={2}>
      <Text fontWeight="medium" color="fg.emphasized">
        Imported data
      </Text>

      {snapshots.map((snapshot) => (
        <HStack
          key={snapshot.id}
          justify="space-between"
          borderWidth="1px"
          borderRadius="md"
          p={2}
          gap={3}
        >
          <HStack gap={2} flex={1} minW={0}>
            {editing === snapshot.id ? (
              <>
                <Input
                  size="sm"
                  maxW="130px"
                  placeholder="DD/MM/YYYY"
                  value={dateText}
                  onChange={(e) => setDateText(e.target.value)}
                />
                <Button
                  size="xs"
                  colorPalette="glaucous"
                  disabled={displayToIso(dateText) === null}
                  onClick={async () => {
                    await editSnapshot(snapshot.id, { date: displayToIso(dateText) });
                    setEditing(null);
                  }}
                >
                  Save
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Text>{snapshot.date ? isoToDisplay(snapshot.date) : "Undated"}</Text>
                {snapshot.label && (
                  <Text color="fg.muted" truncate>
                    {snapshot.label}
                  </Text>
                )}
                {snapshot.id === activeId && <Badge colorPalette="glaucous">Showing</Badge>}
              </>
            )}
          </HStack>

          <HStack gap={2}>
            <Text fontSize="sm" color="fg.muted" whiteSpace="nowrap">
              {snapshot.playerCount.toLocaleString()} players
            </Text>
            {snapshot.id !== activeId && (
              <Button size="xs" variant="outline" onClick={() => setActive(snapshot.id)}>
                Show
              </Button>
            )}
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setEditing(snapshot.id);
                setDateText(isoToDisplay(snapshot.date));
              }}
            >
              Set date
            </Button>
            <Button
              size="xs"
              variant="outline"
              colorPalette="spicyPaprika"
              disabled={snapshots.length === 1}
              onClick={() => setPendingDelete(snapshot.id)}
            >
              Delete
            </Button>
          </HStack>
        </HStack>
      ))}

      <HStack gap={3}>
        {usage && (
          <Text fontSize="sm" color="fg.muted">
            Using {formatBytes(usage.used)} of {formatBytes(usage.quota)} available.
          </Text>
        )}
        <Button
          size="xs"
          variant="ghost"
          loading={purging}
          onClick={async () => {
            setPurging(true);
            try {
              const removed = await db.purgeOrphanedRows();
              toaster.create({
                title: removed > 0 ? "Leftover rows removed" : "Nothing to clean up",
                description:
                  removed > 0
                    ? `${removed.toLocaleString()} rows from an interrupted import were deleted.`
                    : "No rows without a snapshot were found.",
                type: "success",
                duration: 5000,
              });
            } finally {
              setPurging(false);
            }
          }}
        >
          Clean up leftover rows
        </Button>
      </HStack>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async (value: string) => {
          await removeSnapshot(value);
          setPendingDelete(null);
        }}
        title="Delete this snapshot?"
        message="Its players are removed permanently. Annotations, lists and your plan are not touched."
        options={pendingDelete ? [{ label: "Delete", value: pendingDelete }] : []}
      />
    </VStack>
  );
}
```

Delete is disabled at one snapshot: clearing everything is what *New save* is for.

- [ ] **Step 3: Mount it in ImportView**

Add the import and place `<SnapshotTable />` in the outer `VStack`, directly above the `FileInput`.

- [ ] **Step 4: Verify by hand**

Run: `npm run build && npm run dev`

On `/import` with two snapshots: both listed newest first, the active one badged *Showing*, *Show* switches, *Set date* accepts `DD/MM/YYYY` and re-sorts the list, *Delete* asks first and removes, and the storage line reports a plausible figure. *Clean up leftover rows* reports nothing to do on a healthy database; to see it work, delete a `snapshots` record by hand in DevTools while leaving its `playerSnapshots` rows, then click it.

- [ ] **Step 5: Commit**

```bash
git add src/components/SnapshotTable.tsx src/views/ImportView.tsx
git commit -m "manage snapshots from the import view"
```

---

# Phase 4 — Consumers

---

### Task 14: Player history on the profile

**Files:**
- Create: `src/components/PlayerHistory.tsx`
- Modify: `src/views/PlayerProfileView.tsx`

**Interfaces:**
- Consumes: `db.getPlayerHistory`, `ROLE_CONFIG`, `STAT_LABELS`, `isoToDisplay`.
- Produces: `PlayerHistory` with props `{ uid: number; roleKey: string | null }`.

- [ ] **Step 1: Write the component**

Create `src/components/PlayerHistory.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Box, Heading, Spinner, Table, Text, VStack } from "@chakra-ui/react";
import { db } from "../services/db";
import { ROLE_CONFIG, STAT_LABELS } from "../roles";
import { isoToDisplay } from "../utils/import-date";
import type { PlayerHistoryEntry } from "../types/snapshot";

function statValue(entry: PlayerHistoryEntry, roleKey: string | null, statKey: string): string {
  const config = ROLE_CONFIG.find((role) => role.key === roleKey);
  if (!config || !config.RoleClass.isRole(entry.player)) return "—";
  const role = new config.RoleClass(entry.player) as unknown as Record<string, unknown>;
  const value = role[statKey];
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function PlayerHistory({ uid, roleKey }: { uid: number; roleKey: string | null }) {
  const [entries, setEntries] = useState<PlayerHistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.getPlayerHistory(uid).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (entries === null) return <Spinner size="sm" colorPalette="glaucous" />;
  if (entries.length <= 1) return null;

  const statKeys = ROLE_CONFIG.find((role) => role.key === roleKey)?.statKeys ?? [];

  return (
    <Box borderWidth="1px" borderRadius="md" p={2}>
      <VStack align="stretch" gap={2}>
        <Heading size="sm" color="fg.emphasized">
          History
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Raw per-90 figures as imported. These are not percentiles — league quality drifts
          between dates.
        </Text>

        <Box overflowX="auto">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Date</Table.ColumnHeader>
                <Table.ColumnHeader>Club</Table.ColumnHeader>
                <Table.ColumnHeader>Age</Table.ColumnHeader>
                <Table.ColumnHeader>Starts</Table.ColumnHeader>
                <Table.ColumnHeader>Mins</Table.ColumnHeader>
                {statKeys.map((key) => (
                  <Table.ColumnHeader key={key}>{STAT_LABELS[key] ?? key}</Table.ColumnHeader>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {entries.map((entry) => (
                <Table.Row key={entry.snapshot.id}>
                  <Table.Cell whiteSpace="nowrap">
                    {entry.snapshot.date ? isoToDisplay(entry.snapshot.date) : "Undated"}
                  </Table.Cell>
                  <Table.Cell>{entry.player.Club}</Table.Cell>
                  <Table.Cell>{entry.player.Age}</Table.Cell>
                  <Table.Cell>{entry.player.Starts}</Table.Cell>
                  <Table.Cell>{entry.player.Mins}</Table.Cell>
                  {statKeys.map((key) => (
                    <Table.Cell key={key}>{statValue(entry, roleKey, key)}</Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      </VStack>
    </Box>
  );
}
```

`entries.length <= 1` hides the section entirely when there is nothing to compare — a single snapshot has no history worth a table.

- [ ] **Step 2: Render it in the profile**

`PlayerHistory` needs the role the profile is currently showing. The role selector lives in the comparison section around `PlayerProfileView.tsx:663` as `selectedRole`. Lift that state to the component that renders both, or pass it down — whichever the existing structure makes cleaner — and render:

```tsx
<PlayerHistory uid={player.UID} roleKey={selectedRole} />
```

directly below the role comparison section.

- [ ] **Step 3: Handle a player absent from the active snapshot**

The spec requires a profile to survive when its player is not in the active snapshot. In `PlayerProfileView`, where `db.getPlayer(uid)` returns undefined, fall back to the annotation instead of erroring:

```tsx
const playerData = await db.getPlayer(uid);
if (!playerData) {
  const annotation = await db.getAnnotation(uid);
  if (!annotation) {
    setError("Player not found");
    return;
  }
  setMissingIdentity({
    name: annotation.lastKnownName ?? "Unknown player",
    club: annotation.lastKnownClub ?? "",
  });
  setPlayer(null);
  return;
}
```

Render the header from `missingIdentity` with a line saying the player is not in the selected date's data, skip the stat sections, and still render `<PlayerHistory uid={uid} roleKey={null} />` — history does not depend on the active snapshot.

- [ ] **Step 4: Verify by hand**

Run: `npm run build && npm run dev`

Open a player present in two snapshots: the History section lists both, newest first. Switch the sidebar to the older snapshot — the history is unchanged, because it spans all dates. Open a player who exists in only one snapshot while the other is active: the profile renders his name from the annotation with the not-in-this-date message rather than an error.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayerHistory.tsx src/views/PlayerProfileView.tsx
git commit -m "show a player's stats across every snapshot"
```

---

### Task 15: Rank a history row on demand

A percentile needs its snapshot's whole cohort. Loading four historic 50k cohorts to open a profile is not viable, so ranking is an explicit per-row action.

**Files:**
- Create: `src/utils/role-percentiles.ts`
- Modify: `src/views/PlayerProfileView.tsx`
- Modify: `src/components/PlayerHistory.tsx`

**Interfaces:**
- Consumes: `db.getSnapshotRoster`, `db.getLeagueRankings`.
- Produces: `getComparisonCohort(RoleClass, allPlayers, leagueRankings, sameLeagueOnly?)` and `calculateRolePercentiles(playerRole, cohort, statKeys)`, moved out of `PlayerProfileView` so both callers rank identically.

- [ ] **Step 1: Move the two helpers into a util**

Create `src/utils/role-percentiles.ts` and move `getComparisonCohort` (`PlayerProfileView.tsx:622-641`) and `calculateRolePercentiles` (`:643` onwards) into it verbatim, plus the `StatPercentile` interface at `:613-617`. Export all three. Add the imports they need:

```ts
import type { Player, LeagueRanking } from "../types/types";
import type { RoleConfig } from "../roles";
import { getPercentile } from "./utils";
```

Then in `PlayerProfileView.tsx`, delete the moved definitions and import them:

```tsx
import {
  getComparisonCohort,
  calculateRolePercentiles,
  type StatPercentile,
} from "../utils/role-percentiles";
```

Both callers must rank the same way, which is the reason for the move: a history row ranked differently from the panel above it would be worse than no ranking at all.

- [ ] **Step 2: Add the action to PlayerHistory**

In `src/components/PlayerHistory.tsx`, add per-row percentile state and a button:

```tsx
import { Button } from "@chakra-ui/react";
import { getComparisonCohort, calculateRolePercentiles } from "../utils/role-percentiles";
import { ROLE_CONFIG } from "../roles";

const [ranked, setRanked] = useState<Record<string, Record<string, number>>>({});
const [ranking, setRanking] = useState<string | null>(null);

const rankRow = async (entry: PlayerHistoryEntry) => {
  const config = ROLE_CONFIG.find((role) => role.key === roleKey);
  if (!config || !config.RoleClass.isRole(entry.player)) return;

  setRanking(entry.snapshot.id);
  try {
    const [roster, rankings] = await Promise.all([
      db.getSnapshotRoster(entry.snapshot.id),
      db.getLeagueRankings(),
    ]);
    const cohort = getComparisonCohort(config.RoleClass, roster, rankings);
    const playerRole = new config.RoleClass(entry.player) as unknown as Record<string, unknown>;
    const percentiles = calculateRolePercentiles(playerRole, cohort, config.statKeys);
    setRanked((prev) => ({
      ...prev,
      [entry.snapshot.id]: Object.fromEntries(percentiles.map((p) => [p.key, p.percentile])),
    }));
  } finally {
    setRanking(null);
  }
};
```

Add a trailing column to the header (`<Table.ColumnHeader />`) and to each row:

```tsx
<Table.Cell>
  {ranked[entry.snapshot.id] ? null : (
    <Button
      size="xs"
      variant="outline"
      loading={ranking === entry.snapshot.id}
      onClick={() => rankRow(entry)}
    >
      Rank this row
    </Button>
  )}
</Table.Cell>
```

And show the percentile in place of the raw value once it exists, by replacing the stat cell body:

```tsx
<Table.Cell key={key}>
  {ranked[entry.snapshot.id]?.[key] !== undefined
    ? `${Math.round(ranked[entry.snapshot.id][key])}%`
    : statValue(entry, roleKey, key)}
</Table.Cell>
```

Confirm the property names on `StatPercentile` (`key`, `value`, `percentile`) against the interface you moved in Step 1 before writing `p.key` / `p.percentile`.

- [ ] **Step 3: Verify by hand**

Run: `npm run build && npm run dev`

On a player with two snapshots, click *Rank this row* on the older one. It should show a loading state for a second or two on a large snapshot, then replace that row's raw figures with percentages. The other row keeps its raw values until ranked separately.

- [ ] **Step 4: Commit**

```bash
git add src/utils/role-percentiles.ts src/views/PlayerProfileView.tsx src/components/PlayerHistory.tsx
git commit -m "rank a history row against its own snapshot on demand"
```

---

### Task 16: Planner horizon from the snapshot date

**Files:**
- Modify: `src/types/planner.ts`
- Modify: `src/utils/planner.ts`
- Modify: `src/services/db/settings.ts`
- Modify: `src/components/planner/PlannerToolbar.tsx`
- Modify: `src/components/planner/PlannerCard.tsx`
- Modify: `browser-tests/pack.spec.ts`

**Interfaces:**
- Consumes: `useSnapshots` for the active snapshot's date.
- Produces:
  - `HorizonPreset = "now" | "season" | "1y" | "2y"` in `src/types/planner.ts`; `SquadPlan.horizon: HorizonPreset | null`.
  - `resolveHorizon(snapshotDate: string | null, preset: HorizonPreset | null): Date | null` in `src/utils/planner.ts`, replacing `parseHorizon`.

- [ ] **Step 1: Write the failing test**

Append to `browser-tests/pack.spec.ts`:

```ts
import { resolveHorizon } from '../src/utils/planner';

test('now resolves to the snapshot date itself', () => {
  const now = resolveHorizon('2035-01-24', 'now');
  expect(now?.getFullYear()).toBe(2035);
  expect(now?.getMonth()).toBe(0);
  expect(now?.getDate()).toBe(24);
});

test('season resolves to the following 30 June', () => {
  expect(resolveHorizon('2035-01-24', 'season')?.getFullYear()).toBe(2035);
  expect(resolveHorizon('2035-01-24', 'season')?.getMonth()).toBe(5);
  expect(resolveHorizon('2035-01-24', 'season')?.getDate()).toBe(30);
  expect(resolveHorizon('2035-08-10', 'season')?.getFullYear()).toBe(2036);
});

test('year offsets add whole years to the snapshot date', () => {
  expect(resolveHorizon('2035-01-24', '1y')?.getFullYear()).toBe(2036);
  expect(resolveHorizon('2035-01-24', '2y')?.getFullYear()).toBe(2037);
});

test('an undated snapshot or no preset gives no horizon', () => {
  expect(resolveHorizon(null, 'season')).toBeNull();
  expect(resolveHorizon('2035-01-24', null)).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test browser-tests/pack.spec.ts`
Expected: FAIL — `resolveHorizon` is not exported from `src/utils/planner`.

- [ ] **Step 3: Change the type**

In `src/types/planner.ts`:

```ts
export type HorizonPreset = "now" | "season" | "1y" | "2y";

export interface SquadPlan {
  formationId: string;
  horizon: HorizonPreset | null;
  slots: PlannedSlot[];
}
```

- [ ] **Step 4: Replace parseHorizon**

In `src/utils/planner.ts`, delete `parseHorizon` and add:

```ts
import type { HorizonPreset, SquadPlan } from '../types/planner';

export function resolveHorizon(
  snapshotDate: string | null,
  preset: HorizonPreset | null
): Date | null {
  if (!snapshotDate || !preset) return null;
  const [year, month, day] = snapshotDate.split('-').map(Number);
  if (preset === 'now') return new Date(year, month - 1, day);
  if (preset === '1y') return new Date(year + 1, month - 1, day);
  if (preset === '2y') return new Date(year + 2, month - 1, day);
  return new Date(month > 6 ? year + 1 : year, 5, 30);
}
```

`parseCustomDate` is no longer needed here; remove it from the import if nothing else in the file uses it.

- [ ] **Step 5: Discard a stored typed horizon**

In `src/services/db/settings.ts`, the stored plan may carry an old `"24/01/2035"` string. Coerce it in `isSquadPlan`'s consumer:

```ts
const HORIZON_PRESETS = new Set(['now', 'season', '1y', '2y']);

export async function getSquadPlan(): Promise<SquadPlan | null> {
  const value = await _get(SQUAD_PLAN);
  if (!isSquadPlan(value)) return null;
  return HORIZON_PRESETS.has(value.horizon as string)
    ? value
    : { ...value, horizon: null };
}
```

- [ ] **Step 6: Swap the toolbar input for a select**

In `src/components/planner/PlannerToolbar.tsx`, replace the `Input` block:

```tsx
const HORIZON_OPTIONS: Array<{ value: HorizonPreset; label: string }> = [
  { value: "now", label: "Now" },
  { value: "season", label: "End of season" },
  { value: "1y", label: "In one year" },
  { value: "2y", label: "In two years" },
];

const { active } = useSnapshots();

<HStack gap={1}>
  <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">
    Contracts as of:
  </Text>
  <NativeSelect.Root size="sm" width="160px">
    <NativeSelect.Field
      value={plan?.horizon ?? ""}
      onChange={(e) => setHorizon((e.currentTarget.value || null) as HorizonPreset | null)}
      disabled={!active?.date}
    >
      <option value="">No tint</option>
      {HORIZON_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect.Field>
    <NativeSelect.Indicator />
  </NativeSelect.Root>
</HStack>
```

Change `setHorizon`'s type in `SquadPlanContext` from `(horizon: string | null) => void` to `(horizon: HorizonPreset | null) => void`. Its body is unchanged.

- [ ] **Step 7: Update the card**

In `src/components/planner/PlannerCard.tsx:39-40`:

```tsx
const { active } = useSnapshots();
const horizon = resolveHorizon(active?.date ?? null, plan?.horizon ?? null);
const expiring = Boolean(horizon && player?.Expires && player.Expires <= horizon);
```

Replace the `parseHorizon` import with `resolveHorizon` and add `useSnapshots`.

- [ ] **Step 8: Run the tests and verify**

Run: `npx playwright test && npm run build`
Expected: PASS, 21 tests. Build clean.

```bash
npm run dev
```

On `/my-team/planner`: the planning-date input is gone, replaced by a select. With a dated snapshot and *End of season* chosen, players whose contracts expire before the following 30 June tint paprika. Switching to an undated snapshot disables the select and removes every tint.

- [ ] **Step 9: Commit**

```bash
git add src/types/planner.ts src/utils/planner.ts src/services/db/settings.ts src/components/planner src/contexts/SquadPlanContext.tsx browser-tests/pack.spec.ts
git commit -m "anchor the planner horizon on the snapshot date"
```

---

### Task 17: Guard Remove missing on historic snapshots

*Remove missing* counts placed players absent from the active snapshot. Viewed on a 2033 snapshot it would offer to delete players who are in the 2035 squad and perfectly present.

**Files:**
- Modify: `src/components/planner/PlannerToolbar.tsx`

**Interfaces:**
- Consumes: `isNewest` from `useSnapshots()`.
- Produces: nothing new.

- [ ] **Step 1: Disable the button off the newest snapshot**

In `src/components/planner/PlannerToolbar.tsx`, `isNewest` is already available from the `useSnapshots()` call added in Task 16. Replace the missing-players block:

```tsx
{missing > 0 && (
  <HStack gap={2}>
    <Text fontSize="sm" color="spicyPaprika.500">
      {missing} not in this date&rsquo;s data
    </Text>
    <Button size="xs" variant="outline" disabled={!isNewest} onClick={() => removeMissing(presentUids)}>
      Remove missing
    </Button>
    {!isNewest && (
      <Text fontSize="sm" color="fg.muted">
        Only available on the newest data.
      </Text>
    )}
  </HStack>
)}
```

Disabled rather than hidden: a button that vanishes reads as a bug, and the note explains itself.

- [ ] **Step 2: Verify by hand**

Run: `npm run build && npm run dev`

Place a player on the board who exists only in the newer snapshot. Switch to the older one: the planner reports him as not in this date's data and *Remove missing* is disabled with the note. Switch back: the button is enabled again.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/PlannerToolbar.tsx
git commit -m "disable remove missing on historic snapshots"
```

---

### Task 18: Behaviour tests and documentation

Five Playwright tests, each mutation-checked. Break the behaviour, watch the test fail, restore it — a test that passes against broken code is worse than no test.

**Files:**
- Create: `browser-tests/snapshots.spec.ts`
- Modify: `browser-tests/helpers/seed.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `seedSnapshots(page, snapshots)` in the seed helper, where `snapshots: Array<{ id: string; date: string | null; players: Array<{ uid: number; name: string; club?: string }> }>`, plus the active id set to the first entry.

- [ ] **Step 1: Extend the seed helper**

Add to `browser-tests/helpers/seed.ts`, keeping `makePlayer` and `seedPlayersAndCompareList` as they are:

```ts
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
```

- [ ] **Step 2: Write the tests**

Create `browser-tests/snapshots.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { seedSnapshots } from './helpers/seed';

const OLD = { id: 'snap-2033', date: '2033-08-10', players: [{ uid: 1, name: 'Early Player' }] };
const MID = { id: 'snap-2035', date: '2035-01-24', players: [{ uid: 1, name: 'Early Player' }, { uid: 2, name: 'Later Player' }] };
const NEW = { id: 'snap-2036', date: '2036-05-01', players: [{ uid: 2, name: 'Later Player' }] };

test('switching the date changes which players the app shows', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [OLD, NEW], NEW.id);
  await page.goto('/players');

  await expect(page.getByText('Later Player')).toBeVisible();
  await expect(page.getByText('Early Player')).toHaveCount(0);

  await page.getByLabel('Data date').selectOption({ label: '10/08/2033' });

  await expect(page.getByText('Early Player')).toBeVisible();
  await expect(page.getByText('Later Player')).toHaveCount(0);
});

test('a historic snapshot is badged and the newest is not', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [OLD, NEW], NEW.id);
  await page.goto('/players');

  await expect(page.getByText('Historic')).toHaveCount(0);
  await page.getByLabel('Data date').selectOption({ label: '10/08/2033' });
  await expect(page.getByText('Historic')).toBeVisible();
});

test('snapshots imported out of order are listed and read by date', async ({ page }) => {
  await page.goto('/import');
  // Seeded in import order 2035, 2036, then a back-filled 2033, with the
  // back-filled one active — as it would be straight after that import.
  await seedSnapshots(page, [MID, NEW, OLD], OLD.id);
  await page.goto('/players');

  const options = await page.getByLabel('Data date').locator('option').allTextContents();
  expect(options).toEqual(['01/05/2036', '24/01/2035', '10/08/2033']);
  await expect(page.getByText('Historic')).toBeVisible();
});

test('a player history lists every snapshot he appears in, newest first', async ({ page }) => {
  await page.goto('/import');
  await seedSnapshots(page, [MID, NEW, OLD], MID.id);
  await page.goto('/players/1');

  const dates = page.getByRole('row').filter({ hasText: /20\d\d/ });
  await expect(dates.first()).toContainText('24/01/2035');
  await expect(dates.last()).toContainText('10/08/2033');
});

test('the import date is derived from the filename', async ({ page }) => {
  await page.goto('/import');
  await page.setInputFiles('input[type="file"]', {
    name: 'emmen_24_01_2035.html',
    mimeType: 'text/html',
    buffer: Buffer.from(await buildExport()),
  });
  await expect(page.getByPlaceholder('DD/MM/YYYY')).toHaveValue('24/01/2035');
});
```

The last test needs a minimal valid export. Add this helper at the top of the file, building a one-row table from `REQUIRED_COLUMNS` so it survives the Task 10 guard:

```ts
import { REQUIRED_COLUMNS } from '../src/parser/html-parser';

async function buildExport(): Promise<string> {
  const values: Record<string, string> = {
    UID: '1', Name: 'Test Player', Age: '25', Nat: 'ENG',
    Division: 'Premier League', Club: 'Test FC', Position: 'ST (C)',
    'Sec. Position': '-', Wage: '10000', Expires: '30/06/2036',
    Height: '180 cm', Weight: '80 kg', 'Rc Injury': '-', Starts: '20',
    Mins: '1800', 'Pas %': '80%', 'xSv %': '0%', 'Sv %': '0%',
  };
  const cells = REQUIRED_COLUMNS.map((c) => `<td>${values[c] ?? '0'}</td>`).join('');
  const headers = REQUIRED_COLUMNS.map((c) => `<th>${c}</th>`).join('');
  return `<html><body><table><tr>${headers}</tr><tr>${cells}</tr></table></body></html>`;
}
```

- [ ] **Step 3: Run the tests**

Run: `npx playwright test`
Expected: all pass, including the pre-existing compare-list test.

- [ ] **Step 4: Mutation-check each test**

For each of the five, make the listed change, confirm the named test fails, then revert:

| Test | Break it by | Must fail |
|---|---|---|
| switching changes players | In `SnapshotContext.setActive`, drop `setRoster(null)` | the switch test |
| historic badge | In `SnapshotSwitcher`, change `!isNewest` to `false` | the badge test |
| out-of-order ordering | In `sortSnapshots`, sort by `importedAt` instead of `date` | the ordering test |
| history newest first | In `getPlayerHistory`, return `entries` unsorted | the history test |
| filename date | In `deriveDateFromFilename`, return `null` always | the filename test |

A test that still passes after its mutation is not testing what it claims. Fix the test, not the mutation.

- [ ] **Step 5: Update CLAUDE.md**

Add a section after **Squad Planner**, and amend the stale parts the rest of this plan invalidated:

```markdown
## Historic Snapshots

Every import is a dated snapshot of one save. Route: the switcher in the sidebar; management on `/import`.

- **Storage**: `snapshots` holds one metadata record per import; `playerSnapshots` holds `{ s, u, v }` rows keyed `[snapshotId, uid]` with a `by-uid` index. Values are packed — field names live once per snapshot in `Snapshot.fields`, which is why a stat added later does not corrupt older snapshots. Database version 6.
- **Ordering is always by `date`, never by import time.** `src/utils/snapshot-order.ts` is the only place that rule lives. Undated sorts oldest and is never "newest". Snapshots can be back-filled in any order.
- **State**: `SnapshotProvider` (`src/contexts/SnapshotContext.tsx`), outermost in `Layout` because `CompareContext` reads the roster. `useSnapshots()` is metadata only and costs nothing; `useRoster()` triggers the lazy load. The split keeps `/import` and `/leagues` from paying for a 50k-row read they do not use. One roster is in memory at a time.
- **Import** asks which save the file belongs to and what date it is, prefilled from a trailing `DD_MM_YYYY` in the filename. *New save* erases everything; *Same save* adds a snapshot and touches nothing else. Files missing required columns are refused by name before any write.
- **Percentile cohorts never span snapshots.** Profile history shows raw per-90s; *Rank this row* loads that one snapshot's cohort on demand.
- **The planner horizon** is a preset resolved against the active snapshot's date, never the machine clock. *Remove missing* is disabled off the newest snapshot, where it would offer to delete players who are present in the current squad.
```

Then fix what changed: the **Custom Positions** section's DB-methods list no longer includes `getPlayersByClub`; the **My Team** section says `/my-team`'s picker calls `db.getAllPlayers()`, which is now `useRoster()`; and the **Squad Planner** section's "Planning date" bullet describes the removed typed field — replace it with the preset behaviour.

- [ ] **Step 6: Final verification**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add browser-tests CLAUDE.md
git commit -m "test snapshot switching, ordering and history"
```

---

## Done when

- Two or more dated snapshots coexist and the sidebar switches the whole app between them.
- An older export imported after a newer one sorts, reads and ranks by its date.
- A player's profile shows his stats across every snapshot he appears in.
- The planner tints contracts against the snapshot date with no typed date anywhere.
- `npm run build`, `npm run lint` and `npx playwright test` are clean, and all five behaviour tests have been mutation-checked.
