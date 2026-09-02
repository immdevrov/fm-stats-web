# Historic Snapshots — Design

Date: 2026-09-02
Status: Approved for planning

## Problem

An import is a single moment. FM Jotter reads one exported file, replaces
everything it holds, and answers every question from that one instant. A save
is not an instant — it runs for seasons.

That gap hides the question a scout actually asks. A striker on 0.7 goals per
90 is either a player who has been good for three seasons or a player having
one hot half-season on the back of two poor ones, and the app renders both
identically. The same blindness works in reverse: a squad player whose numbers
dipped this season looks like a problem, with nothing to say whether he has
been steady for four years.

Re-importing an older file is not an answer. It destroys the current data to
show the old, so seeing last season costs this season, and getting back costs
another import of a 44 MB file.

## Scope

In scope: dated snapshots as the storage unit, an import that asks which save
a file belongs to and when it was taken, a global switcher that puts the whole
app into one snapshot, a per-player history on the profile, and a planner
horizon anchored on the snapshot date instead of a typed one.

Out of scope, each deliberate rather than merely unbuilt: cross-snapshot
consistency scoring in scouting, trend columns or sparklines in any list view,
snapshots of differing coverage (see Assumptions), several saves held side by
side, automatic save detection, and any comparison of two snapshots rendered
side by side.

## Assumptions

Stated because the design leans on them, and because a change to any of them
is a change to the design.

1. **Every import is the same export.** The same saved FM search, run again at
   a later date. Snapshots therefore hold comparable populations, and each one
   stands alone: percentiles within a snapshot are computed from that
   snapshot's own players and never mix dates. A squad-only export imported as
   a snapshot would render a nearly empty app, and nothing in this design
   prevents that or apologises for it.
2. **UIDs are stable within a save.** They are the join key across snapshots
   and the key every annotation already uses.
3. **The export is large.** The current save is ~50k players in a 44 MB file.
   Every storage and load decision below is made at that size; at 5k players
   most of them would not be worth making.

## Decisions

Settled during brainstorming; not open for re-litigation during
implementation.

| Decision | Choice | Consequence |
|---|---|---|
| Storage unit | One dated snapshot per import | Old data is never destroyed by a new import |
| Record layout | Packed values, keys stored once per snapshot | ~30 MB a snapshot instead of ~100 MB |
| Store key | `[snapshotId, uid]` composite | A roster is a key-range read; no `by-snapshot` index |
| Cross-snapshot join | One `by-uid` index | Player history is a single indexed read |
| Save identity | Asked on every import | No detection heuristic to be wrong |
| New save | Erases everything | Positions, lists, rankings, club and plan are all save-scoped |
| Import date | Derived from the filename, else typed | Never taken from the machine's clock |
| Ordering | By `date`, never by import time | Snapshots can be back-filled in any order |
| Active snapshot | One, global, app-wide | There is always one answer to "what am I looking at" |
| Switcher | In the sidebar, always visible | An old snapshot cannot be misread as current |
| Roster access | A context, loaded lazily | One 50k load a screen instead of up to three |
| History values | Raw stats; percentiles on demand | A profile page never loads four historic cohorts |
| Percentile cohorts | Within one snapshot | Ranks are never computed across dates |
| Annotations | Save-scoped, not snapshot-scoped | A custom position is not a fact about January 2035 |
| Planner horizon | Preset, anchored on the snapshot date | No typed date, and no use of the wall clock |
| Preserve dialog | Removed | The save gate makes per-category choice meaningless |

## Data model

Database version 6. Two new stores; `players` is dropped.

**`snapshots`** — one small record per import, keyPath `id`:

```ts
interface Snapshot {
  id: string;            // crypto.randomUUID(); two imports may share a date
  date: string | null;   // ISO YYYY-MM-DD; null only for the migrated snapshot
  label: string | null;  // free text, e.g. "before the January window"
  playerCount: number;
  importedAt: number;    // epoch ms, wall clock, for tie-breaking equal dates
  fields: string[];      // the packed field order used to write this snapshot
}
```

