# Player Annotations & Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give FM Jotter named shortlists, an "unwanted" status, and per-player prices and notes that survive a re-import — fixing the existing defect where re-importing silently destroys every custom position.

**Architecture:** User annotations move out of the `Player` record into two new IndexedDB stores (`playerAnnotations`, `playerLists`) so `clearAllPlayers()` cannot touch them, exactly as `leagueRankings` already works. `src/services/db.ts` splits into focused modules behind an unchanged public API; the database layer alone knows the data is split, merging `customPosition` back onto `Player` objects at the read boundary so every role's `isRole()` keeps working untouched. A React context mirrors the existing `CompareContext` pattern for UI state.

**Tech Stack:** React 19 + TypeScript (strict), Vite, Chakra UI 3, React Router 7, `idb`, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-player-annotations-lists-design.md`

## Global Constraints

- **Testing policy overrides this skill's TDD default.** Behaviour tests only, main behaviours only, **Playwright browser mode only**. No Vitest, no unit tests, no jsdom. Do NOT add a test runner or a test file except where Task 1 explicitly calls for throwaway characterisation tests, which are **deleted before that task's final commit**. Per-task verification is `npm run build` and `npm run lint`.
- **No code comments** unless the logic is genuinely non-obvious. Never restate what the code says. (`CLAUDE.md`)
- **Strict TypeScript**: `noUnusedLocals`, `noUnusedParameters` are on. `npm run build` runs `tsc -b` first and must pass.
- **Commit messages**: one short line. Never mention Claude, AI, or add co-author trailers.
- **Path alias**: `@/*` → `./src/*`. Existing code mostly uses relative imports; match the file you are editing.
- **Type names carry no `I` prefix here** — follow the existing `LeagueRanking` / `PlayerPosition` precedent, not the role-interface convention.
- **Status vocabulary is "unwanted"**, never "no-go" or "rejected", in labels, types, and method names.
- **Currency format** is `formatWage()` (de-DE, EUR, no decimals) for every money value including price and wage demand.
- **Empty note renders as nothing** — no `–` placeholder in its column, and no dangling separator in the tooltip.

---

## File Structure

**Created:**
- `src/types/annotations.ts` — `PlayerAnnotation` and `PlayerList` types
- `src/services/db/connection.ts` — schema, `DB_VERSION`, upgrade + migrations
- `src/services/db/players.ts` — player CRUD + `customPosition` merge/strip
- `src/services/db/annotations.ts` — annotations + lists CRUD
- `src/services/db/rankings.ts` — league rankings
- `src/services/db/compare.ts` — compare list
- `src/services/db/index.ts` — composes and re-exports the `db` singleton
- `src/contexts/PlayerNotesContext.tsx` — annotation + list state
- `src/components/PlayerStatusControl.tsx` — interactive status glyph + menu
- `src/components/PlayerStatusBadge.tsx` — read-only status glyph
- `src/components/PricingFields.tsx` — price / wage demand / note editor
- `src/views/ListsView.tsx` — the `/lists` route
- `src/components/ui/import-preserve-dialog.tsx` — multi-select preserve dialog

**Deleted:**
- `src/services/db.ts` — replaced by `src/services/db/` (must be deleted in the same commit, or the import `../services/db` is ambiguous)

**Modified:**
- `src/components/ui/table.tsx` — add `rowProps`
- `src/components/Layout.tsx` — mount `PlayerNotesProvider`
- `src/components/Navigation.tsx` — add the Lists entry
- `src/App.tsx` — add the `/lists` route
- `src/views/ImportView.tsx:61-125` — preserve categories instead of `clearRankings`
- `src/views/PlayerProfileView.tsx` — status control + pricing fields
- `src/views/ScoutingView.tsx`, `src/views/PlayersView.tsx`, `src/views/TeamProfileView.tsx`, `src/views/CompareView.tsx` — status column, dimming, filter
- `browser-tests/helpers/seed.ts` — `DB_VERSION` 3 → 4

---

### Task 1: Characterisation tests, then split `db.ts`

Refactor only. No behaviour changes. The throwaway tests exist to prove that, and are deleted at the end of this task.

**Files:**
- Create (temporary, deleted in Step 8): `browser-tests/temp-db-characterisation.spec.ts`
- Create: `src/services/db/connection.ts`, `src/services/db/players.ts`, `src/services/db/rankings.ts`, `src/services/db/compare.ts`, `src/services/db/index.ts`
- Delete: `src/services/db.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getDB(): Promise<IDBPDatabase<FmStatsDB>>` from `connection.ts`; the `db` singleton from `src/services/db/index.ts` with the **same public method names as today** — `savePlayer`, `savePlayers`, `getPlayer`, `getAllPlayers`, `getPlayersByClub`, `getPlayersByPosition`, `searchPlayersByName`, `deletePlayer`, `clearAllPlayers`, `getPlayerCount`, `saveLeagueRankings`, `getLeagueRankings`, `clearLeagueRankings`, `getCompareList`, `saveCompareList`, `updatePlayerPosition`, `clearPlayerCustomPosition`, `clearAllCustomPositions`.

- [ ] **Step 1: Write the throwaway characterisation tests**

These pin behaviour as it is **today**, including the custom-position bug. Do not "fix" anything here.

`browser-tests/temp-db-characterisation.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { seedPlayersAndCompareList } from './helpers/seed';

test('custom position persists across a reload', async ({ page }) => {
  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import Player Data' })).toBeVisible();
  await seedPlayersAndCompareList(page, [{ uid: 1, name: 'Alice Striker' }], []);
  await page.reload();

  await page.goto('/players/1');
  await page.getByRole('button', { name: 'Edit position' }).click();
  await page.getByRole('checkbox', { name: 'GK' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Edited')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Edited')).toBeVisible();
});

test('league rankings survive when the import dialog is answered Keep', async ({ page }) => {
  await page.goto('/leagues');
  await expect(page.getByRole('heading', { name: /Leagues/ })).toBeVisible();

  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('fm-stats-db', 3);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('leagueRankings', 'readwrite');
        tx.objectStore('leagueRankings').put({ rank: 1, league: 'Premier League' });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  });

  await page.reload();
  await expect(page.getByText('Premier League')).toBeVisible();
});
```

- [ ] **Step 2: Run them against the current code and confirm they pass**

Run: `npx playwright test browser-tests/temp-db-characterisation.spec.ts`
Expected: 2 passed. If either fails, the test is wrong about current behaviour — fix the test, not `db.ts`. This is the baseline the refactor must preserve.

- [ ] **Step 3: Create `connection.ts`**

Schema and version are unchanged in this task — still version 3, still three stores. Version 4 arrives in Task 2.

`src/services/db/connection.ts`

```typescript
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
```

- [ ] **Step 4: Create `players.ts`, `rankings.ts`, `compare.ts`**

Move the existing method bodies across verbatim, swapping `this.getDB()` for the imported `getDB()` and the repeated try/catch message building for `wrapError`.

`src/services/db/players.ts`

```typescript
import { getDB, wrapError } from './connection';
import type { Player } from '../../types/types';
import type { PlayerPositions } from '../../fields/positions';

export async function savePlayer(player: Player): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('players', 'readwrite');
    await tx.store.put(player);
    await tx.done;
  } catch (error) {
    throw wrapError('save player', error);
  }
}

export async function savePlayers(players: Player[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('players', 'readwrite');
    await Promise.all(players.map((player) => tx.store.put(player)));
    await tx.done;
  } catch (error) {
    throw wrapError('save players', error);
  }
}

export async function getPlayer(uid: number): Promise<Player | undefined> {
  try {
    const db = await getDB();
    return await db.get('players', uid);
  } catch (error) {
    throw wrapError('get player', error);
  }
}

export async function getAllPlayers(): Promise<Player[]> {
  try {
    const db = await getDB();
    return await db.getAll('players');
  } catch (error) {
    throw wrapError('get players', error);
  }
}

export async function getPlayersByClub(club: string): Promise<Player[]> {
  try {
    const db = await getDB();
    return await db.getAllFromIndex('players', 'by-club', club);
  } catch (error) {
    throw wrapError('get players by club', error);
  }
}

export async function getPlayersByPosition(position: string): Promise<Player[]> {
  try {
    const db = await getDB();
    return await db.getAllFromIndex('players', 'by-position', position);
  } catch (error) {
    throw wrapError('get players by position', error);
  }
}

export async function searchPlayersByName(searchTerm: string): Promise<Player[]> {
  try {
    const db = await getDB();
    const allPlayers = await db.getAll('players');
    const lowerSearch = searchTerm.toLowerCase();
    return allPlayers.filter((player) => player.Name.toLowerCase().includes(lowerSearch));
  } catch (error) {
    throw wrapError('search players', error);
  }
}

export async function deletePlayer(uid: number): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('players', uid);
  } catch (error) {
    throw wrapError('delete player', error);
  }
}

export async function clearAllPlayers(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('players', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    throw wrapError('clear players', error);
  }
}

export async function getPlayerCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count('players');
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
    const player = await db.get('players', uid);
    if (!player) throw new Error(`Player ${uid} not found`);
    player.CustomPosition = customPosition;
    await db.put('players', player);
  } catch (error) {
    throw wrapError('update player position', error);
  }
}

export async function clearPlayerCustomPosition(uid: number): Promise<void> {
  try {
    const db = await getDB();
    const player = await db.get('players', uid);
    if (!player) throw new Error(`Player ${uid} not found`);
    delete player.CustomPosition;
    await db.put('players', player);
  } catch (error) {
    throw wrapError('clear player custom position', error);
  }
}

export async function clearAllCustomPositions(): Promise<void> {
  try {
    const db = await getDB();
    const allPlayers = await db.getAll('players');
    const withCustom = allPlayers.filter((p) => p.CustomPosition);
    if (withCustom.length === 0) return;
    const tx = db.transaction('players', 'readwrite');
    await Promise.all(
      withCustom.map((p) => {
        delete p.CustomPosition;
        return tx.store.put(p);
      })
    );
    await tx.done;
  } catch (error) {
    throw wrapError('clear custom positions', error);
  }
}
```

`src/services/db/rankings.ts`

```typescript
import { getDB, wrapError } from './connection';
import type { LeagueRanking } from '../../types/types';

export async function saveLeagueRankings(rankings: LeagueRanking[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('leagueRankings', 'readwrite');
    await tx.store.clear();
    await Promise.all(rankings.map((ranking) => tx.store.put(ranking)));
    await tx.done;
  } catch (error) {
    throw wrapError('save league rankings', error);
  }
}

export async function getLeagueRankings(): Promise<LeagueRanking[]> {
  try {
    const db = await getDB();
    const rankings = await db.getAll('leagueRankings');
    return rankings.sort((a, b) => a.rank - b.rank);
  } catch (error) {
    throw wrapError('get league rankings', error);
  }
}

export async function clearLeagueRankings(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('leagueRankings', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    throw wrapError('clear league rankings', error);
  }
}
```

`src/services/db/compare.ts`

```typescript
import { getDB, wrapError } from './connection';

export async function getCompareList(): Promise<number[]> {
  try {
    const db = await getDB();
    const entry = await db.get('compareList', 'default');
    return entry?.uids ?? [];
  } catch {
    return [];
  }
}

export async function saveCompareList(uids: number[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('compareList', { id: 'default', uids });
  } catch (error) {
    throw wrapError('save compare list', error);
  }
}
```

- [ ] **Step 5: Create `index.ts` with the same public surface**

`src/services/db/index.ts`

```typescript
import * as players from './players';
import * as rankings from './rankings';
import * as compare from './compare';

export const db = {
  ...players,
  ...rankings,
  ...compare,
};

export type { FmStatsDB } from './connection';
```

- [ ] **Step 6: Delete the old file**

```bash
git rm src/services/db.ts
```

Both `src/services/db.ts` and `src/services/db/index.ts` resolving at once makes `../services/db` ambiguous, so this deletion belongs in the same commit as the new directory.

- [ ] **Step 7: Verify the refactor changed nothing**

Run: `npm run build && npm run lint && npx playwright test`
Expected: build clean, lint clean, all tests pass including the two characterisation tests and the pre-existing `compare-list.spec.ts`. No caller was edited, because the public API is identical.

- [ ] **Step 8: Delete the throwaway tests and commit**

```bash
rm browser-tests/temp-db-characterisation.spec.ts
npx playwright test
git add -A src/services browser-tests
git commit -m "split db service into focused modules"
```

Expected: `compare-list.spec.ts` still passes on its own. The characterisation tests have served their purpose and must not be left behind.

---

### Task 2: Version 4 stores, the `customPosition` seam, and the migration

**Files:**
- Create: `src/types/annotations.ts`, `src/services/db/annotations.ts`
- Modify: `src/services/db/connection.ts`, `src/services/db/players.ts`, `src/services/db/index.ts`
- Modify: `browser-tests/helpers/seed.ts:4`

**Interfaces:**
- Consumes: `getDB`, `wrapError` from `connection.ts` (Task 1).
- Produces: types `PlayerAnnotation`, `PlayerList`; and on `db` — `getAnnotations(): Promise<PlayerAnnotation[]>`, `getAnnotation(uid: number): Promise<PlayerAnnotation | undefined>`, `setAnnotation(uid: number, patch: Partial<PlayerAnnotation>, player?: Pick<Player, 'Name' | 'Club'>): Promise<void>`, `clearAllAnnotations(): Promise<void>`, `getLists(): Promise<PlayerList[]>`, `saveList(list: PlayerList): Promise<void>`, `deleteList(id: string): Promise<void>`, `clearAllLists(): Promise<void>`, `setUnwanted(uid: number, unwanted: boolean, player?: Pick<Player, 'Name' | 'Club'>): Promise<void>`.

- [ ] **Step 1: Create the annotation types**

`src/types/annotations.ts`

```typescript
import type { PlayerPositions } from '../fields/positions';

export interface PlayerAnnotation {
  uid: number;
  customPosition?: PlayerPositions;
  unwanted?: boolean;
  price?: number;
  wageDemand?: number;
  note?: string;
  lastKnownName?: string;
  lastKnownClub?: string;
}

export interface PlayerList {
  id: string;
  name: string;
  order: number;
  uids: number[];
  createdAt: Date;
}
```

- [ ] **Step 2: Bump the schema to version 4 and migrate custom positions**

Replace the schema interface, `DB_VERSION`, and `upgrade` in `src/services/db/connection.ts`. Everything else in that file stays.

```typescript
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
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

type UpgradeTx = IDBPTransaction<FmStatsDB, ArrayLike<never>, 'versionchange'>;

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
            migrateCustomPositions(tx as UpgradeTx);
          }
        }
      },
    });
  }
  return dbPromise;
}
```

The `oldVersion > 0` guard skips the migration on a brand-new database, where the players store was just created and is empty.

- [ ] **Step 3: Create the annotations module**

`src/services/db/annotations.ts`

```typescript
import { getDB, wrapError } from './connection';
import type { Player } from '../../types/types';
import type { PlayerAnnotation, PlayerList } from '../../types/annotations';

type PlayerIdentity = Pick<Player, 'Name' | 'Club'>;

export async function getAnnotations(): Promise<PlayerAnnotation[]> {
  try {
    const db = await getDB();
    return await db.getAll('playerAnnotations');
  } catch (error) {
    throw wrapError('get annotations', error);
  }
}

export async function getAnnotation(uid: number): Promise<PlayerAnnotation | undefined> {
  try {
    const db = await getDB();
    return await db.get('playerAnnotations', uid);
  } catch (error) {
    throw wrapError('get annotation', error);
  }
}

export async function setAnnotation(
  uid: number,
  patch: Partial<PlayerAnnotation>,
  player?: PlayerIdentity
): Promise<void> {
  try {
    const db = await getDB();
    const existing = await db.get('playerAnnotations', uid);
    const merged: PlayerAnnotation = {
      ...existing,
      ...patch,
      uid,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    };
    await db.put('playerAnnotations', merged);
  } catch (error) {
    throw wrapError('set annotation', error);
  }
}

export async function clearAllAnnotations(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('playerAnnotations', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    throw wrapError('clear annotations', error);
  }
}

export async function getLists(): Promise<PlayerList[]> {
  try {
    const db = await getDB();
    const lists = await db.getAll('playerLists');
    return lists.sort((a, b) => a.order - b.order);
  } catch (error) {
    throw wrapError('get lists', error);
  }
}

export async function saveList(list: PlayerList): Promise<void> {
  try {
    const db = await getDB();
    await db.put('playerLists', list);
  } catch (error) {
    throw wrapError('save list', error);
  }
}

export async function deleteList(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('playerLists', id);
  } catch (error) {
    throw wrapError('delete list', error);
  }
}

export async function clearAllLists(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('playerLists', 'readwrite');
    await tx.store.clear();
    await tx.done;
  } catch (error) {
    throw wrapError('clear lists', error);
  }
}

export async function setUnwanted(
  uid: number,
  unwanted: boolean,
  player?: PlayerIdentity
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(['playerAnnotations', 'playerLists'], 'readwrite');
    const annotationStore = tx.objectStore('playerAnnotations');
    const listStore = tx.objectStore('playerLists');

    const existing = await annotationStore.get(uid);
    await annotationStore.put({
      ...existing,
      uid,
      unwanted,
      lastKnownName: player?.Name ?? existing?.lastKnownName,
      lastKnownClub: player?.Club ?? existing?.lastKnownClub,
    });

    if (unwanted) {
      const lists = await listStore.getAll();
      await Promise.all(
        lists
          .filter((list) => list.uids.includes(uid))
          .map((list) =>
            listStore.put({ ...list, uids: list.uids.filter((id) => id !== uid) })
          )
      );
    }

    await tx.done;
  } catch (error) {
    throw wrapError('set unwanted', error);
  }
}
```

One transaction spans both stores, so the stored flag and list membership can never disagree.

- [ ] **Step 4: Move the custom-position methods onto the annotations store and add the read seam**

In `src/services/db/players.ts`, add the merge/strip helpers and replace the three custom-position methods. Every read merges; every write strips.

```typescript
import { getDB, wrapError } from './connection';
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

function withoutCustomPosition(player: Player): Player {
  if (player.CustomPosition === undefined) return player;
  const stripped = { ...player };
  delete stripped.CustomPosition;
  return stripped;
}
```

Then rewrite these six methods; leave `deletePlayer`, `clearAllPlayers` and `getPlayerCount` untouched.

```typescript
export async function savePlayer(player: Player): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('players', 'readwrite');
    await tx.store.put(withoutCustomPosition(player));
    await tx.done;
  } catch (error) {
    throw wrapError('save player', error);
  }
}

export async function savePlayers(players: Player[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('players', 'readwrite');
    await Promise.all(players.map((player) => tx.store.put(withoutCustomPosition(player))));
    await tx.done;
  } catch (error) {
    throw wrapError('save players', error);
  }
}

export async function getPlayer(uid: number): Promise<Player | undefined> {
  try {
    const db = await getDB();
    const player = await db.get('players', uid);
    if (!player) return undefined;
    const [merged] = await withCustomPositions([player]);
    return merged;
  } catch (error) {
    throw wrapError('get player', error);
  }
}

export async function getAllPlayers(): Promise<Player[]> {
  try {
    const db = await getDB();
    return await withCustomPositions(await db.getAll('players'));
  } catch (error) {
    throw wrapError('get players', error);
  }
}

export async function getPlayersByClub(club: string): Promise<Player[]> {
  try {
    const db = await getDB();
    return await withCustomPositions(await db.getAllFromIndex('players', 'by-club', club));
  } catch (error) {
    throw wrapError('get players by club', error);
  }
}

export async function getPlayersByPosition(position: string): Promise<Player[]> {
  try {
    const db = await getDB();
    return await withCustomPositions(
      await db.getAllFromIndex('players', 'by-position', position)
    );
  } catch (error) {
    throw wrapError('get players by position', error);
  }
}

export async function searchPlayersByName(searchTerm: string): Promise<Player[]> {
  try {
    const db = await getDB();
    const allPlayers = await db.getAll('players');
    const lowerSearch = searchTerm.toLowerCase();
    return await withCustomPositions(
      allPlayers.filter((player) => player.Name.toLowerCase().includes(lowerSearch))
    );
  } catch (error) {
    throw wrapError('search players', error);
  }
}

export async function updatePlayerPosition(
  uid: number,
  customPosition: PlayerPositions
): Promise<void> {
  try {
    const db = await getDB();
    const player = await db.get('players', uid);
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
      withCustom.map(({ customPosition: _removed, ...rest }) => tx.store.put(rest))
    );
    await tx.done;
  } catch (error) {
    throw wrapError('clear custom positions', error);
  }
}
```

`updatePlayerPosition` and `clearPlayerCustomPosition` no longer throw when the player is missing — an annotation for an absent uid is now a legitimate state.

- [ ] **Step 5: Export the annotations module from the singleton**

`src/services/db/index.ts`

```typescript
import * as players from './players';
import * as rankings from './rankings';
import * as compare from './compare';
import * as annotations from './annotations';

export const db = {
  ...players,
  ...rankings,
  ...compare,
  ...annotations,
};

export type { FmStatsDB } from './connection';
```

- [ ] **Step 6: Bump the test seed helper to version 4**

In `browser-tests/helpers/seed.ts`, change line 4:

```typescript
const DB_VERSION = 4;
```

Opening at version 3 when the app has already upgraded to 4 throws `VersionError` and every seeded test fails.

- [ ] **Step 7: Verify**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean. Then manually confirm the migration: open the app, set a custom position on a player, re-import a file choosing to keep everything, and confirm the "Edited" badge survives — the defect this whole sub-project exists to fix.

- [ ] **Step 8: Commit**

```bash
git add -A src browser-tests
git commit -m "move custom positions into annotations store, add lists schema"
```

---

### Task 3: `PlayerNotesContext`

**Files:**
- Create: `src/contexts/PlayerNotesContext.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: `db.getAnnotations`, `db.setAnnotation`, `db.setUnwanted`, `db.getLists`, `db.saveList`, `db.deleteList` (Task 2); `PlayerAnnotation`, `PlayerList` (Task 2).
- Produces: `usePlayerNotes()` returning `{ annotations: Map<number, PlayerAnnotation>; lists: PlayerList[]; isLoaded: boolean; isUnwanted(uid: number): boolean; toggleUnwanted(uid: number, player?: PlayerIdentity): Promise<void>; listsFor(uid: number): PlayerList[]; addToList(listId: string, uid: number, player?: PlayerIdentity): Promise<void>; removeFromList(listId: string, uid: number): Promise<void>; createList(name: string): Promise<PlayerList>; renameList(id: string, name: string): Promise<void>; deleteList(id: string): Promise<void>; setPricing(uid: number, values: { price?: number; wageDemand?: number; note?: string }, player?: PlayerIdentity): Promise<void> }`, plus the exported type `PlayerIdentity = Pick<Player, 'Name' | 'Club'>`.

- [ ] **Step 1: Write the provider**

Unlike `CompareContext`, this does **not** prune uids missing from the players store — that is the whole point of the orphan design.

`src/contexts/PlayerNotesContext.tsx`

```tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { db } from "../services/db";
import type { Player } from "../types/types";
import type { PlayerAnnotation, PlayerList } from "../types/annotations";

export type PlayerIdentity = Pick<Player, "Name" | "Club">;

interface PlayerNotesContextValue {
  annotations: Map<number, PlayerAnnotation>;
  lists: PlayerList[];
  isLoaded: boolean;
  isUnwanted: (uid: number) => boolean;
  toggleUnwanted: (uid: number, player?: PlayerIdentity) => Promise<void>;
  listsFor: (uid: number) => PlayerList[];
  addToList: (listId: string, uid: number, player?: PlayerIdentity) => Promise<void>;
  removeFromList: (listId: string, uid: number) => Promise<void>;
  createList: (name: string) => Promise<PlayerList>;
  renameList: (id: string, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  setPricing: (
    uid: number,
    values: { price?: number; wageDemand?: number; note?: string },
    player?: PlayerIdentity
  ) => Promise<void>;
}

const PlayerNotesContext = createContext<PlayerNotesContextValue | null>(null);

export function PlayerNotesProvider({ children }: { children: ReactNode }) {
  const [annotations, setAnnotations] = useState<Map<number, PlayerAnnotation>>(new Map());
  const [lists, setLists] = useState<PlayerList[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([db.getAnnotations(), db.getLists()]).then(([loadedAnnotations, loadedLists]) => {
      setAnnotations(new Map(loadedAnnotations.map((a) => [a.uid, a])));
      setLists(loadedLists);
      setIsLoaded(true);
    });
  }, []);

  const refreshAnnotations = useCallback(async () => {
    const loaded = await db.getAnnotations();
    setAnnotations(new Map(loaded.map((a) => [a.uid, a])));
  }, []);

  const refreshLists = useCallback(async () => {
    setLists(await db.getLists());
  }, []);

  const isUnwanted = useCallback(
    (uid: number) => annotations.get(uid)?.unwanted === true,
    [annotations]
  );

  const toggleUnwanted = useCallback(
    async (uid: number, player?: PlayerIdentity) => {
      await db.setUnwanted(uid, !(annotations.get(uid)?.unwanted === true), player);
      await Promise.all([refreshAnnotations(), refreshLists()]);
    },
    [annotations, refreshAnnotations, refreshLists]
  );

  const listsFor = useCallback(
    (uid: number) => lists.filter((list) => list.uids.includes(uid)),
    [lists]
  );

  const addToList = useCallback(
    async (listId: string, uid: number, player?: PlayerIdentity) => {
      const list = lists.find((l) => l.id === listId);
      if (!list || list.uids.includes(uid)) return;
      await db.saveList({ ...list, uids: [...list.uids, uid] });
      await db.setAnnotation(uid, {}, player);
      await Promise.all([refreshLists(), refreshAnnotations()]);
    },
    [lists, refreshLists, refreshAnnotations]
  );

  const removeFromList = useCallback(
    async (listId: string, uid: number) => {
      const list = lists.find((l) => l.id === listId);
      if (!list) return;
      await db.saveList({ ...list, uids: list.uids.filter((id) => id !== uid) });
      await refreshLists();
    },
    [lists, refreshLists]
  );

  const createList = useCallback(
    async (name: string) => {
      const list: PlayerList = {
        id: crypto.randomUUID(),
        name,
        order: lists.length,
        uids: [],
        createdAt: new Date(),
      };
      await db.saveList(list);
      await refreshLists();
      return list;
    },
    [lists, refreshLists]
  );

  const renameList = useCallback(
    async (id: string, name: string) => {
      const list = lists.find((l) => l.id === id);
      if (!list) return;
      await db.saveList({ ...list, name });
      await refreshLists();
    },
    [lists, refreshLists]
  );

  const removeList = useCallback(
    async (id: string) => {
      await db.deleteList(id);
      await refreshLists();
    },
    [refreshLists]
  );

  const setPricing = useCallback(
    async (
      uid: number,
      values: { price?: number; wageDemand?: number; note?: string },
      player?: PlayerIdentity
    ) => {
      await db.setAnnotation(uid, values, player);
      await refreshAnnotations();
    },
    [refreshAnnotations]
  );

  return (
    <PlayerNotesContext.Provider
      value={{
        annotations,
        lists,
        isLoaded,
        isUnwanted,
        toggleUnwanted,
        listsFor,
        addToList,
        removeFromList,
        createList,
        renameList,
        deleteList: removeList,
        setPricing,
      }}
    >
      {children}
    </PlayerNotesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayerNotes() {
  const ctx = useContext(PlayerNotesContext);
  if (!ctx) throw new Error("usePlayerNotes must be used within PlayerNotesProvider");
  return ctx;
}
```

The `eslint-disable` comment matches the one `CompareContext.tsx` already carries for the same rule.

- [ ] **Step 2: Mount the provider**

In `src/components/Layout.tsx`, wrap inside `CompareProvider`:

```tsx
import { PlayerNotesProvider } from "../contexts/PlayerNotesContext";

export function Layout() {
  return (
    <CompareProvider>
      <PlayerNotesProvider>
        <Box minH="100vh" bg="bg.canvas" color="fg.default">
          {/* unchanged body */}
        </Box>
      </PlayerNotesProvider>
    </CompareProvider>
  );
}
```

- [ ] **Step 3: Verify and commit**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean. The app renders exactly as before — nothing consumes the context yet.

```bash
git add src/contexts/PlayerNotesContext.tsx src/components/Layout.tsx
git commit -m "add player notes context"
```

---

### Task 4: `Table` row styling and the status components

**Files:**
- Modify: `src/components/ui/table.tsx:17-21,160-180`
- Create: `src/components/PlayerStatusBadge.tsx`, `src/components/PlayerStatusControl.tsx`

**Interfaces:**
- Consumes: `usePlayerNotes`, `PlayerIdentity` (Task 3).
- Produces: `Table` prop `rowProps?: (row: T) => React.ComponentProps<typeof ChakraTable.Row>`; `<PlayerStatusBadge uid={number} />`; `<PlayerStatusControl uid={number} player?={PlayerIdentity} />`.

- [ ] **Step 1: Add `rowProps` to the shared table**

In `src/components/ui/table.tsx`, extend the base props and spread on each row. Deriving the type with `React.ComponentProps` avoids depending on Chakra exporting a named `RowProps`.

```tsx
import { Table as ChakraTable, Box } from "@chakra-ui/react";

