# Briefs, step 5: rank, grade and verdict

## Problem

The brief page (step 3) shows a brief's shortlist as a heat table, in list
order. List order means nothing — it is the order players were pinned in. The
page shows how candidates compare but records nothing about what Roman
decided, so every visit starts the comparison from scratch, and the final
decision lives in his head.

Step 5 lets him commit: put the shortlist in order, say whether each player is
good enough, and write down why.

Roadmap: `2026-11-08-archetypes-design.md`. Step 4 (dominance) was dropped, so
this is the last step.

## What a pick is

Per brief, per shortlisted player:

- **Rank** — a full order of everyone on the shortlist. There is no "unranked"
  state; a newly pinned player lands at the bottom.
- **Grade** — `A` (sign him; he answers the brief), `B` (a solid fallback),
  `C` (only if the price is right), or ungraded. There is no "no" grade: a no
  means the player leaves the shortlist (see *Removing*).
- **Verdict** — one line of free text.

Picks belong to the **brief**, not the list: a list can be linked to several
briefs, and a player can be an A for one and a C for another. The list's own
order is left alone and keeps meaning nothing.

## Storage

`picks?: BriefPick[]` on `Brief`, where

```ts
type Grade = "A" | "B" | "C";
interface BriefPick { uid: number; grade?: Grade; verdict?: string }
```

Array order is the rank. Stored with the brief in the existing `settings` key
`archetypes`, so there is no schema change. `getBriefs()` coerces `picks`:
drops entries without a numeric `uid`, duplicate uids (first wins), grades
other than `A`/`B`/`C`, and non-string or blank verdicts (verdicts are trimmed).
A pick with neither grade nor verdict is still a valid entry — it carries rank.

### The displayed order

`orderedShortlist(picks, listUids)` (pure, in `src/utils/brief-picks.ts`):
the list's uids that have a pick, in pick order, followed by the list's uids
that have none, in list order. Uids in `picks` that are not on the list are
ignored here (they are pruned, below). This is the only definition of the
rank; the `#` column shows the position in it, 1-based.

### Pruning — off the shortlist means gone

A player who leaves the shortlist loses his rank, grade and verdict for that
brief. Pinned again later, he comes back fresh at the bottom.

A player can leave the list from many places (the status menu, `/lists`,
marking him unwanted anywhere, the brief page itself), so pruning is not done
at each removal site. `BriefProvider` (mounted inside `PlayerNotesProvider`)
runs one reconciling effect: when briefs have loaded **and** notes have loaded
without error, each brief's `picks` are filtered to the uids of its linked list
(`linkedListOf`); a brief with no linked list, or whose list is gone, keeps no
picks. It writes only when something actually changed, and writes through the
same `change` path as every other mutation.

Never prune on a notes load error or before notes load — unknown is not
missing, as with `linkedListOf`.

Consequences, all intended:
- Changing a brief's linked list keeps picks only for players on both lists.
- Deleting a linked list (`unlinkList`) clears that brief's picks.
- *New save* clears every list, so every brief's picks go with them;
  `unlinkAll` also drops `picks` explicitly so it does not depend on the
  effect running. *Same save* touches neither.

Accepted risk: with two tabs open, a tab-return re-read of briefs can land
before the re-read of lists, and the effect could prune a pick made in the
other tab for a player this tab does not yet see on the list. Rare, and the
cost is one lost grade.

### Not a filter

Like `listId`: *modified*, *Save* and *Revert* on `/scouting` ignore `picks`;
`update(id, filters)` keeps them. *Save as new* does **not** copy them — a new
brief is a new judgement.

## The brief page

Only `/briefs/:briefId`'s table changes. `/briefs` and `/scouting` are
untouched.

### Columns

`#` (rank, with the drag grip) · **Grade** · Player (name, tags, and the
verdict line under it) · then the existing identity and heat columns,
unchanged.

### Ranking by drag

- The table opens sorted by `#` ascending.
- **Only while sorted by `#` ascending**, every row shows a grip (⋮⋮) at its
  leading edge with a grab cursor, and a muted line above the table says
  *Drag rows to reorder.* Dragging a row by its grip and dropping it on
  another row moves it to that row's position (the rows between shift by one).
- Sorted by anything else (or `#` descending), the grips are gone and the line
  says *Sorted by {column header} — sort by rank to reorder*, where *sort by
  rank* is a link that resets the sort to `#` ascending.
- A drop writes the whole displayed order back as `picks` (players without a
  pick get an empty entry), so the rank is stored from the first drag on.
- Uses `@dnd-kit/core` (already a dependency, used by the planner) with a
  pointer sensor and an activation distance so clicks on the row still work.
- Players missing from the snapshot are dimmed as today and drag like anyone
  else.

### Grade

A narrow column right after `#`: a compact A / B / C / – control; one click
sets the grade, `–` clears it. Editable on any snapshot — picks are taste, not
snapshot data.

### Verdict

A muted line under the player's name. Click it to edit inline in a one-line
input; Enter or blur saves, Esc cancels, an empty value removes the verdict.
With no verdict, the row shows a faint *Add verdict…* only on hover (and when
the input has focus), so unjudged rows stay clean.

### Removing

Each row gets a remove control (an icon button with a menu) offering:

- **Remove from shortlist** — `removeFromList(list.id, uid)`.
- **Remove and mark unwanted** — `setUnwanted(uid, true)` with the row's
  identity, which (as today) also takes him off every other list. Once
  unwanted, scouting dims him and disables his pin.

This replaces the *Remove* button absent rows have today; absent rows get the
same two options (marking unwanted uses the annotation's last-known
name/club). Pruning then drops his pick.

Plain removal does not hide him from scouting — he can turn up there again
and be re-pinned, coming back fresh.

## Out of scope

- Showing picks on `/briefs` (e.g. top pick per brief); sorting or filtering
  by grade.
- Dominance (dropped).
- Drag on `/scouting` or `/lists`.
- Keyboard reordering.

## Testing

Playwright behaviour tests in `browser-tests/brief-page.spec.ts`, each
mutation-checked:

1. Dragging a row to another position reorders the table, and the order
   survives a reload.
2. A grade and a verdict set on a row survive a reload.
3. *Remove from shortlist*, then pinning the same player again, brings him
   back at the bottom with no grade or verdict.

Not tested by a browser test: the coercion branches, *New save* clearing
(covered by the pruning rule), the drag cue text.