`date` is an ISO string rather than a `Date` so it sorts lexically and carries
no timezone. It is the in-game date of the export, and the only date the app
treats as "now".

`fields` is written per snapshot, not held as a global constant. A stat added
to `Player` next season changes the constant used for new writes; older
snapshots keep decoding against the list they were written with. Without this,
adding a field silently shifts every historic row by one column.

**`playerSnapshots`** — one record per player per snapshot, keyPath
`['s', 'u']`:

```ts
interface PackedPlayer {
  s: string;        // snapshot id
  u: number;        // UID
  v: unknown[];     // values in the snapshot's `fields` order
}
```

One index: `by-uid` on `u`.

The composite primary key already orders rows by snapshot, so a roster is a
key-range read over the primary key — `IDBKeyRange.bound([id], [id, []])`,
using the fact that arrays sort above numbers in IndexedDB key order. No
`by-snapshot` index is created, and that saves an index over 50k rows a
snapshot.

`by-uid` exists for exactly one caller: the profile history, which needs every
row for one player across all snapshots. Without it that is a full scan.

### Packing

The saving is in key names, not values. IndexedDB stores no schema, so a plain
`Player` re-stores all ~55 key strings in every record — `ShotsOutsideBoxPer90`
and its neighbours are roughly 60% of each row. At 50k players that is ~100 MB
a snapshot; packed, it is ~30 MB.

`pack(player, fields)` and `unpack(values, fields)` live in
`src/services/db/pack.ts` and are used only by the snapshot store. Nothing
above `services/db` sees a packed record: every db function returns `Player`.

Two values are deliberately not transformed further:

- `Expires` stays a `Date`. Structured clone stores dates compactly, and
  converting to a string would cost 50k date constructions on every load.
- `Position` and `SecPosition` stay nested `PlayerPosition[]`. Re-serialising
  them to their compact string form would save roughly 3 MB a snapshot and
  cost a 50k-row `parsePositions` on every load. Not a good trade.

`UID` is not in `fields`; it is the `u` key.

### Settings

`activeSnapshot` joins `myClub` and `squadPlan` in the existing `settings`
store, as a typed accessor pair over the module's private `_get`/`_set`.

## Import

`ImportView` parses the file as it does today, then opens one dialog before
any write. `ImportPreserveDialog` is deleted.

The dialog asks two things:

**Which save is this?** — *Same save* or *New save*, with no default. Asked
every time. A detection heuristic on UID overlap was considered and rejected:
it is right almost always, and the cost of the rare miss is the user's entire
save.

**What date is this data?** — prefilled by matching
`(\d{1,2})[_-](\d{1,2})[_-](\d{4})` against the end of the filename, so
`emmen_24_01_2035.html` gives 24/01/2035. The club prefix is ignored; only the
trailing date is read. No match, an impossible date, or a filename the user
renamed leaves the field empty. The field is required — an import cannot
produce an undated snapshot.

*Same save* writes a new snapshot and touches nothing else. If the entered
date matches an existing snapshot's date, the dialog asks whether to replace
that snapshot instead of adding a second one at the same date; that is the
"my first export was missing columns" case, and replacing deletes the old
snapshot's rows before writing.

*New save* confirms destructively, then clears `snapshots`,
`playerSnapshots`, `playerAnnotations`, `playerLists`, `leagueRankings`,
`myClub` and `squadPlan`. Nothing survives a new save, because nothing in
those stores means anything against a different set of UIDs.

The preserve dialog is removed rather than kept. With an explicit save gate
the only two outcomes are "keep everything" and "wipe everything", so a
per-category choice has nothing left to decide. Selective clearing is still
available: the two *Clear all…* buttons already on the Import view do it.

### Writing 50k rows

`savePlayers` currently issues every put into one transaction under a single
`Promise.all`. At 50k that is 50k pending promises in one transaction. The
snapshot writer chunks instead — roughly 2,000 rows a transaction — and
reports progress, so a large import shows a bar rather than an unresponsive
tab.

