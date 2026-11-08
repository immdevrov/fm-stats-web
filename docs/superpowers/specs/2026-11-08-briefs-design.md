# Briefs, step 3: the brief page and its heat table

## Problem

Steps 1–2 gave scouting named searches (archetypes) and a shortlist per search.
Comparing the shortlisted players still happens in the scouting table with
*Shortlist only* ticked, and that view is the wrong tool for it:

- It only narrows the rows the current filters let through. Tighten a threshold
  and a pinned player silently drops out; a pinned player outside the cohort
  (under 900 minutes, an unranked league, another role) never shows at all.
- It shows every column the role has — around 20 stats and 8 groups for a
  full-back — with the brief's own stats buried among them.
- Its colours are three bands. Every pinned player already passed the brief's
  thresholds, so the brief's own columns read solid green, and 62 looks like 95.

Real clubs split this work in two. The manager writes a **brief** (a player
profile tied to the system); scouts turn it into a long list with data filters;
the long list is cut to a shortlist ordered by preference — stats, but also
availability, fee and wages — and a decision is made from that. FM's own
*Recruitment Focus* works the same way. In FM Jotter, `/scouting` is the scouts'
desk (the long list). This step adds the manager's desk.

Roadmap: `2026-11-08-archetypes-design.md`. This is step 3 of 5. Steps 4
(dominance) and 5 (ranking, grade, verdict) will land on the brief page built
here.

## One object, renamed

A brief **is** the archetype — the same stored record, renamed. No wrapper
object: separating a *need* ("replace my left-back by summer") from the *search*
that serves it is parked until real use asks for it.

- **UI**: every user-visible *archetype* becomes *brief* — the scouting picker
  (*No brief*, *Save as brief*, *Save as new brief*, *Rename brief*, *Delete
  brief*, *Brief actions*), its empty state, the name-taken message, the *Briefs
  Not Saved* and *Briefs Not Loaded* toasts, and the delete-list confirm on
  `/lists` (*"Wingers" is the shortlist of …*).
- **Code**: identifiers follow, so code and UI use one word. `Archetype` →
  `Brief`, `ArchetypeProvider`/`useArchetypes` → `BriefProvider`/`useBriefs`
  (`src/contexts/BriefContext.tsx`), `ArchetypePicker` → `BriefPicker`,
  `src/types/archetypes.ts` → `src/types/briefs.ts`, `src/utils/archetypes.ts` →
  `src/utils/briefs.ts`, `db.getArchetypes`/`setArchetypes` →
  `db.getBriefs`/`setBriefs`, `activeArchetypeId` → `activeBriefId`. The browser
  test files are renamed to `briefs.spec.ts` and `brief-shortlist.spec.ts`.
- **Kept on purpose**, as fixed identifiers like the `fm-stats` ones: the
  `archetypes` key in the `settings` store, the `scouting-filters`
  `localStorage` key, and the `activeArchetypeId` property inside that stored
  JSON. Renaming them would need a migration and gain nothing.
- **Not touched**: the old badge system — `calculateArchetypes` in
  `src/utils/utils.ts` and the `src/processors/*` that use the word — and
  earlier spec/plan documents.
- The rename is its own commit with no behaviour change.

## Pages

Sidebar: **Briefs** right after *Scouting*. Two routes.

### `/briefs` — the overview

A table, one row per brief, ordered by role in plain `ROLE_CONFIG` order, then
by name (case-insensitive).

| Column | Content |
|---|---|
| Brief | name, linking to `/briefs/:id` |
| Role | the role's `ROLE_CONFIG` name, plus the side when it is not *both* (*Fullback, left*) |
| Shortlist | linked list name, or a *Link list* button |
| Candidates | number of players on the linked list; blank when unlinked |

- *Link list* opens the existing `LinkListDialog` and does exactly what the
  picker's link action does (create a new list if chosen, then `setList`; a
  failed create raises *List Not Created*). That logic moves out of the picker
  into one hook, `useLinkBriefList()`, since it needs `createList` from
  `usePlayerNotes()` and `setList` from `useBriefs()`.
- **No roster read.** The candidate count is the list's length, so the overview
  stays cheap — like `/import`, it never calls `useRoster()`.
- Empty state: *No briefs yet — save a search as a brief on Scouting*, linking
  to `/scouting`.
- Rename and delete stay in the scouting picker.

### `/briefs/:id` — one brief

**Header**: the brief's name, then its criteria as one read-only line, then
*Open in scouting*.

