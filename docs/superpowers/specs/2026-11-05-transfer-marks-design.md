# Transfer marks

## Problem

Imports happen at the end of a season; transfers happen at the start of the
next. Between the two, the newest snapshot is already out of date: a player
agreed to be sold still shows in the squad, and one agreed to be signed shows
at his old club. Re-exporting fixes that only once the game has completed the
deal, and not for deals that are agreed but not yet done.

A transfer mark is a note that bridges that gap: *this player is leaving* or
*this player is arriving*. `/my-team` and the planner treat the squad as the
import plus those notes. The next import that reflects the deal makes the mark
redundant, and it is then shown as done rather than silently dropped.

## Not lists, a flag

The request was two new special lists beside Unwanted. In the UI that is what
they look like: two tabs on `/lists`, two entries in the status menu. In
storage they are one field on the annotation, next to `unwanted`:

```ts
interface PlayerAnnotation {
  // ...
  transfer?: 'in' | 'out';
}
```

A player cannot be both in and out, and neither mark needs ordering or
many-to-many membership. That is what a field gives you and a pair of
`PlayerList` records would not. The `playerAnnotations` store is schemaless, so
there is **no migration and no version bump**.

### One status at a time

A player carries at most one of *unwanted*, *in*, *out*. Setting any one clears
the other two, in the same `put`.

- *In* and *unwanted* contradict each other: you do not sign a player you have
  ruled out.
- *Out* replaces *unwanted*: a player you wanted rid of and have now sold has
  moved on from "ruled out" to "leaving".

Unwanted still removes a player from every list. A transfer mark does not: an
incoming player who was on a shortlist stays on it.

## Where marks apply: the newest snapshot only

Marks look forward from the newest import. Applying them to a 2031 snapshot
would grey out a player in a season he played in full. So:

- On the **newest** snapshot, `/my-team` and the planner use the marked squad.
- **Off the newest**, both show the import as it is. A one-line note under the
  tabs says marks apply to the newest snapshot only. This follows the existing
  rule that the planner writes back and offers *Remove missing* only on the
  newest.

The status badge and the `/lists` tabs show marks on every snapshot, because
they describe the mark, not the squad.

## The marked squad

One helper, `src/utils/squad.ts`, used by `/my-team` for both tabs:

```
imported  = players whose Club === myClub
incoming  = players marked in whose Club !== myClub
outgoing  = imported players marked out
squad     = (imported − outgoing) ∪ incoming
```

The helper is a pure function of the roster, `myClub` and the annotations. It
returns all four sets, because the table needs `outgoing` and the planner does
not. Off the newest snapshot, `MyTeamView` skips the helper and uses `imported`
as the squad, with both other sets empty.

### Done is derived, never stored

A mark is **done** when the newest snapshot already shows the move: a player
marked *in* is now at `myClub`, or a player marked *out* is now elsewhere. The
formula above already treats a done mark as having no effect. Nothing is
auto-cleared on import, so a deal that fell through keeps its mark until the
user decides what to do with it.

Done is only computed on the newest snapshot. Off it, no mark is shown as done.

## `/my-team` squad table

`SquadTable` takes a new optional `transfers` prop. Only `MyTeamView` passes
it; `/teams/:teamName` does not, so a team profile always shows the import
unchanged, including your own club's profile.

With `transfers` set:

- **Incoming rows** are added to the table. Next to the name they show a small
  `IN · from <club>` tag, where the club is the player's current club in the
  import.
- **Outgoing rows** stay in the table, greyed the same way unwanted rows are
  now, with an `OUT` tag next to the name.
- A done mark shows no tag: the row is already where it belongs.

The header count shows the marked squad, with a breakdown when anything is
pending: `27 players · +2 in · −1 out`.

The "club not in the current data" gate stays on `imported`. A club with no
imported players but some incoming ones is still absent from the import.

## Planner

`SquadPlanner` receives the marked squad as `players` in place of the raw club
filter. Everything else follows from that.

- **Candidate pool** = `squad ∪ (listed − marked out)`. A player marked *out*
  never shows up as a candidate, even if he is on a list. An incoming player
  appears in the *Squad* tab, not *Lists*, and loses the ★ there.