The snapshot metadata record is written **last**. A write interrupted halfway
leaves orphaned rows under an id no `snapshots` record names, which the
Import view's storage panel reports and can delete; it never leaves a snapshot
the switcher offers but cannot load.

`navigator.storage.persist()` is requested once, on the first import. Several
hundred megabytes of save data is exactly the size a browser evicts under
pressure, and asking is free.

The new snapshot becomes active on success.

### Column shape

Before writing anything, the import checks the parsed headers against the
columns `transformPlayerStats` requires and refuses the file with a message
naming what is missing.

This is not hypothetical, and it is not new: `transformPlayerStats` reads
`record["Pas %"].replace(...)` and `record["xSv %"].replace(...)` unguarded, so
a file without those columns throws a bare `TypeError` today. Back-filling an
older export is the case that provokes it — an FM search saved two seasons ago
may not carry every column the current view expects. A named refusal before
the write is worth more than a partial snapshot of `NaN`s that percentile
maths will silently propagate.

## Import order

Snapshots may arrive in any order: a 2035 export, then 2036, then a 2033 file
found later. Everything below is ordered **by `date`, never by import time**,
which is what makes back-filling work.

- **The switcher, the snapshot table and player history** sort by `date`
  descending. `importedAt` breaks ties between two snapshots that share a date.
- **"Newest"**, wherever this spec uses it — the Historic badge, the planner's
  *Remove missing* guard — means the greatest `date`, not the most recent
  import. Reading it as import time would let a freshly back-filled 2033
  snapshot suppress the badge while rendering 2033 data, which is precisely
  the confusion the badge exists to prevent.
- **An undated snapshot sorts oldest** and can never be the newest. Only the
  migrated snapshot is undated, and dating it in the snapshot table moves it
  into place. If it is the *only* snapshot it is trivially active, and the
  badge does not appear.
- **A back-filled import still becomes active**, like any other — you asked
  for that file. The Historic badge appears in the same render, so the app
  says what it has done rather than silently dropping you two seasons back.
- **Deleting the active snapshot** moves active to the newest remaining by
  date. The same fallback covers a stored `activeSnapshot` naming an id that
  no longer exists, which is what a half-finished delete or a stale setting
  leaves behind.

Nothing else depends on arrival order. Each snapshot's `fields` list is
written with it, so an older file imported later decodes against the columns
it was actually written with; annotations are keyed by UID and are indifferent
to dates; and percentile cohorts never span snapshots, so no computation mixes
two dates however they were loaded.

## Reading

`SnapshotProvider` (`src/contexts/SnapshotContext.tsx`) mounts in `Layout`
**outside `CompareProvider`**, since `CompareContext` loads the roster itself.

It exposes two hooks, split by cost:

- **`useSnapshots()`** — the snapshot list, the active id, `isLoaded`,
  `setActive`, `deleteSnapshot`, `setSnapshotDate`, `setSnapshotLabel`.
  Metadata only. This is what the sidebar uses.
- **`useRoster()`** — returns `{ players, isLoading }` and asks the provider
  to load the active snapshot on first use.

The split is the point. A single hook would drag a 50k-row load onto
`/import` and `/leagues`, which render no players. Only a view that asks for
the roster pays for it.

One roster is held in memory at a time. Switching snapshots drops the previous
one before loading the next; the provider never caches two.

Consumers gate on `isLoaded` before rendering, as `MyTeamProvider` and
`SquadPlanProvider` already do, so no view flashes an empty state before the
first read resolves.

### Call sites

Every player read moves to `useRoster()` and filters in memory:
`SquadPlanner`, `CompareContext`, `CompareView`, `LeaguesView`, `ListsView`,
`MyTeamView`, `PlayerProfileView` (both loads), `PlayersView`, `ScoutingView`,
`TeamProfileView`, `TeamsView`.

`getPlayersByClub` and `getPlayersByPosition` are removed rather than
reimplemented. They existed to use indexes that packing gives up, their
callers already had the full roster in hand, and in-memory filtering of 50k
rows is not the expensive part of any of those screens.

