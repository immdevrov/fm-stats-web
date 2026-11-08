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
ignored here. This is the only definition of the rank. `buildBriefRows` takes
the brief's picks and builds its rows in this order; `BriefRow.index` is the
1-based position in it (today it is list position), so the `#` column and the
default sort show the rank.

**Every pick write materialises the order first.** Grading, editing a verdict
and dropping all start from `orderedShortlist(picks, listUids)`, turn it into
one entry per list member (keeping existing grade/verdict, empty entries for
the rest), and only then apply the edit. Otherwise grading an unpicked player
would append him to `picks` and jump him above every other unpicked player.
The helpers live in `brief-picks.ts` (`setGrade`, `setVerdict`, `moveTo`, each
`(picks, listUids, …) → BriefPick[]`). Materialising also drops any stale
entry for a non-member.

### Pruning — off the shortlist means gone

A player who leaves the shortlist loses his rank, grade and verdict for that
brief. Pinned again later, he comes back fresh at the bottom.

A player can leave a list from many places (the status menu, `/lists`, marking
him unwanted anywhere, the brief page itself). Pruning is tied to **this tab's
own list mutations**, never to a re-read:

- `PlayerNotesContext` exposes `onListsChanged(listener) → unsubscribe`. Its
  local mutations that can take a uid off a list — `removeFromList`,
  `toggleUnwanted`, the new `setUnwanted` — call the listeners with the
  freshly read lists once they are saved. The tab-return `refresh()` and the
  initial load do not.
- `BriefProvider` (mounted inside `PlayerNotesProvider`) subscribes and, for
  each brief whose linked list is among those lists, filters `picks` to that
  list's uids, through the normal `change` path, only if something changed.
  A brief whose list is not found is left alone.
- The three ways a link really goes away drop picks explicitly: `setList`
  drops them whenever the list id changes (a new shortlist is a fresh
  judgement; linking the same list again is a no-op), and `unlinkList` and
  `unlinkAll` drop them.

Why not an effect over `lists`: both providers re-read on tab return, in
either order. An effect would prune this tab's stale briefs against fresh
lists (or fresh briefs against stale lists) and save the result over the other
tab's work. With the subscription, a tab return never writes; the other tab
already pruned and saved, and this tab picks that up with its briefs re-read.

Consequences, all intended:
- Changing a brief's linked list clears its picks.
- Deleting a linked list clears that brief's picks (via `unlinkList`).
- *New save* clears every brief's picks via `unlinkAll`; *Same save* touches
  neither.
- A stale entry can survive only if a list mutation happened in a tab whose
  briefs failed to load. It is invisible (`orderedShortlist` ignores
  non-members) and disappears at the next pick write; pinning him again
  before that would bring his old pick back. Accepted.

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
- A drop writes the materialised order (see *Storage*), so the rank is stored
  from the first drag on.
- Uses `@dnd-kit/core` (already a dependency, used by the planner) with a
  pointer sensor and an activation distance so clicks on the row still work.
  `@dnd-kit/sortable` is not added, so rows do not shift live while dragging:
  the dragged row dims and the row under the pointer gets a glaucous outline;
  the move happens on drop.
- `Table` (`src/components/ui/table.tsx`) needs three small additions, none of
  which change its existing users: a `getRowKey` prop (rows are keyed by index
  today, which would leave per-row state — an open verdict input, a menu, drag
  hooks — on the wrong player after a reorder); a `rowComponent` prop so a row
  can be a component calling `useDroppable`; and its sort comparator exported
  as `sortRows(data, key, direction)`, because `BriefHeatTable` switches to
  controlled sorting (it must know the sort to show the cue) and controlled
  mode does not sort.
- Players missing from the snapshot are dimmed as today and drag like anyone
  else.

### Grade

A narrow column right after `#`: the grade as a coloured badge (A green, B
yellow, C orange; ungraded a grey outlined `–`) that opens a dropdown of the
four choices, each with its meaning (*Sign him*, *Solid fallback*, *Only if the
price is right*, *No grade*). Changed after build at Roman's request; the
first version was a row of four buttons. Editable on any snapshot — picks are taste, not
snapshot data. The column sorts like any other (A first; ungraded last), which
the table gives for free.

### Verdict

A muted line under the player's name. Click it to edit inline in a one-line
input; Enter or blur saves, Esc cancels, an empty value removes the verdict.
With no verdict, the row shows a faint *Add verdict…* only on hover (and when
the input has focus), so unjudged rows stay clean.

### Removing

Each row gets a remove control (an icon button with a menu) offering:

- **Remove from shortlist** — `removeFromList(list.id, uid)`.
- **Remove and mark unwanted** — a new non-toggling
  `setUnwanted(uid, true, player)` on `PlayerNotesContext` (only
  `toggleUnwanted` exists today, which would un-mark a player who is already
  unwanted), with the row's identity. `db.setUnwanted` already takes him off
  every list. Once unwanted, scouting dims him and disables his pin.

This replaces the *Remove* button absent rows have today; absent rows get the
same two options (marking unwanted uses the annotation's last-known
name/club). Pruning then drops his pick.

Plain removal does not hide him from scouting — he can turn up there again
and be re-pinned, coming back fresh.

## Out of scope

- Showing picks on `/briefs` (e.g. top pick per brief); filtering by grade.
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
