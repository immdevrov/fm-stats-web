# Archetypes, step 2: a shortlist per archetype

## Problem

Step 1 made a scouting search something you can name and come back to. The
players it turns up still have nowhere to go that belongs to the search: putting
one on a shortlist means opening his status popover and ticking a list, and
nothing ties that list to the search that found him. The roadmap's later steps
(heat table, dominance, verdicts) all work on "the candidates for this
archetype", so that set has to exist first.

Step 2 lets an archetype **link** to one ordinary `/lists` list. The list stays
just a shortlist — the link is a reference from the archetype, nothing more.

Roadmap: `2026-11-08-archetypes-design.md`. This is step 2 of 5.

## The link

```ts
interface Archetype {
  id: string;
  name: string;
  filters: ScoutingFilters;
  listId?: string;
}
```

- **One list per archetype, many archetypes per list.** The reference lives on
  the "many" side, the archetype — what a nullable foreign key with
  `ON DELETE SET NULL` would be in a relational schema. `PlayerList` is
  unchanged.
- **The link is not a filter.** Linking, changing or unlinking saves
  immediately. It is not compared when deriving *modified*; *Save* and *Revert*
  do not touch it.
- **Save as new copies the link**, so a variant of a search feeds the same
  shortlist. The user can unlink the copy afterwards.
- **A link to a list that does not exist is no link.** Rendering looks the id up
  in the current lists and treats a miss as unlinked, without writing anything.
  IndexedDB enforces no references, and this covers a failed write between the
  two steps of a delete. There is no separate repair pass.
- **Unknown is not missing.** Until `PlayerNotesProvider` has loaded, `lists` is
  empty and every link would look missing. No link UI — list name, link menu
  items, pin, *Shortlist only* — renders until notes are loaded, and none at all
  when notes failed to load, so a load error never invites relinking over a list
  that still exists.
- The read guard in `getArchetypes()` keeps `listId` only when it is a
  non-empty string. **No schema change** — still the `archetypes` value in the
  `settings` store.

## Lifecycle

- **Deleting a list on `/lists`.** When one or more archetypes link to it, the
  existing confirm names them: *"Wingers" is the shortlist of Inverted winger,
  Classic winger. Delete it and unlink?* An unlinked list keeps today's message.
  Confirming deletes the list, then unlinks it from every archetype. If the
  second write fails, the stale ids read as no link. *Delete* is disabled until
  archetypes have loaded, since the confirm needs their names.
- **Marking a pinned player unwanted unpins him** — `setUnwanted` already strips
  him from every list; nothing extra is needed.
- **New save.** Lists are erased, so every link goes; the archetypes themselves
  survive, as in step 1. After the erase block, beside `clearMyClub()` and
  `clearPlan()`, the import calls the provider's `unlinkAll()`, which clears
  `listId` from every archetype in storage and in live state.
- **Deleting an archetype** leaves its list alone.

## Provider

`ArchetypeProvider` gains three mutators, each a `change(...)` like the
existing ones, so the change counter protects them from a late read and the
save effect writes the whole value:

- `setList(archetypeId, listId | null)` — `null` removes the key
- `unlinkList(listId)` — clears it from every archetype that links to it
- `unlinkAll()`

`create(name, filters)` gains an optional third argument, `listId`, for *Save
as new*.

**Changes before the first read.** Today the late first read keeps the current
state whenever a change has been made, which is safe only because the picker —
until now the only caller — renders nothing before `isLoaded`. `unlinkList` and
`unlinkAll` are called from `/lists` and `/import`, so a change made before the
read lands would be applied to `[]` and the save effect would then write `[]`
over every archetype. Instead, a change made before `isLoaded` is also queued,
and the first read applies the queue to the stored value rather than keeping
the current state.

A failed write raises the existing *Archetypes Not Saved* toast.

## `/scouting`

### Archetype menu

The `…` menu is shown whenever an archetype is active — modified or not — and
holds the same items in both states: the link items, then *Rename* and
*Delete*. The modified state keeps its *modified* marker and *Save / Save as
new / Revert* buttons after the menu.

- **Not linked:** *Link list…*.
- **Linked:** *Change list…* and *Unlink*. Unlinking only drops the reference;
  the list stays.

Both open one **link dialog**: a *List* select whose first option is *New list*,
followed by every list by name. *Link list…* opens on *New list*; *Change
list…* opens on the current list. With *New list* chosen, a *Name* input
appears, prefilled with the archetype's name. A new name is trimmed and must be
non-empty and not match an existing list's name case-insensitively — the
dialog says *A list with that name exists — pick it above.* so a typed name
never quietly creates a duplicate. Confirming creates the list if needed, then
links it. A failed create raises a *List Not Created* error toast and links
nothing.

When linked, the list's name is shown in muted text right after the picker
button, before the `…` menu, so it is clear where pins go.

### Pin toggle

A pin button beside each row's status badge, present only while an archetype is
active **and** linked. Filled when the player is on that list. Clicking adds or
removes him through the existing `addToList` / `removeFromList`. Disabled for
unwanted players, as the list checkboxes in the status popover already are.
Labelled *Pin {name}* with `aria-pressed` for its state. It is its own
component reading `usePlayerNotes()` directly, so its state follows the lists
without the table's column memo having to.

### Shortlist only

A checkbox beside *Hide unwanted*, present only while the active archetype is
linked. It narrows the rows the current filters already show to the listed
players; percentiles still come from the full cohort. Plain view state like
*Hide unwanted*: not part of the archetype, not in `localStorage`, gone on
reload. Turning it on resets to page 1. The filter applies only while the
toggle is on **and** a linked list is shown — derived, so a moment of unloaded
lists never flips it — and the toggle itself is reset when the active archetype
changes.

Without an active archetype — including after a role-tab switch, which leaves
it — neither the pin nor *Shortlist only* is shown. Pins work on every snapshot;
lists are not tied to snapshots.

## Not in step 2

- Showing listed players who fail the current filters or the cohort rules.
- Pinning from anywhere but `/scouting` (`/lists` and the status popover work as
  today).
- A heat table, dominance, ranking or verdicts — steps 3–5.

## Testing

Per the project's policy: few, behaviour-only, Playwright, mutation-checked.
One test pins the main behaviour:

> Save an archetype → *Link list…* with a new list → pin two players, unpin one
> → *Shortlist only* shows exactly the pinned one → on `/lists` the list holds
> him → delete the list; the confirm names the archetype → back on `/scouting`
> the archetype is still active, with no pin buttons and no *Shortlist only*.

The confirm is a `window.confirm`, captured with a Playwright dialog handler.

Checked by hand while building, with temporary tests deleted afterwards: unlink
on *New save*, a shared list, the disabled pin for unwanted players, *Save as
new* copying the link.

## Docs

The Archetypes section of `CLAUDE.md` gets the link: where it is stored, that
it is not a filter, the delete and New-save rules, missing list = no link.
