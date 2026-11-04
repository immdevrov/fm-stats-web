# Transfer Marks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user mark players as arriving or leaving, so `/my-team` and the planner can show the squad as it will be, not only as the import has it.

**Architecture:** There is one optional `transfer` field on `PlayerAnnotation`. A pure helper, `src/utils/squad.ts`, derives the marked squad. `MyTeamView` calls it, on the newest snapshot only, and hands the result to both tabs. The planner reads presence from one set (`presentUids`), so the toolbar count and the card dimming cannot disagree.

**Tech Stack:** React 19, Chakra UI 3, idb, Playwright (browser-mode tests only).

**Spec:** `docs/superpowers/specs/2026-11-05-transfer-marks-design.md`

## Global Constraints

- No migration, no DB version bump. `playerAnnotations` is schemaless.
- A player has at most one of `unwanted`, `transfer: 'in'`, `transfer: 'out'`. Setting any one clears the others in the same `put`.
- Marks change the squad only when the active snapshot is the newest (`useSnapshots().isNewest`).
- UI copy, verbatim: tabs **Arriving (n)** / **Leaving (n)**. Menu items **Mark as arriving**, **Mark as leaving**, **Clear arriving**, **Clear leaving**. Badge tooltips **Arriving** / **Leaving**. Squad table tags `IN · from <club>` / `OUT`. Planner card tooltip **Marked as leaving**. Header `N players · +X in · −Y out`.
- Badge glyphs: `↘` in `glaucous.500`, `↗` in `spicyPaprika.500`.
- Strict TS, no generic comments, no unit tests (Playwright only). Commits are one short line with no attribution.
- Verify every task with `npm run build` (tsc + vite) and `npm run lint` at minimum.

**Human verification:** at finish. The user runs `npm run dev`. Check `/my-team`, `/my-team/planner` and `/lists` with a player marked arriving and another marked leaving (see the Task 5 checklist).

---

### Task 1: Data layer and marked-squad helper

**Files:**
- Modify: `src/types/annotations.ts` (add `transfer?: 'in' | 'out'`)
- Modify: `src/services/db/annotations.ts` (add `setTransfer`; make `setUnwanted(…, true)` drop `transfer`)
- Modify: `src/contexts/PlayerNotesContext.tsx` (add `transferOf`, `setTransfer`)
- Create: `src/utils/squad.ts`

**Interfaces:**
- Produces: `type TransferMark = 'in' | 'out'`, exported from `src/types/annotations.ts`.
- Produces: `db.setTransfer(uid: number, transfer: TransferMark | null, player?: PlayerIdentity): Promise<void>`. It runs as one transaction on `playerAnnotations`, sets or deletes `transfer`, sets `unwanted: false` when `transfer` is non-null, and records `lastKnownName` / `lastKnownClub` the way `setUnwanted` does.
- Produces (context): `transferOf(uid: number): TransferMark | undefined` and `setTransfer(uid: number, transfer: TransferMark | null, player?: PlayerIdentity): Promise<void>`. `setTransfer` refreshes annotations afterwards.
- Produces: `markedSquad(roster: Player[], myClub: string, annotations: Map<number, PlayerAnnotation>): { imported: Player[]; incoming: Player[]; outgoing: Player[]; squad: Player[] }`.
- Produces: `isTransferDone(transfer: TransferMark, club: string | undefined, myClub: string): boolean`. In: `club === myClub`. Out: `club !== myClub`, which includes `undefined`, meaning absent from the import.

**Definition of done:**
- `imported` is the roster filtered by `Club === myClub`.
- `incoming` is marked `in` with `Club !== myClub`.
- `outgoing` is the members of `imported` marked `out`.
- `squad` is `imported − outgoing` followed by `incoming`.
- A done mark has no effect on `squad`.

**Verify:** `npm run build` passes. A scratch probe of `markedSquad` on a 4-player roster (stay, out, in-elsewhere, in-already-home) gives `squad` = [stay, in-already-home, in-elsewhere], `incoming` = [in-elsewhere] and `outgoing` = [out].

- [ ] Implement the four files
- [ ] Build, probe, commit `add transfer marks to annotations`

### Task 2: Status menu and badge

**Files:**
- Modify: `src/components/PlayerStatusControl.tsx`
- Modify: `src/components/PlayerStatusBadge.tsx`

**Interfaces:** consumes `transferOf` and `setTransfer` from Task 1, and `useMyTeam().myClub`.

**Definition of done:**
- Under the unwanted button there is one ghost button, chosen as follows:
  - Marked `in`: **Clear arriving**.
  - Marked `out`: **Clear leaving**.
  - Otherwise, with `myClub` set: **Mark as leaving** if `player?.Club === myClub`, else **Mark as arriving**.
  - No `myClub` and no mark: no button.
- Marking does not disable the list checkboxes.
- Badge priority is transfer > unwanted > lists. The transfer glyph's tooltip is **Arriving** or **Leaving**, followed by ` — <note>` when a note exists. The glyph has `aria-label` of "Arriving" or "Leaving".

**Verify:** `npm run build` and `npm run lint`. The behaviour is covered by Task 3's test, which seeds marks rather than clicking. The menu is checked by human eyes at finish.

- [ ] Implement, build, commit `transfer actions in the status menu`

### Task 3: `/my-team` squad table and header (test-first)

**Files:**
- Create: `browser-tests/transfer-marks.spec.ts`
- Modify: `browser-tests/helpers/seed.ts` (`seedAnnotation` accepts `transfer?: 'in' | 'out'`)
- Modify: `src/views/MyTeamView.tsx`
- Modify: `src/components/SquadTable.tsx`

