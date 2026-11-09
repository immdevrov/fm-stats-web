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
- **Stat Categories** (`stat-categories.ts`): 10 category interfaces (Aerial, Possession, Passing, Defensive, Creative, Attacking, Movement, Crossing, Goalkeeper, Error) with `extract*Stats()` functions
- **Role Detection**: Each role has static `isRole(player)` checking `player.Position` array
- **Sub-role Pattern**: Some roles extend others (e.g., LeftFullback extends Fullback with side filtering)
- **Computed Stats**: Roles can derive stats (e.g., `saveRatioOverExpected = saveRatio - expectedSaveRatio`)
- **Archetype System**: Archetypes map names to stat key arrays; badges awarded when all stats hit 60th percentile

### Percentile Comparison System
- **Cohort Filtering**: Players compared must have same role, be in ranked leagues, and have 900+ minutes
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
- **Page width**: the `Container` recipe is full-width and left-aligned (no gap after the sidebar). Data-heavy views fill the screen; narrow-content views cap with a v3 size token (`4xl`, `5xl`, `7xl`). v2's `container.lg`/`container.xl` don't exist in v3 and are silently ignored.

## Scouting View

Route: `/scouting` — role-based player scouting with percentile analysis.

### Architecture
- **`src/utils/stat-group-mapping.ts`**: Maps each role to stat groups (e.g. defensive, aerial, passing). `getStatGroupsForRole(roleKey)` returns `StatGroup[]`.
- **`src/utils/scouting-engine.ts`**: `buildScoutingCohort()` filters players (role match + ranked league + 900+ minutes). `computeScoutingData()` computes per-stat percentiles and group ratings (sum of adjusted percentiles ranked as a percentile).
- **`src/views/ScoutingView.tsx`**: Role tabs, side selector (FB/W), filters (wage, contract, injuries, leagues), percentile table with color coding, pagination.

