# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FM Jotter is a web application for analyzing Football Manager 24 player statistics. Users import RTF files exported from the game, and the app parses, persists, and analyzes player data to help with transfer decisions.

## Commands

```bash
npm run dev      # Start Vite dev server with HMR
npm run build    # Type-check with tsc, then build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Tech Stack

- React 19 with TypeScript
- Vite with React Compiler (auto-memoization)
- Chakra UI 3 with Emotion
- React Router DOM 7
- IndexedDB via `idb` library

## Architecture

### Data Flow
1. **Import** → User selects RTF file via ImportView
2. **Parse** → `parser/rtf-parser.ts` extracts pipe-delimited tables from RTF
3. **Transform** → Raw records become typed `Player` objects
4. **Persist** → `services/db.ts` (singleton) saves to IndexedDB
5. **Analyze** → Role classes apply filters and archetype calculations

### Directory Structure
- `src/components/` - React components; `ui/` contains Chakra primitives
- `src/views/` - Route-bound page components
- `src/services/db.ts` - IndexedDB singleton (database: `fm-stats-db`)
- `src/parser/` - RTF file parsing logic
- `src/roles/` - Player role classes extending abstract `Role` base class
- `src/types/` - TypeScript definitions (`Player`, `Table`, etc.)
- `src/fields/` - Parsers for positions and contract expiry
- `src/filters/` - Role-based filter functions
- `src/utils/` - Percentile, archetype, cohort calculations

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

### Available Roles
8 role classes in `src/roles/`:
| Role | Class | Position Detection |
|------|-------|-------------------|
| Goalkeeper | `GoalKeeper` | type = "GK" |
| Central Defender | `CentralDefender` | type = "D" + side includes "C" |
| Fullback | `Fullback` | type = "D" or "WB" + side includes "L" or "R" |
| Defensive Mid | `DefensiveMidfielder` | type = "DM" or (type = "M" + side includes "C") |
| Central Mid | `CentralMidfielder` | type = "DM" or (type = "M" + side includes "C") |
| Attacking Mid | `AttackingMidfielder` | type = "M" or "AM" + side includes "C" |
| Winger | `Winger` | type = "AM" or "M" + side includes "L" or "R" |
| Striker | `Striker` | type = "ST" |

### Percentile Comparison System
- **Cohort Filtering**: Players compared must have same role, be in ranked leagues, and have 5+ starts
- **getPercentile()**: Standard formula `(countBelow + 0.5 * countEqual) / total * 100`
- **Display**: Horizontal bars with color coding (red < 30, yellow 30-60, green > 60)
- **ROLE_CONFIG**: Defined in `src/roles/index.ts` - maps roles to their display stat keys

### IndexedDB Schema (v2)
- **players** store: keyPath `UID`, indexes: `by-name`, `by-club`, `by-position`
- **leagueRankings** store: keyPath `rank`
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

## Key Utilities

- `safeNumber()` — returns 0 for undefined/null/NaN
- `getPercentile()` — standard percentile calculation
- `sortIntoCohorts()` — splits into bottom/middle/top thirds
- `formatWage()` — EUR currency (de-DE locale)
- `formatPositions()` — "D(RC), WB(L)" format
- `parseCustomDate()` — parses "DD/MM/YYYY" format

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

- **Storage**: Optional `CustomPosition?: PlayerPositions` field on the `Player` type (no IDB schema change needed)
- **Helper**: `getEffectivePosition(player)` returns `CustomPosition ?? Position` — used by all `isRole()` methods and position displays
- **UI**: Edit button (pencil icon) next to position in PlayerHeader opens a dialog with position type + side checkboxes. "Edited" badge shown when custom position is set. X button clears the override.
- **Clear options**: Per-player clear in profile view; "Clear All Custom Positions" button in Import view
- **DB methods**: `updatePlayerPosition()`, `clearPlayerCustomPosition()`, `clearAllCustomPositions()`

## Type Utilities

- `KeyOfType<T, V>` — extracts keys where value is type V
- `Table<T>` — alias for `Array<T>`
