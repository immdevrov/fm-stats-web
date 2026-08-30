# Squad Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Planner tab to `/my-team` that lays the squad and the shortlist onto a chosen formation as one ranked depth stack per slot, so a thin position and the signing that would fill it are visible on the same board.

**Architecture:** The whole feature is one value in the existing `settings` store — no schema change, the database stays at version 5 — reached through a typed pair and held by a `SquadPlanProvider` modelled on `MyTeamContext`. Formations are static data in `src/formations/`, never persisted. Every card state (out of position, unwanted, listed, injury-prone, contract, counted elsewhere) is **derived** on render from the plan, the player record and sub-project A's annotations by pure functions in `src/utils/planner.ts`; nothing about a card is stored. `MyTeamView` becomes a shell that owns the club gate once and renders either the existing `SquadTable` or the new planner.

**Tech Stack:** React 19 + TypeScript (strict), Vite, Chakra UI 3, React Router 7, `idb`, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-30-squad-planner-design.md`

Mockups: `design/planner/Main.dc.html` (the board) and `design/planner/ChipSystem.dc.html` (the card rules). Read both before Task 8. Their colours are theme tokens: `#fef5f2` is `spicyPaprika.50`, `#fbcbba` is `spicyPaprika.200`, `#fde0d6` is `spicyPaprika.100`, `#dc602e` is `spicyPaprika.500`, `#943c1e` is `spicyPaprika.700`, `#6a7fdb` is `glaucous.500`, `#947572` is `softBlush.800`, `#b49794` is `softBlush.700`. Use the tokens, never the hex.

## Global Constraints

- **Testing policy overrides this skill's TDD default.** Behaviour tests only, main behaviours only, **Playwright browser mode only**. No Vitest, no unit tests, no jsdom. Do NOT add a test runner or a new test file — the one candidate is deliberately deferred to "After the plan". Per-task verification is `npm run build`, `npm run lint`, and the named manual browser check.
- **No code comments** unless the logic is genuinely non-obvious. Never restate what the code says. (`CLAUDE.md`)
- **Strict TypeScript**: `noUnusedLocals` and `noUnusedParameters` are on. `npm run build` runs `tsc -b` first and must pass.
- **Commit messages**: one short line. Never mention Claude, AI, or add co-author trailers.
- **No schema change.** `DB_VERSION` stays at 5. If you find yourself editing `src/services/db/connection.ts`, stop and re-read this line.
- **The planner computes no statistics.** No percentiles, no ratings, no averages, no "squad strength". Every value on a card is already on the player record or in an annotation. This is the boundary with the unbuilt team-statistics screen; crossing it builds a rival implementation of it.
- **Nothing about a card's appearance is stored.** Out of position, unwanted, listed, injury-prone, contract and counted-elsewhere are all derived on every render. The only stored fields are the ones in `SquadPlan`.
- **Strict position matching.** No `D`/`WB` equivalence, no `M`/`DM` equivalence, no left/right equivalence. The only allowance is a missing `side` on either side of the comparison.
- **`src/services/db/`, `src/contexts/`, `src/views/` and `src/components/` use relative imports**, not the `@/*` alias. Match the file you are editing.
- **Type names carry no `I` prefix** in this area — follow `PlayerAnnotation` and `LeagueRanking`, not the role-interface convention.
- **Vocabulary**: "Planner" is the tab, "Planning for" is the date field, "first choice" is index 0, "cover" is index 1 and 2. Never "starter", "bench" or "XI" in UI copy.
- **The plan never joins the import "Preserve data" dialog** and the Import view gets no "Clear Squad Plan" button. `src/views/ImportView.tsx` and `src/components/ui/import-preserve-dialog.tsx` must not be touched.
- **Out of scope, deliberately** — do not build any of these even if they look easy: computed statistics, tactical roles and duties, named plans, placeholder players, an "outgoing" flag, auto-seeding a board, drag and drop, the depth-grid view, the alternative card colouring, reading the in-game date from the import filename.

---

## File Structure

**Created:**
- `src/types/planner.ts` — `SquadPlan`, `PlannedSlot`, `PlannedPlayer`, `MAX_DEPTH`
- `src/formations/index.ts` — `Formation`, `FormationSlot`, the eight-formation catalogue, `getFormation()`
- `src/utils/planner.ts` — `matchesSlot`, `describeMismatch`, `buildPlacementIndex`, `slotLabel`, `countSlotsWithoutCover`, `parseHorizon`
- `src/contexts/SquadPlanContext.tsx` — the plan, loaded once and persisted on change
- `src/components/planner/SquadPlanner.tsx` — the formation-picker branch, or toolbar + board + panel
- `src/components/planner/PlannerToolbar.tsx` — formation switch, planning date, cover summary, orphan cleanup
- `src/components/planner/PlannerBoard.tsx` — the formation's rows
- `src/components/planner/PlannerSlot.tsx` — label, stack, empty position
- `src/components/planner/PlannerCard.tsx` — one card and every status channel
- `src/components/planner/CandidatePopover.tsx` — the add-to-this-slot picker
- `src/components/planner/CandidatePanel.tsx` — the Squad and Lists tabs

**Modified:**
- `src/services/db/settings.ts` — a private untyped get/set pair, plus `getSquadPlan`/`setSquadPlan`
- `src/components/Layout.tsx` — mount `SquadPlanProvider`
- `src/components/Navigation.tsx` — active state for nested routes
- `src/App.tsx` — the `/my-team/planner` route
- `src/views/MyTeamView.tsx` — becomes the shell: club gate plus tab bar
- `CLAUDE.md` — the Squad Planner section

**Not touched:** `src/services/db/connection.ts`, `src/views/ImportView.tsx`, `src/components/ui/import-preserve-dialog.tsx`, `src/components/SquadTable.tsx`, `src/roles/`, `src/utils/scouting-engine.ts`.

**One addition to the spec's component table:** the spec lists `SquadPlanner.tsx` as "board plus candidate panel". Two further files are split out of it here — `PlannerToolbar.tsx` and `CandidatePopover.tsx` — because the toolbar carries four unrelated controls and the popover is a self-contained interactive unit used from two places. This is decomposition, not new scope.

---

### Task 1: The plan's types and its typed accessors

Adds the stored shape and the two functions that read and write it, and makes the fix sub-project B's review recorded: `settings.ts` currently inlines its store access, so a second setting would copy two `try`/`catch` blocks rather than compose.

**Files:**
- Create: `src/types/planner.ts`
- Modify: `src/services/db/settings.ts`

**Interfaces:**
- Consumes: `getDB()` and `wrapError()` from `./connection`.
- Produces: the types `SquadPlan`, `PlannedSlot`, `PlannedPlayer` and the constant `MAX_DEPTH = 3` from `../types/planner`; `db.getSquadPlan(): Promise<SquadPlan | null>` and `db.setSquadPlan(plan: SquadPlan | null): Promise<void>`. Task 4 is the only consumer of the accessors; Tasks 3, 4, 6 and 8 use the types.

- [ ] **Step 1: Create the plan types**

Create `src/types/planner.ts`:

```ts
export const MAX_DEPTH = 3;

export interface PlannedPlayer {
  uid: number;
  name: string;
  club: string;
}

export interface PlannedSlot {
  slotId: string;
  players: PlannedPlayer[];
}

export interface SquadPlan {
  formationId: string;
  horizon: string | null;
  slots: PlannedSlot[];
}
```

`name` and `club` are a snapshot refreshed on every write. They exist for one reason: a player missing from a later import must still render as a person rather than a number — the same reason A keeps `lastKnownName`. A's annotations cannot serve here, because a squad player can be placed on the board without ever having been annotated.

Do **not** add this to `src/types/index.ts`. `src/types/annotations.ts` is imported directly and this file follows it.

- [ ] **Step 2: Rewrite the settings module over a private pair**

Replace the whole of `src/services/db/settings.ts`:

```ts
import { getDB, wrapError } from './connection';
import type { SquadPlan } from '../../types/planner';

const MY_CLUB = 'myClub';
const SQUAD_PLAN = 'squadPlan';

async function _get(key: string): Promise<unknown> {
  try {
    const db = await getDB();
    const entry = await db.get('settings', key);
    return entry?.value ?? null;
  } catch {
    return null;
  }
}

async function _set(key: string, value: unknown, action: string): Promise<void> {
  try {
    const db = await getDB();
    if (value === null) {
      await db.delete('settings', key);
      return;
    }
    await db.put('settings', { key, value });
  } catch (error) {
    throw wrapError(action, error);
  }
}

export async function getMyClub(): Promise<string | null> {
  const value = await _get(MY_CLUB);
  return typeof value === 'string' ? value : null;
}

export function setMyClub(club: string | null): Promise<void> {
  return _set(MY_CLUB, club, 'save my team');
}

function isSquadPlan(value: unknown): value is SquadPlan {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Partial<SquadPlan>;
  return typeof plan.formationId === 'string' && Array.isArray(plan.slots);
}

export async function getSquadPlan(): Promise<SquadPlan | null> {
  const value = await _get(SQUAD_PLAN);
  return isSquadPlan(value) ? value : null;
}

export function setSquadPlan(plan: SquadPlan | null): Promise<void> {
  return _set(SQUAD_PLAN, plan, 'save squad plan');
}
```

Both getters swallow their error and return `null`, matching `getCompareList()` in `src/services/db/compare.ts` — a missing preference must not break a page render. Both setters throw, matching every other writer in the layer.

`isSquadPlan` is the object-shaped equivalent of the `typeof value === 'string'` guard the club getter already has. The store's value type is `unknown`, so a blob written by an older build, or a hand-edited one, would otherwise reach the board and crash it on `plan.slots.map`.

`db.getSquadPlan` and `db.setSquadPlan` need no registration: `src/services/db/index.ts` already spreads the whole settings module.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then check nothing regressed in the club setting, which now runs through the new private pair:
1. `npm run dev`, go to `/my-team`. Your club is still set (or the picker still works).
2. Change it, reload, confirm it stuck.
3. Open devtools → Application → IndexedDB → `fm-stats-db` → `settings`.

Expected: one row, `{ key: 'myClub', value: '<your club>' }`. There is no `squadPlan` row yet — nothing writes one until Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/types/planner.ts src/services/db/settings.ts
git commit -m "add squad plan storage behind the settings pair"
```

---

### Task 2: The formation catalogue

Eight formations as static data. Never persisted — the plan stores only `formationId`, so a ninth shape later is a data edit, not a migration.

**Files:**
- Create: `src/formations/index.ts`

**Interfaces:**
- Consumes: `PlayerPosition` from `../fields/positions`.
- Produces: `FormationSlot { id: string; position: PlayerPosition; row: number }`, `Formation { id: string; name: string; slots: FormationSlot[] }`, `FORMATIONS: Formation[]`, `getFormation(id: string): Formation | undefined`. Tasks 3, 6, 7 and 8 consume these.

- [ ] **Step 1: Create the catalogue**

Create `src/formations/index.ts`:

```ts
import type { PlayerPosition } from '../fields/positions';

