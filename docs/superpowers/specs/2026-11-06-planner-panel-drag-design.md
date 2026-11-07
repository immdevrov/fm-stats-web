# Squad Planner — drag from the side panel, position hint while dragging

Status: design agreed in chat (2026-11-06), not implemented. Bounded change — no plan document; implement directly (TDD, behaviour-only Playwright tests).

## Goals

1. Drag a player from the side panel (`CandidatePanel`, both the **Squad** and **Lists** tabs) onto the board.
2. While dragging any individual player — from the panel or an existing board card — show a subtle hint of which positions he can and cannot play, on both set slots (cells with a marker) and unset cells (empty playable cells).

## Current state (read these first)

- `src/components/planner/SquadPlanner.tsx` — renders `PlannerToolbar`, then `PlannerBoard` and `CandidatePanel` side by side.
- `src/components/planner/PlannerBoard.tsx` — owns the `DndContext` (PointerSensor, distance 6, `pointerWithin`), `onDragStart`/`onDragEnd`, announcements, the `DragOverlay` chip, and `DragKindContext.Provider`. Because the context lives here, the panel is outside it today.
- `src/components/planner/dragKind.ts` — `DragKind = "marker" | "card" | null`; droppables enable themselves only for the active kind.
- Droppables: `PlannerSlot` (`cell:` — marker only), `BoardCell` (`cell:` — marker only, empty playable cells), `PlannerCard` (`card:{slotId}:{uid}`, data `{ kind: "card", slotId, index }`), `CandidatePopover` *Add* placeholder (`add:{slotId}`, data `{ kind: "add", slotId }`).
- Draggables: marker grip in `PlannerSlot`; card grip in `PlannerCard` (data `{ kind: "card", slotId, uid, name }`).
- Rules live as pure functions in `src/utils/planner.ts`: `matchesSlot` (strict, see CLAUDE.md), `moveMarker`, `moveCard`. `MAX_DEPTH = 3` in `src/types/planner.ts`.
- `useSquadPlan()` exposes `place(slotId, PlannedPlayer)` (appends), `moveCard`, `moveMarker`, etc.
- `src/formations/grid.ts` — `cellPosition(cell)` gives the single position of any cell; `isPlayableCell`.
- Effective position: `PlannerCard` merges `annotations.get(uid)?.customPosition` onto the player before calling `describeMismatch`. Follow the same pattern for the hint so a live custom-position edit is reflected.
- Existing tests: `browser-tests/planner-drag.spec.ts` (reuse its helpers), `browser-tests/planner-departures.spec.ts`.

## Design

### 1. Lift the drag context

Extract the `DndContext`, its handlers, announcements, `DragOverlay` and the drag-context provider from `PlannerBoard` into a new `src/components/planner/PlannerDnd.tsx` wrapper. `SquadPlanner` wraps both `PlannerBoard` and `CandidatePanel` in it. `PlannerBoard` keeps only the grid.

### 2. Panel drag

- Each `CandidateRow` gets a grip (`LuGripVertical`, same styling as the card grip) at its leading edge. The name `Link` stays clickable.
- New drag kind `"candidate"`, draggable id `candidate:{uid}`, data `{ kind: "candidate", uid, name, club }`.
- Card and *Add* droppables enable for `card` **or** `candidate`. Marker-only droppables unchanged.
- New pure rule `placeCandidate(plan, player: PlannedPlayer, to: { slotId, index: number | null })` in `src/utils/planner.ts`, exposed as a mutator on `SquadPlanContext`:
  - already in the target slot → no change;
  - target has room → insert at `index` (*Add* = `null` = append);
  - target full and dropped on a card → **replace** that card; the displaced player leaves the board (he reappears in the panel's Squad "unplaced" list if he is in the squad);
  - target full and dropped on *Add* → no change.
- A listed player already placed elsewhere may still be dropped into another slot (same as the *Add* picker allows).
- No mismatch dialog on drop (same as card drag).
- Overlay chip and announcements show the player's name, as for cards.

### 3. Position hint while dragging a player

Applies to `card` and `candidate` drags only; marker drag look is unchanged.

- Extend the drag context to carry the dragged player's effective positions (roster player + annotation `customPosition`). Board cards for players absent from the import have no positions → no hint.
- **Set slots** (`PlannerSlot`): `matchesSlot` true → soft glaucous outline; false → slightly dimmed.
- **Unset cells** (`BoardCell`, playable only): if he matches `cellPosition(cell)` → faint dashed glaucous outline with the position name (`formatPositions([cellPosition(cell)])`); otherwise stay blank. Hint only — empty cells do not accept card/candidate drops.
- Same strict rule as the out-of-position flag: no `D`/`WB`, `M`/`DM`, or left/right equivalence; a missing side on either side matches.

Chosen look (agreed):

```
  ST        [ST C ]
  .  AM L  ┆AM C┆  .   AM R
     dim    glaucous      dim
  ┆M L┆  [M C] [M C]  ┆M R┆
  [D L]  [D C]  [D C]  [D R]
   dim    dim    dim    dim

 [ ] = slot with marker      ┆ ┆ = empty cell he can play
```

### 4. Tests (few, behaviour-only, mutation-check each)

In `browser-tests/planner-drag.spec.ts`:

1. Dragging a squad player from the panel onto a slot's *Add* places him there (and he leaves the Squad "unplaced" list).
2. Dropping a panel player onto a card in a full slot replaces that card; the displaced player is back in the panel.
3. During a player drag, a matching slot and a playable matching empty cell are marked, and a non-matching slot is not (expose state via a `data-` attribute or accessible label, not styles).

### 5. Docs

Update the **Squad Planner** section of `CLAUDE.md`: panel drag rules (`placeCandidate`, replace-on-full), the `candidate` drag kind, `PlannerDnd` owning the single `DndContext`, and the position hint.