interface TablePropsBase<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  filterRow?: React.ReactNode;
  rowProps?: (row: T) => React.ComponentProps<typeof ChakraTable.Row>;
}
```

Destructure it alongside the others, then apply it — placed after the existing style props so a caller can override `bg` or set `opacity`:

```tsx
const { data, columns, onRowClick, filterRow, rowProps } = props;
```

```tsx
<ChakraTable.Row
  key={index}
  bg={index % 2 === 0 ? "bg.muted" : "bg"}
  cursor={onRowClick ? "pointer" : "default"}
  _hover={{ bg: "glaucous.900/20" }}
  onClick={() => onRowClick?.(row)}
  {...rowProps?.(row)}
>
```

- [ ] **Step 2: Write the read-only status badge**

Three states, one glyph, detail in the tooltip. An empty note yields the bare word "Unwanted" with no trailing separator.

`src/components/PlayerStatusBadge.tsx`

```tsx
import { HStack, Text, Badge } from "@chakra-ui/react";
import { Tooltip } from "./ui/tooltip";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";

export function PlayerStatusBadge({ uid }: { uid: number }) {
  const { annotations, listsFor } = usePlayerNotes();
  const unwanted = annotations.get(uid)?.unwanted === true;
  const note = annotations.get(uid)?.note;
  const memberships = listsFor(uid);

  if (unwanted) {
    return (
      <Tooltip content={note ? `Unwanted — ${note}` : "Unwanted"}>
        <Text as="span" color="spicyPaprika.500" fontSize="md" lineHeight="1">
          &#8856;
        </Text>
      </Tooltip>
    );
  }

  if (memberships.length > 0) {
    return (
      <Tooltip content={memberships.map((list) => list.name).join(", ")}>
        <HStack gap={1}>
          <Text as="span" color="glaucous.500" fontSize="md" lineHeight="1">
            &#9733;
          </Text>
          <Badge colorPalette="glaucous" variant="subtle" size="sm">
            {memberships.length}
          </Badge>
        </HStack>
      </Tooltip>
    );
  }

  return (
    <Tooltip content="Not on any list">
      <Text as="span" color="fg.muted" fontSize="md" lineHeight="1">
        &#9734;
      </Text>
    </Tooltip>
  );
}
```

- [ ] **Step 3: Write the interactive status control**

Same three glyphs, wrapped in a menu. Reuses the badge for rendering so the vocabulary cannot drift.

`src/components/PlayerStatusControl.tsx`

```tsx
import { useState } from "react";
import { Box, Button, Checkbox, Input, Popover, Portal, VStack, Text } from "@chakra-ui/react";
import { PlayerStatusBadge } from "./PlayerStatusBadge";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";