export interface FormationSlot {
  id: string;
  position: PlayerPosition;
  row: number;
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

const GK: FormationSlot = { id: 'GK', position: { type: 'GK' }, row: 0 };

function back4(row: number): FormationSlot[] {
  return [
    { id: 'D-L', position: { type: 'D', side: ['L'] }, row },
    { id: 'D-C-1', position: { type: 'D', side: ['C'] }, row },
    { id: 'D-C-2', position: { type: 'D', side: ['C'] }, row },
    { id: 'D-R', position: { type: 'D', side: ['R'] }, row },
  ];
}

function back3(row: number): FormationSlot[] {
  return [
    { id: 'D-C-1', position: { type: 'D', side: ['C'] }, row },
    { id: 'D-C-2', position: { type: 'D', side: ['C'] }, row },
    { id: 'D-C-3', position: { type: 'D', side: ['C'] }, row },
  ];
}

export const FORMATIONS: Formation[] = [
  {
    id: '4-4-2',
    name: '4-4-2',
    slots: [
      GK,
      ...back4(1),
      { id: 'M-L', position: { type: 'M', side: ['L'] }, row: 2 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-R', position: { type: 'M', side: ['R'] }, row: 2 },
      { id: 'ST-C-1', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'ST-C-2', position: { type: 'ST', side: ['C'] }, row: 3 },
    ],
  },
  {
    id: '4-4-1-1',
    name: '4-4-1-1',
    slots: [
      GK,
      ...back4(1),
      { id: 'M-L', position: { type: 'M', side: ['L'] }, row: 2 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-R', position: { type: 'M', side: ['R'] }, row: 2 },
      { id: 'AM-C', position: { type: 'AM', side: ['C'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 4 },
    ],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    slots: [
      GK,
      ...back4(1),
      { id: 'DM-C-1', position: { type: 'DM', side: ['C'] }, row: 2 },
      { id: 'DM-C-2', position: { type: 'DM', side: ['C'] }, row: 2 },
      { id: 'AM-L', position: { type: 'AM', side: ['L'] }, row: 3 },
      { id: 'AM-C', position: { type: 'AM', side: ['C'] }, row: 3 },
      { id: 'AM-R', position: { type: 'AM', side: ['R'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 4 },
    ],
  },
  {
    id: '4-1-4-1',
    name: '4-1-4-1',
    slots: [
      GK,
      ...back4(1),
      { id: 'DM-C', position: { type: 'DM', side: ['C'] }, row: 2 },
      { id: 'M-L', position: { type: 'M', side: ['L'] }, row: 3 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 3 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 3 },
      { id: 'M-R', position: { type: 'M', side: ['R'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 4 },
    ],
  },
  {
    id: '4-3-3',
    name: '4-3-3',
    slots: [
      GK,
      ...back4(1),
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-3', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'AM-L', position: { type: 'AM', side: ['L'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'AM-R', position: { type: 'AM', side: ['R'] }, row: 3 },
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    slots: [
      GK,
      ...back3(1),
      { id: 'WB-L', position: { type: 'WB', side: ['L'] }, row: 2 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-3', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'WB-R', position: { type: 'WB', side: ['R'] }, row: 2 },
      { id: 'ST-C-1', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'ST-C-2', position: { type: 'ST', side: ['C'] }, row: 3 },
    ],
  },
  {
    id: '5-3-2',
    name: '5-3-2',
    slots: [
      GK,
      { id: 'WB-L', position: { type: 'WB', side: ['L'] }, row: 1 },
      ...back3(1),
      { id: 'WB-R', position: { type: 'WB', side: ['R'] }, row: 1 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-3', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'ST-C-1', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'ST-C-2', position: { type: 'ST', side: ['C'] }, row: 3 },
    ],
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    slots: [
      GK,
      ...back3(1),
      { id: 'M-L', position: { type: 'M', side: ['L'] }, row: 2 },
      { id: 'M-C-1', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-C-2', position: { type: 'M', side: ['C'] }, row: 2 },
      { id: 'M-R', position: { type: 'M', side: ['R'] }, row: 2 },
      { id: 'AM-L', position: { type: 'AM', side: ['L'] }, row: 3 },
      { id: 'ST-C', position: { type: 'ST', side: ['C'] }, row: 3 },
      { id: 'AM-R', position: { type: 'AM', side: ['R'] }, row: 3 },
    ],
  },
];

export function getFormation(id: string): Formation | undefined {
  return FORMATIONS.find((formation) => formation.id === id);
}
```

Four things about this data are decisions, not accidents:

**Rows, not coordinates.** Row 0 is the goalkeeper and the number increases towards the attack. The board is a stack of centred rows, so `x`/`y` would be forty numbers to keep consistent for no visible gain.

**Slot order within a row is left to right on screen** — `D-L`, `D-C-1`, `D-C-2`, `D-R` — matching `design/planner/Main.dc.html`, whose defence row reads D (L), D (C), D (C), D (R). The board renders each row's array in order.

**`DM` slots carry `side: ['C']`.** The export writes `DM` with no side at all, and the matching rule in Task 3 treats a missing side as a wildcard, so a bare `DM` player still matches. Stating the side on the slot is what makes a `DM (L)` player a mismatch there, which is correct.

**3-5-2 and 5-3-2 use `WB` on the flanks, and the consequence is intended.** Strict matching means a `D (L)` full-back placed in a `WB (L)` slot is out of position and tinted. In the game he is unfamiliar with the wing-back position in the DM strata and plays there with restrictions. It is recorded here so it is not later mistaken for a bug. The two shapes differ in exactly one way in this model: 3-5-2 puts the wing-backs in the midfield row, 5-3-2 puts them in the defensive row.

- [ ] **Step 2: Verify the catalogue is well-formed**

Run: `npm run build && npm run lint`
Expected: both clean.

Then paste this into the devtools console on any page of `npm run dev` — a throwaway check, not a test file:

```js
const { FORMATIONS } = await import('/src/formations/index.ts');
for (const f of FORMATIONS) {
  const ids = f.slots.map((s) => s.id);
  console.log(f.id, ids.length, new Set(ids).size === ids.length ? 'unique' : 'DUPLICATE IDS');
}
```

Expected: eight lines, every count `11`, every id set `unique`.

- [ ] **Step 3: Commit**

```bash
git add src/formations/index.ts
git commit -m "add the formation catalogue"
```

---

### Task 3: The matching rule and the plan's pure functions

Everything the board derives, in one place with no React in it.

**Files:**
- Create: `src/utils/planner.ts`

**Interfaces:**
- Consumes: `FormationSlot` from `../formations`; `SquadPlan` from `../types/planner`; `getEffectivePosition`, `formatPositions`, `parseCustomDate` from `./utils`; `PlayerPosition`, `PlayerPositions` from `../fields/positions`.
- Produces:
  - `matchesSlot(player: PositionedPlayer, slot: FormationSlot): boolean`
  - `describeMismatch(player: PositionedPlayer, slot: FormationSlot): string | null`
  - `slotLabel(slot: FormationSlot): string`
  - `buildPlacementIndex(plan: SquadPlan | null): PlacementIndex`
  - `placementFacts(placements: PlacementIndex, uid: number, slotId: string): { elsewhere: Placement[]; firstChoiceCount: number }`
  - `countSlotsWithoutCover(plan: SquadPlan | null, slotCount: number): number`
  - `parseHorizon(horizon: string | null): Date | null`
  - the types `PositionedPlayer`, `Placement`, `PlacementIndex`
- Tasks 4, 6, 7, 8, 9, 10 and 11 consume these.

- [ ] **Step 1: Write the module**

Create `src/utils/planner.ts`:

```ts
import type { FormationSlot } from '../formations';
import type { PlayerPosition, PlayerPositions } from '../fields/positions';
import type { SquadPlan } from '../types/planner';
import { formatPositions, getEffectivePosition, parseCustomDate } from './utils';

export type PositionedPlayer = { Position: PlayerPositions; CustomPosition?: PlayerPositions };

export interface Placement {
  slotId: string;
  rank: number;
}

export type PlacementIndex = Map<number, Placement[]>;

function sideMatches(slotSide: PlayerPosition['side'], playerSide: PlayerPosition['side']): boolean {
  if (!slotSide?.length || !playerSide?.length) return true;
  return slotSide.every((side) => playerSide.includes(side));
}

export function matchesSlot(player: PositionedPlayer, slot: FormationSlot): boolean {
  return getEffectivePosition(player).some(
    (position) =>
      position.type === slot.position.type && sideMatches(slot.position.side, position.side)
  );
}

export function slotLabel(slot: FormationSlot): string {
  return formatPositions([slot.position]);
}

const AN_BEFORE = /^[AEFHILMNORSX]/;
const SIDE_WORDS: Record<string, string> = { L: 'left', R: 'right', C: 'centre' };

export function describeMismatch(player: PositionedPlayer, slot: FormationSlot): string | null {
  if (matchesSlot(player, slot)) return null;

  const sameType = getEffectivePosition(player).filter(
    (position) => position.type === slot.position.type
  );

  if (sameType.length === 0) {
    const article = AN_BEFORE.test(slot.position.type) ? 'an' : 'a';
    return `not ${article} ${slotLabel(slot)}`;
  }

  const sides = [...new Set(sameType.flatMap((position) => position.side ?? []))];
  const words = sides.map((side) => SIDE_WORDS[side] ?? side);
  return `${words.join(' and ')} ${words.length > 1 ? 'sides' : 'side'} only`;
}

export function buildPlacementIndex(plan: SquadPlan | null): PlacementIndex {
  const index: PlacementIndex = new Map();
  if (!plan) return index;

  for (const slot of plan.slots) {
    slot.players.forEach((player, rank) => {
      const existing = index.get(player.uid);
      if (existing) existing.push({ slotId: slot.slotId, rank });
      else index.set(player.uid, [{ slotId: slot.slotId, rank }]);
    });
  }

  return index;
}

export function placementFacts(
  placements: PlacementIndex,
  uid: number,
  slotId: string
): { elsewhere: Placement[]; firstChoiceCount: number } {
  const all = placements.get(uid) ?? [];
  return {
    elsewhere: all.filter((placement) => placement.slotId !== slotId),
    firstChoiceCount: all.filter((placement) => placement.rank === 0).length,
  };
}

export function countSlotsWithoutCover(plan: SquadPlan | null, slotCount: number): number {
  if (!plan) return slotCount;
  return slotCount - plan.slots.filter((slot) => slot.players.length >= 2).length;
}

export function parseHorizon(horizon: string | null): Date | null {
  if (!horizon || horizon.split('/').length !== 3) return null;
  const date = parseCustomDate(horizon);
  return Number.isNaN(date.getTime()) ? null : date;
}
```

Five notes on the parts that are not obvious from the code:

**`placementFacts` is the "counted elsewhere" derivation** the card reads in Task 9, and it deliberately counts *every* slot the player occupies — including the one asking — when working out `firstChoiceCount`. That is what makes the badge read identically on both of a player's cards: being first choice twice is a fact about him, not about either slot. The remaining card statuses (unwanted, listed, injury-prone) are single-key lookups on A's annotations and stay at the call site; wrapping them here would only mean passing A's whole context into a pure module.

**`sideMatches` is the whole matching rule.** A missing `side` on either the slot or the player is a wildcard for that comparison — the one allowance, and it exists because the export writes `DM` with no side at all. Both sides stated and different is a mismatch, so `WB` never satisfies a `D` slot, `M` never satisfies an `AM` slot, and a left-back never satisfies a right-back slot. There are no other equivalences, and none are to be added.

**`AN_BEFORE` is the article for a letter read aloud**, not for a word: `M` is "em", `AM` is "ay-em", `ST` is "ess-tee", so all three take "an"; `D`, `DM`, `WB` and `GK` take "a". This produces "not an AM(C)" and "not a D(C)", matching `design/planner/ChipSystem.dc.html`.

**`slotLabel` goes through `formatPositions`**, which renders `D(C)` with no space. The mockups draw `D (C)`. Follow the helper: every other screen in the app — `SquadTable`, `ListsView`, `PlayerAutocomplete` — formats positions this way, and one screen spelling them differently is worse than one screen differing from a mockup.

**`parseHorizon` must use `parseCustomDate`, not `new Date()`.** `parseCustomDate` is also what `src/parser/html-parser.ts` uses to build `Player.Expires`, so both sides of the `expires <= horizon` comparison are produced by the same function and the comparison is exact. It has a quirk — it passes a 1-based month into `new Date(year, month, day)`, so the `Date` it returns is a month later than the string reads — but applied consistently to both sides the comparison is unaffected. Do not "fix" it here: `Player.Expires` is built with it at import time, so changing one side alone would silently break the tint, and changing both also moves Scouting's contract filter. It is out of this sub-project's scope.

- [ ] **Step 2: Verify the rule by hand**

Run: `npm run build && npm run lint`
Expected: both clean.

Then in the devtools console on `npm run dev`:

```js
const { matchesSlot, describeMismatch } = await import('/src/utils/planner.ts');
const dR = { id: 'x', row: 1, position: { type: 'D', side: ['R'] } };
const wbL = { id: 'y', row: 1, position: { type: 'WB', side: ['L'] } };
const dmC = { id: 'z', row: 2, position: { type: 'DM', side: ['C'] } };
const p = (s) => ({ Position: s });

console.log(matchesSlot(p([{ type: 'D', side: ['R', 'C'] }]), dR));  // true
console.log(matchesSlot(p([{ type: 'D', side: ['L'] }]), dR));       // false
console.log(matchesSlot(p([{ type: 'WB', side: ['R'] }]), dR));      // false
console.log(matchesSlot(p([{ type: 'D', side: ['L'] }]), wbL));      // false
console.log(matchesSlot(p([{ type: 'DM' }]), dmC));                  // true
console.log(matchesSlot(p([{ type: 'DM', side: ['L'] }]), dmC));     // false
console.log(describeMismatch(p([{ type: 'D', side: ['L'] }]), dR));  // "left side only"
console.log(describeMismatch(p([{ type: 'M', side: ['C'] }]), dR));  // "not a D(R)"
console.log(describeMismatch(p([{ type: 'D', side: ['R'] }]), dR));  // null
```

Expected: exactly the commented values, in order. If the `WB (L)` case returns `true`, the strictness is broken and everything downstream is wrong.

- [ ] **Step 3: Commit**

```bash
git add src/utils/planner.ts
git commit -m "add the planner matching rule and placement index"
```
---

### Task 4: The plan's state layer

`SquadPlanProvider`, modelled line for line on `MyTeamContext`: load once on mount, persist on change, and never let a late-landing initial read overwrite something the user did while it was in flight.

**Files:**
- Create: `src/contexts/SquadPlanContext.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: `db.getSquadPlan`/`db.setSquadPlan` (Task 1); `SquadPlan`, `PlannedPlayer`, `MAX_DEPTH` (Task 1); `getFormation` (Task 2); `buildPlacementIndex`, `PlacementIndex` (Task 3); `toaster` from `../components/ui/toaster`.
- Produces: `useSquadPlan()` returning
  ```ts
  {
    plan: SquadPlan | null;
    isLoaded: boolean;
    placements: PlacementIndex;
    setFormation: (formationId: string) => void;
    setHorizon: (horizon: string | null) => void;
    place: (slotId: string, player: PlannedPlayer) => void;
    remove: (slotId: string, uid: number) => void;
    makeFirstChoice: (slotId: string, uid: number) => void;
    refreshSnapshots: (byUid: Map<number, { name: string; club: string }>) => void;
    removeMissing: (presentUids: Set<number>) => void;
  }
  ```
  Every later task consumes this hook.

- [ ] **Step 1: Write the provider**

Create `src/contexts/SquadPlanContext.tsx`:

```tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { db } from "../services/db";
import { toaster } from "../components/ui/toaster";
import { getFormation } from "../formations";
import { buildPlacementIndex, type PlacementIndex } from "../utils/planner";
import { MAX_DEPTH, type PlannedPlayer, type SquadPlan } from "../types/planner";

interface SquadPlanContextValue {
  plan: SquadPlan | null;
  isLoaded: boolean;
  placements: PlacementIndex;
  setFormation: (formationId: string) => void;
  setHorizon: (horizon: string | null) => void;
  place: (slotId: string, player: PlannedPlayer) => void;
  remove: (slotId: string, uid: number) => void;
  makeFirstChoice: (slotId: string, uid: number) => void;
  refreshSnapshots: (byUid: Map<number, { name: string; club: string }>) => void;
  removeMissing: (presentUids: Set<number>) => void;
}

const SquadPlanContext = createContext<SquadPlanContextValue | null>(null);

function emptyPlan(formationId: string, horizon: string | null): SquadPlan {
  const formation = getFormation(formationId);
  return {
    formationId,
    horizon,
    slots: (formation?.slots ?? []).map((slot) => ({ slotId: slot.id, players: [] })),
  };
}

export function SquadPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlanState] = useState<SquadPlan | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const userChanged = useRef(false);

  useEffect(() => {
    db.getSquadPlan().then((stored) => {
      setPlanState((current) => (userChanged.current ? current : stored));
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    db.setSquadPlan(plan).catch(() => {
      toaster.create({
        title: "Plan Not Saved",
        description: "Your squad plan could not be saved.",
        type: "error",
        duration: 3000,
      });
    });
  }, [isLoaded, plan]);

  const update = useCallback((fn: (current: SquadPlan) => SquadPlan) => {
    userChanged.current = true;
    setPlanState((current) => (current ? fn(current) : current));
  }, []);

  const mapSlot = useCallback(
    (slotId: string, fn: (players: PlannedPlayer[]) => PlannedPlayer[]) =>
      update((current) => ({
        ...current,
        slots: current.slots.map((slot) =>
          slot.slotId === slotId ? { ...slot, players: fn(slot.players) } : slot
        ),
      })),
    [update]
  );

  const setFormation = useCallback((formationId: string) => {
    userChanged.current = true;
    setPlanState((current) => emptyPlan(formationId, current?.horizon ?? null));
  }, []);

  const setHorizon = useCallback(
    (horizon: string | null) => update((current) => ({ ...current, horizon })),
    [update]
  );

  const place = useCallback(
    (slotId: string, player: PlannedPlayer) =>
      mapSlot(slotId, (players) =>
        players.length >= MAX_DEPTH || players.some((p) => p.uid === player.uid)
          ? players
          : [...players, player]
      ),
    [mapSlot]
  );

  const remove = useCallback(
    (slotId: string, uid: number) =>
      mapSlot(slotId, (players) => players.filter((p) => p.uid !== uid)),
    [mapSlot]
  );

  const makeFirstChoice = useCallback(
    (slotId: string, uid: number) =>
      mapSlot(slotId, (players) => {
        const promoted = players.find((p) => p.uid === uid);
        return promoted ? [promoted, ...players.filter((p) => p.uid !== uid)] : players;
      }),
    [mapSlot]
  );

  const refreshSnapshots = useCallback(
    (byUid: Map<number, { name: string; club: string }>) =>
      update((current) => ({
        ...current,
        slots: current.slots.map((slot) => ({
          ...slot,
          players: slot.players.map((player) => {
            const fresh = byUid.get(player.uid);
            return fresh && (fresh.name !== player.name || fresh.club !== player.club)
              ? { ...player, ...fresh }
              : player;
          }),
        })),
      })),
    [update]
  );

  const removeMissing = useCallback(
    (presentUids: Set<number>) =>
      update((current) => ({
        ...current,
        slots: current.slots.map((slot) => ({
          ...slot,
          players: slot.players.filter((player) => presentUids.has(player.uid)),
        })),
      })),
    [update]
  );

  const placements = useMemo(() => buildPlacementIndex(plan), [plan]);

  return (
    <SquadPlanContext.Provider
      value={{
        plan,
        isLoaded,
        placements,
        setFormation,
        setHorizon,
        place,
        remove,
        makeFirstChoice,
        refreshSnapshots,
        removeMissing,
      }}
    >
      {children}
    </SquadPlanContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSquadPlan() {
  const ctx = useContext(SquadPlanContext);
  if (!ctx) throw new Error("useSquadPlan must be used within SquadPlanProvider");
  return ctx;
}
```

Five things here are load-bearing:

**`userChanged` is not belt-and-braces.** Without it, a plan the user creates while the initial read is still in flight is overwritten when that read lands with `null`. This is the same guard `MyTeamContext` carries, for the same reason.

**`isLoaded` gates the write effect as well as the board.** Without the gate the first render would persist `null` over a stored plan.

**`setFormation` replaces the plan and clears every assignment**, exactly as the spec requires. It does not ask — the confirm belongs to the view, which knows whether the board holds anything worth losing. It carries the horizon across because the planning date is a property of your planning, not of the shape.

**`place` is where the two invariants live**: at most `MAX_DEPTH` in a stack, and no slot holds the same player twice. Both are enforced by returning the array unchanged, so a caller that has not disabled its own control cannot corrupt the plan.

**`refreshSnapshots` is what keeps `name`/`club` a live snapshot** rather than a fossil. Task 6 calls it once per squad load. It rewrites nothing when nothing changed, so it cannot loop.

The exposed surface adds three functions to the seven the spec names — `refreshSnapshots`, `removeMissing` and the `PlacementIndex` type export. `removeMissing` is required by the spec's "Remove missing" action, `refreshSnapshots` by its "refreshed on every write" snapshot policy; the spec's list simply did not restate them.

- [ ] **Step 2: Mount the provider**

In `src/components/Layout.tsx`, add the import:

```tsx
import { SquadPlanProvider } from "../contexts/SquadPlanContext";
```

and wrap it immediately inside `MyTeamProvider`, so the planner's two providers nest in the order they depend on each other:

```tsx
        <MyTeamProvider>
          <SquadPlanProvider>
            <Box minH="100vh" bg="bg.canvas" color="fg.default">
```

and close it after the matching `</Box>`, before `</MyTeamProvider>`:

```tsx
          </SquadPlanProvider>
        </MyTeamProvider>
```

`<Toaster />` stays inside the `Box`, where it already is.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then, with `npm run dev` running, on any page:
1. The app renders exactly as before — nothing consumes the plan yet.
2. In the devtools console:

```js
await (await import('/src/services/db/index.ts')).db.setSquadPlan({ formationId: '4-2-3-1', horizon: null, slots: [] });
```
3. Reload. Application → IndexedDB → `fm-stats-db` → `settings` now has a `squadPlan` row, and it survives the reload — nothing wrote `null` over it.
4. Delete that row before moving on:

```js
await (await import('/src/services/db/index.ts')).db.setSquadPlan(null);
```

- [ ] **Step 4: Commit**

```bash
git add src/contexts/SquadPlanContext.tsx src/components/Layout.tsx
git commit -m "add the squad plan provider"
```

---

### Task 5: The `/my-team` shell and its tab bar

`MyTeamView` becomes the shell. It owns the club gate — loading, no club, club absent from the current data — in exactly one place, so `SquadTable` and `SquadPlanner` are each handed a club that is known to exist.

**Files:**
- Modify: `src/views/MyTeamView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Navigation.tsx`

**Interfaces:**
- Consumes: `useMyTeam()`, `db.getPlayersByClub`.
- Produces: two routes, `/my-team` and `/my-team/planner`, both rendering `MyTeamView`; a `<SquadPlanner club={myClub} players={players} />` call site that Task 6 fills in.

- [ ] **Step 1: Add the route**

In `src/App.tsx`, beneath the existing `my-team` route:

```tsx
        <Route path="my-team" element={<MyTeamView />} />
        <Route path="my-team/planner" element={<MyTeamView />} />
```

Two flat routes rather than a nested pair with an `<Outlet />`: the shell has to hand the loaded squad down to whichever tab is showing, and an outlet would mean threading it through router context for no gain.

- [ ] **Step 2: Fix the navigation's active state**

`src/components/Navigation.tsx` currently computes `const isActive = location.pathname === item.path;`, so `/my-team/planner` would leave the sidebar's My Team entry unlit. Replace that line with:

```tsx
          const isActive =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
```

This also lights up Teams on `/teams/:teamName` and Players on `/players/:playerId`, which were previously unlit. That is a fix, not a regression, and it is the reason to make the change general rather than special-casing `/my-team`.

- [ ] **Step 3: Turn the view into a shell**

Rewrite `src/views/MyTeamView.tsx`. The club gate and the picker branch are unchanged from what is there today; what is new is the tab bar and the branch beneath it:

```tsx
import { Container, Heading, VStack, Box, Text, Spinner, HStack, Button, Tabs } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { db } from "../services/db";
import type { Player } from "../types/types";
import { SearchableSelect } from "../components/SearchableSelect";
import { SquadTable } from "../components/SquadTable";
import { SquadPlanner } from "../components/planner/SquadPlanner";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useMyTeam } from "../contexts/MyTeamContext";

export function MyTeamView() {
  const { myClub, isLoaded, setMyClub, clearMyClub } = useMyTeam();
  const location = useLocation();
  const navigate = useNavigate();
  const isPlanner = location.pathname === "/my-team/planner";
  useDocumentTitle(myClub ? `My Team: ${myClub}` : "My Team");

  const [clubs, setClubs] = useState<string[] | null>(null);
  const [squad, setSquad] = useState<{ club: string; players: Player[] } | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    db.getAllPlayers().then((all) => {
      setClubs([...new Set(all.map((p) => p.Club).filter(Boolean))].sort());
    });
  }, []);

  useEffect(() => {
    if (!myClub) return;
    let cancelled = false;
    db.getPlayersByClub(myClub).then((players) => {
      if (!cancelled) setSquad({ club: myClub, players });
    });
    return () => {
      cancelled = true;
    };
  }, [myClub]);
```

The loading branch, the picker branch and the `players` derivation stay exactly as they are today — copy them across unchanged. Replace only the final `return`:

```tsx
  const players = squad?.club === myClub ? squad.players : null;

  return (
    <Box minH="100vh" p={8}>
      <Container maxW={isPlanner ? "container.2xl" : "container.lg"}>
        <VStack gap={6} align="stretch">
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <HStack gap={3} align="baseline">
              <Heading size="2xl" colorPalette="glaucous" color="fg.emphasized">
                {myClub}
              </Heading>
              {players && (
                <Text fontSize="sm" color="fg.muted">
                  {players.length} players
                </Text>
              )}
            </HStack>
            <Button size="sm" variant="outline" onClick={() => setIsPicking(true)}>
              Change club
            </Button>
          </HStack>

          <Tabs.Root
            value={isPlanner ? "planner" : "squad"}
            onValueChange={(e) =>
              navigate(e.value === "planner" ? "/my-team/planner" : "/my-team")
            }
          >
            <Tabs.List>
              <Tabs.Trigger value="squad">Squad</Tabs.Trigger>
              <Tabs.Trigger value="planner">Planner</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          {players === null ? (
            <Spinner size="lg" colorPalette="glaucous" alignSelf="center" />
          ) : isPlanner ? (
            <SquadPlanner club={myClub} players={players} />
          ) : players.length === 0 ? (
            <Text color="fg.muted">{myClub} is not in the current data.</Text>
          ) : (
            <SquadTable players={players} />
          )}
        </VStack>
      </Container>
    </Box>
  );
}
```

The tab bar is on two real routes rather than a piece of local state, so a reload and a bookmark both land where the user left off. There is no new navigation entry: the planner is a view of your team, not a ninth section of the app.

The "club absent from the current data" message stays on the Squad tab only. The planner is still useful with an empty squad — the shortlist is a candidate source of its own — so it gets the empty array and says its own piece.

- [ ] **Step 4: Add a placeholder planner so the shell compiles**

Create `src/components/planner/SquadPlanner.tsx`:

```tsx
import { Text } from "@chakra-ui/react";
import type { Player } from "../../types/types";

export function SquadPlanner({ club, players }: { club: string; players: Player[] }) {
  return (
    <Text color="fg.muted">
      Planner for {club}: {players.length} squad players.
    </Text>
  );
}
```

Task 6 replaces the body of this file.

- [ ] **Step 5: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then with `npm run dev`:
1. `/my-team` shows the club heading, a player count, a Squad/Planner tab bar, and the squad table under Squad.
2. Click Planner. The URL becomes `/my-team/planner` and the placeholder line appears with the right club and count.
3. Reload on `/my-team/planner`. It comes back on the Planner tab, not the Squad tab.
4. The sidebar's My Team entry is highlighted on both routes.
5. "Change club" still works from both tabs, and the picker still cancels.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Navigation.tsx src/views/MyTeamView.tsx src/components/planner/SquadPlanner.tsx
git commit -m "add the planner tab to my team"
```

---

### Task 6: The formation picker and the empty board

First visit: no plan, no formation, so the board is replaced by a picker. Picking one creates the plan with every slot empty, and the shape appears.

**Files:**
- Modify: `src/components/planner/SquadPlanner.tsx`
- Create: `src/components/planner/PlannerBoard.tsx`
- Create: `src/components/planner/PlannerSlot.tsx`

**Interfaces:**
- Consumes: `useSquadPlan()` (Task 4); `FORMATIONS`, `getFormation`, `type Formation`, `type FormationSlot` (Task 2); `slotLabel` (Task 3).
- Produces:
  - `<PlannerBoard formation={Formation} />`
  - `<PlannerSlot slot={FormationSlot} />`
  - `SquadPlanner` renders the picker when `plan` is `null`, otherwise the board.

Neither the board nor the slot takes players in this task — there is nothing to put in a stack until Task 8, and `noUnusedParameters` rejects a prop that is bound but never read. Task 8 introduces the props it needs at the moment it needs them.

- [ ] **Step 1: The slot**

Create `src/components/planner/PlannerSlot.tsx`:

```tsx
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import { slotLabel } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { MAX_DEPTH } from "../../types/planner";

const EMPTY_LABEL = ["Nobody", "No cover", "Add"];

export function PlannerSlot({ slot }: { slot: FormationSlot }) {
  const { plan } = useSquadPlan();
  const placed = plan?.slots.find((s) => s.slotId === slot.id)?.players ?? [];

  return (
    <VStack flex="1 1 0" maxW="210px" align="stretch" gap="6px">
      <Text
        fontSize="9.5px"
        fontWeight="bold"
        letterSpacing="0.07em"
        color="softBlush.700"
        textTransform="uppercase"
      >
        {slotLabel(slot)}
      </Text>

      {placed.length < MAX_DEPTH && (
        <HStack
          justify="center"
          gap="6px"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border.emphasized"
          borderRadius="md"
          p="10px"
          color="softBlush.700"
          fontSize="xs"
        >
          <Box aria-hidden>&#43;</Box>
          <Text>{EMPTY_LABEL[placed.length]}</Text>
        </HStack>
      )}
    </VStack>
  );
}
```

The empty position is labelled by what it means, which is the whole point of the board: "Nobody" for an empty slot, "No cover" for a slot with only a first choice, "Add" for a slot with two. A full stack shows no empty position at all.

- [ ] **Step 2: The board**

Create `src/components/planner/PlannerBoard.tsx`:

```tsx
import { HStack, VStack } from "@chakra-ui/react";
import type { Formation } from "../../formations";
import { PlannerSlot } from "./PlannerSlot";

export function PlannerBoard({ formation }: { formation: Formation }) {
  const rows = [...new Set(formation.slots.map((slot) => slot.row))].sort((a, b) => b - a);

  return (
    <VStack
      flexGrow={1}
      minW={0}
      align="stretch"
      gap="20px"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      p="18px 16px"
    >
      {rows.map((row) => (
        <HStack key={row} justify="center" gap="12px" align="stretch">
          {formation.slots
            .filter((slot) => slot.row === row)
            .map((slot) => (
              <PlannerSlot key={slot.id} slot={slot} />
            ))}
        </HStack>
      ))}
    </VStack>
  );
}
```

Rows are sorted **descending** so the attack is at the top and the goalkeeper at the bottom, matching `design/planner/Main.dc.html`. Within a row, the catalogue's own order is left to right.

- [ ] **Step 3: The picker and the branch**

Replace `src/components/planner/SquadPlanner.tsx` entirely:

```tsx
import { Button, Heading, SimpleGrid, Spinner, Text, VStack } from "@chakra-ui/react";
import type { Player } from "../../types/types";
import { FORMATIONS, getFormation } from "../../formations";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { PlannerBoard } from "./PlannerBoard";

export function SquadPlanner({ club }: { club: string; players: Player[] }) {
  const { plan, isLoaded, setFormation } = useSquadPlan();

  if (!isLoaded) {
    return <Spinner size="lg" colorPalette="glaucous" alignSelf="center" />;
  }

  const formation = plan ? getFormation(plan.formationId) : undefined;

  if (!formation) {
    return (
      <VStack align="stretch" gap={5}>
        <Heading size="lg" color="fg.emphasized">
          Which shape are you planning?
        </Heading>
        <Text color="fg.muted">
          {club}&rsquo;s board starts empty. Every card is placed by hand.
        </Text>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
          {FORMATIONS.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              colorPalette="glaucous"
              onClick={() => setFormation(option.id)}
            >
              {option.name}
            </Button>
          ))}
        </SimpleGrid>
      </VStack>
    );
  }

  return <PlannerBoard formation={formation} />;
}
```

`players` stays in the props **type** but is not destructured yet, so nothing is bound and unread — Task 8 starts using it. Keeping it in the type means `MyTeamView`'s call site never changes.

The `!formation` branch covers both cases at once: no plan at all, and a plan whose `formationId` is no longer in the catalogue. The second cannot happen today, but falling back to the picker is the only sane response if it ever does, and it costs one condition.

`isLoaded` gates the whole planner for the same reason it gates `/my-team`: without it the picker flashes for a frame before a saved plan arrives, and a formation picked in that frame would be overwritten by the read landing late.

- [ ] **Step 4: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then with `npm run dev`, on `/my-team/planner`:
1. With no plan stored, the picker appears with eight formation buttons.
2. Click 4-2-3-1. The picker is replaced by the shape: a single ST (C) at the top, then AM (L) / AM (C) / AM (R), then two DM (C), then D (L) / D (C) / D (C) / D (R), then GK at the bottom.
3. Every slot shows one dashed "+ Nobody".
4. Reload. The same board comes back — not the picker.
5. Click through to 3-5-2 by clearing the plan in the console (`db.setSquadPlan(null)`, reload, pick again) and confirm the wing-backs sit in the midfield row, five slots wide.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/
git commit -m "add the formation picker and the empty board"
```
---

### Task 7: The toolbar

The formation switch with its confirm, the planning date, and the cover summary. The orphan count joins it in Task 11.

**Files:**
- Create: `src/components/planner/PlannerToolbar.tsx`
- Modify: `src/components/planner/SquadPlanner.tsx`

**Interfaces:**
- Consumes: `useSquadPlan()`; `FORMATIONS`, `type Formation` (Task 2); `countSlotsWithoutCover` (Task 3); `ConfirmDialog` from `../ui/confirm-dialog`.
- Produces: `<PlannerToolbar formation={Formation} />`.

- [ ] **Step 1: Write the toolbar**

Create `src/components/planner/PlannerToolbar.tsx`:

```tsx
import { useState } from "react";
import { HStack, Input, NativeSelect, Text } from "@chakra-ui/react";
import type { Formation } from "../../formations";
import { FORMATIONS } from "../../formations";
import { countSlotsWithoutCover } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { ConfirmDialog } from "../ui/confirm-dialog";

export function PlannerToolbar({ formation }: { formation: Formation }) {
  const { plan, setFormation, setHorizon } = useSquadPlan();
  const [pendingFormation, setPendingFormation] = useState<string | null>(null);

  const uncovered = countSlotsWithoutCover(plan, formation.slots.length);
  const hasPlacements = (plan?.slots ?? []).some((slot) => slot.players.length > 0);

  const handleSelect = (id: string) => {
    if (id === formation.id) return;
    if (hasPlacements) setPendingFormation(id);
    else setFormation(id);
  };

  return (
    <>
      <HStack gap={4} flexWrap="wrap" align="center">
        <NativeSelect.Root size="sm" width="140px">
          <NativeSelect.Field
            value={formation.id}
            onChange={(e) => handleSelect(e.currentTarget.value)}
          >
            {FORMATIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>

        <HStack gap={1}>
          <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">
            Planning for:
          </Text>
          <Input
            type="text"
            placeholder="DD/MM/YYYY"
            value={plan?.horizon ?? ""}
            onChange={(e) => setHorizon(e.target.value || null)}
            maxW="130px"
            size="sm"
          />
        </HStack>

        <Text fontSize="sm" color="fg.muted">
          {uncovered === 0
            ? "Every slot has cover"
            : `${uncovered} ${uncovered === 1 ? "slot has" : "slots have"} no cover`}
        </Text>
      </HStack>

      <ConfirmDialog
        isOpen={pendingFormation !== null}
        onClose={() => setPendingFormation(null)}
        onConfirm={(value) => {
          setFormation(value);
          setPendingFormation(null);
        }}
        title="Change formation?"
        message="Every player on the board will be removed. There is only one board, so this cannot be undone."
        options={
          pendingFormation
            ? [{ label: `Switch to ${pendingFormation}`, value: pendingFormation }]
            : []
        }
      />
    </>
  );
}
```

The confirm belongs here, not in the provider: only the view knows whether the board holds anything worth losing, which is why switching an empty board is immediate and switching a filled one asks. This is the cheapest correct thing — named plans, when they arrive, supersede it.

The date field is empty by default and nothing is ever derived from the machine's clock. The app has no idea what date the save is on: `filterByContractExpiryDate` takes an explicit `currentDate` and Scouting makes the user type one, so the planner does the same. It is also what makes one board serve both uses — set it to next June and every deal ending first lights up; leave it blank and you are simply looking at the squad in another shape.

The value is stored raw as typed. A half-typed `30/06` parses to `null` in `parseHorizon` and simply tints nothing, so there is no need to validate on the way in.

- [ ] **Step 2: Render it**

In `src/components/planner/SquadPlanner.tsx`, import the toolbar and wrap the board:

```tsx
import { PlannerToolbar } from "./PlannerToolbar";
```

and replace the final `return`:

```tsx
  return (
    <VStack align="stretch" gap={4}>
      <PlannerToolbar formation={formation} />
      <PlannerBoard formation={formation} />
    </VStack>
  );
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then with `npm run dev`, on `/my-team/planner`:
1. The toolbar shows the current formation in a select, an empty "Planning for" field, and "11 slots have no cover" on a fresh 4-2-3-1.
2. Change the formation on an empty board: it switches immediately, no dialog.
3. Type `30/06/2027` into the field, reload, and confirm it came back — the horizon persists with the plan.
4. Clear the field. It stores `null` rather than an empty string.

The confirm dialog cannot be exercised until a card is on the board; Task 8 verifies it.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/
git commit -m "add the planner toolbar"
```

---

### Task 8: Placing, ordering and removing

The board becomes usable: a popover over the squad and the lists fills a stack, and a card's own menu reorders and empties it. The card is deliberately plain here — every status channel is Task 9.

**Files:**
- Create: `src/components/planner/PlannerCard.tsx`
- Create: `src/components/planner/CandidatePopover.tsx`
- Modify: `src/components/planner/PlannerSlot.tsx`

**Interfaces:**
- Consumes: `useSquadPlan()`; `usePlayerNotes()` for `lists`; `matchesSlot` (Task 3); `MAX_DEPTH`, `PlannedPlayer` (Task 1); `formatPositions`, `getEffectivePosition`, `displayDate` from `../../utils/utils`.
- Produces:
  - `<PlannerCard slot={FormationSlot} planned={PlannedPlayer} rank={number} player={Player | undefined} />`
  - `<CandidatePopover slot={FormationSlot} squad={Player[]} label={string} />`

- [ ] **Step 1: The candidate popover**

Create `src/components/planner/CandidatePopover.tsx`:

```tsx
import { useState } from "react";
import { Box, HStack, Popover, Portal, Text, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import type { Player } from "../../types/types";
import { formatPositions, getEffectivePosition } from "../../utils/utils";
import { matchesSlot } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";

export function CandidatePopover({
  slot,
  squad,
  label,
}: {
  slot: FormationSlot;
  squad: Player[];
  label: string;
}) {
  const { plan, place } = useSquadPlan();
  const { lists } = usePlayerNotes();
  const [isOpen, setIsOpen] = useState(false);

  const inThisSlot = new Set(
    (plan?.slots.find((s) => s.slotId === slot.id)?.players ?? []).map((p) => p.uid)
  );
  const listedUids = new Set(lists.flatMap((list) => list.uids));

  const candidates = squad.filter((player) => !inThisSlot.has(player.UID));
  const matching = candidates.filter((player) => matchesSlot(player, slot));
  const rest = candidates.filter((player) => !matchesSlot(player, slot));

  const row = (player: Player) => (
    <HStack
      key={player.UID}
      px={2}
      py="6px"
      gap={2}
      borderRadius="md"
      cursor="pointer"
      _hover={{ bg: "bg.muted" }}
      onClick={() => {
        place(slot.id, { uid: player.UID, name: player.Name, club: player.Club });
        setIsOpen(false);
      }}
    >
      {listedUids.has(player.UID) && (
        <Text as="span" color="glaucous.500" lineHeight="1" aria-label="On a list">
          &#9733;
        </Text>
      )}
      <VStack align="start" gap={0} flexGrow={1} minW={0}>
        <Text fontSize="xs" fontWeight="semibold" truncate>
          {player.Name}
        </Text>
        <Text fontSize="10.5px" color="softBlush.800">
          {formatPositions(getEffectivePosition(player))} &middot; {player.Club}
        </Text>
      </VStack>
    </HStack>
  );

  return (
    <Popover.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
      <Popover.Trigger asChild>
        <HStack
          justify="center"
          gap="6px"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border.emphasized"
          borderRadius="md"
          p="10px"
          color="softBlush.700"
          fontSize="xs"
          cursor="pointer"
          _hover={{ bg: "bg.muted" }}
        >
          <Box aria-hidden>&#43;</Box>
          <Text>{label}</Text>
        </HStack>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="280px">
            <Popover.Body maxH="420px" overflowY="auto" p={2}>
              <VStack align="stretch" gap={0}>
                {matching.map(row)}
                {rest.length > 0 && (
                  <>
                    <Text
                      fontSize="10px"
                      fontWeight="bold"
                      color="softBlush.700"
                      textTransform="uppercase"
                      letterSpacing="0.07em"
                      px={2}
                      pt={3}
                      pb={1}
                      borderTopWidth={matching.length > 0 ? "1px" : undefined}
                      borderColor="border.emphasized"
                    >
                      Out of position
                    </Text>
                    {rest.map(row)}
                  </>
                )}
                {candidates.length === 0 && (
                  <Text fontSize="xs" color="fg.muted" p={2}>
                    Nobody left to add.
                  </Text>
                )}
              </VStack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
```

`squad` here is the **candidate set**, assembled by `PlannerSlot` in Step 3 — every squad and list player. It is deliberately a different set from the panel's Squad tab: it includes players already placed elsewhere, because a defender covering two flanks is the point of the board. It excludes only the players already in *this* stack, which no slot may hold twice.

Matching players come first and the rest sit below a labelled divider, so placing someone out of position takes a deliberate scroll past the players who fit.

- [ ] **Step 2: The card**

Create `src/components/planner/PlannerCard.tsx`:

```tsx
import { HStack, Menu, Portal, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import type { FormationSlot } from "../../formations";
import type { Player } from "../../types/types";
import type { PlannedPlayer } from "../../types/planner";
import { displayDate, formatPositions, getEffectivePosition } from "../../utils/utils";
import { useSquadPlan } from "../../contexts/SquadPlanContext";

export function PlannerCard({
  slot,
  planned,
  rank,
  player,
}: {
  slot: FormationSlot;
  planned: PlannedPlayer;
  rank: number;
  player: Player | undefined;
}) {
  const { remove, makeFirstChoice } = useSquadPlan();

  const positions = player ? formatPositions(getEffectivePosition(player)) : "";
  const trailing = player
    ? player.Expires
      ? displayDate(player.Expires)
      : planned.club
    : "not in current data";

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <HStack
          align="center"
          gap={2}
          borderWidth="1px"
          borderColor="border.emphasized"
          borderRadius="md"
          bg="bg.canvas"
          p="7px 8px"
          cursor="pointer"
          opacity={player ? 1 : 0.5}
        >
          <Text
            flexShrink={0}
            w="17px"
            h="17px"
            borderRadius="full"
            bg="bg.muted"
            color="fg.muted"
            fontSize="10px"
            fontWeight="semibold"
            textAlign="center"
            lineHeight="17px"
          >
            {rank + 1}
          </Text>
          <VStack align="stretch" gap="2px" flexGrow={1} minW={0}>
            <HStack gap="5px" align="baseline">
              <Text fontSize="12.5px" fontWeight="semibold" truncate>
                {player?.Name ?? planned.name}
              </Text>
              {player && (
                <Text fontSize="10.5px" color="softBlush.800">
                  {player.Age}
                </Text>
              )}
            </HStack>
            <Text fontSize="10.5px" color="softBlush.800" truncate>
              {positions ? `${positions} · ${trailing}` : trailing}
            </Text>
          </VStack>
        </HStack>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {rank > 0 && (
              <Menu.Item value="first" onSelect={() => makeFirstChoice(slot.id, planned.uid)}>
                Make first choice
              </Menu.Item>
            )}
            {player && (
              <Menu.Item value="profile" asChild>
                <Link to={`/players/${planned.uid}`}>Open profile</Link>
              </Menu.Item>
            )}
            <Menu.Item value="remove" onSelect={() => remove(slot.id, planned.uid)}>
              Remove
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
```

"Open profile" is how the board answers "is he actually any good" without computing anything. The planner deliberately has no statistics of its own; it links through to the screen that has them.

A card whose player is missing from the current import renders from the `name`/`club` snapshot, dimmed, and says "not in current data" — it keeps its rank rather than being silently demoted. Task 11 adds the toolbar count and the cleanup action.

- [ ] **Step 3: Wire the slot**

Rewrite `src/components/planner/PlannerSlot.tsx`:

```tsx
import { Text, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import type { Player } from "../../types/types";
import { slotLabel } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { MAX_DEPTH } from "../../types/planner";
import { PlannerCard } from "./PlannerCard";
import { CandidatePopover } from "./CandidatePopover";

const EMPTY_LABEL = ["Nobody", "No cover", "Add"];

export function PlannerSlot({
  slot,
  candidates,
  byUid,
}: {
  slot: FormationSlot;
  candidates: Player[];
  byUid: Map<number, Player>;
}) {
  const { plan } = useSquadPlan();
  const placed = plan?.slots.find((s) => s.slotId === slot.id)?.players ?? [];

  return (
    <VStack flex="1 1 0" maxW="210px" align="stretch" gap="6px">
      <Text
        fontSize="9.5px"
        fontWeight="bold"
        letterSpacing="0.07em"
        color="softBlush.700"
        textTransform="uppercase"
      >
        {slotLabel(slot)}
      </Text>

      {placed.map((planned, rank) => (
        <PlannerCard
          key={planned.uid}
          slot={slot}
          planned={planned}
          rank={rank}
          player={byUid.get(planned.uid)}
        />
      ))}

      {placed.length < MAX_DEPTH && (
        <CandidatePopover slot={slot} squad={candidates} label={EMPTY_LABEL[placed.length]} />
      )}
    </VStack>
  );
}
```

- [ ] **Step 4: Build the candidate set once, at the top**

In `src/components/planner/PlannerBoard.tsx`, replace the `players` prop with the two things every slot needs, computed once rather than per slot:

```tsx
import { useMemo } from "react";
import { HStack, VStack } from "@chakra-ui/react";
import type { Formation } from "../../formations";
import type { Player } from "../../types/types";
import { PlannerSlot } from "./PlannerSlot";

export function PlannerBoard({
  formation,
  squad,
  listed,
}: {
  formation: Formation;
  squad: Player[];
  listed: Player[];
}) {
  const candidates = useMemo(() => {
    const byUid = new Map(listed.map((player) => [player.UID, player]));
    for (const player of squad) byUid.set(player.UID, player);
    return [...byUid.values()].sort((a, b) => a.Name.localeCompare(b.Name));
  }, [squad, listed]);

  const byUid = useMemo(() => new Map(candidates.map((p) => [p.UID, p])), [candidates]);

  const rows = [...new Set(formation.slots.map((slot) => slot.row))].sort((a, b) => b - a);

  return (
    <VStack
      flexGrow={1}
      minW={0}
      align="stretch"
      gap="20px"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      p="18px 16px"
    >
      {rows.map((row) => (
        <HStack key={row} justify="center" gap="12px" align="stretch">
          {formation.slots
            .filter((slot) => slot.row === row)
            .map((slot) => (
              <PlannerSlot key={slot.id} slot={slot} candidates={candidates} byUid={byUid} />
            ))}
        </HStack>
      ))}
    </VStack>
  );
}
```

Squad entries overwrite list entries in `byUid`, so a player who is both keeps his squad record.

- [ ] **Step 5: Load the list members and pass them down**

In `src/components/planner/SquadPlanner.tsx`, load every player who is on one of A's lists, then hand both sets to the board. Add the imports:

```tsx
import { useEffect, useMemo, useState } from "react";
import { db } from "../../services/db";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
```

and, above the `isLoaded` gate:

```tsx
  const { lists } = usePlayerNotes();
  const { plan, isLoaded, setFormation, refreshSnapshots } = useSquadPlan();
  const [allPlayers, setAllPlayers] = useState<Player[] | null>(null);

  useEffect(() => {
    db.getAllPlayers().then(setAllPlayers);
  }, []);

  const listed = useMemo(() => {
    if (!allPlayers) return [];
    const uids = new Set(lists.flatMap((list) => list.uids));
    return allPlayers.filter((player) => uids.has(player.UID));
  }, [allPlayers, lists]);

  useEffect(() => {
    if (!isLoaded || !plan || !allPlayers) return;
    refreshSnapshots(
      new Map(allPlayers.map((p) => [p.UID, { name: p.Name, club: p.Club }]))
    );
  }, [isLoaded, plan, allPlayers, refreshSnapshots]);
```

then pass them through:

```tsx
      <PlannerBoard formation={formation} squad={players} listed={listed} />
```

`refreshSnapshots` is a no-op when every name and club already matches, so this effect settles after one pass and does not loop even though `plan` is in its dependency list.

- [ ] **Step 6: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then with `npm run dev`, on `/my-team/planner` with 4-2-3-1 picked:
1. Click "+ Nobody" on the GK slot. The popover opens with your goalkeepers at the top and everyone else under an "Out of position" divider.
2. Pick one. He appears as card 1, the empty position becomes "+ No cover", and the toolbar count drops by nothing yet (cover needs two).
3. Add a second. The toolbar now reads one fewer "no cover", and the empty position reads "+ Add".
4. Add a third. The empty position disappears.
5. Open the popover on a slot that already holds him: he is not offered again there, but he still is on every other slot.
6. Click card 3 → "Make first choice". He moves to the top and the pips renumber.
7. Click a card → "Remove". The stack closes up.
8. Click a card → "Open profile". It navigates to `/players/<uid>`.
9. Reload. Every placement and its order came back.
10. Now change the formation in the toolbar: the confirm dialog appears, warns the board will be emptied, and cancelling leaves it untouched. Confirming clears it.

- [ ] **Step 7: Commit**

```bash
git add src/components/planner/
git commit -m "place, order and remove players on the planner board"
```
---

### Task 9: The card's status channels

Seven things can be true of a card at once. Each visual channel answers exactly one question, so they never compete. Read `design/planner/ChipSystem.dc.html` before starting — it draws every state in this task.

| Channel | Question | States |
|---|---|---|
| Fill | Does he play here? | White. `spicyPaprika.50` on a `spicyPaprika.200` border when he does not |
| Left edge | Where did he come from? | Nothing for your own players; 3px `glaucous.500` for a list member |
| Glyphs | What is true of the man? | A's star with list count, A's unwanted mark, a medical mark for `RcInjury` |
| Rank pip | Where is he in the stack? | 1, 2, 3 |
| Second line | | Positions and contract date — replaced by the mismatch when out of position |
| Counted-elsewhere badge | Is he already spoken for? | Grey outline: cover in another slot. Filled paprika "1st ×2": first choice in more than one |

The organising principle is that these are two families. **Out of position** and **counted elsewhere** are facts about *this placement*; **unwanted**, **listed**, **injury-prone** and the **contract** are facts about *the player*, identical in every slot he occupies. Fill is reserved for the first family and carries exactly one meaning, so a tinted card never has to be interpreted.

**Files:**
- Modify: `src/components/planner/PlannerCard.tsx`

**Interfaces:**
- Consumes: `describeMismatch`, `parseHorizon`, `slotLabel` (Task 3); `useSquadPlan().placements` (Task 4); `usePlayerNotes()` for `annotations` and `listsFor`; `Tooltip` from `../ui/tooltip`.
- Produces: no new exports. `PlannerCard`'s props are unchanged.

- [ ] **Step 1: Derive every status**

In `src/components/planner/PlannerCard.tsx`, add the imports:

```tsx
import { Badge } from "@chakra-ui/react";
import { describeMismatch, parseHorizon, placementFacts, slotLabel } from "../../utils/planner";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
import { Tooltip } from "../ui/tooltip";
```

Replace Task 8's `const { remove, makeFirstChoice } = useSquadPlan();` with the block below, which pulls two more values off the same context and derives every status above the `return`:

```tsx
  const { plan, placements, remove, makeFirstChoice } = useSquadPlan();
  const { annotations, listsFor } = usePlayerNotes();

  const mismatch = player ? describeMismatch(player, slot) : null;
  const memberships = listsFor(planned.uid);
  const unwanted = annotations.get(planned.uid)?.unwanted === true;

  const horizon = parseHorizon(plan?.horizon ?? null);
  const expiring = Boolean(horizon && player?.Expires && player.Expires <= horizon);

  const { elsewhere, firstChoiceCount } = placementFacts(placements, planned.uid, slot.id);
```

- [ ] **Step 2: Apply the channels to the card**

Replace the `HStack` inside `Menu.Trigger` with the version that reads every channel. The pip, name and menu are unchanged; what is new is the fill, the left edge, the second line, the glyphs and the badge:

```tsx
        <HStack
          align="center"
          gap={2}
          borderWidth="1px"
          borderColor={mismatch ? "spicyPaprika.200" : "border.emphasized"}
          borderLeftWidth={memberships.length > 0 ? "3px" : "1px"}
          borderLeftColor={memberships.length > 0 ? "glaucous.500" : undefined}
          borderRadius="md"
          bg={mismatch ? "spicyPaprika.50" : "bg.canvas"}
          p="7px 8px"
          pl={memberships.length > 0 ? "6px" : "8px"}
          cursor="pointer"
          opacity={player ? 1 : 0.5}
        >
          <Text
            flexShrink={0}
            w="17px"
            h="17px"
            borderRadius="full"
            bg={mismatch ? "spicyPaprika.100" : "bg.muted"}
            color={mismatch ? "spicyPaprika.700" : "fg.muted"}
            fontSize="10px"
            fontWeight="semibold"
            textAlign="center"
            lineHeight="17px"
            opacity={unwanted ? 0.5 : 1}
          >
            {rank + 1}
          </Text>

          <VStack align="stretch" gap="2px" flexGrow={1} minW={0} opacity={unwanted ? 0.5 : 1}>
            <HStack gap="5px" align="baseline">
              <Text
                fontSize="12.5px"
                fontWeight="semibold"
                truncate
                textDecoration={unwanted ? "line-through" : undefined}
              >
                {player?.Name ?? planned.name}
              </Text>
              {player && (
                <Text fontSize="10.5px" color="softBlush.800">
                  {player.Age}
                </Text>
              )}
            </HStack>
            <Text
              fontSize="10.5px"
              color={mismatch ? "spicyPaprika.700" : "softBlush.800"}
              truncate
            >
              {positions ? `${positions} · ` : ""}
              {mismatch ? (
                mismatch
              ) : expiring ? (
                <Text as="span" color="spicyPaprika.500" fontWeight="semibold">
                  {trailing}
                </Text>
              ) : (
                trailing
              )}
            </Text>
          </VStack>

          <HStack gap="5px" flexShrink={0}>
            {memberships.length > 0 && (
              <Tooltip content={memberships.map((list) => list.name).join(", ")}>
                <Text as="span" color="glaucous.500" fontSize="sm" lineHeight="1">
                  &#9733;
                </Text>
              </Tooltip>
            )}
            {unwanted && (
              <Tooltip content="Unwanted">
                <Text as="span" color="spicyPaprika.500" fontSize="sm" lineHeight="1">
                  &#8856;
                </Text>
              </Tooltip>
            )}
            {player?.RcInjury && (
              <Tooltip content="Injury-prone">
                <Text as="span" color="softBlush.800" fontSize="sm" lineHeight="1">
                  &#10010;
                </Text>
              </Tooltip>
            )}
            {mismatch && (
              <Tooltip content={`Out of position — this slot is ${slotLabel(slot)}`}>
                <Text as="span" color="spicyPaprika.500" fontSize="sm" lineHeight="1">
                  &#9888;
                </Text>
              </Tooltip>
            )}
            {elsewhere.length > 0 && (
              <Tooltip
                content={
                  firstChoiceCount > 1
                    ? `First choice in ${firstChoiceCount} slots — he cannot start in both`
                    : `Also in ${elsewhere.map((p) => p.slotId).join(", ")}`
                }
              >
                <Badge
                  size="sm"
                  variant={firstChoiceCount > 1 ? "solid" : "outline"}
                  colorPalette={firstChoiceCount > 1 ? "spicyPaprika" : "gray"}
                >
                  {firstChoiceCount > 1 ? `1st ×${firstChoiceCount}` : "⇄"}
                </Badge>
              </Tooltip>
            )}
          </HStack>
        </HStack>
```

Also change `trailing` so a player at another club shows that club where your own players show a contract date:

```tsx
  const trailing = player
    ? player.Club && player.Club !== planned.club
      ? player.Club
      : player.Expires
        ? displayDate(player.Expires)
        : player.Club
    : "not in current data";
```

Six notes:

**The glyphs stay at full strength when a card is dimmed.** `opacity` is applied to the pip and the body, never to the flags row — a player ruled out is still a player whose status you need to read. This is exactly how A dims a table row.

**The mismatch replaces the contract on the second line**, it does not sit beside it. Out of position is the more urgent fact and the line has room for one.

**The counted-elsewhere badge is grey and quiet for cover** — useful, not a problem — and filled paprika only when he is first choice in more than one slot, because then he cannot start in both and one of those slots is really empty.

**`firstChoiceCount` counts every slot including this one**, so the badge reads the same on both of his cards. That is the point: it is a fact about *him*, identical wherever he appears, while the fill differs because it is a fact about *this slot*.

**The tooltip names the other slots** by their slot id, which is already a readable position string (`D-C-1`, `AM-L`).

**Every one of these is derived on render** from the plan, the player record and A's annotations. Nothing in this task writes anything.

- [ ] **Step 3: Verify against the mockup**

Run: `npm run build && npm run lint`
Expected: both clean.

Then with `npm run dev`, on `/my-team/planner`, reproduce each state and compare with `design/planner/ChipSystem.dc.html`:
1. **Plays here** — place a centre-back in a D (C) slot. White card, grey pip, "D(C) · <date>".
2. **Out of position** — place a left-back in the D (R) slot. Paprika fill, paprika pip, paprika second line reading "D(L), WB(L) · left side only", and a warning glyph.
3. **Nobody** — an untouched slot shows the dashed "+ Nobody".
4. **A target off a list** — place a player who is on one of A's lists and plays elsewhere. 3px blue left edge, a blue star, and his club where a contract date would be.
5. **Unwanted** — mark a placed player unwanted from `/lists` or his profile, then come back. Dimmed, struck through, and the ⊘ glyph at full strength.
6. **Injury-prone and running out** — set "Planning for" to a date after a placed player's contract ends. The date turns paprika. A player with `RcInjury` shows the medical glyph.
7. **Cover in more than one slot** — place the same player as cover in two slots. Both cards show the quiet outline ⇄ badge; hovering names the other slot.
8. **First choice twice** — make him first choice in both. Both badges become filled paprika "1st ×2".
9. Clear "Planning for". Every contract tint disappears and no card changes in any other way.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/PlannerCard.tsx
git commit -m "add the planner card status channels"
```

---

### Task 10: The candidate panel

The panel on the right, with its two tabs. Its Squad tab is a different set from the slot popover's, and deliberately so.

**Files:**
- Create: `src/components/planner/CandidatePanel.tsx`
- Modify: `src/components/planner/SquadPlanner.tsx`

**Interfaces:**
- Consumes: `useSquadPlan().placements`; `usePlayerNotes()`; `formatPositions`, `getEffectivePosition`, `displayDate`.
- Produces: `<CandidatePanel squad={Player[]} listed={Player[]} />`.

- [ ] **Step 1: Write the panel**

Create `src/components/planner/CandidatePanel.tsx`:

```tsx
import { useState } from "react";
import { Box, HStack, Tabs, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import type { Player } from "../../types/types";
import { displayDate, formatPositions, getEffectivePosition } from "../../utils/utils";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";

function CandidateRow({ player }: { player: Player }) {
  const { annotations } = usePlayerNotes();
  const unwanted = annotations.get(player.UID)?.unwanted === true;

  return (
    <HStack
      px={2}
      py="6px"
      gap={2}
      borderRadius="md"
      bg={unwanted ? "bg.subtle" : undefined}
      _hover={{ bg: "bg.muted" }}
    >
      <VStack align="stretch" gap={0} flexGrow={1} minW={0} opacity={unwanted ? 0.5 : 1}>
        <HStack gap="5px" align="baseline">
          <Link to={`/players/${player.UID}`}>
            <Text
              fontSize="12.5px"
              fontWeight="semibold"
              textDecoration={unwanted ? "line-through" : undefined}
              _hover={{ textDecoration: "underline" }}
            >
              {player.Name}
            </Text>
          </Link>
          <Text fontSize="10.5px" color="softBlush.800">
            {player.Age}
          </Text>
        </HStack>
        <Text fontSize="10.5px" color="softBlush.800" truncate>
          {formatPositions(getEffectivePosition(player))} &middot;{" "}
          {player.Expires ? displayDate(player.Expires) : player.Club}
        </Text>
      </VStack>
      {unwanted && (
        <Text as="span" color="spicyPaprika.500" fontSize="sm" lineHeight="1" flexShrink={0}>
          &#8856;
        </Text>
      )}
    </HStack>
  );
}

export function CandidatePanel({ squad, listed }: { squad: Player[]; listed: Player[] }) {
  const { placements } = useSquadPlan();
  const [tab, setTab] = useState("squad");

  const unplaced = squad.filter((player) => !placements.has(player.UID));
  const rows = tab === "squad" ? unplaced : listed;

  return (
    <VStack
      w="300px"
      flexShrink={0}
      align="stretch"
      gap={0}
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      maxH="calc(100vh - 260px)"
    >
      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value)}>
        <Tabs.List>
          <Tabs.Trigger value="squad">Squad &middot; {unplaced.length} unplaced</Tabs.Trigger>
          <Tabs.Trigger value="lists">Lists &middot; {listed.length}</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      <Box overflowY="auto" p={2}>
        {rows.length === 0 ? (
          <Text fontSize="xs" color="fg.muted" p={2}>
            {tab === "squad" ? "Everyone is on the board." : "No players on any list yet."}
          </Text>
        ) : (
          <VStack align="stretch" gap="2px">
            {rows.map((player) => (
              <CandidateRow key={player.UID} player={player} />
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
```

The Squad tab lists players placed in **no** slot at all — it answers "have I forgotten anyone", so a player already on the board leaves it. Unwanted players stay in it, dimmed and marked, rather than being hidden: a player ruled out is still a player you have, and hiding him would make the list lie about the size of your squad.

This is why it is a different set from the slot popover, which offers everyone including the already-placed. The two lists answer different questions and neither should be made to answer the other's.

- [ ] **Step 2: Put the panel beside the board**

In `src/components/planner/SquadPlanner.tsx`, import it and change the final `return` so the board and the panel sit side by side:

```tsx
import { HStack } from "@chakra-ui/react";
import { CandidatePanel } from "./CandidatePanel";
```

```tsx
  return (
    <VStack align="stretch" gap={4}>
      <PlannerToolbar formation={formation} />
      <HStack align="stretch" gap={6}>
        <PlannerBoard formation={formation} squad={players} listed={listed} />
        <CandidatePanel squad={players} listed={listed} />
      </HStack>
    </VStack>
  );
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then with `npm run dev`, on `/my-team/planner`:
1. The panel sits to the right of the board with two tabs.
2. "Squad · N unplaced" counts exactly the squad players in no slot. Place one and the count drops by one and he leaves the list.
3. Remove him from the board and he comes back.
4. An unwanted squad player is still listed, dimmed, struck through, with the ⊘ at full strength.
5. The Lists tab shows A's list members with their count, including players at other clubs.
6. A name in either tab links through to the player's profile.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/
git commit -m "add the planner candidate panel"
```
---

### Task 11: Deciding an out-of-position placement

A tinted card is a question, not a verdict. Clicking one offers three answers.

**Files:**
- Create: `src/components/planner/MismatchDialog.tsx`
- Modify: `src/components/planner/PlannerCard.tsx`

**Interfaces:**
- Consumes: `db.updatePlayerPosition`; `usePlayerNotes().refresh`; `useSquadPlan()` for `plan`, `place`, `remove`; `getFormation` (Task 2); `matchesSlot`, `slotLabel` (Task 3); `getEffectivePosition`, `formatPositions`.
- Produces: `<MismatchDialog slot={FormationSlot} player={Player} planned={PlannedPlayer} isOpen={boolean} onClose={() => void} />`.

- [ ] **Step 1: The dialog**

Create `src/components/planner/MismatchDialog.tsx`:

```tsx
import { Button, Dialog, HStack, Portal, Text, VStack } from "@chakra-ui/react";
import type { FormationSlot } from "../../formations";
import { getFormation } from "../../formations";
import type { Player } from "../../types/types";
import type { PlannedPlayer } from "../../types/planner";
import { formatPositions, getEffectivePosition } from "../../utils/utils";
import { matchesSlot, slotLabel } from "../../utils/planner";
import { useSquadPlan } from "../../contexts/SquadPlanContext";
import { usePlayerNotes } from "../../contexts/PlayerNotesContext";
import { db } from "../../services/db";
import { toaster } from "../ui/toaster";

export function MismatchDialog({
  slot,
  player,
  planned,
  isOpen,
  onClose,
}: {
  slot: FormationSlot;
  player: Player;
  planned: PlannedPlayer;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { plan, place, remove } = useSquadPlan();
  const { refresh } = usePlayerNotes();

  const formation = plan ? getFormation(plan.formationId) : undefined;
  const openMatching = (formation?.slots ?? []).filter(
    (candidate) =>
      candidate.id !== slot.id &&
      matchesSlot(player, candidate) &&
      !(plan?.slots.find((s) => s.slotId === candidate.id)?.players ?? []).some(
        (p) => p.uid === planned.uid
      )
  );

  const addPosition = async () => {
    try {
      await db.updatePlayerPosition(planned.uid, [
        ...getEffectivePosition(player),
        slot.position,
      ]);
      await refresh();
      onClose();
    } catch {
      toaster.create({
        title: "Position Not Saved",
        description: "His positions could not be updated.",
        type: "error",
        duration: 3000,
      });
    }
  };

  const moveTo = (target: FormationSlot) => {
    remove(slot.id, planned.uid);
    place(target.id, planned);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Out of position</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Text fontSize="sm">
                  {player.Name} plays{" "}
                  <Text as="span" fontWeight="semibold">
                    {formatPositions(getEffectivePosition(player))}
                  </Text>
                  . This slot is{" "}
                  <Text as="span" fontWeight="semibold">
                    {slotLabel(slot)}
                  </Text>
                  .
                </Text>

                <VStack align="stretch" gap={2}>
                  <Button variant="outline" justifyContent="flex-start" onClick={addPosition}>
                    Add {slotLabel(slot)} to his positions
                  </Button>
                  <Text fontSize="xs" color="fg.muted">
                    A custom position also moves him between Scouting cohorts — every role check
                    reads the same effective position.
                  </Text>

                  {openMatching.length > 0 && (
                    <>
                      <Text fontSize="xs" fontWeight="bold" color="fg.muted" pt={2}>
                        MOVE HIM TO
                      </Text>
                      <HStack gap={2} flexWrap="wrap">
                        {openMatching.map((target) => (
                          <Button
                            key={target.id}
                            size="sm"
                            variant="outline"
                            onClick={() => moveTo(target)}
                          >
                            {slotLabel(target)}
                          </Button>
                        ))}
                      </HStack>
                    </>
                  )}
                </VStack>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={onClose}>
                Leave it — he plays out of position
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
```

The first option writes through A's existing `updatePlayerPosition`, so the tint clears in every slot he occupies — and the copy names the consequence, because `getEffectivePosition` feeds every `isRole`, so a custom position also moves him between Scouting cohorts. That is a real side effect of a click on this screen and the user is told before making it.

The third option leaves the tint in place on purpose. He has been seen and allowed; the board is recording a decision, not nagging about one.

`refresh()` is what makes the change visible without a reload: `updatePlayerPosition` writes to `playerAnnotations`, and `PlayerNotesProvider` holds the copy every card reads.

`moveTo` filters out slots that already hold him, since no slot may hold the same player twice.

- [ ] **Step 2: Open it from a tinted card**

In `src/components/planner/PlannerCard.tsx`, add `useState`, import the dialog, and add a menu item that only exists when the card is tinted:

```tsx
import { useState } from "react";
import { MismatchDialog } from "./MismatchDialog";
```

```tsx
  const [showMismatch, setShowMismatch] = useState(false);
```

In `Menu.Content`, above "Remove":

```tsx
            {mismatch && (
              <Menu.Item value="mismatch" onSelect={() => setShowMismatch(true)}>
                Out of position…
              </Menu.Item>
            )}
```

The dialog is a sibling of the menu, not a child of it: wrap the component's return in a fragment so `</Menu.Root>` closes first, then the dialog follows.

```tsx
  return (
    <>
      <Menu.Root>
        {/* unchanged */}
      </Menu.Root>

      {mismatch && player && (
        <MismatchDialog
          slot={slot}
          player={player}
          planned={planned}
          isOpen={showMismatch}
          onClose={() => setShowMismatch(false)}
        />
      )}
    </>
  );
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then with `npm run dev`, on `/my-team/planner`:
1. Place a left-back in the D (R) slot. The card is tinted and its menu now offers "Out of position…".
2. Open it. The dialog reads "<name> plays D(L), WB(L). This slot is D(R)." and offers the three actions.
3. Click "Move him to" → D (L). He leaves the right slot and appears in the left one, untinted.
4. Put him back in D (R), open the dialog, and click "Add D(R) to his positions". The card goes white immediately, with no reload.
5. Go to `/players/<uid>`. His position shows the "Edited" badge — this wrote a custom position through the same path the profile view uses.
6. Clear the custom position from the profile. Back on the board, the tint is back.
7. Place him again in D (R), open the dialog and click "Leave it". Nothing changes and the tint stays.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/
git commit -m "add the out of position decision dialog"
```

---

### Task 12: Orphans

A re-import may not contain a placed player. Following A and B, the entry is kept and the absence is reported.

**Files:**
- Modify: `src/components/planner/PlannerToolbar.tsx`
- Modify: `src/components/planner/SquadPlanner.tsx`

**Interfaces:**
- Consumes: `useSquadPlan().removeMissing` (Task 4).
- Produces: `PlannerToolbar` gains a `presentUids: Set<number>` prop.

- [ ] **Step 1: Report the count and offer the cleanup**

In `src/components/planner/PlannerToolbar.tsx`, take the new prop and pull `removeMissing` out of the context:

```tsx
export function PlannerToolbar({
  formation,
  presentUids,
}: {
  formation: Formation;
  presentUids: Set<number>;
}) {
  const { plan, setFormation, setHorizon, removeMissing } = useSquadPlan();
```

Add the count beside the others:

```tsx
  const missing = (plan?.slots ?? [])
    .flatMap((slot) => slot.players)
    .filter((player) => !presentUids.has(player.uid)).length;
```

and render it after the cover summary, inside the same `HStack`:

```tsx
        {missing > 0 && (
          <HStack gap={2}>
            <Text fontSize="sm" color="spicyPaprika.500">
              {missing} not in current data
            </Text>
            <Button size="xs" variant="outline" onClick={() => removeMissing(presentUids)}>
              Remove missing
            </Button>
          </HStack>
        )}
```

Add `Button` to the `@chakra-ui/react` import.

A count and a button, not an automatic sweep: this is the same manual, visible cleanup A gives each list. Nothing is reinterpreted either — a first choice who has vanished is not silently demoted to "no cover", he keeps his rank and says he is missing.

- [ ] **Step 2: Pass the present uids down**

In `src/components/planner/SquadPlanner.tsx`, derive the set from every player in the current import — not just the squad, because a placed list member at another club is present too:

```tsx
  const presentUids = useMemo(
    () => new Set((allPlayers ?? []).map((player) => player.UID)),
    [allPlayers]
  );
```

and pass it:

```tsx
      <PlannerToolbar formation={formation} presentUids={presentUids} />
```

Guard the count against the moment before the load resolves: while `allPlayers` is `null` the set is empty, which would briefly claim every placed player is missing. Render the toolbar only once the players are in:

```tsx
  if (!isLoaded || allPlayers === null) {
    return <Spinner size="lg" colorPalette="glaucous" alignSelf="center" />;
  }
```

replacing the existing `!isLoaded` gate.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both clean.

Then with `npm run dev`:
1. Place several players, including one from a list at another club.
2. Import a file that does not contain one of them (or delete him in the console: `await db.deletePlayer(<uid>)`, then reload).
3. The toolbar reads "1 not in current data". His card is still in its slot, still at its rank, dimmed, reading "not in current data", and rendering his name from the snapshot rather than a bare number.
4. Every other card is untouched.
5. Click "Remove missing". Only he goes.
6. Reload. The cleanup stuck.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/
git commit -m "report and clean up planner orphans"
```

---

### Task 13: Documentation and end-to-end verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the planner**

Add a new section to `CLAUDE.md` after "My Team":

```markdown
## Squad Planner

Route: `/my-team/planner`, the second tab of `/my-team`. Lays the squad and the
shortlist onto a formation as one ranked depth stack per slot.

- **Storage**: one `SquadPlan` value in the `settings` store under key `squadPlan`, reached through `db.getSquadPlan()` / `db.setSquadPlan()`. No schema change — the database stays at version 5 — and a re-import cannot touch it, so the board survives one. It deliberately does not join the import "Preserve data" dialog: that dialog lists what an import can destroy, and this is not that.
- **Settings module**: `src/services/db/settings.ts` keeps a private untyped `_get`/`_set` pair and composes the typed accessors over it, so a third setting adds a pair of one-liners rather than another two `try`/`catch` blocks.
- **State**: `SquadPlanProvider` (`src/contexts/SquadPlanContext.tsx`), mounted in `Layout` inside `MyTeamProvider`. `useSquadPlan()` returns the plan, `isLoaded`, a memoised `placements` index, and the mutators. Gate on `isLoaded` before rendering: without it the formation picker flashes before a saved plan arrives, and a plan created in that frame would be overwritten by the read landing late.
- **Formations**: static data in `src/formations/index.ts`, never persisted — the plan stores only `formationId`. Slots carry a `row` (0 = goalkeeper, increasing towards the attack) rather than pitch coordinates, and are ordered left to right within a row. Eight shapes; a ninth is a data edit.
- **Matching is strict** (`matchesSlot` in `src/utils/planner.ts`): no `D`/`WB`, `M`/`DM` or left/right equivalence. The one allowance is a missing `side` on either side of the comparison, because the export writes `DM` with no side. A full-back in a `WB` slot is therefore out of position, which is what the game does too.
- **Nothing about a card is stored.** Out of position, unwanted, listed, injury-prone, contract and counted-elsewhere are all derived on render from the plan, the player record and the annotations.
- **No statistics.** The planner computes nothing — it links through to the player profile instead. Its first choices are the seam the future team-statistics screen reads.
- **Planning date**: the toolbar's "Planning for" field, empty by default. A contract expiring on or before it turns paprika; empty means no contract tint. Nothing is derived from the machine's clock — the app does not know the save's date.
- **Formation switch clears the board**, after a confirm raised by the toolbar (the provider's `setFormation` does not ask). The plan is not keyed by formation id on purpose: two plans for the same shape is what named plans will need, so that key would already be wrong.
- **Orphans**: a placed player missing from the current import keeps his slot and rank, renders from the `name`/`club` snapshot, and is counted in the toolbar with a "Remove missing" action.
```

- [ ] **Step 2: Correct the My Team section**

Two lines above it are now stale. In the "My Team" section, replace the `/my-team` picker bullet's neighbours where they describe the view:

```markdown
- **Set from**: the `/my-team` picker, or "Set as My Team" on a team profile.
- **Tabs**: `MyTeamView` is a shell. It owns the club gate — loading, no club, club absent from the current import — in one place and renders either `SquadTable` (`/my-team`) or `SquadPlanner` (`/my-team/planner`), each handed a club known to exist. The two tabs are two routes so a reload and a bookmark land where the user left off.
```

Leave the rest of the section as it is.

- [ ] **Step 3: Verify the whole feature end to end**

Run: `npm run build && npm run lint && npx playwright test`
Expected: all clean. The existing `browser-tests/compare-list.spec.ts` must still pass — nothing in this sub-project changed the database version or the seed.

Then walk the two questions the sub-project exists to answer:

**Where is the squad thin?**
1. Set your club, open the Planner tab, pick your shape.
2. Fill each slot with a first choice from the Squad tab, working down the panel until it is empty.
3. The toolbar's "N slots have no cover" is now the answer, and each thin slot says "No cover" in place of a second card.
4. Any player you had to use twice carries the ⇄ badge; anyone you made first choice twice carries "1st ×2", which means one of those slots is really empty.

**Does the shortlist fix that?**
5. Add a target to one of A's lists from `/scouting` or a player profile.
6. Back on the board, open a thin slot's popover: he is offered, above the divider if he fits.
7. Place him. His card carries the blue left edge, the star, and his current club.
8. Set "Planning for" to next June. Every deal ending first turns paprika, including the ones you have as first choice.

**And the promise the storage decision exists to keep:**
9. Re-import the same file with every preserve box checked. The board is unchanged.
10. Re-import with every box **unchecked**. The board is *still* unchanged — the plan is a preference, not import data, and no dialog option touches it.
11. Import a file missing one placed player. He keeps his slot, the toolbar counts him, and "Remove missing" takes only him.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "document the squad planner"
```

---

## After the plan

**The one pinned-test candidate**, deliberately deferred until the feature works: **the board survives a re-import** — place a player, re-import, confirm he is still in his slot. That is Step 3 items 9 and 10 of Task 13, done by hand. If it is pinned it goes in `browser-tests/` as a Playwright spec, seeded through `browser-tests/helpers/seed.ts` (which needs a `settings` write adding alongside the existing `compareList` one), and must then be validated by mutation testing per project policy. Any temporary test written while debugging is deleted afterwards.

**Follow-ups the spec records as deferred, not forgotten:**

- **The in-game date from the import filename.** The user's import files follow a naming convention that encodes the save's date. Reading it would let the app fill the planning date — and give contract filters everywhere a real "today" instead of a typed one. Nothing in the parser looks at the filename today. This is also the point at which `parseCustomDate`'s 1-based-month quirk is worth confronting, since it would then feed a value the user never typed.
- **Named plans.** Several boards with names, switched between. The reason today's plan is not keyed by formation id. A `squadPlans` store arrives with them or not at all.
- **The depth grid** (`design/planner/DepthGrid.dc.html`, the canvas's Parked page): the same slots and stacks as a grid, rows for slots and columns for first, second and third choice. A tab over the same data, better at spotting holes, and able to grow a fourth column.
- **The alternative card colouring** (`design/planner/ChipAltC.dc.html`, also parked): tint by how much is wrong rather than what. The card data is identical; only the rule that colours it differs, so it is a styling change rather than a re-model.
- **Drag and drop** between the panel and the board, and within a stack.
- **Team statistics** — the unbuilt half of sub-project B. The plan's first choices are a set of uids it can read to describe the projected side. Producer to consumer, not two features overlapping.
