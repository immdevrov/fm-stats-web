# Player notes

## Problem

There are two free-text fields about a player, and they do not know about each
other:

- the **note** on the player annotation — one per player, edited on the
  profile, shown in the `/lists` Note column and the status badge tooltip;
- the **verdict** on a brief pick — one per player per brief, edited and shown
  only on the brief page.

The same opinion gets typed twice, the profile never shows what was written on
a brief, and a verdict is deleted with its pick when the player leaves the
shortlist — often the very text that said why he left.

## The idea

A small notes log per player, like the game's: several notes, each dated, each
optionally **tagged with a brief**. A verdict is just a note tagged with a
brief. Notes belong to the player, so removing him from a shortlist, unlinking
a list or deleting a brief never touches what was written.

## Storage

`notes?: PlayerNote[]` on `PlayerAnnotation`:

```ts
interface PlayerNote {
  id: string;
  text: string;
  date: string | null;
  briefId?: string;
  briefName?: string;
}
```

- **Array order is write order**; the log is shown newest first, and "latest"
  means the last entry in the array (of those matching, when filtered by
  brief). Editing keeps a note's position. Order follows writing, not `date`,
  on purpose: deleting a snapshot or editing its date can make the dates
  disagree with the order, and that is fine.
- **`date`** is the newest snapshot's game date (`newestSnapshot()`, ISO
  `YYYY-MM-DD`) at the moment the note is added, `null` when that snapshot is
  undated or there is none. Never the machine clock. Editing never changes it.
- **`briefName`** is the brief's name when the note was added, kept only so a
  note can still be labelled after its brief is deleted. A live brief is always
  labelled with its current name.
- `text` is trimmed and never empty.