export function PlayerStatusControl({
  uid,
  player,
}: {
  uid: number;
  player?: PlayerIdentity;
}) {
  const { lists, listsFor, addToList, removeFromList, createList, isUnwanted, toggleUnwanted } =
    usePlayerNotes();
  const [isOpen, setIsOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const unwanted = isUnwanted(uid);
  const memberIds = new Set(listsFor(uid).map((list) => list.id));

  const handleCreate = async () => {
    const name = newListName.trim();
    if (!name) return;
    const list = await createList(name);
    await addToList(list.id, uid, player);
    setNewListName("");
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <Popover.Trigger asChild>
        <Box cursor="pointer" onClick={(e) => e.stopPropagation()}>
          <PlayerStatusBadge uid={uid} />
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="240px">
            <Popover.Body>
              <VStack align="stretch" gap={2}>
                <Text fontSize="xs" fontWeight="bold" color="fg.muted">
                  ADD TO LIST
                </Text>
                {lists.map((list) => (
                  <Checkbox.Root
                    key={list.id}
                    checked={memberIds.has(list.id)}
                    disabled={unwanted}
                    onCheckedChange={(e) =>
                      e.checked ? addToList(list.id, uid, player) : removeFromList(list.id, uid)
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>{list.name}</Checkbox.Label>
                  </Checkbox.Root>
                ))}
                <Input
                  size="sm"
                  placeholder="New list…"
                  value={newListName}
                  disabled={unwanted}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  colorPalette="spicyPaprika"
                  onClick={() => toggleUnwanted(uid, player)}
                >
                  {unwanted ? "Clear unwanted" : "Mark as unwanted"}
                </Button>
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
```

The list checkboxes are disabled while a player is unwanted — the two states are mutually exclusive, so the UI should not offer a path into both.

- [ ] **Step 4: Verify and commit**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean.

```bash
git add src/components/ui/table.tsx src/components/PlayerStatusBadge.tsx src/components/PlayerStatusControl.tsx
git commit -m "add player status control and table row props"
```

---

### Task 5: The `/lists` view

**Files:**
- Create: `src/views/ListsView.tsx`
- Modify: `src/App.tsx:9,23`, `src/components/Navigation.tsx:14`

**Interfaces:**
- Consumes: `usePlayerNotes` (Task 3), `PlayerStatusControl` (Task 4), `Table` + `Column` (existing), `formatWage` / `displayDate` / `formatPositions` (existing, `src/utils/utils.ts`).
- Produces: the `/lists` route.

- [ ] **Step 1: Write the view**

Rows are built uid-first with the player optional, so an annotation whose player left the export still renders from `lastKnownName` / `lastKnownClub`. No code here may assume `playersByUid.get(uid)` returns something.

`src/views/ListsView.tsx`

```tsx
import { useEffect, useMemo, useState } from "react";
import { Box, Button, Container, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { db } from "../services/db";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
import { PlayerStatusControl } from "../components/PlayerStatusControl";
import { Table, type Column } from "../components/ui/table";
import { formatWage, displayDate, formatPositions } from "../utils/utils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Player } from "../types/types";

const UNWANTED_TAB = "__unwanted__";

interface ListRow extends Record<string, unknown> {
  uid: number;
  name: string;
  missing: boolean;
  age: number | null;
  position: string;
  club: string;
  division: string;
  wage: number | null;
  price: number | null;
  wageDemand: number | null;
  expires: Date | null;
  note: string;
}

export function ListsView() {
  useDocumentTitle("Lists");
  const { lists, annotations, createList, renameList, deleteList, removeFromList } =
    usePlayerNotes();
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    db.getAllPlayers().then(setPlayers);
  }, []);

  const playersByUid = useMemo(
    () => new Map(players.map((player) => [player.UID, player])),
    [players]
  );

  const currentTab = activeTab ?? lists[0]?.id ?? UNWANTED_TAB;
  const isUnwantedTab = currentTab === UNWANTED_TAB;
  const activeList = lists.find((list) => list.id === currentTab);

  const uids = useMemo(() => {
    if (isUnwantedTab) {
      return [...annotations.values()].filter((a) => a.unwanted).map((a) => a.uid);
    }
    return activeList?.uids ?? [];
  }, [isUnwantedTab, annotations, activeList]);

  const rows: ListRow[] = useMemo(
    () =>
      uids.map((uid) => {
        const player = playersByUid.get(uid);
        const annotation = annotations.get(uid);
        return {
          uid,
          name: player?.Name ?? annotation?.lastKnownName ?? `UID ${uid}`,
          missing: !player,
          age: player?.Age ?? null,
          position: player ? formatPositions(player.Position) : "",
          club: player?.Club ?? annotation?.lastKnownClub ?? "",
          division: player?.Division ?? "",
          wage: player?.Wage ?? null,
          price: annotation?.price ?? null,
          wageDemand: annotation?.wageDemand ?? null,
          expires: player?.Expires ?? null,
          note: annotation?.note ?? "",
        };
      }),
    [uids, playersByUid, annotations]
  );

  const missingCount = rows.filter((row) => row.missing).length;

  const columns: Column<ListRow>[] = [
    {
      key: "uid",
      header: "",
      sortable: false,
      width: "56px",
      render: (_value, row) => (
        <PlayerStatusControl
          uid={row.uid}
          player={{ Name: row.name, Club: row.club }}
        />
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (value, row) =>
        row.missing ? (
          <HStack gap={2}>
            <Text>{value as string}</Text>
            <Text fontSize="2xs" color="fg.muted" borderWidth="1px" borderStyle="dashed" px={1}>
              NOT IN DATA
            </Text>
          </HStack>
        ) : (
          <Link to={`/players/${row.uid}`}>
            <Text color="glaucous.400" _hover={{ textDecoration: "underline" }}>
              {value as string}
            </Text>
          </Link>
        ),
    },
    { key: "age", header: "Age", render: (v) => (v === null ? "–" : String(v)) },
    { key: "position", header: "Position" },
    { key: "club", header: "Club" },
    { key: "division", header: "Division" },
    { key: "wage", header: "Wage", render: (v) => (v === null ? "–" : formatWage(v as number)) },
    { key: "price", header: "Price", render: (v) => (v === null ? "–" : formatWage(v as number)) },
    {
      key: "wageDemand",
      header: "Wage Demand",
      render: (v) => (v === null ? "–" : formatWage(v as number)),
    },
    { key: "expires", header: "Expires", render: (v) => (v ? displayDate(v as Date) : "–") },
    { key: "note", header: "Note", render: (v) => (v as string) || "" },
  ];

  if (!isUnwantedTab && activeList) {
    columns.push({
      key: "missing",
      header: "",
      sortable: false,
      width: "40px",
      render: (_value, row) => (
        <Text
          cursor="pointer"
          color="fg.muted"
          onClick={() => removeFromList(activeList.id, row.uid)}
        >
          &#215;
        </Text>
      ),
    });
  }

  const handleCreate = async () => {
    const name = window.prompt("List name");
    if (name?.trim()) {
      const list = await createList(name.trim());
      setActiveTab(list.id);
    }
  };

  const handleRename = async () => {
    if (!activeList) return;
    const name = window.prompt("Rename list", activeList.name);
    if (name?.trim()) await renameList(activeList.id, name.trim());
  };

  const handleDelete = async () => {
    if (!activeList) return;
    if (window.confirm(`Delete "${activeList.name}"? Players are not affected.`)) {
      await deleteList(activeList.id);
      setActiveTab(null);
    }
  };

  const handleRemoveMissing = async () => {
    if (!activeList) return;
    for (const row of rows.filter((r) => r.missing)) {
      await removeFromList(activeList.id, row.uid);
    }
  };

  return (
    <Box minH="100vh" p={8}>
      <Container maxW="container.xl">
        <VStack gap={6} align="stretch">
          <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
            Lists
          </Heading>

          <HStack gap={2} flexWrap="wrap">
            {lists.map((list) => (
              <Button
                key={list.id}
                size="sm"
                variant={currentTab === list.id ? "solid" : "outline"}
                colorPalette="glaucous"
                onClick={() => setActiveTab(list.id)}
              >
                {list.name} ({list.uids.length})
              </Button>
            ))}
            <Button
              size="sm"
              variant={isUnwantedTab ? "solid" : "outline"}
              colorPalette="spicyPaprika"
              onClick={() => setActiveTab(UNWANTED_TAB)}
            >
              Unwanted ({[...annotations.values()].filter((a) => a.unwanted).length})
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCreate}>
              + New list
            </Button>
          </HStack>

          {!isUnwantedTab && activeList && (
            <HStack gap={2} flexWrap="wrap">
              <Button size="xs" variant="ghost" onClick={handleRename}>
                Rename
              </Button>
              <Button size="xs" variant="ghost" onClick={handleDelete}>
                Delete list
              </Button>
              {missingCount > 0 && (
                <HStack gap={2}>
                  <Text fontSize="sm" color="spicyPaprika.500">
                    {missingCount} not in current data
                  </Text>
                  <Button size="xs" variant="outline" onClick={handleRemoveMissing}>
                    Remove missing
                  </Button>
                </HStack>
              )}
            </HStack>
          )}

          {isUnwantedTab && (
            <Text fontSize="sm" color="fg.muted">
              Ruled out, or a deal that proved impossible. They still count in every percentile
              cohort — nothing here is removed from the database.
            </Text>
          )}

          {rows.length === 0 ? (
            <Text color="fg.muted" textAlign="center">
              Nothing here yet.
            </Text>
          ) : (
            <Table<ListRow>
              data={rows}
              columns={columns}
              defaultSortKey="name"
              defaultSortDirection="asc"
              rowProps={(row) => (row.missing ? { opacity: 0.5 } : {})}
            />
          )}
        </VStack>
      </Container>
    </Box>
  );
}
```

- [ ] **Step 2: Register the route**

In `src/App.tsx`, add the import beside the other views and the route beside `scouting`:

```tsx
import { ListsView } from "./views/ListsView";
```

```tsx
<Route path="lists" element={<ListsView />} />
```

- [ ] **Step 3: Add the nav entry**

In `src/components/Navigation.tsx`, insert between Scouting and Compare:

```tsx
{ path: "/lists", label: "Lists" },
```

- [ ] **Step 4: Verify and commit**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean. Then open `/lists`, create a list, and confirm the empty state, the tab strip, and the Unwanted tab all render.

```bash
git add src/views/ListsView.tsx src/App.tsx src/components/Navigation.tsx
git commit -m "add lists view with unwanted tab"
```

---

### Task 6: Profile integration

**Files:**
- Create: `src/components/PricingFields.tsx`
- Modify: `src/views/PlayerProfileView.tsx:137,297`

**Interfaces:**
- Consumes: `usePlayerNotes` (Task 3), `PlayerStatusControl` (Task 4).
- Produces: `<PricingFields uid={number} player={PlayerIdentity} />`.

- [ ] **Step 1: Write the pricing fields**

Price and wage demand are stored as numbers; the inputs hold raw digits and commit on blur.

`src/components/PricingFields.tsx`

```tsx
import { useEffect, useState } from "react";
import { HStack, Input, Text, VStack } from "@chakra-ui/react";
import { usePlayerNotes, type PlayerIdentity } from "../contexts/PlayerNotesContext";

function toNumber(value: string): number | undefined {
  const digits = value.replace(/[^\d]/g, "");
  return digits === "" ? undefined : Number(digits);
}

export function PricingFields({ uid, player }: { uid: number; player: PlayerIdentity }) {
  const { annotations, setPricing } = usePlayerNotes();
  const annotation = annotations.get(uid);

  const [price, setPrice] = useState("");
  const [wageDemand, setWageDemand] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setPrice(annotation?.price !== undefined ? String(annotation.price) : "");
    setWageDemand(annotation?.wageDemand !== undefined ? String(annotation.wageDemand) : "");
    setNote(annotation?.note ?? "");
  }, [annotation?.price, annotation?.wageDemand, annotation?.note]);

  const commit = () =>
    setPricing(
      uid,
      { price: toNumber(price), wageDemand: toNumber(wageDemand), note: note.trim() || undefined },
      player
    );

  return (
    <VStack align="stretch" gap={3}>
      <HStack gap={3}>
        <VStack align="stretch" gap={1} flex={1}>
          <Text fontSize="xs" fontWeight="medium" color="fg.muted">
            Price
          </Text>
          <Input
            size="sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commit}
          />
        </VStack>
        <VStack align="stretch" gap={1} flex={1}>
          <Text fontSize="xs" fontWeight="medium" color="fg.muted">
            Wage demand
          </Text>
          <Input
            size="sm"
            value={wageDemand}
            onChange={(e) => setWageDemand(e.target.value)}
            onBlur={commit}
          />
        </VStack>
      </HStack>
      <VStack align="stretch" gap={1}>
        <Text fontSize="xs" fontWeight="medium" color="fg.muted">
          Note
        </Text>
        <Input
          size="sm"
          placeholder="Why he is on the list, or why he is not…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commit}
        />
      </VStack>
    </VStack>
  );
}
```

- [ ] **Step 2: Add both to the profile header**

In `src/views/PlayerProfileView.tsx`, import the two components, then inside `PlayerHeader` place the status control next to the existing "Edited" badge area and the pricing fields below the header block:

```tsx
import { PlayerStatusControl } from "../components/PlayerStatusControl";
import { PricingFields } from "../components/PricingFields";
```

```tsx
<PlayerStatusControl uid={player.UID} player={{ Name: player.Name, Club: player.Club }} />
```

```tsx
<PricingFields uid={player.UID} player={{ Name: player.Name, Club: player.Club }} />
```

- [ ] **Step 3: Verify and commit**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean. Then open a player profile, set a price and note, reload, and confirm both persist.

```bash
git add src/components/PricingFields.tsx src/views/PlayerProfileView.tsx
git commit -m "add pricing fields and status control to player profile"
```

---

### Task 7: Scouting, Players, Team and Compare integrations

**Files:**
- Modify: `src/views/ScoutingView.tsx`, `src/views/PlayersView.tsx`, `src/views/TeamProfileView.tsx:120-146`, `src/views/CompareView.tsx`

**Interfaces:**
- Consumes: `PlayerStatusControl`, `PlayerStatusBadge` (Task 4), `Table` `rowProps` (Task 4), `usePlayerNotes` (Task 3).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Add the status column and dimming to `PlayersView`**

The existing `columns` array is module-level and static; it must move inside the component so it can read context. Add the imports and the hook call first:

```tsx
import { PlayerStatusControl } from "../components/PlayerStatusControl";
import { usePlayerNotes } from "../contexts/PlayerNotesContext";
```

```tsx
const { isUnwanted } = usePlayerNotes();
```

The same two imports and hook call are needed in `ScoutingView` and `TeamProfileView` in Steps 3 and 4. Then add the status column as the first entry:

```tsx
{
  key: "uid",
  header: "",
  sortable: false,
  width: "56px",
  render: (_value, row) => (
    <PlayerStatusControl uid={row.uid} player={{ Name: row.name, Club: row.club }} />
  ),
},
```

and on the `<Table>`:

```tsx
rowProps={(row) => (isUnwanted(row.uid) ? { color: "fg.muted", bg: "bg.subtle" } : {})}
```

Fade the row with an inherited text colour, **not** `opacity`. The spec requires the status glyph to stay legible on a faded row, and CSS opacity applies to the whole subtree so a child cannot opt back out. Muted inherited colour fades every cell, while `PlayerStatusBadge` sets `spicyPaprika.500` explicitly and keeps full strength.

- [ ] **Step 2: Add the “Hide unwanted” filter to `PlayersView`**

The filter must fold into the existing filter memo, **before** pagination. `PlayersView` renders `paginatedData`, sliced from `filteredAndSortedData` at `src/views/PlayersView.tsx:173-177`; filtering the table’s data after that slice would bypass pagination and break the “Showing N of M players” count at line 303.

Add the state beside the existing filters:

```tsx
const [hideUnwanted, setHideUnwanted] = useState(false);
```

Inside the `filteredAndSortedData` memo (`src/views/PlayersView.tsx:119`), after the search, position and club filters and before the sort:

```tsx
if (hideUnwanted) {
  result = result.filter((player) => !isUnwanted(player.uid));
}
```

Add `hideUnwanted` and `isUnwanted` to that memo’s dependency array, and add `hideUnwanted` to the page-reset effect at `src/views/PlayersView.tsx:180` so toggling the filter returns to page 1, exactly as every other filter does:

```tsx
}, [searchQuery, selectedPositions, selectedClub, sortKey, sortDirection, hideUnwanted]);
```

Render the checkbox alongside the existing filter controls. `<Table data={paginatedData}>` stays untouched:

```tsx
<Checkbox.Root
  checked={hideUnwanted}
  onCheckedChange={(e) => setHideUnwanted(e.checked === true)}