**Interfaces:**
- Consumes `markedSquad` from Task 1.
- `SquadTable` gains an optional `transfers?: { incoming: Set<number>; outgoing: Set<number> }`. Without it, behaviour is unchanged, so `/teams/:teamName` is untouched.

**Definition of done:**
- On the newest snapshot, `MyTeamView` computes `markedSquad`. The squad table gets `imported ∪ incoming` plus `transfers`. The planner gets `squad`.
- Off the newest snapshot, both tabs get `imported`, and this note shows under the tabs: *Transfer marks apply to the newest snapshot only.* The note appears only when at least one annotation carries a mark.
- Incoming rows show `IN · from <club>` next to the name. Outgoing rows show `OUT` and use the unwanted row styling.
- The header reads `{squad.length} players`, plus ` · +{incoming} in` and ` · −{outgoing} out` when each count is non-zero.
- The "not in the current data" gate still uses `imported.length === 0`.

**Test (seeded):** one snapshot, `myClub = 'Test FC'`, with players:
- uid 1 'Keeper' at Test FC
- uid 2 'Seller' at Test FC, marked `out`
- uid 3 'Buyer' at Rivals FC, marked `in`
- uid 4 'Stranger' at Rivals FC

On `/my-team`, expect:
- `IN · from Rivals FC` visible
- `OUT` visible
- text `2 players · +1 in · −1 out`
- 'Stranger' absent

The planner part of the same test is added in Task 4.

**Verify:** `npx playwright test browser-tests/transfer-marks.spec.ts` fails before the implementation and passes after.

- [ ] Write the failing test, run it, see it fail
- [ ] Implement and run until it passes. Commit `show transfer marks on my team`

### Task 4: Planner (extend the test first)

**Files:**
- Modify: `browser-tests/transfer-marks.spec.ts`
- Modify: `src/components/planner/SquadPlanner.tsx` (`listed` excludes marked `out`; pass `presentUids` to the board)
- Modify: `src/components/planner/PlannerBoard.tsx`, `PlannerSlot.tsx` (thread `presentUids: Set<number>`)
- Modify: `src/components/planner/PlannerCard.tsx` (`departed = Boolean(player) && !presentUids.has(planned.uid)`; markers)

**Definition of done:**
- Candidates are `squad ∪ (listed − out)`. 'Seller' is never offered. 'Buyer' appears in the panel's *Squad* tab.
- A placed card that is departed and marked `out` while still at `myClub` uses the existing `→` marker with `aria-label="No longer in the squad"`, but the tooltip reads **Marked as leaving**. Departed and at another club keeps the existing tooltip `No longer at <club> — now at <club>`.
- A placed card marked `in` shows `↘` with tooltip **Arriving**.
- The toolbar count and *Remove missing* need no change. They already use `presentUids`.
- `browser-tests/planner-departures.spec.ts` still passes unchanged.

**Test extension:** seed a 4-4-2 plan with 'Seller' (uid 2) placed in `ST-C-1`. On `/my-team/planner`, expect:
- `1 no longer in the squad`
- `getByLabel('No longer in the squad')` hover shows `Marked as leaving`
- `Buyer` visible in the candidate panel

**Verify:** `npx playwright test browser-tests/transfer-marks.spec.ts browser-tests/planner-departures.spec.ts` passes. Mutation-check both pins, each by temporary edit, and expect a failure each time:
1. Drop `outgoing` from the `squad` formula in `squad.ts`.
2. Revert `departed` in `PlannerCard` to `player.Club !== myClub && memberships.length === 0`. This should fail on the tooltip or the count.

- [ ] Extend the test, see it fail. Implement, see it pass
- [ ] Run both mutation checks, then restore. Commit `planner honours transfer marks`

### Task 5: `/lists` tabs, clear-done, import toast, docs

**Files:**
- Modify: `src/views/ListsView.tsx`
- Modify: `src/views/ImportView.tsx` (toast text)
- Modify: `CLAUDE.md`

**Definition of done:**
- After Unwanted come two tabs, **Arriving (n)** and **Leaving (n)**, built like the Unwanted tab with the same `rows` builder.
- Each tab has a **Done** column. It shows `Done` when `isNewest && myClub && isTransferDone(...)` holds, using the player's club from the roster, which is `undefined` when the player is missing.
- Each tab has a **Clear done** button that calls `setTransfer(uid, null)` for every done row. It is disabled when `!isNewest`, with a tooltip reading *Only on the newest snapshot*.
- The explanation line reads verbatim: *Agreed or planned moves. /my-team and the planner treat these as already done until an import shows them.*
- The import toast reads: "All lists, prices, notes, unwanted flags and transfer marks have been removed."
- `CLAUDE.md` gets a **Transfer marks** section covering:
  - the field
  - the one-status rule
  - newest-only
  - `squad.ts` as the single definition
  - that done is derived
  - the `SquadTable` `transfers` prop
- In `CLAUDE.md`'s Squad Planner section, "Two ways to leave" is updated to three. It notes that presence is read from `presentUids`, which the card shares with the toolbar.

**Verify:** `npm run build`, `npm run lint`, and the full `npm run test:browser`.

Then **verify: human-eyes**, with one player marked arriving and another marked leaving:
- `/lists` shows both tabs, and Done appears for a mark the import already shows.
- `/my-team` shows the tags and the header.
- `/my-team/planner` shows the marker on the leaving player.
- The status menu offers the right action.

- [ ] Implement, verify, commit `arriving and leaving tabs on lists`