On the current save this is a straight speed win, not merely a refactor:
`PlayerProfileView` loads the roster twice today, and `MyTeamView` and
`SquadPlanner` each load it on the same screen. Three 50k loads become one.

`db.getPlayer(uid)` reads a single row from the active snapshot and stays —
it is a cheap keyed read and `PlayerProfileView` uses it after an annotation
edit.

New db functions: `createSnapshot`, `listSnapshots`, `getSnapshotRoster`,
`getPlayerHistory(uid)`, `deleteSnapshot`, `updateSnapshot`.

## The switcher

A compact select in `Navigation`, directly beneath the FM Jotter heading,
listing snapshots newest date first and labelled by date — `24 Jan 2035` —
with the label appended when one is set. A single snapshot renders as static
text, not a control. An undated snapshot renders as *Undated*.

When the active snapshot is not the newest **by date**, the sidebar carries a
paprika **Historic** badge. This is the whole justification for a global switcher over
per-view ones: the state is visible from everywhere, and an old snapshot
cannot be quietly mistaken for the current one.

Changing it sets `activeSnapshot`, drops the loaded roster, and re-renders
every view.

## Snapshot management

The Import view gains a snapshot table above the file input: date, label,
player count, an active marker, and per-row *Set date*, *Rename* and *Delete*.
Deleting asks first, removes the metadata record and the rows together, and
is refused for the last remaining snapshot — clearing everything is what *New
save* is for.

Below it, total usage from `navigator.storage.estimate()`, shown against the
quota, so several hundred megabytes of snapshots is a number the user can see
before the browser tells them about it.

## Player history

`PlayerProfileView` gains a History section: one row per snapshot the player
appears in, from a single `by-uid` read. The index returns those rows ordered
by UID then by primary key, and the primary key's leading component is a UUID
— so index order is arbitrary and **the rows must be sorted by joining each
`s` to its snapshot's date**, newest first. Sorting them as they arrive
happens to look right until an older export is imported after a newer one,
which is exactly when it stops being right. Columns are the date,
Club, Age, Starts, Mins, and his role's `ROLE_CONFIG` display stats.

**These are raw per-90s, not percentiles**, and the section says so. A
percentile needs its snapshot's whole cohort; rendering four historic
cohorts to open a profile page means four 50k loads. Precomputing percentiles
at import does not rescue it either — they depend on league rankings and
custom positions the user edits *after* importing, so a stored value would be
computed from rankings that no longer exist.

Each historic row therefore carries a **Rank this row** action that loads that
one snapshot's cohort on demand and fills its percentiles in place, using the
existing `buildScoutingCohort` and `computeScoutingData` against that
snapshot's players and the role the profile is currently showing. Cheap by
default, expensive only when asked, and honest in both states.

A player absent from the active snapshot — signed since, or retired before it
— still has a profile. The current-data sections render their empty states and
the header falls back to the annotation's `lastKnownName` and `lastKnownClub`,
as the planner's orphan cards already do; the History section renders in full,
because it is the one part of the page that does not depend on the active
snapshot.

Raw numbers answer most of the motivating question — three seasons of
0.6 goals per 90 is not a fluke — while drifting league quality is the part
they answer badly, which is what the on-demand ranking is for.

## Planner

`SquadPlan.horizon` changes from a typed date string to
`'now' | 'season' | '1y' | '2y' | null`, resolved against the active
snapshot's date. `parseHorizon` becomes
`resolveHorizon(snapshotDate, preset)`. The toolbar's text input becomes a
four-option select; a stored typed horizon is discarded on load.

`'now'` resolves to the snapshot date itself, so the tint means "already
expired or expiring today". `'1y'` and `'2y'` add whole years to it.
`'season'` resolves to 30 June following the snapshot date — a European
season boundary, and the one assumption in this design taken from football
rather than from the data.

An undated snapshot produces no horizon and no contract tint, matching the
current behaviour of an empty planning date.

