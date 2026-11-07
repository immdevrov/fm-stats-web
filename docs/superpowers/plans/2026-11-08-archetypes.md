# Archetypes (step 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save a scouting search under a name, reapply it later, switch between several.

**Architecture:** Scouting's filters get one typed shape (`ScoutingFilters`) with a pure helper module for defaults, coercion and equality. Archetypes are an `Archetype[]` in the `settings` store behind an `ArchetypeProvider`. `ScoutingView` keeps its working filters in `localStorage` plus the active archetype id; *modified* is derived by comparing the two.

**Tech Stack:** React 19, Chakra UI 3, IndexedDB via `idb`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-08-archetypes-design.md`

## Global Constraints

- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`); `npx tsc -b` and `npx eslint .` clean before every commit.
- No code comments unless the code cannot say it; never restate the code.
- Commit messages: one short lowercase line, no attribution of any kind.
- Tests: Playwright only, behaviour only. One durable test (Task 3), mutation-checked. Temporary tests are deleted before commit.
- Never start the dev server yourself; Playwright's `webServer` may.
- No schema change: `DB_VERSION` stays as is.
- A *New save* import does **not** clear archetypes.
- Contract presets: `"season" | "1y" | "2y"`, labels *By end of season* / *Within a year* / *Within two years*, resolved with `resolveHorizon()` from `src/utils/planner.ts` against the active snapshot's date; never the machine clock.

**Human verification:** at finish, see the checklist at the bottom.

---

### Task 1: One filter shape, role by key, contract presets

Plain scouting only — no archetypes yet. After this task scouting looks the same except the contract field is a preset select.

**Files:**

- Create: `src/types/archetypes.ts`
- Create: `src/utils/scouting-filters.ts`
- Modify: `src/views/ScoutingView.tsx` (types and `loadFilters`/`saveFilters` at ~90–130, state at ~300–366, contract filter at ~382–388, `clearFilters`/`hasActiveFilters` at ~499–508, contract input at ~718–728)

**Interfaces:**

- Produces, in `src/types/archetypes.ts`:
  ```ts
  export type Side = "both" | "left" | "right";
  export type ContractHorizon = Exclude<HorizonPreset, "now">;
  export type ColumnFilters = Record<string, { min?: string; max?: string }>;
  export interface ScoutingFilters {
    roleKey: string;
    side: Side;
    columnFilters: ColumnFilters;
    contractHorizon: ContractHorizon | null;
    excludeInjuries: boolean;
    excludedLeagues: string[];
    sortKey: string;
    sortDirection: SortDirection;
  }
  export interface Archetype { id: string; name: string; filters: ScoutingFilters }
  ```
  `Side` moves here from `ScoutingView`; `SortDirection` is the existing table type.
- Produces, in `src/utils/scouting-filters.ts`:
  - `DEFAULT_FILTERS: ScoutingFilters` — `roleKey: ROLE_CONFIG[0].key`, `side: "both"`, `columnFilters: {}`, `contractHorizon: null`, `excludeInjuries: true`, `excludedLeagues: []`, `sortKey: "name"`, `sortDirection: "asc"`.
  - `coerceFilters(value: unknown): ScoutingFilters` — never throws; every missing or wrong-typed field takes its default; `roleKey` not in `ROLE_CONFIG` → default; `contractHorizon` not one of the three presets → `null`; column-filter entries with neither a non-empty `min` nor `max` dropped. Also reads the legacy shape: a numeric `selectedRoleIndex` maps to `ROLE_CONFIG[index]?.key`; `contractBefore` is ignored.
  - `sameFilters(a: ScoutingFilters, b: ScoutingFilters): boolean` — compares after dropping empty column entries; `excludedLeagues` compared as sets (order-insensitive); key order of `columnFilters` irrelevant.
  - `loadWorkingState(): { filters: ScoutingFilters; activeArchetypeId: string | null }` and `saveWorkingState(state)` — `localStorage` key stays `"scouting-filters"`; stored as `{ ...filters, activeArchetypeId }`; every access in `try`/`catch`.

