# Brief Picks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/briefs/:briefId`, let the user rank the shortlist by drag, grade each player A/B/C, write a one-line verdict, and remove a player (optionally marking him unwanted). All of it stored per brief.

**Architecture:** `picks?: BriefPick[]` on `Brief` (array order = rank), saved with the briefs in the existing `settings` key. Pure helpers in `src/utils/brief-picks.ts` define the displayed order and every write. `BriefProvider` exposes the mutators and prunes picks when this tab's own list mutations take a player off a list, via a new `onListsChanged` subscription on `PlayerNotesContext`. `Table` gains row keys, a row component slot and an exported comparator so `BriefHeatTable` can host dnd-kit rows with controlled sorting.

**Tech Stack:** React 19, TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`), Chakra UI 3, `@dnd-kit/core` 6 (already installed; no `@dnd-kit/sortable`), IndexedDB via `idb`, Playwright (browser tests only).

**Spec:** `docs/superpowers/specs/2026-11-09-brief-picks-design.md`. Read it before any task; this plan argues from it.

## Global Constraints

- Read `CLAUDE.md` first, especially *Briefs*, *Brief pages* and *Shortlist link*. Functional components only; no generic code comments (one short line only where genuinely non-obvious).
- No schema change, no new dependency. Picks live under the existing `archetypes` settings key.
- Grades are exactly `"A" | "B" | "C"`; ungraded = no `grade` property (row value `null`).
- UI copy, verbatim:
  - column header `Grade`; grade buttons labelled `A`, `B`, `C`, `–` with aria-labels `Grade A`, `Grade B`, `Grade C`, `No grade`, and `aria-pressed` true on the current one (`–` pressed when ungraded)
  - verdict placeholder `Add verdict…`; the verdict button and input both have aria-label `Verdict for {name}`
  - remove control: icon button aria-label `Remove {name}`, menu items `Remove from shortlist` and `Remove and mark unwanted`
  - drag grip aria-label `Drag {name}`
  - cue lines: `Drag rows to reorder.` and `Sorted by {header} — sort by rank to reorder` (where `sort by rank` is a link-styled button that resets the sort to `#` ascending; `{header}` is the sorted column's `header`, e.g. `Age`, or `#` when sorted by `#` descending)
- Testing policy: few tests, behaviour-only, Playwright only (no unit tests, no jsdom, no Vitest). Every kept test is mutation-checked: break the behaviour it pins, watch it fail, restore. Temporary probes are fine but are deleted before the task's commit.
- Never start the dev server. Playwright boots its own (`npm run test:browser -- <file>`).
- Commit messages: one short lowercase line, no attribution trailers, no mention of AI.
- Before every commit: `npx tsc -b` and `npm run lint` clean, plus the task's Verify command.

**Human verification (at finish, non-blocking):** the user runs `npm run dev`, opens a brief with 3+ shortlisted players, and checks: grips and the *Drag rows to reorder.* line show when sorted by `#`; sorting by Age hides the grips and shows the *Sorted by Age* line, whose link restores rank order; dragging shows the dimmed row and the glaucous outline on the target; grade buttons and the verdict line read well in light and dark mode; *Add verdict…* only appears on row hover. Most likely wrong: the verdict line crowding the name/tags cell, or the outline being hard to see in dark mode.

---

### Task 1: Picks model, storage and provider mutators

**Files:**
- Modify: `src/types/briefs.ts` — add `Grade`, `BriefPick`, `picks?: BriefPick[]` on `Brief`
- Create: `src/utils/brief-picks.ts`
- Modify: `src/services/db/settings.ts` (`getBriefs`) — coerce `picks`
- Modify: `src/contexts/BriefContext.tsx` — new mutators; `setList`/`unlinkList`/`unlinkAll` drop picks