**Remove missing is disabled unless the active snapshot is the newest by
date.** It
counts placed players absent from the active snapshot; viewed on a 2033
snapshot it would offer to delete players who are in the 2035 squad and
perfectly present. The button is disabled with a note saying why, rather than
hidden.

`CompareView` has the same shape of problem and needs no fix: a compared
player missing from the active snapshot renders as missing, which is true.

## Migration

Version 5 to 6, in one `versionchange` transaction:

1. Create `snapshots` and `playerSnapshots` with their keyPaths and the
   `by-uid` index.
2. If `players` holds rows, create one snapshot — `date: null`,
   `label: "Imported data"` — and cursor every row into it, packed.
3. Delete the `players` store.

The copy walks a cursor rather than gathering promises. A `versionchange`
transaction commits as soon as the microtask queue drains with no pending
request, so cursor iteration is what keeps it alive across 50k rows; a
`Promise.all` over gathered rows, or an await on anything that is not an
IndexedDB request, closes it mid-migration.

The migrated snapshot is undated because the app cannot know when that export
was taken. It shows as *Undated* in the switcher until the user sets its date
in the snapshot table.

A 50k-row upgrade is the riskiest part of this design. If it proves
unreliable, the fallback is cheap and should be taken rather than patched
around: drop `players` without copying and re-import the file. Annotations,
lists, rankings, club and plan all live in stores the upgrade does not touch,
so the cost is one import, not a lost save.

`getDB()` already caches a rejected upgrade deliberately, so a failed
migration fails every call until reload rather than serving a half-migrated
schema. That behaviour is correct here and stays.

## Implementation order

This is one feature but four separable stages, and the app should build and
run at the end of each. The plan should follow these seams.

1. **Storage.** `pack.ts`, the v6 schema, the migration, and the snapshot db
   functions. Nothing above `services/db` changes yet: `getAllPlayers` becomes
   a read of the active snapshot, and `getPlayersByClub` and
   `getPlayersByPosition` survive this stage as in-memory filters over it, so
   every existing view keeps working untouched. Stage 2 deletes them.
2. **Reading.** `SnapshotProvider`, the two hooks, and the eleven call sites.
   Still one snapshot, still no switcher — this stage is the refactor, and its
   payoff is the duplicate-load fix even before any historic data exists.
3. **Import and switching.** The save gate, the date field, chunked writes,
   the sidebar switcher, the Historic badge, and the snapshot table on the
   Import view. This is the stage that first produces a second snapshot.
4. **Consumers.** Profile history, the planner horizon change, and the
   *Remove missing* guard.

## Testing

Behaviour-only Playwright, few tests, each verified by mutation — breaking the
behaviour must break the test.

1. Importing `emmen_24_01_2035.html` creates a snapshot dated 24/01/2035
   without the user typing a date.
2. With two snapshots, switching the sidebar selector changes the players a
   view renders, and the Historic badge appears on the older one.
3. *New save* clears annotations; *Same save* leaves them intact and adds a
   snapshot.
4. A player's profile history lists every snapshot he appears in.
5. Importing 2035, then 2036, then a back-filled 2033 file: the switcher lists
   all three in date order, the 2033 one is active with the Historic badge
   shown, and the profile history reads 2036, 2035, 2033 top to bottom. This
   is the one test that catches ordering taken from import time.

One exception to behaviour-only: a `pack`/`unpack` round-trip over a fully
populated `Player`, including a null `Expires`, both position fields, and a
`fields` list shorter than the current one. A field-order bug there corrupts a
snapshot silently and no view-level test would localise it.

## Consequences

- The database grows with use. Four snapshots of the current save is roughly
  120 MB, which the storage panel reports and per-snapshot delete controls.
- Percentiles are never comparable across snapshots without an explicit
  action, by design.
- A partial export imported as a snapshot renders a mostly empty app. Nothing
  guards against it; see Assumptions.
- Snapshots belong to one save. Keeping two saves means choosing between
  them, which is what named saves would later fix.
