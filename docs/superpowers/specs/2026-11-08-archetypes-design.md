# Archetypes, step 1: named scouting filters

## Problem

Scouting keeps one unnamed set of filters in `localStorage`. Looking for two
positions at once means overwriting one search with the other, and a carefully
tuned search — "fast flank dribbler who can head the ball" — is gone the moment
the thresholds move. There is no way to keep a search and come back to it.

An **archetype** is a named, saved scouting search. Step 1 is only that: save
the current search under a name, reapply it later, switch between several.

The name comes from the old archetype system (`calculateArchetypes` in
`src/utils/utils.ts`): a hard-coded named set of stats per role, a badge when a
player cleared the 60th percentile on all of them. It is no longer used. This
replaces it with the same idea made user-defined; the old code stays as a
reference until a later step brings badges back.

## Roadmap this belongs to

Each step builds on the one before; only step 1 is designed here.

1. **Archetypes as named scouting filters** — this spec.
2. An archetype owns a shortlist of pinned players.
3. A heat table of that shortlist: many players at once, percentile-coloured.
4. Dominance: grey out candidates beaten on every archetype stat.
5. Commit: manual ranking, a grade and a one-line verdict per candidate.

Later, maybe: must-have vs nice-to-have stats, badges, a planner-slot link, a
look-back across snapshots.

## What an archetype holds

Everything that shapes a scouting search today, except the view-only toggle
*hide unwanted*:

```ts
interface Archetype {
  id: string;
  name: string;
  filters: ScoutingFilters;
}

interface ScoutingFilters {
  roleKey: string;                       // ROLE_CONFIG key: "GK", "FB", "W", ...
  side: Side;                            // "both" | "left" | "right"
  columnFilters: Record<string, { min?: string; max?: string }>;
  contractHorizon: ContractHorizon | null;
  excludeInjuries: boolean;
  excludedLeagues: string[];
  sortKey: string;
  sortDirection: SortDirection;
}
```

- **Role by key, not index.** Today's saved filters store `selectedRoleIndex`;
  reordering or adding a role would silently point every saved archetype at
  the wrong one. `roleKey` is looked up in `ROLE_CONFIG`; an unknown key falls
  back to the first role.
- **Column filters are stored as the raw strings** the inputs hold, as today.
  Entries with neither `min` nor `max` are dropped before saving and before
  comparing, so clearing an input and leaving it empty is not a change.
- **Excluded leagues by name.** A league name that does not exist in the
  current import excludes nothing and is otherwise ignored.

## The contract filter becomes a preset

Today it is a typed `DD/MM/YYYY` date. Saved in an archetype that goes stale:
"expires before 06/2032" means nothing two seasons later. It becomes a preset,
resolved against the **active snapshot's date** with the planner's existing
`resolveHorizon()`:

```ts
type ContractHorizon = Exclude<HorizonPreset, "now">;   // "season" | "1y" | "2y"
```

Labelled *by end of season / within a year / within two years*. A player
passes when his contract expires on or before the resolved date. `now` is left
out: for scouting it would only mean "already expired".

- No preset → no contract filter (as an empty date field does today).
- The active snapshot has no date → the control is disabled and a set preset is
  not applied, the same rule as the planner's horizon. Nothing is derived from
  the machine clock.
- This replaces the date field in plain scouting too, not only inside
  archetypes. A date already in `localStorage` is dropped on load.

## Working state, active archetype, modified

Scouting still keeps its live filters in `localStorage` under
`scouting-filters`, now in the `ScoutingFilters` shape plus the id of the
active archetype, so a reload lands where the user left off. The old shape is
read once: `selectedRoleIndex` is mapped to its key, `contractBefore` is
dropped.

- **Applying** an archetype replaces the working filters with its filters and
  makes it active.
- **Modified** = an archetype is active and the working filters differ from
  its saved filters. Derived on render by comparison, never stored. Changing a
  threshold and changing it back is not modified.
- **Switching role tab** while an archetype is active leaves the archetype: the
  picker goes back to *no archetype*, the filters stay as they are. An
  archetype is a search for one role; the same thresholds on another role are
  a different search, not an edit of this one. The side selector is an edit,
  not a switch.
- **Deleting the active archetype** leaves the working filters untouched and
  the picker on *no archetype*.

## UI

One control in the scouting toolbar, beside the role tabs.

- **Picker** (a menu): every archetype, grouped by role, the
  current role's group first. Choosing one applies it, switching role tab if
  needed.
- **No archetype active:** *Save as archetype* — asks for a name.
- **Active, unmodified:** the name, and a menu with *Rename* and *Delete*
  (delete confirms).
- **Active, modified:** the name with a *modified* marker, and *Save*,
  *Save as new* (asks for a name; the new one becomes active and the original
  is left as it was), *Revert*.
- Applying another archetype while modified asks first — *discard changes?* —
  the one place an edit could be lost without the user choosing to.
- Names are trimmed, non-empty, and unique case-insensitively; the dialog says
  why when one is refused.

*Clear filters* keeps working as today and does not touch the active
archetype — afterwards it simply shows as modified, and *Revert* brings the
search back.

## Storage

One `Archetype[]` value in the `settings` store under key `archetypes`, read
and written through `db.getArchetypes()` / `db.setArchetypes()` — two
one-liners over the private `_get`/`_set` in `src/services/db/settings.ts`,
with a shape guard on read like `getSquadPlan`'s. Malformed entries are
dropped individually rather than discarding the whole value. **No schema
change.**

- **Survives every import.** A *New save* import does not clear archetypes:
  they describe the user's tactical taste, not one save's data. They are not
  in the snapshot stores, and `ImportView`'s New-save branch is not given a
  clear for them. Unlike My Team and the squad plan, a New save keeps them, and `CLAUDE.md`
  says so.
- **State**: `ArchetypeProvider` (`src/contexts/ArchetypeContext.tsx`), mounted
  in `Layout` beside the other providers so a later step's shortlist and
  `/lists` can read it. Same pattern as `SquadPlanProvider`: an `isLoaded` gate,
  a change counter so a late read never overwrites a user change, and a
  re-read on tab return through `useOnTabReturn`. The picker renders nothing
  until `isLoaded`.
- A failed write raises an error toast, as the planner's does; the working
  filters are never lost because they live in `localStorage` too.

## Not in step 1

- No shortlist, no badges, no weights, no must-have/nice-to-have split.
- No archetypes outside `/scouting`.
- No sharing, export or import of archetypes.
- No migration of the old hard-coded archetypes into stored ones.

## Testing

Per the project's policy: few, behaviour-only, Playwright, mutation-checked.
One test pins the main behaviour:

> Save the current search as an archetype → change a threshold → the picker
> shows *modified* → *Revert* restores the threshold → reload, still active →
> switch role tab (leaves it) → choose it again and its filters come back, role tab included.

Anything else (the contract preset, name uniqueness, the discard prompt) is
checked by hand while building, with temporary tests deleted afterwards.
