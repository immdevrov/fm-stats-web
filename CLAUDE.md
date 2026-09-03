# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FM Jotter is a web application for analyzing Football Manager 24 player statistics. Users import RTF files exported from the game, and the app parses, persists, and analyzes player data to help with transfer decisions.

## Architecture

### Data Flow
1. **Import** → User selects RTF file via ImportView
2. **Parse** → `parser/rtf-parser.ts` extracts pipe-delimited tables from RTF
3. **Transform** → Raw records become typed `Player` objects
4. **Persist** → `services/db.ts` (singleton) saves to IndexedDB
5. **Analyze** → Role classes apply filters and archetype calculations

### Key Patterns
- **Role-based classification**: Abstract `Role` class in `roles/_role.ts`, extended by position-specific classes (Striker, Goalkeeper, etc.)
- **Singleton service**: `DatabaseService` manages all IndexedDB operations
- **Path alias**: `@/*` maps to `./src/*`

### Role System Details
- **Stat Categories** (`stat-categories.ts`): 11 category interfaces (Aerial, Possession, Passing, Defensive, Creative, Attacking, Movement, Goalkeeper, Physical, Error) with `extract*Stats()` functions
- **Role Detection**: Each role has static `isRole(player)` checking `player.Position` array
- **Sub-role Pattern**: Some roles extend others (e.g., LeftFullback extends Fullback with side filtering)
- **Computed Stats**: Roles can derive stats (e.g., `saveRatioOverExpected = saveRatio - expectedSaveRatio`)
- **Archetype System**: Archetypes map names to stat key arrays; badges awarded when all stats hit 60th percentile

### Percentile Comparison System
- **Cohort Filtering**: Players compared must have same role, be in ranked leagues, and have 5+ starts
- **getPercentile()**: Standard formula `(countBelow + 0.5 * countEqual) / total * 100`
- **Display**: Horizontal bars with color coding (red < 30, yellow 30-60, green > 60)
- **ROLE_CONFIG**: Defined in `src/roles/index.ts` - maps roles to their display stat keys

### IndexedDB
- Batch writes use single transaction with `Promise.all()`
- Connection is lazy (opens on first access)

### HTML Parser
- Uses browser's native `DOMParser` (not regex/string manipulation)
- `createStringProcessor()` HOF for conditional field processing
- Special values (`-`, `N/A`) coerced to `null`
- Field-specific parsers: wage (currency stripping), height/weight (unit removal)

### Player Positions
GK (Goalkeeper), D (Defender), WB (Wing Back), DM (Defensive Midfielder), M (Midfielder), AM (Attacking Midfielder), ST (Striker) — with L/C/R side variations.

## Conventions

- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`)
- Interface prefix: `I` (e.g., `IRole`, `IStriker`)
- Private methods: underscore prefix in service classes
- Functional components only (no class components)
- **No generic code comments** - only add comments in complex/hard-to-understand places. User will ask for comments if needed.

## Component Patterns

- **State**: Basic React hooks, no external state management
- **Table Component**: Dual mode (controlled via `sortKey`/`onSortChange`, or uncontrolled via `defaultSortKey`); custom `render()` per column
- **Deferred State**: `useRef` for pending data while dialogs open (see ImportView)
- **Toaster**: `toaster.create({ title, description, type, duration })`

## Chakra UI 3 Theme

- Semantic tokens: `fg.default`, `fg.emphasized`, `fg.muted`, `bg.canvas`, `bg.subtle`, `bg.muted`
- Custom palettes: `carbonBlack`, `glaucous`, `thistle`, `spicyPaprika`, `softBlush`
- Dark mode via `_dark` variants in semantic tokens

## Scouting View

Route: `/scouting` — role-based player scouting with percentile analysis.

### Architecture
- **`src/utils/stat-group-mapping.ts`**: Maps each role to stat groups (e.g. defensive, aerial, passing). `getStatGroupsForRole(roleKey)` returns `StatGroup[]`.
- **`src/utils/scouting-engine.ts`**: `buildScoutingCohort()` filters players (role match + ranked league + 5+ starts). `computeScoutingData()` computes per-stat percentiles and group ratings (sum of adjusted percentiles ranked as a percentile).
- **`src/views/ScoutingView.tsx`**: Role tabs, side selector (FB/W), filters (wage, contract, injuries, leagues), percentile table with color coding, pagination.

### Key Design Decisions
- Percentiles computed on full cohort BEFORE filters. Filters only hide rows.
- Group ratings: sum stat percentiles (inverted for INVERTED_STATS) → rank sum as percentile across cohort.
- Side selector (FB/W) changes the cohort class (LeftFullback, RightFullback, etc.) and recomputes percentiles.
- `useTransition` wraps cohort computation for responsive UI during role/side switches.

## Custom Positions

Users can override a player's imported positions from the Player Profile view.

- **Storage**: `customPosition` on the `playerAnnotations` record, merged onto `Player` by the database layer on read and stripped on write
- **Helper**: `getEffectivePosition(player)` returns `CustomPosition ?? Position` — used by all `isRole()` methods and position displays
- **UI**: Edit button (pencil icon) next to position in PlayerHeader opens a dialog with position type + side checkboxes. "Edited" badge shown when custom position is set. X button clears the override.
- **Clear options**: Per-player clear in profile view; "Clear All Custom Positions" button in Import view
- **DB methods**: `updatePlayerPosition()`, `clearPlayerCustomPosition()`, `clearAllCustomPositions()`

## My Team

The user nominates one club as their own. Route: `/my-team`.

- **Storage**: the club name in the `settings` store under key `myClub`, reached only through `db.getMyClub()` / `db.setMyClub()`. Living outside the snapshot stores means `clearAllSnapshots()` cannot touch it, so the choice survives a *Same save* re-import; a *New save* import clears it explicitly.
- **State**: `MyTeamProvider` (`src/contexts/MyTeamContext.tsx`), mounted in `Layout`. `useMyTeam()` returns `myClub`, `isLoaded`, `setMyClub`, `clearMyClub`. Every consumer that renders based on `myClub` (the "Set as My Team" control on a team profile, the `/my-team` squad branch) gates on `isLoaded` first, so it never shows a default "no club" state before the initial read resolves. A club the user sets or clears while that read is still in flight is never overwritten by it landing late.
- **Set from**: the `/my-team` picker, or "Set as My Team" on a team profile.
- **Tabs**: `MyTeamView` is a shell. It owns the club gate — loading, no club, club absent from the current import — in one place and renders either `SquadTable` (`/my-team`) or `SquadPlanner` (`/my-team/planner`), each handed a club known to exist. The two tabs are two routes so a reload and a bookmark land where the user left off.
- **Squad table**: `SquadTable` (`src/components/SquadTable.tsx`) is shared by `/my-team` and `/teams/:teamName`; it takes only `players` and reads each row's own club from `Player.Club`.
- `/my-team`'s club picker also loads the full club list (`useRoster()`) to populate its `SearchableSelect`. That load is independent of `MyTeamProvider`'s `isLoaded` and only blocks the picker branch, not a returning user's squad view.
- A club missing from the current import is kept, not cleared; the view says so.

## Squad Planner

Route: `/my-team/planner`, the second tab of `/my-team`. Lays the squad and the
shortlist onto a formation as one ranked depth stack per slot.

- **Storage**: one `SquadPlan` value in the `settings` store under key `squadPlan`, reached through `db.getSquadPlan()` / `db.setSquadPlan()`. No schema change of its own — it reuses the existing `settings` store, so the version bump to 6 was historic snapshots' doing, not the planner's — and a *Same save* re-import cannot touch it, so the board survives one; a *New save* import clears it explicitly.
- **Settings module**: `src/services/db/settings.ts` keeps a private untyped `_get`/`_set` pair and composes the typed accessors over it, so a third setting adds a pair of one-liners rather than another two `try`/`catch` blocks.
- **State**: `SquadPlanProvider` (`src/contexts/SquadPlanContext.tsx`), mounted in `Layout` inside `MyTeamProvider`. `useSquadPlan()` returns the plan, `isLoaded`, a memoised `placements` index, and the mutators. Gate on `isLoaded` before rendering: without it the formation picker flashes before a saved plan arrives, and a plan created in that frame would be overwritten by the read landing late.
- **Formations**: static data in `src/formations/index.ts`, never persisted — the plan stores only `formationId`. Slots carry a `row` (0 = goalkeeper, increasing towards the attack) rather than pitch coordinates, and are ordered left to right within a row. Eight shapes; a ninth is a data edit.
- **Matching is strict** (`matchesSlot` in `src/utils/planner.ts`): no `D`/`WB`, `M`/`DM` or left/right equivalence. The one allowance is a missing `side` on either side of the comparison, because the export writes `DM` with no side. A full-back in a `WB` slot is therefore out of position, which is what the game does too.
- **Nothing about a card is stored.** Out of position, unwanted, listed, injury-prone, contract and counted-elsewhere are all derived on render from the plan, the player record and the annotations.
- **No statistics.** The planner computes nothing — it links through to the player profile instead. Its first choices are the seam the future team-statistics screen reads.
- **Contract horizon**: the toolbar's "Contracts as of" field is a preset (`now` / `end of season` / `in one year` / `in two years`), not a typed date, resolved against the active snapshot's date via `resolveHorizon()` in `src/utils/planner.ts`. A contract expiring on or before the resolved date turns paprika; no preset means no contract tint. Disabled when the active snapshot has no date. Nothing is derived from the machine's clock — only from the snapshot.
- **Formation switch clears the board**, after a confirm raised by the toolbar (the provider's `setFormation` does not ask). The plan is not keyed by formation id on purpose: two plans for the same shape is what named plans will need, so that key would already be wrong.
- **Two ways to leave.** A placed player is no longer in the squad if he is absent from the import entirely (retired, or outside its range) *or* if he is still in it at another club and on no list. The second case is exact rather than a guess: a player can only reach the board through the candidate picker, whose pool is the squad plus everything shortlisted, so at-another-club-and-unlisted means he was yours and left. Both keep their slot and rank, both dim, and both are counted in the toolbar with a "Remove missing" action; a shortlisted player at another club is a deliberate transfer target and is left alone. The departed also carry a marker naming their new club.
- **Orphans render from the `name`/`club` snapshot** stored on the placement, which is refreshed from the newest import — so the plan records where a player is now, not where he was when placed.

## Historic Snapshots

Every import is a dated snapshot of one save. Route: the switcher in the sidebar; management on `/import`.

- **Storage**: `snapshots` holds one metadata record per import; `playerSnapshots` holds `{ s, u, v }` rows keyed `[snapshotId, uid]` with a `by-uid` index. Values are packed — field names live once per snapshot in `Snapshot.fields`, which is why a stat added later does not corrupt older snapshots. Database version 6. The `players` object store entry stays in the `FmStatsDB` type on purpose: the v5→v6 migration still opens it to move existing rows into `playerSnapshots` before deleting it.
- **The migrated snapshot has contracts a month late.** `parseCustomDate` read `DD/MM/YYYY` with a 1-based month, so every `Expires` stored before the fix landed sits one month on. New imports are correct; the rows the v5→v6 migration carried over are not, and the original strings are gone, so the migrated “Imported data” snapshot and any fresh one disagree about the same contract. Re-importing that date is the only repair.
- **Ordering is always by `date`, never by import time.** `src/utils/snapshot-order.ts` is the only place that rule lives. Undated sorts oldest and is never "newest". Snapshots can be back-filled in any order.
- **State**: `SnapshotProvider` (`src/contexts/SnapshotContext.tsx`), outermost in `Layout`. `useSnapshots()` is metadata only and costs nothing; `useRoster()` triggers the lazy load. Only `/import` never calls it — every other view does when visited, including `CompareView` (its player picker needs the full roster). `CompareContext` itself does not: it validates its at-most-3 stored ids with `db.getPlayerHistory` — an index read plus two small whole-store reads, never a roster read — so mounting it in `Layout` costs `/import` nothing. One roster is in memory at a time.
- **Import** asks which save the file belongs to and what date it is, prefilled from a trailing `DD_MM_YYYY` in the filename. *New save* erases everything — snapshots, league rankings, lists/annotations, compare list, My Team club and squad plan, clearing both the stored values and the providers' live React state so nothing stale lingers in memory. *Same save* adds a snapshot and touches nothing else. If a snapshot already exists on that date the dialog asks which it should be — replace every snapshot on that date, or keep both — and refuses to import until answered; it never picks for you. Two snapshots may share a date; the `importedAt` tie-break orders them and *Rename* tells them apart. *Delete* is refused for the last remaining snapshot and says so on hover — clearing everything is what *New save* is for. Files missing required columns are refused by name before any write.
- **The compare list is pruned only on initial load**, and only of uids present in *no* snapshot — it reads history, not the active snapshot, so neither a snapshot switch nor a reload while viewing a historic one can drop an entry. A compared player missing from the active snapshot renders in his slot as a dimmed last-known name with a Remove button, the same treatment lists and the planner give.
- **A failed read is never shown as "no data".** `useRoster()` returns an `error` alongside the roster, and every one of the eight views that reads a roster renders `RosterErrorNotice` instead of an empty state — so a read failure never routes the user toward the destructive *New save* control. The error is keyed to the snapshot it belongs to, so switching away from a failed snapshot shows a spinner, not the old message.
- **Percentile cohorts never span snapshots.** Profile history shows raw per-90s; *Rank this row* loads that one snapshot's cohort on demand.
- **The planner writes back** a placed player's name and club only from the newest snapshot, so browsing 2033 does not persist 2033 clubs into the plan.
- **The planner horizon** is a preset (`now` / `end of season` / `in one year` / `in two years`) resolved against the active snapshot's date, never the machine clock. *Remove missing* is disabled off the newest snapshot, where it would offer to delete players who are present in the current squad.
