# Dynamic formations

## Problem

The planner offers eight fixed shapes. Any shape outside them — a diamond, a
4-3-1-2, a back three with inverted wing-backs — cannot be planned at all, and
adding presets one by one never catches up with what the game allows. In the
game you start from a preset and then drag position markers anywhere on the
tactic grid; the marker's cell decides its position. The planner should work
the same way.

Two drags, both in scope:

1. **Marker drag** — move a position marker to another grid cell. Its depth
   stack travels with it.
2. **Card drag** — move a player card between slots, or re-rank it within one.

## The grid

A goalkeeper cell plus 5 rows × 5 columns. Rows, from own goal outwards:
`D`, `DM`, `M`, `AM`, `ST`. Columns: `L`, `CL`, `C`, `CR`, `R` (0–4).

Every cell resolves to exactly one `PlayerPosition`:

| row | col L / R | cols CL / C / CR |
|-----|-----------|------------------|
| D   | `D (L)` / `D (R)` | `D (C)` |
| DM  | `WB (L)` / `WB (R)` | `DM (C)` |
| M   | `M (L)` / `M (R)` | `M (C)` |
| AM  | `AM (L)` / `AM (R)` | `AM (C)` |
| ST  | not playable | `ST (C)` |
| GK  | — | the single `GK` cell |

This is the game's own grid: wing-backs sit on the wide DM cells, full-backs
on the wide D cells, and there are no wide striker cells. Because the
position is derived from the cell, strict matching (`matchesSlot`) keeps
working unchanged and a full-back on a wide DM cell is out of position, as in
the game.

Lives in `src/formations/grid.ts`: `GridRow`, `Cell = { row, col }`,
`cellPosition(cell)`, `isPlayableCell(cell)`, `sameCell(a, b)`.

## Data model

```ts
interface PlannedSlot {
  slotId: string;    // stable marker id; opaque, never re-derived from the cell
  cell: Cell;
  players: PlannedPlayer[];
}

interface SquadPlan {
  horizon: HorizonPreset | null;
  slots: PlannedSlot[];   // always 11, at most one per cell
}
```

`formationId` is gone. A slot's position is never stored — it is computed
from `cell` on render, which keeps the rule *nothing about a card is stored*.
`slotId` does not change when a marker moves, so the placement index,
*counted elsewhere*, *Remove missing* and `refreshSnapshots` are untouched.

`FormationSlot` becomes `{ id, cell, position }`, where `position` is
`cellPosition(cell)`. `boardSlots(plan)` builds them from a plan; every
component that took a `FormationSlot` keeps doing so.

### Rules

- Always exactly 11 markers; dragging moves markers, never adds or removes.
- At most one marker per cell.
- The GK marker cannot be dragged, and nothing can be dropped on the GK cell.
- Wide ST cells are not drop targets.

## Presets

`src/formations/index.ts` keeps the preset list, but each preset slot carries
a `cell` instead of a `row`. A preset is now only a starting list of 11 cells
with marker ids.

Centre columns map as: one player → `C`; two → `CL`, `CR`; three → `CL`,
`C`, `CR`.

On the grid, 3-5-2 and 5-3-2 resolve to the **same 11 cells** (three
centre-backs, wing-backs on the wide DM cells, three central midfielders, two
strikers) and the same slot ids. They merge into one preset, `3-5-2`. Legacy
plans of either id migrate to it.

Applying a preset to a board with players asks first and then clears the
board, exactly as switching formation does today. The provider's
`applyPreset` does not ask; the toolbar does.

### Shape name

The toolbar names the current shape. If its cells equal a preset's cells
exactly, it is that preset's name. Otherwise it is the marker count per row,
`D`-`DM`-`M`-`AM`-`ST`, empty rows skipped (four defenders, two DMs, three
AMs, one striker → `4-2-3-1`).

## Migration

No schema change and no version bump — `squadPlan` lives in the schemaless
`settings` store. `getSquadPlan()` recognises the old shape (`formationId` is
a string) and converts it: each stored `slotId` is looked up in that preset to
get its cell; slots whose id the preset does not know are dropped; preset
slots the stored plan lacks are added empty. The converted plan is returned
and written back on the next save. A value that is neither shape is `null`,
as today.

Every legacy slot keeps the same position it had, so no card changes its
out-of-position state on migration.

## Marker drag

- The handle is a grip on the slot's header label. The GK header has none.
- Dropping on an empty playable cell moves the marker there.
- Dropping on an occupied cell swaps the two markers' cells; both stacks
  travel with their markers.
- Dropping on its own cell, the GK cell or a wide ST cell does nothing.
- While a marker is dragged, every playable cell shows a dashed outline; the
  one under the pointer is highlighted.

## Card drag

- The handle is a grip at the card's leading edge, outside the card's
  `Menu.Trigger`, so a click still opens the menu and a drag never does.
- Drop targets: every card, and the *Add* placeholder at the foot of a slot
  that is not full.
- Rules, for a card `p` dragged from slot `A`, index `i`:
  - **onto a card in `A` at `j`** — `p` moves to index `j`.
  - **onto `A`'s *Add*** — `p` moves to the bottom.
  - **onto a card in `B` at `j`, `B` not full** — `p` leaves `A` and is
    inserted into `B` at `j`.
  - **onto a card `q` in `B` at `j`, `B` full** — swap: `p` takes `q`'s place
    in `B`, `q` takes `p`'s place in `A`.
  - **onto `B`'s *Add*** — `p` leaves `A` and is appended to `B`.
  - If `p` is already in `B`, or in a swap `q` is already in `A`, nothing
    happens.
- No mismatch dialog on drop. An out-of-position card shows it on render, as
  it already does.

## Board layout

A CSS grid of 5 equal columns. Rows top to bottom: `ST`, `AM`, `M`, `DM`, `D`,
then the GK cell centred. Columns line up on every row, so the board reads
like the pitch.

Rows holding no marker render at a fixed compact height in both states. They
do not grow when a drag starts: a layout shift under the pointer moves the
drop targets mid-drag.

## Library

`@dnd-kit/core` — pointer sensor with a small activation distance, a
`DragOverlay` for the dragged marker or card, `useDraggable`/`useDroppable`
per handle and target. One `DndContext` around the board handles both drag
kinds, told apart by the draggable's `data`. Native HTML5 drag-and-drop was
rejected: no touch, poor drag image, awkward hover feedback for two drag
kinds on one board.

## Provider API

`setFormation` is replaced by:

- `applyPreset(presetId)` — new empty plan from that preset, horizon kept.
- `moveMarker(slotId, cell)` — move or swap, by the rules above.
- `moveCard(from: { slotId, uid }, to: { slotId, index: number | null })` —
  `index: null` means the *Add* target.

The move logic is pure functions in `src/utils/planner.ts`, and the provider
wraps them in `update`.

## Testing

Behaviour only, Playwright, mutation-checked:

- `planner-departures.spec.ts` already seeds a legacy `formationId: '4-4-2'`
  plan; it keeps passing only if migration works.
- New `planner-drag.spec.ts`:
  - dragging a marker carries its stack to the new cell — the label becomes
    the new position, the shape name changes, and both survive a reload;
  - dropping a card on a card in a full slot swaps the two.

## Docs

`CLAUDE.md` *Squad Planner*: replace *Formations* and *Formation switch
clears the board* with the grid, presets-as-templates, the two drags, and the
migration.
