# Player Annotations & Lists — Design

Date: 2026-08-29
Status: Approved for planning
Sub-project: A of A–E (see Roadmap)

## Problem

FM Jotter can analyse players but cannot record judgements about them. Three
things are missing:

1. **Shortlists** — named lists of players to keep an eye on, with prices.
2. **Unwanted marking** — a player ruled out (not good enough, or a transfer that
   proved impossible) who must stay visible and keep counting in every
   statistical cohort, but be clearly flagged wherever he appears.
3. **Durability across imports** — user judgements must survive a re-import the
   way league rankings already do.

Point 3 is not merely a requirement; it is a live defect. `ImportView`
(`src/views/ImportView.tsx:69-70`) calls `clearAllPlayers()` then
`savePlayers()`, and `savePlayers` performs a whole-record `put`. Because
`CustomPosition` is a field on the `Player` record, **every re-import silently
destroys all custom positions today**. League rankings survive only because they
live in their own object store, untouched by `clearAllPlayers()`.

This design fixes that defect and builds shortlists on the corrected foundation.

## Scope

In scope: named lists, unwanted status, price and wage demand, notes, the `/lists`
view, quick actions and badges across existing views, the import preserve
dialog, and moving `CustomPosition` into durable storage.

Out of scope, deferred to later sub-projects: My Team selection, team statistics
screen, squad planner, team tendencies, percentile caching.

## Decisions

These were settled during brainstorming and are not open for re-litigation
during implementation.

| Decision | Choice | Consequence |
|---|---|---|
| List model | Multiple named lists | Needs list CRUD and a list picker |
| "Shortlisted" | Derived from membership, not stored | Only `unwanted` is a stored status; no ghost "shortlisted but listed nowhere" state |
| Unwanted vs shortlist | One mutually exclusive status | Marking a player unwanted removes him from every list |
| List typing | Untyped — name only | Lists may span positions; no role binding |
| List columns | Plain roster table | No percentile columns; click through to the profile for stats |
| Prices | Price + wage demand | Wage demand is often the real blocker in FM |
| Unwanted display | Visible, dimmed, with a "Hide unwanted" filter | The player stays on the board so you remember he was ruled out |
| Orphans | Kept, not pruned | Requires display fallbacks and uid-first rendering (see Orphan handling) |
| Add flows | Per-row quick action, bulk select in Scouting, Player Profile, and mark-unwanted from anywhere | One shared control component serves all four |

## Data model

Two new object stores, database version **4**.

```ts
// store: playerAnnotations, keyPath 'uid'
interface PlayerAnnotation {
  uid: number;
  customPosition?: PlayerPositions;
  unwanted?: boolean;
  price?: number;
  wageDemand?: number;
  note?: string;
  lastKnownName?: string;
  lastKnownClub?: string;
}

// store: playerLists, keyPath 'id'
interface PlayerList {
  id: string;
  name: string;
  order: number;
  uids: number[];
  createdAt: Date;
}
```

`uids` is stored inline on the list rather than in a membership store. Lists hold
tens of players, so a whole-list `put` is cheap, and manual ordering stays
trivial.

Shortlist status is derived: a player is shortlisted if any list's `uids`
contains him. The only stored status is `unwanted`. Marking a player unwanted
removes his uid from every list; the annotation write and the list writes share
one transaction spanning both stores, so the two can never disagree.

`lastKnownName` and `lastKnownClub` are refreshed on every annotation or list
write. Their sole purpose is rendering orphans (see Orphan handling). The write
APIs therefore take the `Player` (not a bare uid) wherever the caller has one,
and copy `Name` and `Club` across; callers holding only a uid leave the existing
values in place.

### Migration

The v4 `upgrade` callback iterates the existing `players` store and, for every
record carrying a `CustomPosition`, writes a `playerAnnotations` row with that
value, then deletes the field from the player record. No user data is lost.

## The customPosition seam

Only `customPosition` crosses back into the `Player` object. It is the one
annotation domain code depends on: `getEffectivePosition()`
(`src/utils/utils.ts:76`) reads it, and every role's `isRole()` calls that.

`unwanted`, `price`, `wageDemand` and `note` are consumed exclusively by views
and the context layer and **must never be merged onto `Player`**. Widening the
seam beyond one field is a design violation.

The invariant to protect is: *a `Player` object handed to domain code always
carries its effective position*. The only reliable way to hold an invariant is
to make the object impossible to construct without it, so the join happens at
the read boundary inside the database layer:

- **Reads** — `getPlayer`, `getAllPlayers`, `getPlayersByClub`,
  `getPlayersByPosition`, `searchPlayersByName` merge `customPosition` onto the
  returned objects.
- **Writes** — `savePlayer`, `savePlayers` strip `CustomPosition` before `put`.

A standalone repository module was considered and rejected: it would leave
`db.getAllPlayers()` reachable and returning half-built players, and a role
misclassifying a player is a silent failure.

Roles, filters, the scouting engine and all existing views are unchanged. Only
the database layer knows there are two stores.

Cost: each player read also performs one `getAll` on `playerAnnotations`, a
store holding only annotated players — tens of rows.

## Database layer split

`src/services/db.ts` already mixes connection management, player CRUD, league
rankings, the compare list and custom positions. This sub-project adds
annotations and lists. It is split by responsibility:

```
src/services/db/connection.ts    schema, DB_VERSION, upgrade + migrations
src/services/db/players.ts       player CRUD + customPosition merge/strip
src/services/db/annotations.ts   annotations + lists CRUD
src/services/db/rankings.ts      league rankings
src/services/db/compare.ts       compare list
src/services/db/index.ts         composes and re-exports the `db` singleton
```

The public API of `db` is unchanged, so no existing caller is touched by the
split.

