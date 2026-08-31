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

- **Storage**: the club name in the `settings` store under key `myClub`, reached only through `db.getMyClub()` / `db.setMyClub()`. Living outside `players` means `clearAllPlayers()` cannot touch it, so the choice survives a re-import.
- **State**: `MyTeamProvider` (`src/contexts/MyTeamContext.tsx`), mounted in `Layout`. `useMyTeam()` returns `myClub`, `isLoaded`, `setMyClub`, `clearMyClub`. Every consumer that renders based on `myClub` (the "Set as My Team" control on a team profile, the `/my-team` squad branch) gates on `isLoaded` first, so it never shows a default "no club" state before the initial read resolves. A club the user sets or clears while that read is still in flight is never overwritten by it landing late.
- **Set from**: the `/my-team` picker, or "Set as My Team" on a team profile.
- **Squad table**: `SquadTable` (`src/components/SquadTable.tsx`) is shared by `/my-team` and `/teams/:teamName`; it takes only `players` and reads each row's own club from `Player.Club`.
- `/my-team`'s club picker also loads the full club list (`db.getAllPlayers()`) to populate its `SearchableSelect`. That load is independent of `MyTeamProvider`'s `isLoaded` and only blocks the picker branch, not a returning user's squad view.
- A club missing from the current import is kept, not cleared; the view says so.