- **Criteria line**, built from `brief.filters`, each part present only when it
  narrows something: role (and side); each column threshold using the scouting
  column abbreviation (*Tkl ≥ 60*, *Aer 40–80*, *Age ≤ 24*, *Wage ≤* the wage
  as `formatWage` prints it);
  the contract horizon (*contract by end of season* / *within a year* / *within
  two years*); *injury-free* when injuries are excluded; *N leagues excluded*.
  The sort is not shown. Only thresholds on columns the brief's role actually
  has count — role tabs do not clear column filters, so a stored brief can
  carry a key from another role, which scouting already ignores; so does this
  page (criteria line and heat columns alike).
- **Open in scouting** writes `{ filters: brief.filters, activeBriefId: brief.id }`
  through the existing `saveWorkingState` and navigates to `/scouting`, which
  reads its working state on mount. Scouting stays the only place a brief's
  criteria are edited.

**Body**: the heat table (below). With no linked list: *This brief has no
shortlist yet* and a *Link list* button (same helper as the overview). An empty
linked list: *No players on “{list}” yet — pin them from Scouting*.

## The heat table

### Rows

Every player on the linked list, in the list's own order — **regardless of the
brief's filters**. The filters found the players; once pinned, they are all
compared. The order is the list's `uids` order until the user sorts by a
column; step 5's manual ranking will replace it.

Rows are computed against the **active snapshot**, like every view. Percentiles
never mix snapshots.

### The cohort, and players outside it

The cohort is exactly scouting's: players of the brief's role class (role and
side — `LeftFullback` for *Full-back, left*), in a ranked league, with 900+
minutes, in the active snapshot. Its percentiles are computed exactly as on
`/scouting`, so a cohort player's numbers match scouting's to the digit.

A pinned player can fall outside it. **One definition** decides how:

```ts
type CohortExclusion = "minutes" | "league" | "role";
function cohortExclusions(player: Player, RoleClass, rankedLeagues: Set<string>): CohortExclusion[];
```

in `src/utils/scouting-engine.ts`. `buildScoutingCohort` keeps a player exactly
when this returns `[]`; the heat table's tags and the toast (below) read the
same function, so the three can never disagree.

- **Outside, but present**: he is **ranked against the cohort** without joining
  it — each of his stat values is placed in the cohort's sorted column, his
  derived stats are the role's formulas applied to those percentiles (as for
  everyone), and each of his group sums is placed in the cohort's sorted group
  sums. Nobody else's numbers move.
  His row carries one tag per reason: *620 min*, *Unranked league*, *Not a
  Fullback (left)* — the brief's `ROLE_CONFIG` name, plus the side when not
  *both*. The side classes follow the role classes' own rules (`LeftFullback`
  accepts `D (L)` only, so a `WB (L)` is tagged too), as scouting does.
- **Wrong role**: `Role`'s constructor refuses a player its `isRole` rejects. A
  wrong-role player is wrapped through a subclass of the brief's role class
  whose `isRole` accepts anyone, so his per-90s come from the same getters.
- **Empty cohort** — whatever the cause (no ranked league, or ranked leagues
  but nobody of this role class at 900+ minutes): nobody gets percentiles. Every
  present row shows its practical columns and tags, with blank heat cells.
  `getPercentile` throws on an empty list, so the engine guards this itself.
- **No stats at all** (0 minutes): blank stat cells and a *No stats* tag.
- **Absent from the active snapshot** (retired, or outside the export): a
  dimmed row named from his annotation's `lastKnownName` / `lastKnownClub`
  (falling back to *UID n*, as `/lists` does), a *Not in this snapshot* tag,
  and a *Remove* button that takes him off the list.

**One ranking path.** The engine exposes the cohort's ranking context — sorted
stat columns and sorted group sums — and one function ranks a single `Role`
against it. `computeScoutingData` builds its rows through that same function,
so a cohort member and an outsider are ranked by identical code:

```ts
interface CohortRanking { /* sorted stat columns, sorted group sums, roleConfig, statGroups */ }
function buildCohortRanking(cohort: Role[], roleConfig, statGroups): CohortRanking | null; // null when empty
function rankPlayer(player: Role, ranking: CohortRanking): ScoutingRow;
```

### Columns, left to right

1. **Player** — status badge, name linking to the profile, and the tags above.
2. **Practical** — age, club, league, wage, contract, minutes.
3. **The brief's stats** — every stat, derived stat and group with a threshold
   in `brief.filters.columnFilters` (keys `stat_*`, `derived_*`, `group_*`), in
   scouting's column order. Each header shows its threshold under the
   abbreviation (*≥ 60*, *40–80*), with the full stat name as the tooltip.