- **Leaving is decided in one place.** Today `PlannerCard` re-derives
  "departed" (`Club !== myClub && no lists`) separately from the `presentUids`
  set the toolbar counts. Those two definitions agree now, but would drift
  apart once marks exist. The card should instead read presence from the same
  `presentUids` set: a placed player is *departed* when he is in the import but
  not in `presentUids`. A placed player marked *out* therefore dims, is counted
  in "N no longer in the squad", and is removed by *Remove missing*, the same
  as one who has already left.
- **Marker text.** A departed card already names his new club. A card marked
  *out* whose player is still at `myClub` reads "Marked as leaving" instead.
  An incoming card gets the same small in-marker the status badge uses.

Off the newest snapshot the planner sees no marks. This is consistent: *Remove
missing* is already disabled there.

## Status menu and badge

`PlayerStatusControl` gains one transfer action under *Mark as unwanted*. Which
action shows depends on the player's club in the active snapshot:

| State | Shown |
|---|---|
| marked in / out | *Clear arriving* / *Clear leaving* |
| unmarked, `Club === myClub` | *Mark as leaving* |
| unmarked, `Club !== myClub` | *Mark as arriving* |
| no `myClub` set | nothing |

`PlayerStatusBadge` shows an arrow for a marked player, with priority
**transfer > unwanted > lists**. The arrow is `↘` in glaucous for in and `↗` in
spicyPaprika for out. Its tooltip reads "Arriving" or "Leaving", plus the note
if there is one, following the unwanted tooltip. The badge does not show
*done*: it takes only a uid, and working out done needs the roster, which the
badge must not trigger a load of. Done is shown on `/lists`, where the roster
is already loaded. While a player is marked, the list checkboxes stay enabled, unlike
unwanted.

`PlayerNotesContext` gains `transferOf(uid)` and `setTransfer(uid, value |
null, player?)`, next to `isUnwanted` / `toggleUnwanted`. The DB function
`setTransfer` follows `setUnwanted`: one transaction, records
`lastKnownName` / `lastKnownClub`, and clears `unwanted`. `setUnwanted(…, true)`
clears `transfer` in turn.

## `/lists`

There are two new built-in tabs after Unwanted: **Arriving (n)** and
**Leaving (n)**. Their rows use the same columns and the same not-in-data
handling as the Unwanted tab, plus:

- A **Done** marker on rows whose mark is done.
- A **Clear done** button that removes every done mark on that tab. It is
  disabled off the newest snapshot, with the same hover explanation *Remove
  missing* gives.
- A one-line explanation, as Unwanted has: *Agreed or planned moves. /my-team
  and the planner treat these as already done until an import shows them.*

## Clearing

- **New save** already clears all annotations, which clears the marks with
  them. No change needed.
- **Clear all lists** on `/import` (`clearListsAndAnnotations(false)`) already
  drops every annotation field except `customPosition`, so marks go too. Its
  toast text gains "transfer marks".
- **Same save** touches nothing. Done marks stay until cleared.

## Out of scope

- No fee, date or "loan" detail on a mark. The note and price fields already on
  the annotation cover that.
- No effect on percentile cohorts, scouting, or `/teams/:teamName`. A mark is
  about your squad, not about where the player plays in the data.
- No automatic clearing of done marks.

## Testing

One Playwright test in `browser-tests/`, extending the pattern in
`planner-departures.spec.ts`, pinning the main behaviour. It marks one squad
player *out* and one other-club player *in*, then checks three things. On
`/my-team`, the outgoing row carries `OUT` and the incoming row is present. In
the planner, the outgoing player is absent from the candidate pool and the
incoming one is present. And after placing the outgoing player, the toolbar
counts him as no longer in the squad. The test is mutation-checked
before it is kept, e.g. by dropping `outgoing` from the squad formula, or by
reverting the card to its own departed rule.

Nothing else gets a test.

## Docs

Add a **Transfer marks** section to `CLAUDE.md`. It covers the storage field,
the one-status rule, newest-only application, `squad.ts` as the single
definition of the marked squad, done-is-derived, and `SquadTable`'s
`transfers` prop. In the Squad Planner section, change the "Two ways to leave"
paragraph to three ways, and note that presence is read from `presentUids`.
