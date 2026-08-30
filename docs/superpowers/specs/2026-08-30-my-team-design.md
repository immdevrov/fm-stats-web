# My Team: Club Selection — Design

Date: 2026-08-30
Status: Approved for planning
Sub-project: B of A–E (first iteration; see Roadmap in the sub-project A spec)

## Problem

FM Jotter treats every club alike. Reaching your own squad means going to
`/teams`, searching for the club, and clicking through — every session, from
every view. Nothing in the app knows which club is yours.

That gap also blocks later work. Sub-project C (squad planner) needs a squad to
plan, and sub-project D needs a team to compare against. Both depend on a
persisted answer to "which club is mine", and neither can start until one exists.

## Scope

In scope: a persisted club selection, the `/my-team` route and navigation entry,
the two flows that set it, and extracting the squad table so both team pages
share one implementation.

Out of scope: team statistics. Sub-project B's roadmap entry names a team
statistics screen; this iteration deliberately omits it. `/my-team` shows the
roster and nothing computed. Also out of scope: the squad planner (C), team
tendencies (D), and pointing the app's index route at `/my-team`.

## Decisions

Settled during brainstorming; not open for re-litigation during implementation.

| Decision | Choice | Consequence |
|---|---|---|
| Route | Own `/my-team` route and view | Gives C and team statistics a home; no later restructure |
| Squad table | Extracted and shared | One table, rendered by both `/my-team` and `/teams/:teamName` |
| Setting entry points | `/my-team` empty state, plus a button on the team page | Two writers, both obvious; no star column in `TeamsView` |
| Storage | Generic `settings` store | Later preferences (formation, default view) need no new store |
| Club identity | Club name | The export carries no club id, and `getPlayersByClub` already keys on the name |
| Nav label | Constant "My Team" | The sidebar does not reflow when the club changes |
| Missing club | Kept, shown as absent | Follows sub-project A's orphan policy |

## Data model

One new object store, database version **5**.

```ts
// store: settings, keyPath 'key'
interface Setting {
  key: string;
  value: unknown;
}
```

No migration: the v5 `upgrade` branch creates the store and nothing else.

The store is generic, but its accessors are not. `src/services/db/settings.ts`
keeps the untyped get/set private and exports typed pairs:

```ts
getMyClub(): Promise<string | null>
setMyClub(club: string | null): Promise<void>
```

Callers never handle a loose key string. Every future preference adds its own
typed pair rather than a new store.

`src/services/db/index.ts` composes the module alongside `players`, `rankings`,
`compare` and `annotations`. The rest of the database layer is unchanged.

## State layer

`MyTeamProvider` in `src/contexts/MyTeamContext.tsx`, modelled on
`CompareContext` — load once on mount, persist on change — mounted in `Layout`
beside `CompareProvider` and `PlayerNotesProvider`.

Exposed by `useMyTeam()`:

- `myClub: string | null`
- `isLoaded: boolean`
- `setMyClub(club: string)`
- `clearMyClub()`

`isLoaded` is not incidental. Without it `/my-team` renders its empty-state
picker for a frame before the saved club arrives from IndexedDB, so a user with
a club set sees the "which club is yours?" prompt flash on every visit.

The context holds the club name only, not its players. Views load the roster
themselves through the existing `db.getPlayersByClub()`.

## Components and views

### Shared squad table

`TeamProfileTable` currently lives inside `src/views/TeamProfileView.tsx`. It
moves to `src/components/SquadTable.tsx` and takes `players: Player[]` and
`club: string`. Its behaviour is unchanged: status control column, unwanted row
dimming, name linking through to the player profile, sorted by starts.

Both team pages render it. Nothing about the table knows which club is yours.

### `MyTeamView`

`/my-team`, with four states:

| State | Renders |
|---|---|
| Not loaded | Spinner |
| No club set | "Which club is yours?" over a `SearchableSelect` of every club in the imported data. With nothing imported, a message and a link to Import instead. |
| Club set | Club name as the heading, a "Change club" button that swaps the header back to the picker, and `SquadTable` below |
| Club set, absent from data | Club name with "not in current data", and the change control. No table. |

The picker reuses the `SearchableSelect` already used by `TeamsView`, over the
club list derived the same way — from `db.getAllPlayers()`.

### `TeamProfileView`

Gains a "Set as My Team" button in its header. When the club being viewed is
already your team, the button is replaced by a read-only "My Team" badge.
Changing your club happens on `/my-team`, or by claiming a different one here.

### `Navigation`

`{ path: "/my-team", label: "My Team" }` is added at the top of `navItems`,
above Import.

## Import behaviour

The setting lives in `settings`, a store `clearAllPlayers()` does not touch, so
it survives a re-import without any change to the import flow — the same
property league rankings already have.

It does **not** join the "Preserve data" dialog. That dialog exists for
user-generated data whose loss is costly; a single preference re-picked in two
clicks is not that, and a fourth checkbox would dilute the three that matter.

No "Clear My Team" button is added to the Import view. `/my-team` owns setting,
changing and clearing the club.

## Missing club handling

A re-import may not contain the saved club — a different set of leagues was
exported, or the club was filtered out. The setting is **kept** and the view
reports the absence, rather than silently clearing.

This is the policy sub-project A settled for annotations: an entity absent from
one week's export is not evidence the user changed their mind. The recovery path
is the same "Change club" control used everywhere else, so no cleanup affordance
is needed beyond it.

## Testing

Per project policy: behaviour tests only, main behaviours only, Playwright
browser mode only, no unit or jsdom layer. No tests are added by default.
Temporary tests written while debugging are deleted afterwards.

One candidate is pinned for a decision after implementation, not before: **the
selected club survives a re-import**. If it is pinned, it must then be validated
by mutation testing.

## Follow-ups

Deliberately deferred, recorded so they are not rediscovered as bugs:

- **Index redirect** — `/` still redirects to `/import`. Sending it to
  `/my-team` when a club is set requires a load gate at the router root, which
  this iteration does not justify.
- **Team statistics** — the rest of sub-project B. `/my-team` is the screen it
  lands on.
