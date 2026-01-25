# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FM-Stats is a web application for analyzing Football Manager 24 player statistics. Users import RTF files exported from the game, and the app parses, persists, and analyzes player data to help with transfer decisions.

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

### Player Positions
GK (Goalkeeper), D (Defender), WB (Wing Back), DM (Defensive Midfielder), M (Midfielder), AM (Attacking Midfielder), ST (Striker) — with L/C/R side variations.

## Conventions

- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`)
- Interface prefix: `I` (e.g., `IRole`, `IStriker`)
- Private methods: underscore prefix in service classes
- Functional components only (no class components)
