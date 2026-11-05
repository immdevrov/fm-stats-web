# Dynamic Formations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the planner's fixed formations with the game's tactic grid: position markers and player cards are dragged anywhere on it, and presets become starting templates.

**Architecture:** A plan stores 11 slots, each with a stable marker id and a grid `cell`; a slot's position is always derived from its cell (`cellPosition`). Presets are static starting lists of cells. Legacy plans (`formationId`) are converted on read in `getSquadPlan()`. Dragging uses `@dnd-kit/core` with one `DndContext` around the board; the move rules are pure functions in `src/utils/planner.ts` wrapped by the provider.

**Tech Stack:** React 19, Chakra UI 3, TypeScript (strict), IndexedDB via `idb`, `@dnd-kit/core`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-dynamic-formations-design.md` — read it before any task; this plan argues from it.

## Global Constraints

- The grid: rows `D`, `DM`, `M`, `AM`, `ST` (+ `GK`), columns 0–4 = `L`, `CL`, `C`, `CR`, `R`. Wide (col 0/4) cells: `D`→`D (L/R)`, `DM`→`WB (L/R)`, `M`→`M (L/R)`, `AM`→`AM (L/R)`, `ST`→not playable. Centre cols 1–3: `{row} (C)`. GK: single cell, `GK`, col 2.
- Always exactly 11 slots; at most one per cell; the GK marker never moves and nothing is dropped on the GK cell; wide ST cells are never drop targets.
- A slot's position is never stored. `slotId` is an opaque, stable marker id.
- No IndexedDB schema change, no `DB_VERSION` bump.
- Nothing derived from the machine clock (existing planner rule, unchanged).
- Code style: strict TS (`noUnusedLocals`, `noUnusedParameters`), functional components, no generic comments (only for genuinely non-obvious lines, one short line).
- Commit messages: one short lowercase line, no attribution, no `Co-Authored-By`, no mention of AI.
- Tests: behaviour only, Playwright (`browser-tests/`), no unit tests, no jsdom. Each kept test is mutation-checked (break the behaviour, watch it fail, restore).
- Never start the dev server manually; Playwright's `webServer` boots its own.
- Run the task's Verify command before every commit. `npm run build` (runs `tsc -b`) and `npm run lint` must pass at every commit.

**Human verification:** one checkpoint at finish — the user runs `npm run dev` and opens `/my-team/planner` with a club set. Look at: the 5-column board lines up like a pitch; empty rows are compact; dragging a marker shows dashed cell outlines with the hovered one highlighted; card grips are visible but unobtrusive; the toolbar shows the shape name plus the preset menu. Most likely to be wrong: column widths squeezing cards next to the candidate panel; drag overlay styling.

---

### Task 1: Grid model, presets as cells, legacy migration, provider API

Switches the data model without changing how the board looks much. After this task the board still renders row by row, but every slot has a cell and a derived position.

**Files:**

- Create: `src/formations/grid.ts`
- Modify: `src/formations/index.ts` (presets carry `cell`, merge 5-3-2 into 3-5-2, `FormationSlot` shape, `boardSlots`, `presetFor`)
- Modify: `src/types/planner.ts` (`PlannedSlot.cell`, drop `SquadPlan.formationId`)
- Modify: `src/services/db/settings.ts` (new-shape guard + legacy conversion)
- Modify: `src/contexts/SquadPlanContext.tsx` (`setFormation` → `applyPreset`)
- Modify: `src/components/planner/SquadPlanner.tsx`, `PlannerBoard.tsx`, `PlannerToolbar.tsx`, `MismatchDialog.tsx`, `PlannerCard.tsx`

**Interfaces:**

- Produces (`src/formations/grid.ts`):
  - `type GridRow = 'GK' | 'D' | 'DM' | 'M' | 'AM' | 'ST'`
  - `const OUTFIELD_ROWS: GridRow[] = ['D', 'DM', 'M', 'AM', 'ST']` (own goal outwards)
  - `interface Cell { row: GridRow; col: number }`
  - `const GK_CELL: Cell = { row: 'GK', col: 2 }`
  - `cellPosition(cell: Cell): PlayerPosition` — per the Global Constraints table
  - `isPlayableCell(cell: Cell): boolean` — false for `ST` col 0/4, for col outside 0–4, and for any `GK` cell other than col 2
  - `sameCell(a: Cell, b: Cell): boolean`
  - `cellKey(cell: Cell): string` → `` `${row}-${col}` `` (used as droppable ids later)
- Produces (`src/formations/index.ts`):
  - `interface FormationSlot { id: string; cell: Cell; position: PlayerPosition }`
  - `interface Preset { id: string; name: string; slots: Array<{ id: string; cell: Cell }> }`
  - `const PRESETS: Preset[]` — 7 presets: `4-4-2`, `4-4-1-1`, `4-2-3-1`, `4-1-4-1`, `4-3-3`, `3-5-2`, `3-4-3` (keep current slot ids)
  - `getPreset(id: string): Preset | undefined` — `'5-3-2'` resolves to the `3-5-2` preset (legacy alias)
  - `boardSlots(plan: SquadPlan): FormationSlot[]` — one per `plan.slots`, `position = cellPosition(cell)`
  - `shapeName(cells: Cell[]): string` — preset name if the cell set equals a preset's exactly (order-insensitive); else counts per `OUTFIELD_ROWS` with zero rows skipped, joined by `-`
- Produces (`src/types/planner.ts`): `PlannedSlot { slotId: string; cell: Cell; players: PlannedPlayer[] }`, `SquadPlan { horizon: HorizonPreset | null; slots: PlannedSlot[] }`
- Produces (context): `applyPreset(presetId: string): void` replaces `setFormation`. Same semantics: new empty plan from the preset, horizon kept.

**Cell mapping for presets** (centre columns: one → 2; two → 1, 3; three → 1, 2, 3):

- `back4`: `D-L` D/0, `D-C-1` D/1, `D-C-2` D/3, `D-R` D/4. `back3`: `D-C-1..3` D/1, D/2, D/3.
- `M-L` M/0, `M-R` M/4, `AM-L` AM/0, `AM-R` AM/4, `WB-L` DM/0, `WB-R` DM/4.
- `4-3-3`'s `ST-C` → ST/2 and its `AM-L`/`AM-R` → AM/0, AM/4. `3-4-3` the same for its front three.
- `3-5-2` (and legacy `5-3-2`): GK, D/1–3, WB DM/0 + DM/4, `M-C-1..3` M/1–3, `ST-C-1` ST/1, `ST-C-2` ST/3.

**Legacy conversion** in `getSquadPlan()`: a stored value with a string `formationId` and an array `slots` is legacy. Resolve the preset via `getPreset(formationId)`; unknown id → `null`. Build the new plan from the preset's slots in preset order: each takes `players` from the stored slot with the same `slotId` (empty if none); stored slots whose id the preset lacks are dropped. Horizon normalised exactly as today. A new-shape value is valid when `slots` is an array and every slot has `slotId` string, `cell` object with string `row` and number `col`, and `players` array; otherwise `null`.

**Definition of done:**

- No reference to `formationId`, `FORMATIONS`, `getFormation` or `setFormation` remains in `src/`.
- Legacy `{ formationId: '4-4-2', slots: [{ slotId: 'ST-C-1', players: [...] }] }` loads with the same players in the `ST (C)` slot; `browser-tests/planner-departures.spec.ts` passes unchanged.
- `PlannerBoard` groups `boardSlots(plan)` by `cell.row` (rows `ST` at top down to `GK` at the bottom, skipping empty rows) and sorts each row by `cell.col`. Same visual as today.
- Toolbar's formation select becomes a preset select; its displayed value is the preset id whose cells match (via `shapeName`/preset equality) or a disabled `Custom` option. Confirm-then-clear flow unchanged, now calling `applyPreset`. (Task 2 restyles this.)
- `MismatchDialog` lists open matching slots from `boardSlots(plan)`.
- `PlannerCard`'s "Also in …" tooltip names slots by `slotLabel` of the slot with that id, not by raw `slotId` (ids no longer describe positions once markers move). Duplicate labels are fine.
- Empty-board picker lists `PRESETS` and calls `applyPreset`.

**Verify:** `npm run build && npm run lint && npx playwright test browser-tests/planner-departures.spec.ts` → all pass

- [ ] **Step 1: Grid module and presets** — `grid.ts` and the reworked `formations/index.ts` per the interfaces above.
- [ ] **Step 2: Types, settings conversion, provider** — `PlannedSlot.cell`, drop `formationId`, legacy conversion in `getSquadPlan`, `applyPreset`.
- [ ] **Step 3: Consumers** — `SquadPlanner`, `PlannerBoard`, `PlannerToolbar`, `MismatchDialog`, `PlannerCard` tooltip.
- [ ] **Step 4: Verify and commit** — `git commit -m "planner slots live on grid cells"`

---

### Task 2: Grid board layout and toolbar shape name

**Files:**

- Modify: `src/components/planner/PlannerBoard.tsx`
- Modify: `src/components/planner/PlannerSlot.tsx` (only if needed for sizing)
- Modify: `src/components/planner/PlannerToolbar.tsx`
- Create: `src/components/planner/BoardCell.tsx` (empty cell; Task 3 makes it a drop target)

**Interfaces:**

- Consumes: `boardSlots`, `shapeName`, `PRESETS`, `cellPosition`, `isPlayableCell`, `cellKey`, `OUTFIELD_ROWS`, `GK_CELL`, `applyPreset` from Task 1.
- Produces: `BoardCell({ cell }: { cell: Cell })` — renders an empty cell with `aria-label={`Empty ${formatPositions([cellPosition(cell)])}`}` for playable cells (e.g. `Empty AM (L)`); renders an inert placeholder for unplayable cells. Task 3 adds droppable behaviour inside this component.

**Definition of done:**

- Board is a CSS grid with `gridTemplateColumns="repeat(5, minmax(0, 1fr))"`. Row order top to bottom: `ST`, `AM`, `M`, `DM`, `D`, then a GK row where only col 2 holds the GK slot.
- Every outfield row renders all 5 columns: a `PlannerSlot` where a slot sits, otherwise a `BoardCell`, so columns line up across rows.
- A row with no slot renders at a fixed compact height of `36px`; rows with slots size to content. Heights never depend on drag state.
- Toolbar shows `Shape: {shapeName(cells)}` as text, followed by a preset select with placeholder option `Apply preset…` (value `""`, always the displayed value) and one option per preset. Choosing a preset on a board with placements opens the existing confirm with title `Apply preset?`, message unchanged, option label `Apply {preset name}`; on an empty board it applies directly.
- Existing behaviour unchanged otherwise (horizon, cover count, missing count).

**Verify:** `npm run build && npm run lint && npx playwright test browser-tests/planner-departures.spec.ts` → all pass. Layout goes to the finish human-eyes checkpoint.

- [ ] **Step 1: Board grid and `BoardCell`**
- [ ] **Step 2: Toolbar shape name and preset select**
- [ ] **Step 3: Verify and commit** — `git commit -m "planner board on the tactic grid"`

---

### Task 3: Marker drag

**Files:**

- Modify: `browser-tests/helpers/seed.ts` — optional `position` on `seedSnapshots` players
- Modify: `package.json` / `package-lock.json` — `npm install @dnd-kit/core@^6.3.1`
- Modify: `src/utils/planner.ts` — `moveMarker`
- Modify: `src/contexts/SquadPlanContext.tsx` — expose `moveMarker`
- Modify: `src/components/planner/PlannerBoard.tsx` — `DndContext`, `DragOverlay`, drag-active state
- Modify: `src/components/planner/PlannerSlot.tsx` — header grip + slot as a cell drop target
- Modify: `src/components/planner/BoardCell.tsx` — droppable
- Create: `browser-tests/planner-drag.spec.ts`

**Interfaces:**

- Consumes: Task 1/2 names above.
- Produces:
  - `moveMarker(plan: SquadPlan, slotId: string, cell: Cell): SquadPlan` (pure, `src/utils/planner.ts`). Returns `plan` unchanged (same reference) when: the slot is the GK slot or doesn't exist, `cell` is not playable or is `GK`, or the slot already sits on `cell`. If another slot occupies `cell`, the two swap cells; otherwise the slot moves. Players never change.
  - Context: `moveMarker(slotId: string, cell: Cell): void` wrapping it in `update`.
  - Drag data contract (Task 4 extends it): draggable `data` is `{ kind: 'marker', slotId }`; cell droppable id is `cell:${cellKey(cell)}` with `data: { kind: 'cell', cell }`. Occupied cells are droppable too (the `PlannerSlot` registers the droppable for its own cell) so that a drop on them swaps.
  - Marker grip: a small button inside the slot header, `aria-label={`Move ${slotLabel(slot)} marker`}`, `cursor: grab`, `touchAction: none`. GK header has no grip.
  - `DndContext` uses `PointerSensor` with `activationConstraint: { distance: 6 }`. While a marker drag is active, every playable cell droppable shows a dashed `border.emphasized` outline and the one under the pointer (`isOver`) a `glaucous.500` outline. `DragOverlay` shows the slot label chip.

**Definition of done:**

- Seeded legacy 4-4-2 plan with player `Winger` (position `M (L)`) in slot `M-L`. Dragging the `Move M (L) marker` grip onto `Empty AM (L)`:
  - the slot header now reads `AM (L)` and `Winger` is still in it, now out of position: his card shows the mismatch text `not an AM (L)`;
  - toolbar reads `Shape: 4-3-1-2`;
  - after `page.reload()` both still hold.
- Dropping on an occupied cell swaps the two markers (covered by `moveMarker`'s contract; not separately tested).

**Verify:** `npm run build && npm run lint && npx playwright test browser-tests/planner-drag.spec.ts browser-tests/planner-departures.spec.ts` → all pass

- [ ] **Step 1: Failing test** — `planner-drag.spec.ts`, test `dragging a marker carries its stack to the new cell`. Seed with `seedSnapshots` / `seedSettings` from `browser-tests/helpers/seed.ts` (as `planner-departures.spec.ts` does): club `Test FC`, player uid 1 `Winger` at `Test FC` with `Position: [{ type: 'M', side: ['L'] }]` (`seedSnapshots` cannot set positions today — every player is `ST`; add an optional `position?: PlayerPositions` to its player entries, defaulting to the current `[{ type: 'ST' }]`), legacy plan `{ formationId: '4-4-2', horizon: null, slots: [{ slotId: 'M-L', players: [{ uid: 1, name: 'Winger', club: 'Test FC' }] }] }`. Drag with `page.mouse`: `down` on the grip's box centre, `move` a few px to activate, `move` to the target cell's centre with `{ steps: 10 }`, `up`. Assert as in Definition of done. Run it: it must fail (no grip yet).
- [ ] **Step 2: Install dnd-kit, implement `moveMarker` and the drag layer**
- [ ] **Step 3: Mutation-check** — make `moveMarker` return `plan` unchanged; the test must fail; restore. Make the provider not persist (skip `db.setSquadPlan`) — the reload assertion must fail; restore.
- [ ] **Step 4: Verify and commit** — `git commit -m "drag position markers on the planner grid"`

---

### Task 4: Card drag, docs

**Files:**

- Modify: `src/utils/planner.ts` — `moveCard`
- Modify: `src/contexts/SquadPlanContext.tsx` — expose `moveCard`
- Modify: `src/components/planner/PlannerBoard.tsx` — handle card drags in the same `onDragEnd`
- Modify: `src/components/planner/PlannerCard.tsx` — grip handle outside `Menu.Trigger`, card droppable
- Modify: `src/components/planner/PlannerSlot.tsx` / `CandidatePopover.tsx` — `Add` placeholder droppable
- Modify: `browser-tests/planner-drag.spec.ts`
- Modify: `CLAUDE.md` — *Squad Planner* section

**Interfaces:**

- Consumes: Task 3's `DndContext`, drag data contract, `PointerSensor` setup.
- Produces:
  - `moveCard(plan: SquadPlan, from: { slotId: string; uid: number }, to: { slotId: string; index: number | null }): SquadPlan` (pure). `index: null` = the slot's *Add* target. Rules, `p` = dragged player in slot `A` at `i`:
    - `to.slotId === A`: remove `p`, reinsert at `to.index` (or at the end when `null`). `index` refers to the target card's index before removal.
    - other slot `B`, `p` already in `B` → unchanged.
    - `B` length < `MAX_DEPTH` (3): remove from `A`, insert into `B` at `to.index` (end when `null`).
    - `B` full and `to.index !== null`: `q = B[to.index]`; if `q` already in `A` → unchanged; else `B[to.index] = p`, `A[i] = q`.
    - `B` full and `to.index === null` → unchanged.
    - Returns the same reference when nothing changes.
  - Context: `moveCard(from, to): void`.
  - Drag data: card draggable `{ kind: 'card', slotId, uid }`; card droppable id `card:${slotId}:${uid}` with `data: { kind: 'card', slotId, index }`; *Add* droppable id `add:${slotId}` with `data: { kind: 'add', slotId }`. Marker drags ignore card/add droppables and card drags ignore cell droppables (check `active.data.current.kind` against `over.data.current.kind` in `onDragEnd`).
  - Card grip: a button at the card's leading edge, outside `Menu.Trigger`, `aria-label={`Drag ${player?.Name ?? planned.name}`}`, `cursor: grab`, `touchAction: none`. Clicking the card body still opens the menu; dragging the grip never opens it. `isOver` on a card or *Add* target gets a `glaucous.500` outline. `DragOverlay` shows the player name.

**Definition of done:**

- New test `dropping a card on a full slot swaps the two players`: legacy 4-4-2 plan, slot `ST-C-1` holds `A1`, `A2`, `A3` (full), slot `ST-C-2` holds `B1`. Drag `Drag B1` onto the `A2` card. Then `ST-C-1` shows `A1`, `B1`, `A3` in that order and `ST-C-2` shows `A2`. Scope each assertion to its slot (give `PlannerSlot`'s root `role="group"` and `aria-label={`Slot ${slotLabel(slot)} ${n}`}` only if no other stable scope exists — two `ST (C)` slots share a label, so index-based `.nth()` on a slot-root locator is acceptable).
- Both tests in `planner-drag.spec.ts` pass; `planner-departures.spec.ts` passes.
- `CLAUDE.md` *Squad Planner*: replace the **Formations** bullet with the grid (rows, columns, wide-cell positions, no wide ST, GK fixed, position derived from cell, `src/formations/grid.ts`); presets are templates in `src/formations/index.ts`, 3-5-2/5-3-2 merged, `shapeName`; replace **Formation switch clears the board** with *Applying a preset clears the board, after a confirm raised by the toolbar (`applyPreset` does not ask)*, keeping the existing rationale sentence about named plans; add the two drags and their rules in one bullet each, pointing at `moveMarker`/`moveCard` in `src/utils/planner.ts`; add **Legacy plans** — `getSquadPlan()` converts `formationId` plans on read. Also fix the *Storage* bullet if it mentions `formationId`.

**Verify:** `npm run build && npm run lint && npx playwright test browser-tests/planner-drag.spec.ts browser-tests/planner-departures.spec.ts` → all pass

- [ ] **Step 1: Failing test** — add the swap test; run, must fail.
- [ ] **Step 2: Implement `moveCard`, grip, droppables**
- [ ] **Step 3: Mutation-check** — replace the full-slot swap branch with `return plan`; the swap test must fail; restore.
- [ ] **Step 4: CLAUDE.md**
- [ ] **Step 5: Verify and commit** — `git commit -m "drag player cards between planner slots"`
