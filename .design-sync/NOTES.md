# design-sync notes — FM Jotter

## Repo shape

- **This repo is an app, not a component library.** There is no `dist/` library build and no `.d.ts`
  tree; `package.json` is `private` with no `main`/`module`/`exports`. `dist/` is the Vite *app* build
  and must never be used as `--entry`.
- `src/ds-entry.ts` is a **committed, curated entry** written for design-sync. esbuild bundles it
  directly. The app's own build scripts are untouched — `tsc -b` type-checks the file, so keep it
  compiling.
- Build command (no `cfg.buildCmd`; there is nothing to pre-build):
  ```sh
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules ./node_modules --entry ./src/ds-entry.ts --out ./ds-bundle
  ```

## Gotchas that cost a debugging cycle

- **Discovery finds nothing on its own.** With no `.d.ts` tree the converter exits `[ZERO_MATCH]`.
  Every component is pinned explicitly in `cfg.componentSrcMap`. **To add a component you must do two
  things**: export it from `src/ds-entry.ts` *and* add its `componentSrcMap` entry. Doing only one is
  silent — an unexported pin renders blank, an unpinned export gets no card.
- **Never put a router in `cfg.provider`.** An earlier config chained `Provider → MemoryRouter`; React
  Router 7 then threw `You cannot render a <Router> inside another <Router>` for every preview that
  supplies its own router, and `Layout`/`Navigation` rendered empty. The provider is `Provider` alone;
  router-dependent previews wrap themselves.
- **Chakra collapses stacked toasts.** A story firing three toasts renders only the top one, so a
  "Stacked" story is indistinguishable from a single-toast one. Fire one toast per story.
- `LightMode`/`DarkMode` are `display: contents` — they have no box of their own. A preview must give
  the child an explicit background or the two modes look identical.
- `CompareProvider` (rendered inside `Layout`) opens IndexedDB on mount. This works in headless
  chromium; no stubbing needed.

## Preview techniques used here

- `SearchableSelect` and `PlayerAutocomplete` are closed until clicked, so their previews use an
  `OpenOnMount` helper that clicks the trigger (`ref.firstElementChild.firstElementChild`) in a
  `useEffect`. If the components' outer wrapper markup changes, that selector needs revisiting.
- `Tooltip` previews pass `open` + `portalled={false}` so the tooltip renders inside the card.
- `PlayerAutocomplete` fixtures are minimal `{UID, Name, Club, Position}` objects cast with
  `as never[]` — the real `Player` type has ~40 fields and esbuild does not type-check previews.

## Known render warns (expected — not new)

- `[CSS_RUNTIME] styles.css has no @imports` — correct. Chakra 3 is CSS-in-JS; the bundle is
  self-styling and `styles.css` is a stub.
- `[CSS_RUNTIME] _ds_bundle.css is the runtime-styles stub` — same cause.
- `tokens/` and `guidelines/` are empty directories by design.

## Scope decisions

- **Excluded:** `SimilarPlayers` — computes similarity over a cohort asynchronously and needs router
  + real player data; it cannot render statically.
- Bundle-only, no card: `Provider`, `ColorModeProvider`, and the re-exported router primitives
  (`MemoryRouter`, `Routes`, `Route`, `Link`, `NavLink`, `Outlet`).
- Card overrides: `PercentileBar`, `DarkMode`, `LightMode` → `cardMode: column` (wider than a grid
  cell). `ConfirmDialog`, `Toaster`, `Layout` → `cardMode: single` (overlay / full-shell).

## Environment

- Playwright: the repo pins `@playwright/test` 1.62.1 → chromium build **1234**, which matched the
  already-installed cache. No browser download was needed.
- Converter deps live in `.ds-sync/` (gitignored). esbuild's postinstall is blocked by
  `allow-scripts`, but esbuild resolves and runs fine anyway — the warning is not a problem.

## Re-sync risks

- **`src/ds-entry.ts` drifts silently.** Components added to `src/components/` will not appear until
  someone edits both the entry and `componentSrcMap`. Diff `ls src/components` against the map on
  every re-sync.
- **Hard-coded hexes in `conventions.md`** (`#6a7fdb`, `#f5f5f5`, `#0f0f0f`, …) are copied from
  `src/theme.ts`. If the palette changes, the header goes stale with no error. Re-verify against
  `theme.ts` when re-syncing.
- **`PlayerAutocomplete` fixtures** duplicate the shape of `Player`. If `formatPositions` or
  `getEffectivePosition` change their contract, the preview breaks at render, not at build.
- The `OpenOnMount` DOM-walk selector (see above) is coupled to component markup.
- Not verified: hover, focus and drag states; keyboard navigation in the dropdowns; the `filterRow`
  prop on `Table` (no story covers it).
- The app was renamed **FM Stats → FM Jotter** in this run. The IndexedDB name (`fm-stats-db`), the
  GitHub Pages base path (`/fm-stats-web/`) and the package name were deliberately left alone —
  changing them orphans user data and breaks the deployed site.

## Views and fixtures (added in the second pass)

The app's eight views are synced as components so designs can start from an existing panel.

- **Views take no props** — each loads from IndexedDB itself. `.design-sync/previews/_seed.tsx` is a
  shared harness that seeds the DB from `_fixtures.ts`, then mounts the view inside `Layout` + a
  `MemoryRouter` at the right path. It is **not** a component preview; `buildPreviews` only looks for
  `<ComponentName>.tsx`, so `_seed.tsx` and `_fixtures.ts` are import-only and safely ignored.
- **`_fixtures.ts` is generated, not hand-written.** Regenerate with:
  ```sh
  node .design-sync/gen-fixtures.mjs     # run from the repo root; writes .design-sync/previews/_fixtures.ts
  ```
  It uses a fixed LCG seed (`20260829`) deliberately — a non-deterministic fixture would clear every
  grade on every re-sync. **Do not change the seed casually.**
- 118 players across 6 ranked leagues, all with 5+ starts, spread over 10 position groups so each
  role has a real cohort for percentile maths.
- **Previews reference specific fixture UIDs**: `PlayerProfileView` uses `1105` (a striker),
  `CompareView` seeds compare list `[1001, 1002, 1003]` (goalkeepers, so they land on the default
  Goalkeeper tab), `TeamProfileView` uses club `Fiorentina` (the busiest club in the fixture set).
  **Regenerating with a different seed invalidates all three.** If you change the seed, re-derive
  those values before rebuilding.
- `Layout` supplies `CompareProvider`, so any view using `useCompare()` (ScoutingView, CompareView,
  PlayerProfileView) must be mounted through the harness, never bare.
- `SimilarPlayers` is still excluded as a standalone card, but it now renders for real inside
  `PlayerProfileView` — which is the honest way to show a component that needs its parent's data.

## Re-sync risks (second pass additions)

- The fixture squad is synthetic. Stat distributions are plausible but not drawn from real FM data,
  so percentile colours in the view cards are illustrative, not representative.
- `_seed.tsx` calls `db.clearAllPlayers()` before seeding. That is scoped to the headless preview
  browser, never a real user's data — but do not import that harness into app code.
- Adding a view means the same two-step rule as components: export it from `src/ds-entry.ts` **and**
  pin it in `componentSrcMap`.