**Definition of done:**

- A `localStorage` value in the old shape (`selectedRoleIndex: 7, contractBefore: "30/06/2036"`) loads as role `ST` with no contract filter, and is re-saved in the new shape.
- The contract control is a select: *Any contract* (null), *By end of season*, *Within a year*, *Within two years*. A player passes when `contractExpires <= resolveHorizon(activeSnapshot.date, preset)`; a player with no `contractExpires` fails while a preset is set (as today with a date).
- The active snapshot has no date → the select is disabled and a stored preset is not applied (all players pass the contract check).
- *Clear filters* sets the preset to null; `hasActiveFilters` is true while a preset is set.
- Role tabs still reset side to `"both"`; everything else in scouting behaves as before.

**Verify:** `npx tsc -b && npx eslint . && npx playwright test` → clean, all existing tests pass. Contract behaviour: `verify: human-eyes` (checklist item 1).

- [ ] **Step 1: Types and helper module** — `src/types/archetypes.ts`, `src/utils/scouting-filters.ts` as above. Scratch-probe `coerceFilters` and `sameFilters` once (scratchpad script or browser console): legacy object above → `roleKey "ST"`, `contractHorizon null`; `sameFilters` true for `excludedLeagues ["A","B"]` vs `["B","A"]` and for `{x:{min:""}}` vs `{}`.
- [ ] **Step 2: Rewire `ScoutingView`** — keep the per-field `useState`s (the debounce on column filters stays); replace `selectedRoleIndex` state with `roleKey` (index derived with `findIndex`, fallback 0); replace `contractBeforeRaw` with `contractHorizon`; assemble `currentFilters: ScoutingFilters` with `useMemo` from the raw (undebounced) values; persist with `saveWorkingState`. Read the active snapshot with `useSnapshots()`.
- [ ] **Step 3: Verify and commit** — `git commit -m "scouting filters by role key, contract presets"`

---

### Task 2: Archetype storage and provider

No UI yet; this task's surface is the provider API.

**Files:**

- Modify: `src/services/db/settings.ts` — add `ARCHETYPES = 'archetypes'`, `getArchetypes`, `setArchetypes`
- Create: `src/utils/ids.ts` — move `generateListId` out of `src/contexts/PlayerNotesContext.tsx` as `generateId(prefix: string): string` (`crypto.randomUUID()` with the existing fallback, prefix used only in the fallback); `PlayerNotesContext` calls `generateId("list")`
- Create: `src/utils/archetypes.ts` — `validateArchetypeName`
- Create: `src/contexts/ArchetypeContext.tsx`
- Modify: `src/components/Layout.tsx` — mount `ArchetypeProvider` inside `SquadPlanProvider`

**Interfaces:**

- Consumes: `Archetype`, `ScoutingFilters` (Task 1), `coerceFilters` (Task 1), `useOnTabReturn` (`src/hooks/useOnTabReturn.ts`).
- Produces:
  - `db.getArchetypes(): Promise<Archetype[]>` — not an array → `[]`; drops an entry unless it is an object with a non-empty string `id` and `name`; `filters` passed through `coerceFilters`; drops later entries whose `id` repeats.
  - `db.setArchetypes(archetypes: Archetype[]): Promise<void>` — via `_set(ARCHETYPES, archetypes, 'save archetypes')`.
  - `validateArchetypeName(name: string, archetypes: Archetype[], exceptId?: string): string | null` — trims; empty → `"Name can't be empty."`; another archetype (not `exceptId`) with the same name case-insensitively → `` `An archetype named “${trimmed}” already exists.` ``; else `null`.
  - `useArchetypes(): { archetypes: Archetype[]; isLoaded: boolean; create(name: string, filters: ScoutingFilters): Archetype; update(id: string, filters: ScoutingFilters): void; rename(id: string, name: string): void; remove(id: string): void }` — names stored trimmed; callers validate first.

