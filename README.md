# FM Jotter

A scout's notepad for Football Manager 24. Import an RTF export from the game and FM Jotter parses, stores and analyses your players — ranking each one against his positional peers so you can tell, quickly, whether he's worth signing.

## What it does

- **Import** — reads RTF/HTML player exports straight from FM24 and persists them to IndexedDB.
- **Percentile analysis** — every stat is ranked against a cohort of players in the same role, in ranked leagues, with 5+ starts. Bars are colour-coded: red below 30, yellow 30–60, green above 60.
- **Scouting** — role-based scouting tables with filters for wage, contract expiry, injuries and league.
- **Compare** — put players side by side, and surface statistically similar players.
- **Archetypes** — badges awarded when a player clears the 60th percentile across every stat in an archetype.
- **Custom positions** — override a player's imported positions when the game's classification doesn't match how you'd use him.

Eight roles are supported: Goalkeeper, Central Defender, Fullback, Defensive Mid, Central Mid, Attacking Mid, Winger and Striker.

## Getting started

```bash
npm install
npm run dev      # Vite dev server with HMR
```

## Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # Type-check with tsc, then build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
npm run test:browser # Run Playwright browser tests
```

## Tech stack

React 19 · TypeScript · Vite (with React Compiler) · Chakra UI 3 · React Router 7 · IndexedDB via `idb`

## Architecture

See [CLAUDE.md](./CLAUDE.md) for a full breakdown of the data flow, role system, percentile engine and IndexedDB schema.