4. **The role's group ratings** — every group for the role not already in 3.
5. **All stats** — a toggle above the table. Off by default; on, it adds every
   remaining stat in `roleConfig.statKeys` and every derived stat — exactly the
   per-stat columns scouting shows — after the groups. Stats that exist only
   inside a group are not shown on their own, as on scouting. Plain view state,
   gone on reload.

A brief with no stat/derived/group thresholds has an empty block 3; the groups
lead. Age and wage thresholds show in the criteria line, not as heat columns.

The abbreviations, labels and the role-class-for-side helper now live outside
`ScoutingView` so both views read one copy.

### Colour

Heat cells are **filled**, on a continuous diverging scale centred on 50: red
below, neutral at 50, green above, saturation growing with distance from 50.
Inverted stats (*mistakes*, *possession lost*) are flipped first, as on
scouting, so green always means good. The number stays in the cell, readable in
light and dark mode. Scouting's three-band text colours are unchanged — this
scale is for the brief page only.

### Sorting

A leading **#** column holds the player's position on the list (1, 2, …).
Every column sorts on header click; percentiles sort on the displayed
(inverted-if-needed) value; rows with no value (absent, no stats, empty
cohort) sort last. Sorting by **#** is the way back to list order. Step 5's
manual ranking will take over that column.

## The toast

Adding a player to a list from the **status menu** (`PlayerStatusControl` — on
the profile, `/players`, `/lists`, squad tables and scouting) checks every brief
that links to that list. For each one he is outside — by `cohortExclusions`
against that brief's role class, using his record in the active snapshot — a
single warning toast lists the brief and the reasons. The roster comes from
`useRoster()` (every view hosting the control already calls it); league
rankings are fetched with `db.getLeagueRankings()` at add time.

> **Outside a brief's cohort** — Added to *Left-back targets*. *Attacking
> full-back*: 620 minutes. Ranked against the cohort — a rough guide.

With *no stats* as the only reason, the last sentence is left out.

- One toast per add, naming each brief he falls outside.
- No toast when he is inside every linked brief's cohort, when no brief links
  to the list, when the roster is not loaded, when fetching league rankings
  fails, when **no league is ranked at all** (every add would warn, and the
  brief page already says so), or when he is not in the active snapshot.
- 0 minutes reads *no stats*.
- The scouting **pin** never toasts: every scouting row is in the cohort of the
  brief it pins to. Creating a new list from the status menu never toasts:
  nothing links to a list that did not exist.
- The add itself never waits on the check.

## States

- **Briefs loading** → spinner; **briefs failed** → `LoadErrorNotice`.
- **Lists loading** → spinner; **lists failed** → an error notice, never *no
  shortlist* — unknown is not missing, as `linkedListOf` already rules.
- **Roster loading** → spinner; **roster failed** → `RosterErrorNotice`.
- **League rankings failed** → error notice; **none ranked** → the notice
  scouting already shows. The table still lists the pinned players (every one
  tagged *Unranked league*, no percentiles) — the empty-cohort rule above.
- **Unknown id** → *Brief not found* with a link to `/briefs`.
- Document titles: *Briefs*, *Brief: {name}*.

## Not in step 3

- Dominance (step 4), ranking / grade / verdict (step 5).
- Editing a brief's criteria anywhere but scouting; rename/delete on `/briefs`.
- A need-vs-search split, planner-slot links, badges.
- Changing scouting's table, pin or *Shortlist only*.

## Testing

Few, behaviour-only, Playwright, each kept test mutation-checked.

The seed helpers' `makePlayer` gives every player identical stats, so the
seeders gain per-player **overrides** (any player field — `Mins`, `Division`,
a per-90 stat). Briefs are seeded straight into the `archetypes` setting with
`seedSettings`.

1. **The brief page shows every pinned player, even one its filters exclude.**
   Seed strikers with distinct values of one stat, and a brief with a threshold
   on it that exactly one pinned player fails; link it to a seeded list holding
   both. `/briefs/:id` shows both rows, in list order, with the exact expected
   percentile in each heat cell.
2. **An out-of-cohort player is ranked and tagged, and the status menu warns.**
   Seed a striker with 600 minutes and a stat value placing him at a known,
   non-50 percentile in the cohort. Add him to the brief's linked list from the
   status menu on his profile → the toast names the brief and *600 minutes*; on
   the brief page his row shows the *600 min* tag and that exact percentile.

The rename adds no test: the existing archetype specs move to the new wording
and must stay green.

## Docs

`CLAUDE.md`: the *Archetypes* section becomes *Briefs* (with the fixed storage
identifiers called out), plus the two pages, the cohort-exclusion rule, the one
ranking path, the heat scale and the toast. The Historic Snapshots note that
"only `/import` never calls `useRoster()`" gains `/briefs` (the overview).