>
  <Checkbox.HiddenInput />
  <Checkbox.Control />
  <Checkbox.Label>Hide unwanted</Checkbox.Label>
</Checkbox.Root>
```

- [ ] **Step 3: Apply the same three changes to `ScoutingView`**

`ScoutingRow` already carries `uid`, `name` and `club`. Add the status column as the first entry of the column list:

```tsx
{
  key: "uid",
  header: "",
  sortable: false,
  width: "56px",
  render: (_value, row) => (
    <PlayerStatusControl uid={row.uid} player={{ Name: row.name, Club: row.club }} />
  ),
},
```

Add the filter state beside the existing wage, contract, injury and league filters:

```tsx
const [hideUnwanted, setHideUnwanted] = useState(false);
```

Fold it into the existing `filteredAndSorted` memo (`src/views/ScoutingView.tsx:450` slices `paginatedRows` from it), after every existing filter and before the sort — filtering after the slice would bypass pagination:

```tsx
if (hideUnwanted) {
  result = result.filter((row) => !isUnwanted(row.uid));
}
```

Add `hideUnwanted` and `isUnwanted` to that memo’s dependency array, and add `hideUnwanted` to the page-reset effect at `src/views/ScoutingView.tsx:457`:

```tsx
}, [selectedRoleIndex, side, columnFilters, contractBefore, excludeInjuries, excludedLeagues, sortKey, sortDirection, hideUnwanted]);
```

Render the checkbox in the existing filter bar. The table keeps receiving its paginated rows:

```tsx
<Checkbox.Root
  checked={hideUnwanted}
  onCheckedChange={(e) => setHideUnwanted(e.checked === true)}