### Key Design Decisions
- Percentiles computed on full cohort BEFORE filters. Filters only hide rows.
- Group ratings: sum stat percentiles (inverted for INVERTED_STATS) → rank sum as percentile across cohort.
- Side selector (FB/W) changes the cohort class (LeftFullback, RightFullback, etc.) and recomputes percentiles.
- `useTransition` wraps cohort computation, but it only defers the resulting *render* — the callback body runs synchronously on the main thread. It is not protection against a slow function.

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
- **State**: `SquadPlanProvider` (`src/contexts/SquadPlanContext.tsx`), mounted in `Layout` inside `MyTeamProvider`. `useSquadPlan()` returns the plan, `isLoaded`, a memoised `placements` index, and the mutators. Gate on `isLoaded` before rendering: without it the preset picker flashes before a saved plan arrives, and a plan created in that frame would be overwritten by the read landing late.
- **The grid**: a goalkeeper cell plus 5 rows × 5 columns (rows `D`, `DM`, `M`, `AM`, `ST` from own goal outwards; columns `L`, `CL`, `C`, `CR`, `R`), in `src/formations/grid.ts`. Every cell resolves to exactly one position, so a slot's position is derived from its cell and never stored: wide cells are `D (L/R)`, `WB (L/R)`, `M`/`AM (L/R)`; there is no wide `ST` cell; the GK cell is fixed. Slots carry a `cell`, not a row.
- **Presets are templates**: `src/formations/index.ts` lists starting sets of 11 cells with marker ids; the plan stores its own `slots` with their cells, not a formation id. 3-5-2 and 5-3-2 land on the same cells, so they are one preset, `3-5-2`. The toolbar names the current shape with `shapeName`: a preset's name when the cells match one exactly, otherwise the marker count per row (`4-2-3-1`).
- **Matching is strict** (`matchesSlot` in `src/utils/planner.ts`): no `D`/`WB`, `M`/`DM` or left/right equivalence. The one allowance is a missing `side` on either side of the comparison, because the export writes `DM` with no side. A full-back in a `WB` slot is therefore out of position, which is what the game does too.
- **Nothing about a card is stored.** Out of position, unwanted, listed, injury-prone, contract and counted-elsewhere are all derived on render from the plan, the player record and the annotations.
- **No statistics.** The planner computes nothing — it links through to the player profile instead. Its first choices are the seam the future team-statistics screen reads.
- **Contract horizon**: the toolbar's "Contracts as of" field is a preset (`now` / `end of season` / `in one year` / `in two years`), not a typed date, resolved against the active snapshot's date via `resolveHorizon()` in `src/utils/planner.ts`. A contract expiring on or before the resolved date turns paprika; no preset means no contract tint. Disabled when the active snapshot has no date. Nothing is derived from the machine's clock — only from the snapshot.
- **Applying a preset clears the board**, after a confirm raised by the toolbar (the provider's `applyPreset` does not ask). The plan is not keyed by formation id on purpose: two plans for the same shape is what named plans will need, so that key would already be wrong.
- **Marker drag**: a grip on the slot's header label (none on GK) moves the marker to a cell; an empty playable cell takes it, an occupied one swaps the two markers with their stacks, and its own cell, the GK cell or a wide ST cell does nothing. Rules in `moveMarker` in `src/utils/planner.ts`.
- **Card drag**: a grip at the card's leading edge, outside `Menu.Trigger`, drags a player onto a card or a slot's *Add* placeholder. Same slot reorders (*Add* = bottom); another slot with room inserts at the target index (*Add* = append); a full slot swaps with the target card; nothing happens if the player is already in the target slot, if the swapped-out player is already in the origin slot, or on *Add* of a full slot. No mismatch dialog on drop. Rules in `moveCard` in `src/utils/planner.ts`.
- **Panel drag**: a grip on each `CandidatePanel` row (Squad and Lists tabs) drags a `candidate` onto a card or *Add*. Room → insert at the target index (*Add* = append); a full slot → the target card is **replaced** and the displaced player leaves that slot (back in the Squad tab's unplaced list if he is in the squad and placed nowhere else); nothing happens if he is already in the target slot, or on *Add* of a full slot. Placed elsewhere is no bar, as in the *Add* picker. No mismatch dialog. Rules in `placeCandidate` in `src/utils/planner.ts`.
- **One `DndContext`**, owned by `PlannerDnd`, which `SquadPlanner` wraps round both the board and the panel. It provides `DragStateContext` (`dragKind.ts`): the drag kind (`marker` / `card` / `candidate`) and the dragged player's effective positions (roster + live annotation `customPosition`). Each droppable is disabled unless the active drag is its kind — card and *Add* take `card` or `candidate`, cells take `marker` only.
- **Position hint** while dragging a player (card or candidate; none for a player absent from the import): a slot he matches gets a soft glaucous outline, one he does not is dimmed; an empty playable cell he matches shows a faint dashed outline with its position name. Hint only — empty cells never accept a player. Same strict `matchesSlot` rule. Exposed as `data-hint="match" | "mismatch"` for tests.
- **Legacy plans**: `getSquadPlan()` converts a plan stored with a `formationId` on read, looking each slot id up in that preset for its cell and writing the result back as soon as the provider loads (the save effect fires when `isLoaded` flips).
- **Three ways to leave.** A placed player is no longer in the squad if he is absent from the import entirely (retired, or outside its range), if he is still in it at another club and on no list, or if he is marked *leaving* (see Transfer marks). The second case is exact rather than a guess: a player can only reach the board through the candidate picker or the side panel, both of whose pools are the squad plus everything shortlisted, so at-another-club-and-unlisted means he was yours and left. All keep their slot and rank, all dim, and all are counted in the toolbar with a "Remove missing" action; a shortlisted player at another club is a deliberate transfer target and is left alone. The departed carry a marker naming their new club, or "Marked as leaving".
- **Presence has one definition.** `presentUids` (`SquadPlanner`) is the marked squad plus everything listed and not marked leaving. The toolbar count, *Remove missing* and the card's departed marker all read it; the card never re-derives departure on its own.
- **Orphans render from the `name`/`club` snapshot** stored on the placement, which is refreshed from the newest import — so the plan records where a player is now, not where he was when placed.

## Historic Snapshots

Every import is a dated snapshot of one save. Route: the switcher in the sidebar; management on `/import`.

- **Storage**: `snapshots` holds one metadata record per import; `playerSnapshots` holds `{ s, u, v }` rows keyed `[snapshotId, uid]` with a `by-uid` index. Values are packed — field names live once per snapshot in `Snapshot.fields`, which is why a stat added later does not corrupt older snapshots. Database version 6. The `players` object store entry stays in the `FmStatsDB` type on purpose: the v5→v6 migration still opens it to move existing rows into `playerSnapshots` before deleting it.
- **The migrated snapshot has contracts a month late.** `parseCustomDate` read `DD/MM/YYYY` with a 1-based month, so every `Expires` stored before the fix landed sits one month on. New imports are correct; the rows the v5→v6 migration carried over are not, and the original strings are gone, so the migrated “Imported data” snapshot and any fresh one disagree about the same contract. Re-importing that date is the only repair.
- **Ordering is always by `date`, never by import time.** `src/utils/snapshot-order.ts` is the only place that rule lives. Undated sorts oldest and is never "newest". Snapshots can be back-filled in any order.
- **State**: `SnapshotProvider` (`src/contexts/SnapshotContext.tsx`), outermost in `Layout`. `useSnapshots()` is metadata only and costs nothing; `useRoster()` triggers the lazy load. `/import` and `/briefs` (the overview) never call it — every other view does when visited, including `CompareView` (its player picker needs the full roster). `CompareContext` itself does not: it validates its at-most-3 stored ids with `db.getPlayerHistory` — an index read plus two small whole-store reads, never a roster read — so mounting it in `Layout` costs `/import` nothing. One roster is in memory at a time.
- **Import** asks which save the file belongs to and what date it is, prefilled from a trailing `DD_MM_YYYY` in the filename. *New save* erases everything — snapshots, league rankings, lists/annotations, compare list, My Team club and squad plan (briefs are kept), clearing both the stored values and the providers' live React state so nothing stale lingers in memory. *Same save* adds a snapshot and touches nothing else. If a snapshot already exists on that date the dialog asks which it should be — replace every snapshot on that date, or keep both — and refuses to import until answered; it never picks for you. Two snapshots may share a date; the `importedAt` tie-break orders them and *Rename* tells them apart. *Delete* is refused for the last remaining snapshot and says so on hover — clearing everything is what *New save* is for. Files missing required columns are refused by name before any write.
- **The compare list is pruned only on initial load**, and only of uids present in *no* snapshot — it reads history, not the active snapshot, so neither a snapshot switch nor a reload while viewing a historic one can drop an entry. A compared player missing from the active snapshot renders in his slot as a dimmed last-known name with a Remove button, the same treatment lists and the planner give.
- **A failed read is never shown as "no data".** `useRoster()` returns an `error` alongside the roster, and every one of the nine views that reads a roster renders `RosterErrorNotice` instead of an empty state — so a read failure never routes the user toward the destructive *New save* control. The error is keyed to the snapshot it belongs to, so switching away from a failed snapshot shows a spinner, not the old message.
- **The same holds for settings.** `_get` in `src/services/db/settings.ts` rethrows a failed read. `MyTeamProvider`, `SquadPlanProvider` and `BriefProvider` then raise a toast and stay unloaded, so their save effects, which run only once loaded, can never write an empty value over the stored one. `/my-team` and the planner show `LoadErrorNotice` instead of spinning forever. Because an unloaded provider never saves, *New save* erases the club and the plan with direct writes in its erase block rather than relying on `clearMyClub()` / `clearPlan()`.
- **Percentile cohorts never span snapshots.** Profile history shows raw per-90s; *Rank this row* loads that one snapshot's cohort on demand.
- **The planner writes back** a placed player's name and club only from the newest snapshot, so browsing 2033 does not persist 2033 clubs into the plan.
- **The planner horizon** is a preset (`now` / `end of season` / `in one year` / `in two years`) resolved against the active snapshot's date, never the machine clock. *Remove missing* is disabled off the newest snapshot, where it would offer to delete players who are present in the current squad.

## Transfer marks

Agreed or planned moves the newest import does not show yet. Set from the status menu (*Mark as arriving* / *Mark as leaving*); listed on `/lists` as the **Arriving** and **Leaving** tabs.

- **Storage**: `transfer?: 'in' | 'out'` on the `playerAnnotations` record, via `db.setTransfer()`. No schema change.
- **One status at a time**: a player has at most one of unwanted, arriving, leaving. `setTransfer` clears `unwanted`; `setUnwanted(…, true)` clears `transfer`. Unlike unwanted, a mark leaves lists alone.
- **The marked squad**: `markedSquad()` in `src/utils/squad.ts` is the only definition — `(club − leaving) ∪ arriving-from-elsewhere`. `MyTeamView` computes it once and hands `squad` to the planner and `imported ∪ incoming` plus a `transfers` prop to `SquadTable`. `/teams/:teamName` never passes `transfers`, so a team profile always shows the import as it is.
- **Newest snapshot only**: off the newest, `/my-team` and the planner ignore marks. The badge and `/lists` show them everywhere.
- **Done is derived, never stored**: a mark is done when the newest snapshot already shows the move (`isTransferDone`). A done mark has no effect on the squad. Nothing is cleared on import; *Clear done* on `/lists` does it, and only on the newest snapshot. The badge does not show done — it would need the roster.

## Briefs

A named, saved scouting search. Chosen, saved and edited from the picker in the `/scouting` toolbar; read on `/briefs` and `/briefs/:briefId` (see Brief pages). Spec: `docs/superpowers/specs/2026-11-08-archetypes-design.md`.

- **Storage**: a `Brief[]` in the `settings` store under key `archetypes` (the identifier predates the rename), via `db.getBriefs()` / `db.setBriefs()`. No schema change. The read drops malformed entries one by one and runs each `filters` through `coerceFilters`.
- **Stats version**: stored briefs and the `scouting-filters` working state carry `statsVersion` (in storage only, not on `Brief`). An unversioned brief that filters or sorts on a key the 2026-11 stat-group change removed or redefined for its role is deleted on read (`brokenByStatChange` in `src/utils/scouting-filters.ts`), with a toast on the initial load; an unversioned working state broken the same way is reset, keeping role and side. Every write stamps the current version. The rule only fires below version 2, so a future change that breaks briefs bumps `FILTERS_STATS_VERSION` and adds its own rule for versions below the new one, leaving this one alone.
- **Survives *New save***: briefs describe the user's taste, not one save's data, so the New-save branch of the import never clears them.
- **State**: `BriefProvider` (`src/contexts/BriefContext.tsx`), mounted in `Layout`. Same pattern as `SquadPlanProvider`: gate on `isLoaded`, a change counter so a late read never overwrites a user change, a re-read on tab return.
- **One filter shape**: `ScoutingFilters` (`src/types/briefs.ts`); defaults, coercion, equality and the `localStorage` working state live in `src/utils/scouting-filters.ts`. Roles are stored by `ROLE_CONFIG` key, never by tab index.
- **Working state**: scouting keeps its live filters and the active brief id in `localStorage` (`scouting-filters`). *Modified* is derived on render with `sameFilters`, never stored.
- **Switching role tab or side leaves the brief** (the picker goes back to *No brief*, filters stay). **Clear filters leaves it too** — it means plain scouting, not an edit — and is shown whenever a brief is active, so it is always a way out. Threshold, contract, injury and league changes are edits (*modified*).
- **Contract filter is a preset** (`season` / `1y` / `2y`) resolved against the active snapshot's date with `resolveHorizon()`; disabled and not applied on an undated snapshot.
- The old hard-coded `calculateArchetypes` in `src/utils/utils.ts` is unused and kept as a reference for bringing badges back.
- **Fixed storage identifiers**: the `archetypes` key in the `settings` store, the `scouting-filters` localStorage key and the `activeArchetypeId` property inside it keep their pre-rename names so saved briefs and the active brief still load.

### Brief pages

Spec: `docs/superpowers/specs/2026-11-08-briefs-design.md`.

- **Two routes.** `/briefs` (`BriefsView`) lists briefs: name (links to the page), role, linked list, candidate count, a *Link list* button when unlinked. `/briefs/:briefId` (`BriefView`) shows the brief's criteria, *Open in scouting* (writes the working state, then navigates) and the heat table of its linked list.
- **The overview never calls `useRoster()`.** Its counts come from list lengths, so it costs nothing to open. `BriefView` does load the roster and league rankings, and shows an error notice rather than an empty table on a failed read.
- **One cohort rule.** `cohortExclusions()` in `src/utils/scouting-engine.ts` returns why a player is outside a cohort (`role` / `league` / `minutes`); `buildScoutingCohort` keeps players with none. The brief page's tags and the toast read the same function.
- **One ranking path.** `buildCohortRanking()` sorts a cohort once (empty cohort → `null`, so no percentiles anywhere); `rankPlayer()` scores one player against it. `computeScoutingData` and the brief page both go through them. An outsider is ranked against the cohort but never joined to it, so the cohort a percentile is measured on never changes.
- **Rows are the whole list, in rank order** (`orderedShortlist`), whatever the cohort says (`buildBriefRows`, `src/utils/brief-rows.ts`). Outsiders carry tags (*Not a Striker*, *Unranked league*, *N min*, *No stats*) and still get percentiles, except `Mins === 0`, which gets none. A uid missing from the snapshot renders dimmed from the annotation's last-known name/club; every row, absent or not, has the remove menu (*Remove from shortlist* / *Remove and mark unwanted*).
- **Picks**: `picks` on the brief, `{ uid, grade?, verdict? }[]`; array order is the rank. The helpers in `src/utils/brief-picks.ts` (`setGrade`, `setVerdict`, `moveTo`) all start from `orderedShortlist(picks, listUids)`, so the first write materialises the list order.
- **Pruning**: `BriefProvider` subscribes to `onListsChanged` (this tab's list mutations only, never a re-read) and filters `picks` to the linked list's uids. `setList` (id changed), `unlinkList` and `unlinkAll` drop picks explicitly.
- **Drag only in rank mode** (`#` ascending): the grip is rendered then and the cue reads *Drag rows to reorder.*; any other sort drops the grips and the cue offers *sort by rank*. A drop calls `movePick` with the target row's rank.
- **Two ways to remove**: *Remove from shortlist*, or *Remove and mark unwanted*; both prune the pick through the list change.
- **Column blocks**: identity (#, player, age, club, league, wage, contract, mins), then the stats the brief filters on (each with its threshold as a subheader), then group ratings, then the rest behind *All stats*.
- **Who beats whom** (checkbox beside *All stats*): hovering a row focuses him, clicking the row's empty area pins him (click again or Esc unpins, and a pin ignores hover). Hover and pin are ignored during a row drag, and an Esc meant for a menu or the verdict editor leaves the pin alone. Rows he beats are dimmed, rows that beat him get a glaucous tint and left edge (`data-dominance="beats" | "beaten-by"`). "Beats" = ≥ on every stat the brief filters on and > on at least one, compared on the row's heat values (inverted stats already flipped); wage, contract and group ratings never count. A row missing any of those values is never compared. Relative to the focused player only, so nothing is ever greyed for good. Rule in `dominance()` (`src/utils/dominance.ts`); view state only, never stored. Disabled when the brief filters on no stats.
- **Heat scale is continuous and brief-page only**: `heatBackground()` in `BriefHeatTable` mixes red below 50 and green above it in proportion to distance from 50. Scouting keeps its red/yellow/green bands.
- **Add-to-list toast** (`warnIfOutsideBriefs` in `PlayerStatusControl`, rules in `briefCohortWarning`): after a player is added to a list some brief links to, a warning toast names each such brief he is outside of and why. Silent when no league is ranked, when no brief links to the list, when the roster has not loaded, when he is inside every cohort, or when he is absent from the roster. Advisory — a failure inside it is swallowed and never blocks the add. The "rough guide" line is dropped whenever he has no stats (`Mins === 0`), since he is never ranked.

### Shortlist link

Step 2. Spec: `docs/superpowers/specs/2026-11-08-archetype-shortlists-design.md`.

- **Storage**: `listId?` on the brief — one list per brief, any number of briefs per list. `PlayerList` knows nothing of it.
- **Not a filter**: linking saves at once; *modified*, *Save* and *Revert* ignore it. *Save as new* copies it, but not the picks.
- **Missing list = no link**, and **unknown is not missing**: `linkedListOf()` (`src/utils/briefs.ts`) is the one definition — it returns nothing until notes have loaded, or at all on a notes load error.
- **Lifecycle**: deleting a linked list on `/lists` names its briefs in the confirm, then `unlinkList`; *Delete list* is disabled until briefs load. *New save* calls `unlinkAll` — the links go with the lists, the briefs stay.
- **Changes before the first read** are queued in `BriefProvider` and replayed onto the stored value, since `unlinkList`/`unlinkAll` are called from outside the picker. The load ignores a second read (StrictMode runs the effect twice).
- **`/scouting`**: the `…` menu has *Link list…* or *Change list…* / *Unlink*, in both the modified and unmodified states. With an active linked brief, each row gets a `ShortlistPin` (disabled for unwanted) and the brief control gets *Shortlist only*, beside the linked list's name — not in the filter row, because it belongs to the brief rather than to the search. View state owned by `ScoutingView`, narrowing the filtered rows; reset when the active brief or its list changes.
