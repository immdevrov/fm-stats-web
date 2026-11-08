# Stat Groups Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the double-counting and mislabelled stats in the stat categories and group ratings, explain each group in its header tooltip, and delete saved briefs the change breaks.

**Architecture:** The stat model (`stat-categories.ts` → role classes → `ROLE_CONFIG` / group mapping → labels → profile and compare views) changes as one compile-together step. Tooltips extend `StatGroup` with a description and one helper renders it. The brief cleanup is a one-time, versioned read-time filter in the db settings layer, reported by `BriefProvider` in a toast.

**Tech Stack:** React 19, TypeScript (strict), Chakra UI 3, IndexedDB via `idb`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-stat-groups-cleanup-design.md` — the source of truth for every table and string below; read it first.

## Global Constraints

- Filter and sort keys carry prefixes: `stat_<key>`, `derived_<key>`, `group_<key>`.
- New keys: `pressureRatio` (renamed from `pressuresSuccessful`; value `PresCPer90 / PresAPer90` rounded to 2 dp, 0 when attempted is 0 — the current computation), `pressuresAttempted` (`PresAPer90`).
- Labels / abbreviations: `pressureRatio` "Press Ratio" / "Pr%", `pressuresAttempted` "Pressures" / "PrA", `possessionWon` "Poss Won" / "PW", `possessionLost` "Poss Lost" / "PL". `GROUP_ABBREVIATIONS.crossing` = "Cro".
- The engine reads role stats by string key; a key in a group or `statKeys` with no matching field on the role instance scores 0 silently. Every key listed for a role must exist on its class.
- Current brief stats version: `2`. Unversioned = version 1.
- Code comments: default none (CLAUDE.md). Commit messages: one short line, no `Co-Authored-By`, no AI mention.
- No committed test for the brief cleanup; its throw-away test is deleted before Task 3's commit.
- `npx tsc -b`, `npm run lint` and `npm run test:browser` pass at the end.

**Human verification (at finish):** the user runs `npm run dev`. `/scouting`, *Central Defender* tab: hover the *Def* group header → **Defensive** — "Winning the ball back and stopping attacks." then "Tackle Ratio · Press Ratio · Pressures · Def. Contributions". Fullback tab: a *Cro* group column; *Mov* holds dribbles and sprints only. An outfield player's profile: no Retention row, a Pressures row, a Crossing section.

---

### Task 1: Stat model, groups and display

**Files:**

- Modify: `src/types/stat-categories.ts`, `src/roles/*.ts`, `src/roles/index.ts`, `src/utils/stat-group-mapping.ts`, `src/utils/scouting-columns.ts`, `src/views/PlayerProfileView.tsx`, `src/views/CompareView.tsx`, `src/processors/*.ts`, `CLAUDE.md`
- Any other file `tsc` flags for removed or renamed names.

**Interfaces:**

- Produces: `IDefensiveStats { tackles; tackleRatio; pressureRatio; pressuresAttempted; defensiveContributions }`, `IPossessionStats { possessionWon; possessionLost }`, `ICrossingStats { crossRatio; crossesSuccessful }` + `extractCrossingStats(player)`, `IMovementStats { dribbles; sprints }`. Removed: `IPhysicalStats`, `extractPhysicalStats`, `ballRetention`, `pressuresSuccessful`. `StatGroup` shape is unchanged in this task.

**Definition of done:**

- `stat-categories.ts`: ERRORS block gone; the user's `chancesCreated` doc comment ("chances created - more reliable metric then key passes, but still inflated by offsides") kept as written and committed here; `pressureRatio` documented as completed ÷ attempted; `STAT_MAPPING` matches (adds `pressuresAttempted: "PresAPer90"`, a Crossing heading, no Physical, no `ballRetention` note).
- Role classes: no `height`, no `ballRetention`. `pressureRatio` + `pressuresAttempted` on CD, FB, DM, CM, W, ST. `possessionWon` on every outfield class (add to W if missing). `possessionLost` stays on classes that have it today. Crossing fields stay on FB and W, now from `extractCrossingStats`.
- `ROLE_CONFIG.statKeys`: in CD, FB, DM, CM, `pressuresSuccessful` → `pressureRatio` followed by `pressuresAttempted`. `possessionWon` on CD, FB, DM, CM, AM, W, ST — after the role's defensive columns (`tackles`/`tackleRatio`/`pressureRatio`/`pressuresAttempted`/`defensiveContributions`), or last if it has none. DM: `possessionLost` right after `possessionWon`; `ballRetention` removed from DM and AM. `tackles` unchanged. ST keeps `goals`, `xGOverperformance`.
- Labels per Global Constraints; `pressuresSuccessful`, `ballRetention` removed from `STAT_LABELS` and `STAT_ABBREVIATIONS`; `GROUP_ABBREVIATIONS` drops `possession`, `physical`, adds `crossing`. `INVERTED_STATS` keeps `possessionLost`.
- `ROLE_STAT_GROUPS` exactly as the spec's table; Crossing (`key: "crossing"`, label "Crossing") right after Movement for FB and W; no `possession` or `physical` group.
- Profile and compare: Possession keeps Poss Won, Poss Lost, drops Retention; Defensive = Tackles, Tackle %, Press Ratio (`pressureRatio.toFixed(2)`), Pressures (`pressuresAttempted.toFixed(2)`), Def. Contrib.; Movement = Dribbles, Sprints; new Crossing section = Cross %, Crosses.
- Processors: `pressuresSuccessful` → `pressureRatio`; `ballRetention` dropped from archetype key lists; nothing else.
- `CLAUDE.md` Role System Details: category list reads Aerial, Possession, Passing, Defensive, Creative, Attacking, Movement, Crossing, Goalkeeper, Error (10).

**Verify:** `npx tsc -b && npm run lint` → clean; `npx playwright test` → existing suite passes. A test asserting a removed column is a real failure to report, not to edit silently.

- [ ] **Step 1: Interfaces and extractors**
- [ ] **Step 2: Follow the compiler** — role classes, config, labels, groups, views, processors.
- [ ] **Step 3: Verify and commit** — `git commit -m "stat groups: drop possession and physical, fix pressing, split crossing"`

### Task 2: Group tooltips

**Files:**

- Modify: `src/utils/stat-group-mapping.ts`, `src/components/ui/table.tsx`, `src/views/ScoutingView.tsx`, `src/utils/brief-rows.ts`, `src/components/BriefHeatTable.tsx`
- Create: `src/components/GroupTooltip.tsx`

**Interfaces:**

- Produces: `StatGroup.description: string`; `groupTooltip(group: StatGroup): ReactNode`; `Column.headerTooltip?: ReactNode`; `HeatKey.group?: StatGroup`.

**Definition of done:**

- Descriptions verbatim from the spec, in one map keyed by group key, applied to every group entry.
- `groupTooltip`: label in bold, " — ", description; next line the group's `statKeys` through `STAT_LABELS` (fallback: key) joined by " · ".
- Scouting group columns and brief-page group columns use it; stat and derived columns keep plain strings; heat cell `aria-label` keeps the plain label.

**Verify:** `npx tsc -b && npm run lint` → clean; `verify: human-eyes` (see header).

- [ ] **Step 1: Descriptions, helper, widen `headerTooltip`**
- [ ] **Step 2: Wire both tables**
- [ ] **Step 3: Verify and commit** — `git commit -m "explain stat groups in their header tooltips"`

### Task 3: Delete briefs broken by the stat change

**Files:**

- Modify: `src/utils/scouting-filters.ts`, `src/services/db/settings.ts`, `src/contexts/BriefContext.tsx`, `CLAUDE.md` (Briefs section)
- Throw-away: `browser-tests/brief-stats-cleanup.spec.ts`, deleted before commit.

**Interfaces:**

- Produces (`scouting-filters.ts`): `FILTERS_STATS_VERSION = 2`; `brokenByStatChange(filters: ScoutingFilters): boolean`.
- Changes: `db.getBriefs(): Promise<{ briefs: Brief[]; removed: string[] }>`; `db.setBriefs()` writes each entry with `statsVersion: 2`. `Brief` type unchanged.

**Definition of done:**

- `brokenByStatChange(f)`: true iff `f.sortKey` or a `columnFilters` key is in the spec's per-role table for `f.roleKey`.
- `getBriefs`: an entry without numeric `statsVersion >= 2` whose coerced filters are broken is left out and its name pushed to `removed`; it does not write.
- `BriefProvider` initial load, after the `loaded.current` guard, when `removed.length > 0`: `toaster.create({ id: "briefs-removed", title: "Briefs removed", description: \`Stat changes broke ${names}. Linked lists are kept.\`, type: "warning", duration: 8000 })`, names quoted and joined by ", ". Tab-return read uses `.briefs`, no toast. Existing save effect does the write-back.
- `saveWorkingState` writes `statsVersion: 2`. `loadWorkingState`: unversioned and broken → filters = defaults with the stored `roleKey` and `side`, `activeBriefId: null`.
- `CLAUDE.md` Briefs: one bullet — stored briefs and the working state carry `statsVersion`; unversioned ones broken by the 2026-11 stat change are deleted on read with a toast; a future breaking stat change bumps the version and adds its rule.

**Verify:** throw-away test passes, then `npx tsc -b && npm run lint && npm run test:browser`.

- [ ] **Step 1: Throw-away test** — seed via `browser-tests/helpers/seed.ts` plus a raw write of the `archetypes` settings key: two unversioned DM briefs linked to one list holding a seeded player — "Broken" with `columnFilters: { stat_ballRetention: { min: "50" } }`, "Fine" with `{ stat_tackleRatio: { min: "50" } }`. `/briefs`: "Fine" listed, "Broken" not, toast contains `"Broken"` and "Linked lists are kept". Check "Broken" absent with `getByRole('link', { name: 'Broken', exact: true })` (the toast also contains the name). Before reloading, `expect.poll` on `readSetting(page, 'archetypes')` until entries carry `statsVersion: 2`. Reload: no "Briefs removed" toast. `/lists`: the player still in the list. Also an unversioned working state — flat shape `{ ...filters, activeArchetypeId }` under `localStorage["scouting-filters"]` — with `roleKey: "CD"`, a `group_physical` filter and an `activeArchetypeId` → `/scouting` on the *Central Defender* tab, no filters, *No brief*. Run → fails.
- [ ] **Step 2: Implement**
- [ ] **Step 3: Verify, delete the test, commit** — `git commit -m "delete briefs broken by the stat group change"`
