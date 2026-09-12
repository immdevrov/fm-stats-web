# App scope and evidence model

Not a feature spec. This records what FM Jotter *is*, which conclusions are
settled and why, and which ideas were considered and rejected — so a future
session does not re-argue them. Two cold reviews fed into it: one reading the
codebase, one reading professional football recruitment practice. Where their
findings were checked against source, file:line is given. Where they were not,
it says so.

## The frame

**Scouting and planning are one loop, not two apps.** The board shows a gap,
scouting ranks candidates, one is signed, back to the board. The seam already
exists: the planner's candidate pool is the squad plus everything shortlisted,
and lists are where scouting deposits conclusions. This ordering is also how
professional recruitment sequences the work — squad analysis first, longlist
second. Do not relitigate.

The anxiety that started this — *"the planner waters down a scouting app"* — was
misplaced. Nothing needed to be split.

## Two layers, divided by provenance

This is a **storage** rule, and it is already in the schema.

- **Facts** — everything the import states. Recomputed on every import, arrive
  for every player unasked, restated fresh per snapshot, wiped by a *New save*.
  Live in `playerSnapshots`.
- **Opinions** — everything typed by hand. Only storable and displayable, exist
  only where the user bothered, must survive a *Same save* re-import untouched.
  Live in the annotation and list stores.

**Statistics are facts.** They may be unreplicable, they may mislead, they come
out of a simulation — they still record what happened. They are not a species of
opinion.

## The display discipline

Over the top of the storage rule sits one principle that governs presentation:

> **Never present a number with more confidence than its evidence supports.**

This does the work the layer model was straining to do, and does it correctly.
It bans star ratings. It requires a thin-minutes bar to carry its sample size.
It requires a cohort to disclose its own composition. It *permits* things the
layer model wrongly forbade — ranking a player in the snapshot where he actually
played, showing a 400-minute player against a cohort he is not a member of.

An earlier formulation — *"a feature belongs if it sits cleanly in one layer"* —
was tested and discarded. It wrongly rejects the contract horizon (shipped, and
correct) and any cross-snapshot ranking, while cheerfully admitting an overall
rating computed purely from statistics. Layer count was never the property being
objected to. Confidence is.

**A decision record is worth building.** Over a fifteen-season save the thing
that cannot be reconstructed is *why did I pass on him in 2029*. It is not a new
layer — it is the dated opinion layer applied to its highest-value case. FM has a
notes system and it is poor; this is a gap worth filling.

## Deferred

- **Trajectory / time-in-career.** Age is a fact, free, and present for every
  player including the statless. The app holds multiple snapshots and does one
  thing with them: prints raw per-90s side by side. Nothing can express "getting
  better". Real, not now.
- **"I have already reviewed this."** With a few thousand players the search is
  held in the head; with 75,000 it cannot be. Shortlists partly cover it.
  `unwanted` is the nearest thing and means something much stronger — note that
  `setUnwanted` strips the player from **every list**
  (`src/services/db/annotations.ts:136-142`), and therefore out of the planner's
  candidate pool.
- **The "412 mins" label** as a visible feature, once the two gates are split.

## Known defects

**Nine parser fields do not handle hyphens.** `Pas %`, `Asts/90`, `xA/90`,
`Pr passes/90`, `ShT/90`, `Shots Outside Box/90`, `NP-xG/90`, `xSv %` and `Sv %`
use a bare `Number()` (`src/parser/html-parser.ts:145-181`), while ~30
neighbouring fields go through `processHyphen` — which is itself the evidence
that the export writes `-`. So does `RcInjury: record["Rc Injury"] !== "-"`.
`Number("-")` is `NaN`, and that `NaN` is written to IndexedDB by `pack()`.

*Corrected 2026-09-12, verified against source.* This entry previously claimed
the `NaN` renders as a red bar at zero printing the literal string `NaN`, and
that a second-order comparator hazard was concealed by the import filter. Both
are wrong. `safeNumber` (`src/utils/utils.ts:9-15`) maps `NaN` to `0`, and every
consumer of these nine reads them only through `extract*Stats()`
(`src/types/stat-categories.ts:190,211,219,221,245,246`) — never directly. All
three cohort builders (`role-percentiles.ts:30`, `comparison-utils.ts:28`,
`scouting-engine.ts:35`) build columns from role instances, so no `NaN` reaches
`getPercentileFromSorted`. The comparator hazard is unreachable because
`safeNumber` sits between the parser and every column, not because of the
filter; removing the filter will not expose it.