**Definition of done:**

- Provider follows `SquadPlanProvider` exactly: initial read sets state unless a change happened first (`changes` counter ref); saves in an effect gated on `isLoaded`; a failed save shows an error toast titled `"Archetypes Not Saved"` with description `"Your archetypes could not be saved."`; `useOnTabReturn` re-reads when loaded and applies only if `changes.current` did not move during the read, keeping the current array when the stored one is JSON-equal.
- `ImportView`'s *New save* branch is unchanged — archetypes survive it.
- Lists still get ids exactly as before.

**Verify:** `npx tsc -b && npx eslint .` → clean (rung 1; behaviour is covered by Task 3's durable test).

- [ ] **Step 1: Storage, ids, validation** — settings accessors, `generateId`, `validateArchetypeName`.
- [ ] **Step 2: Provider and mount.**
- [ ] **Step 3: Verify and commit** — `git commit -m "archetype storage and provider"`

---

### Task 3: Archetype picker in scouting

**Files:**

- Create: `src/components/ArchetypePicker.tsx`
- Create: `src/components/ui/name-dialog.tsx`
- Modify: `src/views/ScoutingView.tsx` — active archetype state, role-tab handler, picker in the role-tab row (after the side selector, pushed right with `ml="auto"`)
- Modify: `browser-tests/helpers/seed.ts` — add `seedLeagueRankings(page, leagues: string[])`: clears `leagueRankings` and puts `{ rank: i + 1, league }` per entry, same pattern as `seedSettings`
- Create: `browser-tests/archetypes.spec.ts`
- Modify: `CLAUDE.md` — new `## Archetypes` section; in *Historic Snapshots → Import*, add that a *New save* keeps archetypes
- Modify: `docs/superpowers/specs/2026-11-08-archetypes-design.md` — *Picker (`SearchableSelect`-style)* → *Picker (a menu)*

**Interfaces:**

- Consumes: `useArchetypes`, `validateArchetypeName` (Task 2); `sameFilters`, `ScoutingFilters`, `Archetype`, `loadWorkingState`/`saveWorkingState` (Task 1); `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`).
- Produces:
  - `NameDialog` props: `{ isOpen: boolean; title: string; initialValue: string; validate: (name: string) => string | null; onSubmit: (name: string) => void; onClose: () => void }`. Submit (button *Save* or Enter) runs `validate`; a message shows under the input and the dialog stays open; `null` → `onSubmit(trimmed)` then close.
  - `ArchetypePicker` props: `{ filters: ScoutingFilters; activeId: string | null; onApply: (archetype: Archetype) => void; onActiveChange: (id: string | null) => void }`.

**Definition of done** (accessible names are what the test uses — keep them exact):

- Renders nothing until `isLoaded`. An `activeId` not among the archetypes renders as no archetype (and `ScoutingView` clears it once loaded).
- Trigger button: `"No archetype"` or the active archetype's name, opening a Chakra `Menu` of all archetypes grouped by role name (`ROLE_CONFIG[].name`), the group of `filters.roleKey` first, other groups in `ROLE_CONFIG` order. An empty list shows a disabled item `"No archetypes saved yet"`.
- No archetype active → button `"Save as archetype"` → `NameDialog` titled `"Save as archetype"` → `create` → `onActiveChange(newId)`.
- Active and `sameFilters(filters, active.filters)` → a menu button `"Archetype actions"` with *Rename* (`NameDialog`, `validate` with `exceptId`) and *Delete* (`ConfirmDialog`, title `"Delete archetype"`, message `` `Delete “${name}”? Your current filters stay as they are.` ``, option *Delete*; then `remove` and `onActiveChange(null)`).
- Active and not equal → text `"modified"` beside the name, and buttons `"Save"` (`update(activeId, filters)`), `"Save as new"` (`NameDialog`; `create`; the new one becomes active; the original unchanged), `"Revert"` (`onApply(active)`).
- Choosing an archetype from the menu while modified → `ConfirmDialog` title `"Discard changes?"`, message `` `Your changes to “${name}” are not saved.` ``, option *Discard*; confirm → `onApply`. Unmodified or no archetype → `onApply` immediately. Choosing the active one while unmodified does nothing.
- `ScoutingView.onApply(a)`: sets every field from `a.filters` (role tab and side included — side set after role, not reset by it), sets active id to `a.id`, resets to page 1.
- Clicking a role tab: as today (side → `"both"`) and active id → `null`. Side buttons do not touch the active id. *Clear filters* does not touch the active id.
- The active id survives a reload (it is in `saveWorkingState`).
- `CLAUDE.md` section states: storage key and accessors; survives *New save*; `ArchetypeProvider` pattern (isLoaded gate, change counter, tab-return re-read); modified is derived, never stored; switching role tab leaves the archetype; contract presets resolved against the active snapshot.