New methods on the annotations module: `getAnnotations`, `getAnnotation`,
`setAnnotation(uid, patch)`, `clearAllAnnotations`, `getLists`, `saveList`,
`deleteList`, `clearAllLists`.

Existing `updatePlayerPosition`, `clearPlayerCustomPosition` and
`clearAllCustomPositions` keep their signatures but write to
`playerAnnotations` instead of the player record.

## State layer

`PlayerNotesProvider` in `src/contexts/PlayerNotesContext.tsx`, modelled on the
existing `CompareContext` (load once on mount, persist on change), mounted
alongside `CompareProvider`.

Exposed by `usePlayerNotes()`:

- `annotations: Map<number, PlayerAnnotation>`
- `lists: PlayerList[]`
- `isUnwanted(uid)`, `toggleUnwanted(uid)`
- `listsFor(uid)`, `addToList(listId, uid)`, `removeFromList(listId, uid)`
- `createList(name)`, `renameList(id, name)`, `deleteList(id)`
- `setPricing(uid, { price, wageDemand, note })`

Unlike `CompareContext`, this provider does **not** prune uids missing from the
players store.

## Components and views

### New components

Shortlisted and unwanted are mutually exclusive, so they share **one**
indicator rather than two. A single narrow status column carries all three
states; there is no badge beside the name.

| State | Glyph | Tooltip |
|---|---|---|
| Neither | hollow star, muted | "Not on any list" |
| Shortlisted | filled star, glaucous, with list count | names the lists he is on |
| Unwanted | circled slash, spicyPaprika | shows the note, e.g. "Wage demand impossible" |

Detail lives in the tooltip, so the column stays about 46px wide and the Name
column keeps its width — the reason a spelled-out badge was rejected.

- `<PlayerStatusControl uid />` — the interactive indicator. Clicking opens a
  menu with a checkbox per list, "New list…", and "Mark as unwanted" (or
  "Clear unwanted" when he already is). Serves every add flow.
- `<PlayerStatusBadge uid />` — the same three-state glyph, read-only, for
  `CompareView`.
- `<PricingFields uid />` — price, wage demand and note editor.

Unwanted rows are dimmed at the row level in addition to the glyph. The status
column is exempt from that dimming, so the flag stays legible on a faded row.

### New view

`/lists` → `ListsView`, with a "Lists" entry in `Navigation`. Tabs for each list
plus a virtual **Unwanted** tab, since unwanted players belong to no list and would
otherwise only surface dimmed inside Scouting.

Columns: Status, Name, Age, Position, Club, Division, Wage, Price, Wage Demand,
Contract Expires, Note. Supports removing players and bulk removal.

### Integrations

| View | Change |
|---|---|
| `ScoutingView` | Quick-action column, bulk checkboxes with "Add N to list…", dimmed unwanted rows, "Hide unwanted" added to the existing filter bar |
| `PlayersView` | Quick-action column, dimmed unwanted rows, "Hide unwanted" filter |
| `PlayerProfileView` | Status control and inline `PricingFields`, beside the existing position editor |
| `TeamProfileView` | Quick-action column, dimmed unwanted rows |
| `CompareView` | Badge only |

### Shared component change

`Table` (`src/components/ui/table.tsx`) gains
`rowProps?: (row: T) => TableRowProps`, spread onto the rendered row so callers
can pass Chakra style props such as `opacity`. It currently offers no way to
style an individual row, and dimming requires it.

## Import flow

`performImport` currently takes a `clearRankings` boolean. It takes a set of
categories to clear instead.

The single-choice rankings `ConfirmDialog` is replaced by a multi-select
"Preserve data" dialog listing only categories that actually hold data:

- League rankings
- Custom positions
- Lists, prices and unwanted flags

Every category defaults to **kept**. This gives custom positions and lists the
same behaviour league rankings already have, which is the requirement that
motivated the storage split.

The existing "Clear All Custom Positions" button on the Import view stays, and
is joined by "Clear All Lists & Notes".

## Orphan handling

After an import, some annotated uids may be absent from the new export.
`CompareContext` prunes such uids silently. That was a fix for crashes caused by
consumers assuming the player exists — not a data-retention policy. Pruning here
would permanently discard the price and notes of a player who merely fell out of
one week's export.

Annotations are therefore kept, and the underlying cause is addressed instead:

1. **Display fallback** — `lastKnownName` and `lastKnownClub` let an orphan
   render as "Pedri (Barcelona) — not in current data" rather than a bare uid.
2. **Uid-first rendering** — list rows are built from `{ annotation, player? }`
   with the player optional. No view may write `playersById.get(uid).Name`.
   This is the actual guard against the original bug.
3. **Manual, visible cleanup** — each list shows a "N not in current data" count
   with a "Remove missing" button. Nothing is deleted automatically.

## Testing

Per project policy: behaviour tests only, main behaviours only, Playwright
browser mode only, no unit or jsdom layer. No tests are added by default.
Temporary tests written while debugging are deleted afterwards.

One candidate is pinned for a decision after implementation, not before:
**annotations survive a re-import** (add a player to a list, re-import, confirm
he is still there). It is the central promise of this sub-project and the
behaviour that failed silently before. If it is pinned, it must then be
validated by mutation testing.

## Roadmap

This spec covers sub-project A only. Each later sub-project gets its own spec.

| # | Sub-project | Depends on |
|---|---|---|
| A | Player annotations and lists | — |
| B | My Team: club selection, navigation, team statistics screen | — |
| C | Squad planner: formation, slots, virtual roster | A, B |
| D | Team tendencies: cross-team statistical profile | B, needs its own brainstorm |
| E | Percentile caching | Measured after D |

Sub-project C draws candidates from A's lists; D is the workload that is
expected to make E necessary.
