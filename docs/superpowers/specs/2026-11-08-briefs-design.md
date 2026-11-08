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
  Not Saved* toast, and the delete-list confirm on `/lists` (*"Wingers" is the
  shortlist of …*).
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
- **Not touched**: the old `calculateArchetypes` in `src/utils/utils.ts` (the
  badge reference) and earlier spec/plan documents.
- The rename is its own commit with no behaviour change.

## Pages

Sidebar: **Briefs** right after *Scouting*. Two routes.

### `/briefs` — the overview

A table, one row per brief, grouped or sorted by role in `ROLE_CONFIG` order
(as the picker groups them), then by name.

| Column | Content |
|---|---|
| Brief | name, linking to `/briefs/:id` |
| Role | role name, plus the side when it is not *both* (*Full-back, left*) |
| Shortlist | linked list name, or a *Link list* button |
| Candidates | number of players on the linked list; blank when unlinked |

- *Link list* opens the existing `LinkListDialog` and does exactly what the
  picker's link action does (create a new list if chosen, then `setList`). That
  logic moves out of the picker into one shared helper both call.
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
  column abbreviation (*TKL ≥ 60*, *AER 40–80*, *Age ≤ 24*, *Wage ≤ 50,000*);
  the contract horizon (*contract by end of season* / *within a year* / *within
  two years*); *injury-free* when injuries are excluded; *N leagues excluded*.
  The sort is not shown.
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
  it — each of his values is placed in the cohort's sorted column, and each of
  his group sums in the cohort's sorted group sums. Nobody else's numbers move.
  His row carries one tag per reason: *620 min*, *Unranked league*, *Not a
  left full-back* (the brief's role and side in words).
- **Wrong role**: `Role`'s constructor refuses a player its `isRole` rejects. A
  wrong-role player is wrapped through a subclass of the brief's role class
  whose `isRole` accepts anyone, so his per-90s come from the same getters.
- **No stats at all** (0 minutes): blank stat cells and a *No stats* tag.
- **Absent from the active snapshot** (retired, or outside the export): a
  dimmed row with his last-known name from the list's stored identity, a
  *Not in this snapshot* tag, and a *Remove* button that takes him off the
  list — the same treatment `/lists` gives.

### Columns, left to right

1. **Player** — status badge, name linking to the profile, and the tags above.
2. **Practical** — age, club, league, wage, contract, minutes.
3. **The brief's stats** — every stat, derived stat and group with a threshold
   in `brief.filters.columnFilters` (keys `stat_*`, `derived_*`, `group_*`), in
   scouting's column order. Each header shows its threshold under the
   abbreviation (*≥ 60*, *40–80*), with the full stat name as the tooltip.
4. **The role's group ratings** — every group for the role not already in 3.
5. **All stats** — a toggle above the table. Off by default; on, it adds every
   remaining stat and derived stat for the role after the groups. Plain view
   state, gone on reload.

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

Every column sorts on header click, as in scouting; percentiles sort on the
displayed (inverted-if-needed) value. Rows with no value sort last.

## The toast

Adding a player to a list from the **status menu** (`PlayerStatusControl` — on
the profile, `/players`, `/lists`, squad tables and scouting) checks every brief
that links to that list. For each one he is outside — by `cohortExclusions`
against that brief's role class, using his record in the active snapshot — a
single warning toast lists the brief and the reasons:

> **Outside a brief's cohort** — Added to *Left-back targets*. *Attacking
> full-back*: 620 minutes. His numbers there are ranked against the cohort and
> are a rough guide.

- One toast per add, naming each brief he falls outside.
- No toast when he is inside every linked brief's cohort, when no brief links
  to the list, when the roster or league rankings are not loaded, or when he is
  not in the active snapshot.
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
  tagged *Unranked league*, no percentiles), since an empty cohort ranks
  nothing.
- **Unknown id** → *Brief not found* with a link to `/briefs`.
- Document titles: *Briefs*, *Brief: {name}*.

## Not in step 3

- Dominance (step 4), ranking / grade / verdict (step 5).
- Editing a brief's criteria anywhere but scouting; rename/delete on `/briefs`.
- A need-vs-search split, planner-slot links, badges.
- Changing scouting's table, pin or *Shortlist only*.

## Testing

Few, behaviour-only, Playwright, each kept test mutation-checked.

1. **The brief page shows every pinned player, even one its filters exclude.**
   Save a brief with a threshold, link a list, pin two players; raise the
   threshold on scouting so one no longer passes; `/briefs/:id` still shows
   both, with heat cells for the brief's stat.
2. **An out-of-cohort player is ranked and tagged, and the status menu warns.**
   Add a player outside the brief's cohort to its linked list from the status
   menu → the toast names the brief and the reason; on the brief page his row
   has percentiles and the matching tag.

The rename adds no test: the existing archetype specs move to the new wording
and must stay green.

## Docs

`CLAUDE.md`: the *Archetypes* section becomes *Briefs* (with the fixed storage
identifiers called out), plus the two pages, the cohort-exclusion rule, the heat
scale and the toast.