**Verify:** `npx playwright test browser-tests/archetypes.spec.ts` → passes; then mutation check (Step 3). Look and feel: `verify: human-eyes` (checklist item 2).

- [ ] **Step 1: Failing durable test** — `browser-tests/archetypes.spec.ts`, one test:
  1. `/import`, then `seedPlayersAndCompareList(page, [{uid:1,name:'Alice Striker'},{uid:2,name:'Bob Striker'}], [])` and `seedLeagueRankings(page, ['Premier League'])` (the seeded players' division), reload, go to `/scouting`, click the `"Striker"` role tab.
  2. Set a min threshold on one stat column through its filter popover (e.g. `50`). Click `"Save as archetype"`, name it `"Poacher"`, save. Trigger shows `"Poacher"`, no `"modified"`.
  3. Change that threshold to `70` → `"modified"` visible. Click `"Revert"` → `"modified"` gone, the popover shows `50` again.
  4. Reload → trigger still `"Poacher"`.
  5. Click the `"Winger"` tab → trigger shows `"No archetype"`. Open the picker, choose `"Poacher"` → `"Striker"` tab is selected again and the threshold is `50`.
- [ ] **Step 2: Implement** `NameDialog`, `ArchetypePicker`, `ScoutingView` wiring, seed helper, `CLAUDE.md`, spec wording — until the test passes.
- [ ] **Step 3: Mutation check** (use the `mutation-testing` skill). Each mutation must make the test fail; revert after each:
  - `Revert` calls nothing.
  - `onApply` does not set the role.
  - `sameFilters` always returns `true`.
  - The role-tab handler does not clear the active id.
  - `saveWorkingState` omits `activeArchetypeId`.
  If one survives, strengthen the test, not the mutation list.
- [ ] **Step 4: Verify and commit** — `npx tsc -b && npx eslint . && npx playwright test` → all pass; `git commit -m "archetype picker in scouting"`

---

## Human verification checklist (at finish)

Start the dev server yourself (`npm run dev`) with real imported data.

1. **Contract presets** — `/scouting`, any role. Set *Within a year*: every listed player's contract ends within a year of the active snapshot's date; *By end of season* ends by 30 June of the season. Switch to an undated snapshot (if you have one): the select is greyed out and the list is unfiltered by contract. Most likely wrong: off-by-one at the boundary date, or players without a contract leaking through.
2. **Picker** — save two archetypes on different roles, then: the menu groups them by role with the current role first; *modified* appears and disappears as you change a threshold and change it back; *Save as new* leaves the original untouched; picking another archetype while modified asks first; *Rename* to an existing name (different case) is refused with the message; *Delete* keeps your filters. Most likely wrong: the toolbar row wrapping badly at narrow widths, or the *modified* state flickering while the column-filter debounce settles.
3. **Survives New save** — with archetypes saved, import a file as *New save*: archetypes are still in the picker.