**The real defect is quieter.** A statless player's `xA/90` becomes a confident
`0.00`, indistinguishable from a player measured at zero — the same lie without
the `NaN` tell. And absent means two different things: for a rate stat it means
*unmeasured*, for `Starts` and `Mins` it means *zero*. Fusing them at parse time
destroys the distinction that "minutes beside every bar" depends on.

**The visible-`NaN` risk is real but sits elsewhere.** `Starts` and `Mins` also
use a bare `Number()` (`html-parser.ts:141-144`) and, unlike the nine, are read
directly and rendered raw (`PlayerHistory.tsx:116-117`,
`PlayerProfileView.tsx:492`, `SquadTable.tsx:30`, `PlayersView.tsx:80`).

Also noted: `AssistsPer90` and `ShotsOutsideBoxPer90` are parsed, typed and
packed but read nowhere.

Verify before the full import: export one club's squad including youth, parse
it, inspect these eleven fields for a player with no appearances.

**The parser builds a full DOM.** `parseHtmlTable`
(`src/parser/html-parser.ts:50-99`) uses `DOMParser` then `querySelectorAll`.
75,000 rows by 55 required columns is roughly 4.1 million `<td>` elements,
constructed synchronously on the main thread, with the source string, the record
array and the `Player[]` all reachable at once (`ImportView.tsx:49-62`). The
spinner is set before the work and cannot animate during a blocking task. A
streaming row-by-row parse that never materialises a DOM is a contained rewrite
of one function. *Reported by review, not measured — measure first.*

**The "5+ starts" cohort rule does not exist.** `Starts` is never filtered on
anywhere; cohorts gate on `Mins >= 900` only. CLAUDE.md says 5+ starts, and
`PlayerProfileView.tsx:812` says it twenty lines below a string at `:759` that
correctly says 900+ mins. 900 minutes is the intended rule and 5 starts is a
superseded concept — **correct the documentation and the string, not the code.**
Noting for future sessions: this thesis was reasoned partly from CLAUDE.md, and
CLAUDE.md had drifted.

**Cohort-size quadratics, reported and unverified.** The goalkeeper section of
the profile re-sorts whole columns *inside* a per-player `map`
(`PlayerProfileView.tsx:627-636`), which is roughly n² log n and is not wrapped in
a transition. Similarity is n²·k. `getPercentile` (`utils.ts:158-164`) copies and
sorts a whole column once per stat key. Fine at cohorts of hundreds; reportedly
seconds of frozen tab at thousands. Only reachable by ranking more leagues —
which the ~10 playable-league ceiling limits.

**`useTransition` is not the protection CLAUDE.md claims.** It deprioritises the
resulting *render*; the callback body runs synchronously on the main thread
(`ScoutingView.tsx:345-353`, `SimilarPlayers.tsx:51-64`). Do not rely on it
against a slow function.

**`PlayerHistory` returns `null` when a player appears in only one snapshot**
(`src/components/PlayerHistory.tsx:78`), so "Rank this row" — the mechanism for
ranking a player in the snapshot where he actually played — does not render for
him at all. Each invocation also loads a second full roster (`:54`).

**misplaced data**
`lastKnownName` and `lastKnownClub` currently sit on `PlayerAnnotation`
(`src/types/annotations.ts:10-11`) and are written on every opinion write
(`src/services/db/annotations.ts:127-135`). They are imported facts in the
opinion store. **They belong in the import layer.** Until moved, the schema does
not cleanly express the split.

## Order of work

1. **Stop lying.** The nine parser fields, the cohort's undisclosed composition,
   the stale documentation. All independent of import scope, all instances of the
   app being more confident than its data.
2. **Split the two gates.** Membership versus eligibility, minutes beside every
   bar. Hands over the thin-evidence population with no import change at all.
3. **Then the import.** Parser spike first — measure the real parse against a
   real full export before designing anything.