>
  <Checkbox.HiddenInput />
  <Checkbox.Control />
  <Checkbox.Label>Hide unwanted</Checkbox.Label>
</Checkbox.Root>
```

```tsx
rowProps={(row) => (isUnwanted(row.uid) ? { color: "fg.muted", bg: "bg.subtle" } : {})}
```

Filtering removes rows only. Percentiles are computed over the full cohort by `computeScoutingData` before any filter runs, so hiding an unwanted player never moves anyone else’s numbers — exactly the guarantee the spec makes about unwanted players still counting.

- [ ] **Step 4: Add the status column to `TeamProfileView`**

`columns` is module-level at `src/views/TeamProfileView.tsx:120` and must move inside `TeamProfileTable` so it can read context. `TeamProfileRow` carries `uid`, `name` and no club field, so pass the team name the view already has:

```tsx
{
  key: "uid",
  header: "",
  sortable: false,
  width: "56px",
  render: (_value, row) => (
    <PlayerStatusControl uid={row.uid} player={{ Name: row.name, Club: teamName }} />
  ),
},
```

`TeamProfileTable` currently takes only `players`; give it the club name too:

```tsx
function TeamProfileTable({ players, teamName }: { players: Player[]; teamName: string }) {
```

and pass `teamName={decodedTeamName}` at the call site. Then add the dimming:

```tsx
rowProps={(row) => (isUnwanted(row.uid) ? { color: "fg.muted", bg: "bg.subtle" } : {})}
```

- [ ] **Step 5: Add the read-only badge to `CompareView`**

Beside each compared player's name:

```tsx
<PlayerStatusBadge uid={player.UID} />
```

- [ ] **Step 6: Verify and commit**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean. Then mark a player unwanted from Scouting and confirm the row dims, the glyph turns, "Hide unwanted" removes him, and he still appears in the percentile cohort — his row is hidden, not his data.

```bash
git add src/views
git commit -m "surface player status across scouting, players, team and compare"
```

---

### Task 8: Import preserve dialog

**Files:**
- Create: `src/components/ui/import-preserve-dialog.tsx`
- Modify: `src/views/ImportView.tsx:19-22,44-58,61-70,117-125,160-180`

**Interfaces:**
- Consumes: `db.clearLeagueRankings`, `db.clearAllCustomPositions`, `db.clearAllAnnotations`, `db.clearAllLists` (Tasks 1–2).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the dialog**

Multi-select, everything kept by default, and only categories that actually hold data are offered.

`src/components/ui/import-preserve-dialog.tsx`

```tsx
import { useState } from "react";
import { Button, Checkbox, Dialog, Portal, Text, VStack } from "@chakra-ui/react";

export type PreserveCategory = "rankings" | "positions" | "lists";

const LABELS: Record<PreserveCategory, string> = {
  rankings: "League rankings",
  positions: "Custom positions",
  lists: "Lists, prices and unwanted flags",
};

export function ImportPreserveDialog({
  isOpen,
  available,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  available: PreserveCategory[];
  onClose: () => void;
  onConfirm: (clear: PreserveCategory[]) => void;
}) {
  const [kept, setKept] = useState<Set<PreserveCategory>>(new Set(available));

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Preserve your data?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={3}>
                <Text>Anything left checked survives this import.</Text>
                {available.map((category) => (
                  <Checkbox.Root
                    key={category}
                    checked={kept.has(category)}
                    onCheckedChange={(e) =>
                      setKept((prev) => {
                        const next = new Set(prev);
                        if (e.checked) next.add(category);
                        else next.delete(category);
                        return next;
                      })
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>{LABELS[category]}</Checkbox.Label>
                  </Checkbox.Root>
                ))}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorPalette="glaucous"
                onClick={() => onConfirm(available.filter((c) => !kept.has(c)))}
              >
                Import
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Replace the rankings dialog in `ImportView`**

Swap the import and the state, decide which categories have data before showing the dialog, and take a clear-set in `performImport`.

```tsx
import { ImportPreserveDialog, type PreserveCategory } from "../components/ui/import-preserve-dialog";
```

```tsx
const [preserveOptions, setPreserveOptions] = useState<PreserveCategory[] | null>(null);
```

Where the old code decided whether to show the rankings dialog, gather every category that holds something:

```tsx
const [rankings, annotations, lists] = await Promise.all([
  db.getLeagueRankings(),
  db.getAnnotations(),
  db.getLists(),
]);

const available: PreserveCategory[] = [];
if (rankings.length > 0) available.push("rankings");
if (annotations.some((a) => a.customPosition)) available.push("positions");
if (lists.length > 0 || annotations.some((a) => a.unwanted || a.price || a.note)) {
  available.push("lists");
}

if (available.length === 0) {
  await performImport(players, []);
} else {
  pendingPlayers.current = players;
  setPreserveOptions(available);
}
```

```tsx
const performImport = async (players: Player[], clear: PreserveCategory[]) => {
  try {
    setIsImporting(true);

    if (clear.includes("rankings")) await db.clearLeagueRankings();
    if (clear.includes("positions")) await db.clearAllCustomPositions();

    if (clear.includes("lists")) {
      const keptPositions = clear.includes("positions")
        ? []
        : (await db.getAnnotations()).filter((a) => a.customPosition);
      await db.clearAllLists();
      await db.clearAllAnnotations();
      for (const annotation of keptPositions) {
        await db.setAnnotation(annotation.uid, { customPosition: annotation.customPosition });
      }
    }

    await db.clearAllPlayers();
    await db.savePlayers(players);

    // success toast and setImportStatus: unchanged from the current implementation
  } catch (error) {
    handleImportError(error);
  } finally {
    setIsImporting(false);
    pendingPlayers.current = null;
  }
};
```

The `lists` branch is subtle and must not be simplified: custom positions and list data now share the `playerAnnotations` store, so `clearAllAnnotations()` would destroy custom positions the user chose to keep. Reading them first and re-saving them after is what keeps the two categories independent, which is the entire point of the dialog.

Keep the existing success-toast and `setImportStatus` block exactly as it is today — only the clearing logic above it changes.

Render the new dialog in place of the old one:

```tsx
<ImportPreserveDialog
  isOpen={preserveOptions !== null}
  available={preserveOptions ?? []}
  onClose={() => {
    setPreserveOptions(null);
    pendingPlayers.current = null;
    setImportStatus(null);
  }}
  onConfirm={async (clear) => {
    setPreserveOptions(null);
    if (pendingPlayers.current) await performImport(pendingPlayers.current, clear);
  }}
/>
```

- [ ] **Step 3: Add the lists clear button**

Beside the existing "Clear All Custom Positions" button:

```tsx
<Button
  variant="outline"
  size="sm"
  colorPalette="red"
  onClick={async () => {
    await db.clearAllLists();
    await db.clearAllAnnotations();
    toaster.create({
      title: "Lists Cleared",
      description: "All lists, prices, notes and unwanted flags have been removed.",
      type: "success",
      duration: 5000,
    });
  }}
>
  Clear All Lists & Notes
</Button>
```

- [ ] **Step 4: Verify the whole feature end to end**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean.

Then walk the main behaviour by hand, because this is the promise the sub-project exists to keep:
1. Add a player to a list, price him, write a note, mark another player unwanted.
2. Re-import the same HTML file, leaving every box checked.
3. Confirm the list, price, note, unwanted flag and any custom position all survived.
4. Re-import again, unchecking "Lists, prices and unwanted flags", and confirm they are gone while league rankings and custom positions remain.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/import-preserve-dialog.tsx src/views/ImportView.tsx
git commit -m "let import preserve rankings, positions and lists independently"
```

---

## After the plan

The one behaviour worth considering as a permanent pinned test is **annotations survive a re-import** — Step 4 of Task 8, done by hand. If it is pinned, it goes in `browser-tests/` as a Playwright spec and must then be validated by mutation testing, per project policy. That decision is deliberately left until the feature works.