**Interfaces — Produces:**
- `type Grade = "A" | "B" | "C"`; `interface BriefPick { uid: number; grade?: Grade; verdict?: string }`
- `orderedShortlist(picks: BriefPick[] | undefined, listUids: number[]): BriefPick[]`: one entry per list uid. First the uids that have a pick, in pick order, carrying their grade/verdict; then the rest, in list order, as `{ uid }`. Non-members are dropped.
- `setGrade(picks, listUids, uid, grade: Grade | null): BriefPick[]`
- `setVerdict(picks, listUids, uid, text: string): BriefPick[]` — trims; empty after trim removes `verdict`
- `moveTo(picks, listUids, uid, toIndex: number): BriefPick[]` — removes `uid` from the ordered array and inserts it at `toIndex` (index into the ordered array before removal = the drop target's position, so dragging the 3rd row onto the 1st yields it at position 1; onto a lower row it lands at that row's position). No-op if `uid` is not a member.
- `prunePicks(picks, memberUids: number[]): BriefPick[] | undefined` — filters to members, keeps order; returns `undefined` when nothing changed, so callers can skip the write.
- All four write helpers start from `orderedShortlist` (the spec's "materialise first" rule) and never mutate their inputs.
- `useBriefs()` gains `setGrade(briefId, listUids, uid, grade | null)`, `setVerdict(briefId, listUids, uid, text)`, `movePick(briefId, listUids, uid, toIndex)`, each a `change(...)` wrapping the helper above.

**Definition of done:**
- `getBriefs()` keeps `picks` only if it is an array. It drops entries without a finite numeric `uid` and duplicate uids (the first wins). It drops a grade that is not `A`/`B`/`C`, and a verdict that is not a string or is blank after trimming (verdicts are stored trimmed). An entry left with only `uid` is kept. A brief with no valid entries gets no `picks` property.
- `setList(briefId, listId)` drops `picks` whenever the stored `listId` differs from the new one (including unlink to `null`); linking the same list id again leaves picks alone.
- `unlinkList(listId)` and `unlinkAll()` drop `picks` from every brief they unlink (`withoutList` drops both `listId` and `picks`).
- `update(id, filters)` keeps `picks` (it already spreads); `create(...)` never sets them, so *Save as new* starts empty (no change needed in `BriefPicker`).
- Example: list `[4, 2, 1]`, picks `undefined`. `setGrade(…, 1, "A")` → `[{uid:4},{uid:2},{uid:1,grade:"A"}]` (order unchanged). `moveTo(that, [4,2,1], 1, 0)` → uids `[1,4,2]`.

**Verify:** `npx tsc -b && npm run lint` clean. Then a scratch probe in the scratchpad (not the repo) runs the examples above plus: `prunePicks([{uid:1},{uid:2}],[2])` → `[{uid:2}]`; `prunePicks([{uid:2}],[2])` → `undefined`; `setVerdict(…, uid, "  ")` removes the verdict. Use `npx esbuild` (bundled with vite) to bundle a probe that imports `src/utils/brief-picks.ts`, and run it with `node`. Delete the probe. Durable coverage comes from Task 4/5's browser tests.

- [ ] **Step 1:** Types and `brief-picks.ts` helpers; run the scratch probe.
- [ ] **Step 2:** Coercion in `getBriefs()`; provider mutators and the picks-dropping link changes.
- [ ] **Step 3:** Verify, then commit `brief picks model and storage`.

---

### Task 2: Prune picks when this tab takes a player off a list

**Files:**
- Modify: `src/contexts/PlayerNotesContext.tsx`
- Modify: `src/contexts/BriefContext.tsx`

**Interfaces:**
- Consumes: `prunePicks` (Task 1).
- Produces, on `usePlayerNotes()`:
  - `setUnwanted(uid: number, unwanted: boolean, player?: PlayerIdentity): Promise<void>` — non-toggling; calls `db.setUnwanted`, then refreshes annotations and lists
  - `onListsChanged(listener: (lists: PlayerList[]) => void): () => void` — subscribe; returns unsubscribe. Listeners live in a ref (`Set`), so subscribing does not re-render.

**Definition of done:**
- `removeFromList`, `toggleUnwanted` and `setUnwanted` notify listeners with the freshly read lists after their write and refresh. To get those lists, `refreshLists` returns what it read. `refresh()` (the tab-return re-read), the initial load, `addToList`, `createList`, `renameList`, `deleteList` and `setPricing` do **not** notify. `deleteList` is covered by `unlinkList`, which `/lists` already calls.
- `BriefProvider` subscribes once (effect with a stable callback). On notify, it runs one `change(...)` that, for each brief whose `listId` is among the given lists, replaces `picks` with `prunePicks(picks, list.uids)` when that returns non-`undefined` (empty result → remove the property). Briefs whose list is not in the given lists are untouched. Once briefs have loaded, it calls `change` only if some brief's picks actually change (checked against a ref holding the latest `briefs`), so a no-op removal does not bump the change counter or trigger a save. Before they have loaded (`loaded.current` false), it always calls `change`, so the prune is queued in `pending` and replayed onto the stored value like any other change.
- No new effect watches `lists`. A tab return never writes briefs.

**Verify:** `npx tsc -b && npm run lint` clean, and `npm run test:browser -- brief-page.spec.ts brief-shortlist.spec.ts briefs.spec.ts transfer-marks.spec.ts` still passes (these exercise list and unwanted flows). The behaviour test lands in Task 4 (test 3).

- [ ] **Step 1:** `setUnwanted`, `onListsChanged` and notify calls in `PlayerNotesContext`.
- [ ] **Step 2:** The subscription in `BriefProvider`.
- [ ] **Step 3:** Verify, then commit `prune brief picks when a player leaves a list`.

---

### Task 3: Table — row keys, row component, exported comparator

**Files:**
- Modify: `src/components/ui/table.tsx`

**Interfaces — Produces:**
- `getRowKey?: (row: T) => React.Key` — body rows use it as `key` when given; otherwise `index` as today.
- `rowComponent?: React.ComponentType<TableRowProps<T>>`, where `export type TableRowProps<T> = React.ComponentProps<typeof ChakraTable.Row> & { row: T }`. When given, the body renders `<RowComponent row={row} {...allTheRowPropsItWouldHaveGot}>{cells}</RowComponent>` instead of `ChakraTable.Row`. The component is responsible for rendering a `ChakraTable.Row` and forwarding the props (and may add a `ref`).
- `export function sortRows<T>(data: T[], key: keyof T | undefined, direction: SortDirection): T[]` — the existing uncontrolled comparator moved out verbatim (nulls last, Date/boolean/number/string handling); returns a new array; no key → copy unchanged. Uncontrolled mode calls it.

**Definition of done:**
- No existing caller changes behaviour; all existing browser tests pass.
- The leading `// Internal state…` / `// Use controlled…` / `// Only sort…` comments may go while touching that code; add none.

**Verify:** `npx tsc -b && npm run lint && npm run test:browser` → the full suite passes (Table is shared by many views).

- [ ] **Step 1:** Implement the three additions.
- [ ] **Step 2:** Verify, then commit `table: row keys, row component, exported sort`.

---

### Task 4: Brief page — rank order, grade, verdict, remove

**Files:**
- Modify: `src/utils/brief-rows.ts` — `BriefRow` gains `grade: Grade | null` and `verdict: string | null`. `buildBriefRows` builds rows in `orderedShortlist(brief.picks, list.uids)` order, with `index` = 1-based position in it.
- Modify: `src/components/BriefHeatTable.tsx`
- Create (if it keeps `BriefHeatTable` readable): `src/components/BriefPickControls.tsx` for `GradeControl`, `VerdictLine` and `RemoveMenu`
- Test: `browser-tests/brief-page.spec.ts`

**Interfaces:**
- Consumes: `useBriefs().setGrade/setVerdict` (Task 1); `usePlayerNotes().setUnwanted`, `removeFromList` (Task 2 / existing); `getRowKey` (Task 3).
- Produces: `BriefRow.grade`, `BriefRow.verdict`; `BriefHeatTable` keyed by `uid` (`getRowKey={(r) => r.uid}`).

**Definition of done:**
- Column order: `#` · `Grade` · `Player` · then the existing columns unchanged. `Grade` has `firstSortDirection: "asc"`, so A comes first and ungraded (`null`) last.
- Grade control: four compact buttons as in Global Constraints. Clicking calls `setGrade(brief.id, list.uids, uid, grade | null)`. It works for absent (missing-from-snapshot) rows too.
- Verdict: a muted line under the name/tags row inside the Player cell. Showing: the verdict text as a button (aria-label `Verdict for {name}`). With no verdict, the button reads `Add verdict…`: hidden (opacity 0) unless the row is hovered or the button has focus, and always in the accessibility tree. Click → a one-line `Input` with the same aria-label, autofocused, prefilled. Enter or blur saves via `setVerdict`; Esc cancels without saving. Saving an empty value removes the verdict.
- Remove: the icon button (`Remove {name}`) opens a menu with the two items. *Remove from shortlist* → `removeFromList(list.id, uid)`. *Remove and mark unwanted* → `setUnwanted(uid, true, identity)`, where identity is `row.identity` (absent rows have it from the annotation's last-known name/club; pass `undefined` when missing). It replaces the old *Remove* button on absent rows. The existing test `brief-page.spec.ts` that clicks *Remove* on an absent row (if any) is updated to the menu.
- The existing first test's title says "in list order". Rename it to "in rank order"; it still passes because there are no picks.

**Tests (add to `browser-tests/brief-page.spec.ts`, reusing `seedDribblerBrief`):**
- **Test 2 — a grade and a verdict survive a reload:** list `[4, 2]`. On `/briefs/b1`, click `Grade B` in Bea's row. Click `Verdict for Bea Striker`, type `Quick but raw`, press Enter. Reload. Bea's row has `Grade B` with `aria-pressed="true"` and shows `Quick but raw`, and Dee's row has `No grade` pressed. Mutation check: make `setVerdict` in the provider a no-op → test fails; restore.
- **Test 3 — off the shortlist means gone:** list `[4, 2]`. Grade Bea `A` and give her verdict `Plan B`. Open `Remove Bea Striker` → `Remove from shortlist`: one row left. Go to `/players/2`, open `Player status`, click `Dribbler targets` (re-pins her). Back on `/briefs/b1`: two rows, Bea second, `No grade` pressed in her row, and the text `Plan B` is absent. Mutation check: disable the `onListsChanged` prune in `BriefProvider` → she comes back graded and the test fails; restore.

**Verify:** `npm run test:browser -- brief-page.spec.ts` → all pass; both mutation checks done and reverted.

- [ ] **Step 1:** Write tests 2 and 3; watch them fail.
- [ ] **Step 2:** Row ordering in `buildBriefRows`; grade, verdict and remove controls.
- [ ] **Step 3:** Verify, mutation-check, then commit `grade, verdict and remove on the brief page`.

---

### Task 5: Drag to rank, the drag cue, docs

**Files:**
- Modify: `src/components/BriefHeatTable.tsx` (and `BriefPickControls.tsx` if a grip or row component fits there)
- Modify: `CLAUDE.md` — *Brief pages* section
- Test: `browser-tests/brief-page.spec.ts`

**Interfaces:**
- Consumes: `useBriefs().movePick` (Task 1); `rowComponent`, `TableRowProps`, `sortRows`, `getRowKey` (Task 3).

**Definition of done:**
- `BriefHeatTable` holds `sortKey`/`sortDirection` state (initially `index` / `asc`) and passes them to `Table` in controlled mode with `data={sortRows(rows, sortKey, sortDirection)}`.
- `rankMode = sortKey === "index" && sortDirection === "asc"`.
- One `DndContext` around the table, with `useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))` as in `src/components/planner/PlannerDnd.tsx`.
- In rank mode, the `#` cell renders a grip (`LuGripVertical`, aria-label `Drag {name}`, `cursor: grab`) before the number, wired with `useDraggable({ id: uid })`. Outside rank mode, no grip is rendered.
- The row component calls `useDroppable({ id: uid, disabled: !rankMode })`. It forwards all props to `ChakraTable.Row`, sets the ref, dims itself (`opacity: 0.4`) while it is the dragged row, and gets a glaucous outline (`outline: 2px solid`, `glaucous.400`, `outlineOffset: -2px`) while hovered by a drag. The existing absent-row dimming (`opacity: 0.6` via `rowProps`) still applies when not dragging.
- `onDragEnd`: when `over` exists and `over.id !== active.id`, call `movePick(brief.id, list.uids, activeUid, targetIndex)`, where `targetIndex` = the target row's `index - 1`.
- Cue line above the table, next to the *All stats* checkbox, muted, `fontSize="sm"`. Rank mode: `Drag rows to reorder.`. Otherwise: `Sorted by {header} — ` followed by a link-styled button `sort by rank`, then ` to reorder`. The button sets `index` / `asc`.
- `CLAUDE.md`, *Brief pages*, gets bullets for:
  - picks storage (`picks` on the brief, array order = rank, materialise-first helpers in `brief-picks.ts`)
  - pruning via `onListsChanged` (local mutations only, never on re-read), with the three explicit drops
  - drag only in rank mode
  - the two remove options

  Drop the stale "in list order" wording in *Rows are the whole list…* in favour of "in rank order (`orderedShortlist`)".

**Tests (add to `browser-tests/brief-page.spec.ts`):**
- **Test 1 — drag reorders and survives a reload:** `seedDribblerBrief(page, [], [4, 2, 1])`. On `/briefs/b1`, `Drag rows to reorder.` is visible. Drag `Drag Ann Striker` onto Dee's row with a `dragTo(page, grip, target)` helper copied from `browser-tests/planner-drag.spec.ts` (mouse down, small move past the 6px activation, stepped move to the target centre, up). Rows read Ann, Dee, Bea. Reload: still Ann, Dee, Bea. Mutation check: make `moveTo` return the ordered array unchanged → test fails; restore.
- Also, in the same test after the reload: click the `Age` header. The grip `Drag Ann Striker` is gone and `Sorted by Age` is visible. Click `sort by rank`, and `Drag rows to reorder.` is back.

**Verify:** `npm run test:browser -- brief-page.spec.ts` → all pass; mutation check done and reverted. Then the full suite `npm run test:browser` → all pass.

- [ ] **Step 1:** Write test 1; watch it fail.
- [ ] **Step 2:** Controlled sort, dnd wiring, cue line.
- [ ] **Step 3:** `CLAUDE.md`.
- [ ] **Step 4:** Verify, mutation-check, full suite, then commit `drag to rank on the brief page`.