DB functions in `src/services/db/annotations.ts`, each one read-modify-write in
a single `readwrite` transaction (not `setAnnotation`'s two separate calls), and
each refreshing `lastKnownName`/`lastKnownClub` like the existing writers:

- `addNote(uid, { text, date, briefId?, briefName? }, player?)` → generates the
  id (`generateId("note")`);
- `updateNote(uid, noteId, text)`;
- `deleteNote(uid, noteId)`.

`updateNote` and `deleteNote` on a note id that no longer exists are silent
no-ops.

`setAnnotation` becomes a single read-modify-write transaction too, so a price
or list write landing at the same moment as a note write cannot overwrite the
note with a stale copy.

`PlayerNotesContext` exposes `addNote`, `updateNote`, `deleteNote` (each
refreshing annotations afterwards). `setPricing` loses its `note` field;
`PricingFields` loses the Note input.

### Old notes and verdicts are dropped

Roman chose not to migrate them.

- **Annotation `note`**: database version 7. The upgrade walks
  `playerAnnotations` with a cursor and, for each record that has a `note`,
  deletes the field and `cursor.update`s it. It runs only when
  `oldVersion >= 4 && oldVersion < 7` (below 4 the store was just created). It
  awaits nothing but IDB requests (the versionchange transaction auto-commits
  otherwise) and joins the existing upgrade chain: after
  `migrateToSnapshots` when there is a `players` store, on its own otherwise,
  with one `.catch` that aborts the transaction either way. Needed because
  every annotation writer spreads the existing record and would carry `note`
  forever.
- **Pick `verdict`**: no upgrade step. `_coercePicks` stops reading it, and
  `BriefProvider` saves the coerced briefs as soon as it loads, so the field is
  gone from storage on the first visit.

No new store. `BriefPick` loses `verdict`, `setVerdict` goes from
`brief-picks.ts` and `BriefContext`, `BriefRow` swaps `verdict` for
`note: PlayerNote | null` (the latest note tagged with this brief, computed in
`buildBriefRows` from the annotations it already receives) and
`noteCount: number` (all his notes).

### Lifecycle

- *New save* and *Clear lists* already clear annotations (keeping custom
  positions where they do today), so notes go with them. Briefs survive *New
  save*; notes tagged with them are simply gone.
- Deleting a brief leaves its notes; the tag then reads as plain text with the
  stored `briefName`, not a link.
- Pick pruning is unchanged: rank and grade still go when a player leaves the
  linked list. Notes are not picks and are never pruned.

## Labels

`src/utils/player-notes.ts` (pure):

- `latestNote(notes, briefId?)` — the last note, or the last tagged with that
  brief.
- `noteBriefName(note, briefs)` — the live brief's name, else `briefName`, else
  `null` for an untagged note.
- `noteSummary(note, briefs)` — `"<brief name>: <text>"` for a tagged note,
  plain text otherwise.

## The notes log — `PlayerNotesLog`

One component, used inline on the profile and inside the drawer.

Props: `uid`, optional `player` (identity for `lastKnown*`; omitted for a
player absent from the active snapshot, so nothing like *Unknown player* is
ever written into `lastKnownName`), optional `defaultBriefId`.

- **Add box** at the top: a textarea labelled *New note*, a brief select (*No
  brief* plus every brief by name; preselected to `defaultBriefId` when given)
  and an *Add note* button, disabled while the text is blank. Adding clears the
  text and keeps the selected brief.
- **Entries**, newest first. Each shows its date (`isoToDisplay`, or
  *Undated*), the brief tag when tagged — a link to `/briefs/:briefId` if the
  brief exists, plain muted text otherwise — and the text (line breaks kept).
  Tags render only once briefs have loaded, so a live brief never flashes as a
  deleted one.
- **Edit** (pencil) turns the text into a textarea labelled *Edit note* with
  *Save* / *Cancel*. Saving blank text is the same as *Cancel*. The date and
  tag never change.
- **Delete** (trash) asks with the existing `ConfirmDialog` (one option,
  *Delete note*), then removes.
- Empty log: *No notes yet.*

Notes work for a player absent from the active snapshot as well: they live on
the annotation, keyed by uid.

## Where notes show

### Player profile

The *Pricing* box keeps price and wage demand. A new **Notes** box below it
holds `PlayerNotesLog`. The missing-player branch of the profile (a player not
in the selected date's data) shows the Notes box too, above the history.

### Brief page

The line under the player's name (where the verdict was) shows his **latest
note tagged with this brief**, on one line, clipped (`lineClamp={1}`).

- Clicking it edits that note inline in an auto-growing textarea: Enter or
  blur saves, Shift+Enter adds a line break, Esc cancels, blank = cancel. A
  textarea rather than an input, so a multi-line note is never flattened by
  being opened and closed. With no tagged note, the line reads *Add note…*
  (visible on row hover or focus, as the verdict placeholder was) and saving
  adds a note tagged with this brief.
- Accessible name of both the line and its editor: `Brief note for <name>`.
- A small notes icon button in the name row, shown whenever the player has at
  least one note, opens the drawer with this brief preselected — the way to
  add a second, later-dated note for this brief, see dates, or delete.
  Tooltip: *Notes* when the line already shows his only note, otherwise
  *1 other note* / *N other notes*. Accessible name: `Notes for <name>`.

### `/lists`

The Note column shows the **latest note of any kind** as `noteSummary`, on one
line, cut with an ellipsis; sorting uses the same string. The cell is a button
that opens the drawer (no brief preselected). With no notes it reads a muted
*Add note…*. Accessible name: `Notes for <name>`.

### Status badge tooltip

`Unwanted — …` / `Arriving — …` / `Leaving — …` use `noteSummary` of the latest
note of any kind, as they used the plain note before.

## The drawer — `NotesDrawerProvider`

One Chakra `Drawer` (right side) for the whole app. `NotesDrawerProvider` sits
in `Layout` inside `BriefProvider` and exposes
`useNotesDrawer().open({ uid, name, identity?, briefId? })`. `name` is the
title (whatever the caller displays for the row); `identity` goes to
`PlayerNotesLog` as `player`. The body is `PlayerNotesLog`, keyed by every
`open` call so its add box starts empty with the right brief each time. The
drawer closes on any route change, so following a brief tag inside it lands on
the brief page without the drawer left open over it.

## Not included

Search across notes, notes on the planner, editing a note's brief tag or date,
migrating the old notes and verdicts.

## Testing

Per the project's policy: few, behaviour-only, Playwright, mutation-checked.
The two brief-page tests that pin verdicts are rewritten:

1. *A note written on the brief page shows on the profile, tagged with the
   brief, and survives a reload* — replaces "a grade and a verdict survive a
   reload" (keeps its grade half).
2. *A player removed from the shortlist loses his pick but keeps his note* —
   replaces the verdict half of "a player removed from the shortlist loses his
   pick": after removal and re-adding, the grade is gone and the brief note
   line still shows the note.

The version-7 cleanup is a one-time migration: tested temporarily, not
committed. `seedAnnotation` loses its `note` field.

## Docs

`CLAUDE.md`: a *Player notes* section (storage, date rule, drawer, where notes
show); *Database version 6* → 7 in Historic Snapshots; the Briefs section's
*Picks* line loses `verdict`; the who-beats-whom line's "the verdict editor"
becomes "the brief note editor".

## Known and left alone

- A note added on the profile while a historic snapshot is active refreshes
  `lastKnownName`/`lastKnownClub` from that snapshot, as price and list writes
  already do.
- No `blocked` handler on `openDB`: a second tab still on version 6 holds the
  upgrade until it is closed, as with every earlier version bump.
